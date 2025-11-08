const { app, BrowserWindow, BrowserView, globalShortcut, screen, ipcMain, shell, Tray, Menu, desktopCapturer, clipboard } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let isShowing = false;
let currentBrowserView = null;
const browserViews = {}; // 缓存所有 BrowserView
let tray = null;
// 自定义全宽模式（非系统原生全屏）
let isFullWidth = false;
let restoreBounds = null; // 记录进入全宽之前的窗口尺寸
// 顶部 UI 占用的预留空间（像素）
let topInset = 50; // 基础工具栏高度

// ============== 与插件数据同步（JSON 文件） ==============
const DEFAULT_SYNC_DIR = '/Users/apple/AI-sidebar 更新/AI-Sidebar';
let syncBaseDir = DEFAULT_SYNC_DIR;
function resolveSyncBaseDir() {
  try {
    const home = app.getPath('home');
    const env = process.env.AISIDEBAR_SYNC_DIR;
    const candidates = [];
    if (env && env.trim()) candidates.push(env.trim());
    candidates.push(DEFAULT_SYNC_DIR);
    candidates.push(path.join(home, 'AI-sidebar 更新', 'AI-Sidebar'));
    candidates.push(path.join(home, '全局 ai 侧边栏', 'AI-Sidebar'));
    candidates.push(path.join(process.cwd()));
    for (const base of candidates) {
      try {
        const s = path.join(base, 'sync');
        if (fs.existsSync(s)) { syncBaseDir = base; return; }
      } catch (_) {}
    }
  } catch (_) {}
  // fallback to default
  syncBaseDir = DEFAULT_SYNC_DIR;
}
function syncFolder() {
  const dir = path.join(syncBaseDir, 'sync');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}
function syncPath(name) {
  return path.join(syncFolder(), `${name}.json`);
}
function readSyncFile(name) {
  try {
    const p = syncPath(name);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (_) { return null; }
}
function writeSyncFile(name, data) {
  try {
    const p = syncPath(name);
    const tmp = p + '.tmp';
    const raw = JSON.stringify(data ?? null, null, 2);
    fs.writeFileSync(tmp, raw, 'utf8');
    fs.renameSync(tmp, p);
    lastFileContent[name] = raw;
    return true;
  } catch (e) { console.error('writeSyncFile error:', e); return false; }
}
let fileWatchers = {};
const lastFileContent = {};
function watchSyncFile(name) {
  try {
    const p = syncPath(name);
    if (fileWatchers[name]) return;
    // 初次确保文件存在
    try { if (!fs.existsSync(p)) fs.writeFileSync(p, '[]', 'utf8'); } catch (_) {}
    try { lastFileContent[name] = fs.readFileSync(p, 'utf8'); } catch (_) { lastFileContent[name] = '[]'; }
    const w = fs.watch(p, { persistent: true }, (evt) => {
      if (evt === 'change' || evt === 'rename') {
        try {
          const raw = fs.readFileSync(p, 'utf8');
          if (raw === lastFileContent[name]) return; // ignore self writes
          lastFileContent[name] = raw;
          const data = JSON.parse(raw);
          mainWindow?.webContents.send('sync-updated', { name, data });
        } catch (_) {}
      }
    });
    fileWatchers[name] = w;
  } catch (e) { console.error('watchSyncFile error:', e); }
}

// ============== 内置同步 HTTP 服务（供 Chrome 扩展调用） ==============
let httpServer = null;
const SYNC_PORT = 3456;
function startSyncHttpServer() {
  if (httpServer) return;
  try {
    httpServer = http.createServer(async (req, res) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      const url = req.url || '/';
      if (req.method === 'GET' && (url === '/ping' || url === '/status')) {
        const status = {
          ok: true,
          base: syncBaseDir,
          files: {}
        };
        try {
          const h = readSyncFile('history') || [];
          const f = readSyncFile('favorites') || [];
          status.files = { history: h.length||0, favorites: f.length||0 };
        } catch (_) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
        return;
      }
      // helper to read body
      const readBody = () => new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; if (data.length > 10*1024*1024) req.destroy(); });
        req.on('end', () => resolve(data));
        req.on('error', () => resolve(''));
      });

      if (req.method === 'POST' && (url === '/sync/history' || url === '/sync/favorites' || url === '/write')) {
        try {
          const raw = await readBody();
          let payload = {};
          try { payload = JSON.parse(raw || '{}'); } catch (_) {}
          // accept both formats:
          // 1) { name: 'history'|'favorites', data: [...] }
          // 2) direct array + endpoint by path
          let name = payload && payload.name;
          if (!name) {
            if (url.includes('history')) name = 'history';
            else if (url.includes('favorites')) name = 'favorites';
          }
          const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
          if (!name || !Array.isArray(data)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'bad-payload' }));
            return;
          }
          writeSyncFile(name, data);
          // 立即向渲染进程广播更新
          try { mainWindow?.webContents.send('sync-updated', { name, data }); } catch (_) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, name, count: data.length }));
          return;
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not-found' }));
    }).listen(SYNC_PORT); // listen on all interfaces (IPv4/IPv6)
    console.log('Sync HTTP server started at http://localhost:' + SYNC_PORT);
  } catch (e) {
    console.error('Failed to start sync HTTP server:', e);
  }
}

// AI 提供商配置
const PROVIDERS = {
  chatgpt: { url: 'https://chatgpt.com', partition: 'persist:chatgpt' },
  codex: { url: 'https://chatgpt.com/codex', partition: 'persist:chatgpt' },
  claude: { url: 'https://claude.ai', partition: 'persist:claude' },
  gemini: { url: 'https://gemini.google.com/app', partition: 'persist:gemini' },
  perplexity: { url: 'https://www.perplexity.ai', partition: 'persist:perplexity' },
  genspark: { url: 'https://www.genspark.ai/agents?type=moa_chat', partition: 'persist:genspark' },
  deepseek: { url: 'https://chat.deepseek.com', partition: 'persist:deepseek' },
  grok: { url: 'https://grok.com', partition: 'persist:grok' },
  google: { url: 'https://www.google.com/search?udm=50&aep=46&source=25q2-US-SearchSites-Site-CTA', partition: 'persist:google' },
  aistudio: { url: 'https://aistudio.google.com/apps', partition: 'persist:aistudio' },
  notebooklm: { url: 'https://notebooklm.google.com', partition: 'persist:notebooklm' },
  tongyi: { url: 'https://www.tongyi.com', partition: 'persist:tongyi' },
  doubao: { url: 'https://www.doubao.com', partition: 'persist:doubao' },
  ima: { url: 'https://ima.qq.com', partition: 'persist:ima' },
  mubu: { url: 'https://mubu.com/app/edit/home/5zT4WuoDoc0', partition: 'persist:mubu' },
  excalidraw: { url: 'https://excalidraw.com', partition: 'persist:excalidraw' },
  attention_local: { url: `file://${path.join(__dirname, 'vendor/attention/index.html')}`, partition: 'persist:attention' }
};

// 创建主窗口
function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // 窗口宽度设置为屏幕的 40%，但不超过 1200px，不小于 800px
  const windowWidth = Math.min(1200, Math.max(800, Math.floor(screenWidth * 0.4)));
  const windowHeight = screenHeight;
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth, // 初始位置在屏幕右侧外面
    y: 0,
    frame: false, // 无边框窗口
    transparent: false,
    alwaysOnTop: false, // 默认不置顶，可由用户切换
    skipTaskbar: false, // 在任务栏显示
    resizable: true, // 允许调整大小
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false // 不使用 webview 标签
    },
    show: false // 初始隐藏
  });

  // 加载 index.html（保留所有功能）
  mainWindow.loadFile('index.html');

  // 监听窗口大小变化，调整 BrowserView
  mainWindow.on('resize', () => {
    updateBrowserViewBounds();
  });

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// 获取或创建 BrowserView
function getOrCreateBrowserView(providerKey) {
  if (browserViews[providerKey]) {
    console.log('Reusing cached BrowserView for:', providerKey);
    return browserViews[providerKey];
  }

  const provider = PROVIDERS[providerKey];
  if (!provider) {
    console.error('Unknown provider:', providerKey);
    return null;
  }

  console.log('Creating new BrowserView for:', providerKey);
  
  const view = new BrowserView({
    webPreferences: {
      partition: provider.partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 允许必要的权限
      enableRemoteModule: false,
    }
  });

  // 加载 URL
  view.webContents.loadURL(provider.url);

  // 监听 URL 变化，同步到渲染进程
  view.webContents.on('did-navigate', (event, url) => {
    console.log(`BrowserView navigated: ${providerKey} - ${url}`);
    if (mainWindow) {
      mainWindow.webContents.send('browserview-url-changed', {
        providerKey,
        url,
        title: view.webContents.getTitle()
      });
    }
  });

  view.webContents.on('did-navigate-in-page', (event, url) => {
    console.log(`BrowserView in-page navigation: ${providerKey} - ${url}`);
    if (mainWindow) {
      mainWindow.webContents.send('browserview-url-changed', {
        providerKey,
        url,
        title: view.webContents.getTitle()
      });
    }
  });

  // 监听页面标题变化
  view.webContents.on('page-title-updated', (event, title) => {
    if (mainWindow) {
      mainWindow.webContents.send('browserview-url-changed', {
        providerKey,
        url: view.webContents.getURL(),
        title
      });
    }
  });

  // 调试日志
  view.webContents.on('did-finish-load', () => {
    console.log(`BrowserView loaded: ${providerKey} - ${provider.url}`);
    // 加载完成后也发送一次 URL
    if (mainWindow) {
      mainWindow.webContents.send('browserview-url-changed', {
        providerKey,
        url: view.webContents.getURL(),
        title: view.webContents.getTitle()
      });
    }
  });

  view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`BrowserView failed to load ${providerKey}:`, errorCode, errorDescription);
  });

  // 缓存
  browserViews[providerKey] = view;
  return view;
}

// 切换到指定的 provider
function switchToProvider(providerKey) {
  console.log('switchToProvider called:', providerKey, 'mainWindow:', !!mainWindow, 'isShowing:', isShowing);
  
  if (!mainWindow) {
    console.error('mainWindow not available');
    return;
  }

  // 移除当前视图
  if (currentBrowserView) {
    try {
      mainWindow.removeBrowserView(currentBrowserView);
      console.log('Removed previous BrowserView');
    } catch (e) {
      console.error('Error removing BrowserView:', e);
    }
  }

  // 获取或创建新视图
  const view = getOrCreateBrowserView(providerKey);
  if (!view) {
    console.error('Failed to get BrowserView for:', providerKey);
    return;
  }

  // 添加新视图
  try {
    mainWindow.addBrowserView(view);
    currentBrowserView = view;
    console.log('Added BrowserView for:', providerKey);
    
    // 设置视图位置
    updateBrowserViewBounds();
    
    // 通知渲染进程切换成功
    mainWindow.webContents.send('provider-switched', providerKey);
  } catch (e) {
    console.error('Error adding BrowserView:', e);
  }
}

// 更新 BrowserView 的边界
function updateBrowserViewBounds() {
  if (!mainWindow || !currentBrowserView) return;

  const bounds = mainWindow.getContentBounds();
  
  // 左侧留出 60px 给导航栏
  const sidebarWidth = 60;
  // 顶部留出空间给工具栏/面板
  const topBarHeight = Math.max(0, Math.floor(topInset || 0));
  
  currentBrowserView.setBounds({
    x: sidebarWidth,
    y: topBarHeight,
    width: bounds.width - sidebarWidth,
    height: bounds.height - topBarHeight
  });

  currentBrowserView.setAutoResize({
    width: true,
    height: true,
    vertical: {
      top: false,
      height: true
    },
    horizontal: {
      left: false,
      width: true
    }
  });
  
  console.log('Updated BrowserView bounds:', {
    x: sidebarWidth,
    y: topBarHeight,
    width: bounds.width - sidebarWidth,
    height: bounds.height - topBarHeight
  });
}

// 切换窗口为全宽/恢复
function toggleFullWidth() {
  if (!mainWindow) return;
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  if (!isFullWidth) {
    // 记录当前尺寸，并展开到当前工作区全宽（保持顶端、右缘不外溢）
    restoreBounds = mainWindow.getBounds();
    mainWindow.setBounds({ x: 0, y: 0, width: screenWidth, height: screenHeight });
    isFullWidth = true;
  } else {
    // 恢复宽度，并把窗口贴回到屏幕右侧
    const width = Math.min(restoreBounds?.width || Math.floor(screenWidth * 0.4), screenWidth);
    const height = screenHeight; // 始终贴满高度
    const x = screenWidth - width;
    mainWindow.setBounds({ x, y: 0, width, height });
    isFullWidth = false;
  }
  // 触发 BrowserView 尺寸更新
  updateBrowserViewBounds();
  try { mainWindow.webContents.send('full-width-changed', { isFullWidth }); } catch (_) {}
}

// 显示窗口（从右侧滑入）
// 参考 RI 项目实现：https://github.com/kexin94yyds/RI.git (showOnActiveSpace 函数)
function showWindow() {
  if (!mainWindow || isShowing) return;
  
  isShowing = true;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = mainWindow.getBounds().width;
  
  const targetX = screenWidth - windowWidth;
  
  mainWindow.setPosition(screenWidth, 0);
  
  // 🔑 关键：每次显示时都要设置这些，确保窗口覆盖在当前应用上
  // 参考 RI 项目的做法，不依赖状态，每次都重新设置
  try {
    // 1. 临时在所有工作区可见（含全屏），避免跳回旧 Space
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (e) {
    console.error('设置工作区可见性失败:', e);
  }
  
  try {
    // 2. 使用 floating 层级（可交互），而不是 screen-saver（太高无法交互）
    // 如果用户点击了置顶按钮，则会在按钮事件中切换到 screen-saver
    mainWindow.setAlwaysOnTop(true, 'floating');
  } catch (e) {
    console.error('设置置顶失败:', e);
  }
  
  mainWindow.show();
  mainWindow.focus();
  
  // 动画滑入
  const startX = screenWidth;
  const duration = 200;
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentX = startX - (startX - targetX) * easeProgress;
    
    mainWindow.setPosition(Math.round(currentX), 0);
    
    if (progress < 1) {
      setTimeout(animate, 16);
    } else {
      mainWindow.setPosition(targetX, 0);
      
      // 3. 200ms 后还原工作区可见性，仅在当前 Space 可见
      setTimeout(() => {
        try {
          mainWindow.setVisibleOnAllWorkspaces(false);
        } catch (e) {
          console.error('还原工作区可见性失败:', e);
        }
      }, 200);
    }
  };
  
  animate();
  
  console.log('窗口已显示，层级: floating（可交互）');
}

// 隐藏窗口（滑出到右侧）
function hideWindow() {
  if (!mainWindow || !isShowing) return;
  
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const currentBounds = mainWindow.getBounds();
  const startX = currentBounds.x;
  const targetX = screenWidth;
  
  const duration = 200;
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easeProgress = Math.pow(progress, 3);
    const currentX = startX + (targetX - startX) * easeProgress;
    
    mainWindow.setPosition(Math.round(currentX), 0);
    
    if (progress < 1) {
      setTimeout(animate, 16);
    } else {
      mainWindow.hide();
      isShowing = false;
    }
  };
  
  animate();
}

// 切换窗口显示/隐藏
function toggleWindow() {
  if (!mainWindow) return;
  
  if (isShowing) {
    hideWindow();
  } else {
    showWindow();
  }
}

// 系统托盘用于兜底唤起
function setupTray() {
  try {
    if (tray) return; // 已存在
    const iconPath = path.join(__dirname, 'images', 'icon16.png');
    tray = new Tray(iconPath);
    tray.setToolTip('AI Sidebar');
    const menu = Menu.buildFromTemplate([
      { label: '显示/隐藏侧边栏', click: () => toggleWindow() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => toggleWindow());
  } catch (e) {
    console.error('创建托盘失败:', e);
  }
}

// IPC 事件处理
ipcMain.on('switch-provider', (event, payload) => {
  try {
    const providerKey = (typeof payload === 'object' && payload && payload.key) ? payload.key : payload;
    const url = (typeof payload === 'object' && payload && payload.url) ? payload.url : null;
    console.log('IPC received switch-provider:', providerKey, url ? `(url: ${url})` : '');

    if (PROVIDERS[providerKey]) {
      switchToProvider(providerKey);
      return;
    }

    // 支持临时/自定义 provider（PROVIDERS 中没有时）
    if (url) {
      // 动态创建一个临时视图
      console.log('Switching to dynamic provider:', providerKey, url);
      
      // 移除当前视图
      if (currentBrowserView) {
        try { mainWindow.removeBrowserView(currentBrowserView); } catch (e) { console.error('Error removing view:', e); }
      }
      
      const view = new BrowserView({
        webPreferences: {
          partition: 'persist:' + (providerKey || 'custom'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          enableRemoteModule: false,
        }
      });
      view.webContents.loadURL(url);
      mainWindow.addBrowserView(view);
      currentBrowserView = view;
      updateBrowserViewBounds();
      mainWindow.webContents.send('provider-switched', providerKey || 'custom');
      return;
    }

    console.warn('Unknown provider and missing URL:', providerKey);
  } catch (e) {
    console.error('switch-provider handler error:', e);
  }
});

// 在 Chrome 浏览器中打开链接
ipcMain.on('open-in-browser', (event, url) => {
  console.log('Opening in Chrome:', url);
  
  // macOS 上 Chrome 的路径
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  
  // 检查 Chrome 是否存在
  if (fs.existsSync(chromePath)) {
    exec(`"${chromePath}" "${url}"`, (error) => {
      if (error) {
        console.error('Failed to open in Chrome:', error);
        // 如果失败，使用系统默认浏览器
        shell.openExternal(url);
      }
    });
  } else {
    // 如果没有 Chrome，使用系统默认浏览器
    console.log('Chrome not found, using default browser');
    shell.openExternal(url);
  }
});

ipcMain.on('get-current-url', (event) => {
  if (currentBrowserView) {
    const url = currentBrowserView.webContents.getURL();
    event.reply('current-url', url);
  } else {
    event.reply('current-url', null);
  }
});

// 全宽切换与状态查询
ipcMain.on('toggle-full-width', () => {
  toggleFullWidth();
});
ipcMain.on('get-full-width-state', (event) => {
  event.reply('full-width-state', { isFullWidth });
});

// 设置顶部预留空间（由渲染进程计算需要的像素）
ipcMain.on('set-top-inset', (event, px) => {
  try {
    const bounds = mainWindow ? mainWindow.getContentBounds() : null;
    const maxAllowed = bounds ? Math.max(0, bounds.height - 50) : 2000;
    const next = Math.max(0, Math.min(parseInt(px || 0, 10), maxAllowed));
    if (next !== topInset) {
      topInset = next;
      updateBrowserViewBounds();
    }
  } catch (_) {}
});

// ============== 截屏与文字注入（自动送入输入框） ==============
async function captureScreen() {
  try {
    // 使用主屏幕分辨率作为缩略图尺寸
    const displaySize = screen.getPrimaryDisplay().size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: displaySize });
    if (!sources || sources.length === 0) return null;
    const source = sources[0];
    const image = source.thumbnail; // NativeImage
    try { clipboard.writeImage(image); } catch (_) {}
    return { dataUrl: image.toDataURL(), createdAt: Date.now() };
  } catch (e) {
    console.error('captureScreen error:', e);
    return null;
  }
}

async function insertImageIntoCurrentView(dataUrl) {
  if (!currentBrowserView || !currentBrowserView.webContents) return { ok:false, error:'no-view' };
  try { currentBrowserView.webContents.focus(); } catch (_) {}
  try {
    const result = await currentBrowserView.webContents.executeJavaScript(`
      (async function() {
        try {
          const dataUrl = ${JSON.stringify('')};
          const real = ${JSON.stringify(dataUrl)};
          const resp = await fetch(real);
          const blob = await resp.blob();
          const file = new File([blob], 'screenshot-' + Date.now() + '.png', { type: blob.type || 'image/png' });
          function findPromptElement() {
            const selectors = [
              'textarea',
              'div[contenteditable="true"]',
              '[role="textbox"]',
              '[aria-label*="prompt" i]',
              '[data-testid*="prompt" i]',
              '[data-testid*="textbox" i]'
            ];
            for (const selector of selectors) {
              const els = Array.from(document.querySelectorAll(selector));
              const visible = els.filter(el => {
                const s = window.getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
              });
              if (visible.length) {
                visible.sort((a,b)=>b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                return visible[0];
              }
            }
            return null;
          }
          const el = findPromptElement();
          if (!el) return { ok:false, error:'no-input' };
          try { el.focus(); } catch(_){}

          // 1) 模拟粘贴事件
          try {
            const dt = new DataTransfer();
            dt.items.add(file);
            const e = new ClipboardEvent('paste', { bubbles:true, cancelable:true });
            try { Object.defineProperty(e, 'clipboardData', { get: () => dt }); } catch (_) {}
            const pasted = el.dispatchEvent(e);
            if (!pasted) return { ok:true, method:'clipboard-event' };
          } catch (_) {}

          // 2) 模拟拖拽
          try {
            const dt = new DataTransfer();
            dt.items.add(file);
            const rect = el.getBoundingClientRect();
            const clientX = Math.max(rect.left + 10, 0);
            const clientY = Math.max(rect.top + 10, 0);
            const ev1 = new DragEvent('dragenter', { bubbles:true, cancelable:true, clientX, clientY });
            const ev2 = new DragEvent('dragover', { bubbles:true, cancelable:true, clientX, clientY });
            const ev3 = new DragEvent('drop', { bubbles:true, cancelable:true, clientX, clientY });
            try { Object.defineProperty(ev1, 'dataTransfer', { get: () => dt }); Object.defineProperty(ev2, 'dataTransfer', { get: () => dt }); Object.defineProperty(ev3, 'dataTransfer', { get: () => dt }); } catch (_) {}
            el.dispatchEvent(ev1);
            el.dispatchEvent(ev2);
            const ok = el.dispatchEvent(ev3);
            if (!ok) return { ok:true, method:'drag-drop' };
          } catch (_) {}

          // 3) 直接 file input
          try {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            for (const input of inputs) {
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              input.dispatchEvent(new Event('change', { bubbles:true }));
              return { ok:true, method:'file-input' };
            }
          } catch (_) {}
          return { ok:false, error:'all-methods-failed' };
        } catch (e) {
          return { ok:false, error: String(e && e.message || e) };
        }
      })();
    `);
    if (result && result.ok) return result;
    // 兜底用系统级粘贴
    try { currentBrowserView.webContents.paste(); return { ok:true, method:'system-paste' }; } catch (e) { return { ok:false, error:String(e) }; }
  } catch (e) {
    return { ok:false, error:String(e) };
  }
}

function simulateSystemCopy() {
  return new Promise((resolve) => {
    try {
      if (process.platform === 'darwin') {
        // 通过 AppleScript 发送 Cmd+C（需要“辅助功能”权限）
        exec('osascript -e "tell application \"System Events\" to keystroke \"c\" using {command down}"', () => resolve());
      } else if (process.platform === 'win32') {
        // PowerShell 发送 Ctrl+C
        const cmd = 'powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'^c\')"';
        exec(cmd, () => resolve());
      } else {
        // Linux: xdotool（若不可用则直接返回）
        exec('which xdotool >/dev/null 2>&1 && xdotool key --clearmodifiers ctrl+c', () => resolve());
      }
    } catch (_) { resolve(); }
  });
}

async function getSelectedTextAuto() {
  try {
    let text = '';
    try { text = clipboard.readText(); } catch (_) {}
    if (text && text.trim()) return text;
    // 尝试模拟一次系统复制
    await simulateSystemCopy();
    await new Promise(r => setTimeout(r, 140));
    try { text = clipboard.readText(); } catch (_) {}
    return (text && text.trim()) ? text : '';
  } catch (e) {
    console.error('read clipboard text error:', e);
    return '';
  }
}

async function insertTextIntoCurrentView(text) {
  if (!text) return { ok:false, error:'empty' };
  if (!currentBrowserView || !currentBrowserView.webContents) return { ok:false, error:'no-view' };
  try {
    const ok = await currentBrowserView.webContents.executeJavaScript(`
      (function(){
        try {
          const text = ${JSON.stringify(text)};
          function findPromptElement(){
            const selectors=['textarea','div[contenteditable="true"]','[role="textbox"]','[aria-label*="prompt" i]','[data-testid*="prompt" i]','[data-testid*="textbox" i]'];
            for (const s of selectors){
              const els=Array.from(document.querySelectorAll(s));
              const visible=els.filter(el=>{const cs=getComputedStyle(el);return cs.display!=='none' && cs.visibility!=='hidden' && el.offsetParent!==null;});
              if (visible.length){visible.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top);return visible[0];}
            }
            return null;
          }
          function setEl(el, t){
            const tag=(el.tagName||'').toLowerCase();
            if (tag==='textarea' || (el.value!==undefined)){
              el.focus();
              const cur=String(el.value||'');
              const nv=cur? (cur+'\n'+t): t;
              el.value=nv; try{ el.selectionStart=el.selectionEnd=nv.length; }catch(_){}
              el.scrollTop=el.scrollHeight;
              el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true}));
              el.dispatchEvent(new Event('change',{bubbles:true}));
              return true;
            }
            if (el.isContentEditable || el.getAttribute('contenteditable')==='true'){
              el.focus();
              const sel=window.getSelection(); const range=document.createRange();
              range.selectNodeContents(el); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
              if (el.textContent && el.textContent.trim()) document.execCommand('insertText',false,'\n');
              document.execCommand('insertText',false,t);
              el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true}));
              return true;
            }
            return false;
          }
          const el=findPromptElement();
          if (!el) return false;
          return setEl(el,text);
        } catch(e){ return false; }
      })();
    `);
    return { ok: !!ok };
  } catch (e) {
    return { ok:false, error:String(e) };
  }
}

// renderer 请求截屏
ipcMain.on('capture-screenshot', async () => {
  // 无闪烁截屏：启用内容保护，避免把本窗口捕获进去
  try { mainWindow?.setContentProtection(true); } catch (_) {}
  await new Promise(r=> setTimeout(r, 30));
  const shot = await captureScreen();
  try { mainWindow?.setContentProtection(false); } catch (_) {}
  if (!shot) { mainWindow?.webContents.send('screenshot-error', 'capture-failed'); return; }
  mainWindow.webContents.send('screenshot-captured', { ...shot, autoPasted: true });
  const res = await insertImageIntoCurrentView(shot.dataUrl);
  mainWindow.webContents.send('screenshot-auto-paste-result', res.ok ? { ok:true } : { ok:false, error: res.error||'unknown' });
});

// renderer 请求读取选中文字
ipcMain.on('get-selected-text', async () => {
  const text = await getSelectedTextAuto();
  if (!text) { mainWindow?.webContents.send('selected-text-error', '未检测到剪贴板文字'); return; }
  mainWindow?.webContents.send('selected-text', { text });
  const res = await insertTextIntoCurrentView(text);
  if (!res.ok) console.warn('insert text failed:', res.error);
});

// 置顶切换
// 参考 RI 项目实现：https://github.com/kexin94yyds/RI.git
ipcMain.on('toggle-always-on-top', (event) => {
  if (!mainWindow) return;
  
  const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
  const newState = !isAlwaysOnTop;
  
  // 设置窗口置顶，并指定窗口层级
  // 'floating' 层级：浮在普通窗口之上（可交互）- 默认使用
  // 'screen-saver' 层级：浮在所有窗口之上（包括全屏应用，但可能难以交互）- 极端置顶模式
  
  if (newState) {
    // 开启置顶：使用 screen-saver 层级，实现真正的"覆盖所有应用"
    try {
      // 临时在所有工作区可见（包括全屏应用）
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // 200ms 后还原工作区可见性
      setTimeout(() => {
        try {
          mainWindow.setVisibleOnAllWorkspaces(false);
        } catch (e) {
          console.error('还原工作区可见性失败:', e);
        }
      }, 200);
      
      console.log('Always on top: true (level: screen-saver) - 极端置顶模式');
    } catch (e) {
      console.error('设置置顶失败:', e);
      // 降级：使用 floating 层级
      mainWindow.setAlwaysOnTop(true, 'floating');
      console.log('Always on top: true (level: floating) - 降级模式');
    }
  } else {
    // 关闭置顶：恢复 floating 层级（保持覆盖在当前应用上，但可交互）
    try {
      mainWindow.setAlwaysOnTop(true, 'floating');
      mainWindow.setVisibleOnAllWorkspaces(false);
      console.log('Always on top: false -> floating (保持浮动，可交互)');
    } catch (e) {
      console.error('恢复 floating 失败:', e);
    }
  }
  
  // 通知渲染进程当前状态
  event.reply('always-on-top-changed', newState);
});

// 获取当前置顶状态
ipcMain.on('get-always-on-top', (event) => {
  if (!mainWindow) {
    event.reply('always-on-top-status', false);
    return;
  }
  
  event.reply('always-on-top-status', mainWindow.isAlwaysOnTop());
});

// 应用准备就绪
app.whenReady().then(() => {
  createWindow();
  setupTray();
  // 解析并准备同步目录
  try { resolveSyncBaseDir(); } catch (_) {}
  // 启动文件同步监控
  try { syncFolder(); watchSyncFile('favorites'); watchSyncFile('history'); } catch (_) {}
  // 启动内置同步 HTTP 服务
  startSyncHttpServer();
  
  // 注册多组全局快捷键，避免冲突
  const primaryHotkey = 'Alt+Space';
  const fallbackHotkey = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space';
  const extraHotkey = 'F13';

  const ok1 = globalShortcut.register(primaryHotkey, () => {
    console.log('全局快捷键触发：', primaryHotkey);
    toggleWindow();
  });
  const ok2 = globalShortcut.register(fallbackHotkey, () => {
    console.log('全局快捷键触发（备用）：', fallbackHotkey);
    toggleWindow();
  });
  const ok3 = globalShortcut.register(extraHotkey, () => {
    console.log('全局快捷键触发（备用2）：', extraHotkey);
    toggleWindow();
  });

  if (!ok1) console.error('主快捷键注册失败：', primaryHotkey);
  if (!ok2) console.warn('备用快捷键注册失败：', fallbackHotkey);
  if (!ok3) console.warn('备用快捷键注册失败：', extraHotkey);

  console.log('快捷键状态:', {
    [primaryHotkey]: globalShortcut.isRegistered(primaryHotkey),
    [fallbackHotkey]: globalShortcut.isRegistered(fallbackHotkey),
    [extraHotkey]: globalShortcut.isRegistered(extraHotkey)
  });
  console.log('应用已启动！按 Option+Space 或 Shift+Cmd/Ctrl+Space（或 F13）呼出侧边栏');
  
  // ============== 截屏/文字 全局快捷键 ==============
  const screenshotKey = process.platform === 'darwin' ? 'Command+Shift+K' : 'Control+Shift+K';
  const textKey = process.platform === 'darwin' ? 'Command+Shift+Y' : 'Control+Shift+Y';
  const gotShot = globalShortcut.register(screenshotKey, async () => {
    console.log('截屏快捷键触发:', screenshotKey);
    // 无闪烁截屏：启用内容保护，避免把本窗口捕获进去
    try { mainWindow?.setContentProtection(true); } catch (_) {}
    await new Promise(r=> setTimeout(r, 30));
    const shot = await captureScreen();
    try { mainWindow?.setContentProtection(false); } catch (_) {}
    if (!isShowing) showWindow();
    if (!shot) { mainWindow?.webContents.send('screenshot-error', 'capture-failed'); return; }
    mainWindow?.webContents.send('screenshot-captured', { ...shot, autoPasted: true });
    const res = await insertImageIntoCurrentView(shot.dataUrl);
    mainWindow?.webContents.send('screenshot-auto-paste-result', res.ok ? { ok:true } : { ok:false, error: res.error||'unknown' });
  });
  if (!gotShot) console.error('截图快捷键注册失败:', screenshotKey);

  const gotText = globalShortcut.register(textKey, async () => {
    console.log('文字选择快捷键触发:', textKey);
    // 先尝试在当前聚焦应用执行复制，再读剪贴板
    const text = await getSelectedTextAuto();
    if (!text) { mainWindow?.webContents.send('selected-text-error', '未检测到剪贴板文字'); return; }
    if (!isShowing) showWindow();
    mainWindow?.webContents.send('selected-text', { text });
    const res = await insertTextIntoCurrentView(text);
    if (!res.ok) console.warn('insert text failed:', res.error);
  });
  if (!gotText) console.error('文字选择快捷键注册失败:', textKey);
  
  // 首次启动时显示窗口并加载默认 provider
  setTimeout(() => {
    showWindow();
    switchToProvider('chatgpt');
  }, 500);
});

// macOS 特定：点击 Dock 图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    showWindow();
  }
});

// ============== 文件同步 IPC ==============
ipcMain.on('sync-set-base', (e, dir) => {
  try {
    if (typeof dir === 'string' && dir.trim()) syncBaseDir = dir;
    syncFolder(); // ensure exists
  } catch (_) {}
});
ipcMain.on('sync-read', (e, payload) => {
  const name = payload && payload.name;
  const data = name ? readSyncFile(name) : null;
  e.sender.send('sync-read-resp', { name, data });
});
ipcMain.on('sync-write', (e, payload) => {
  try {
    const name = payload && payload.name;
    const data = payload && payload.data;
    if (!name) return;
    writeSyncFile(name, data);
  } catch (err) {
    console.error('sync-write error:', err);
  }
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
