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
// 记住窗口位置（参考 RI 项目）
let lastWindowPosition = null; // 存储上次窗口位置 { x, y }
let lastShowAt = 0; // 记录最近一次显示时间，用于忽略刚显示时的 blur

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

// ============== 覆盖模式：暂时隐藏/恢复 BrowserView ==============
let overlayDepth = 0;
function detachBrowserView() {
  try {
    if (mainWindow && currentBrowserView) {
      mainWindow.removeBrowserView(currentBrowserView);
    }
  } catch (e) { console.error('detachBrowserView error:', e); }
}
function attachBrowserView() {
  try {
    if (mainWindow && currentBrowserView) {
      mainWindow.addBrowserView(currentBrowserView);
      updateBrowserViewBounds();
    }
  } catch (e) { console.error('attachBrowserView error:', e); }
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

  // 监听窗口移动，保存位置
  mainWindow.on('move', () => {
    if (isShowing && mainWindow) {
      const pos = mainWindow.getPosition();
      lastWindowPosition = { x: pos[0], y: pos[1] };
      console.log('窗口位置已保存:', lastWindowPosition);
    }
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

  // 添加新视图（若当前处于覆盖模式，则先不添加，仅记录，待退出覆盖时再 attach）
  try {
    currentBrowserView = view;
    if (overlayDepth > 0) {
      console.log('Overlay active; defer addBrowserView for:', providerKey);
    } else {
      mainWindow.addBrowserView(view);
      console.log('Added BrowserView for:', providerKey);
      updateBrowserViewBounds();
    }
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
  
  // 设置 BrowserView 的边界
  currentBrowserView.setBounds({
    x: sidebarWidth,
    y: topBarHeight,
    width: bounds.width - sidebarWidth,
    height: bounds.height - topBarHeight
  });

  // 禁用自动调整，完全由手动控制
  // 这样可以防止窗口大小变化时页面自动滚动到顶部
  currentBrowserView.setAutoResize({
    width: false,
    height: false
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

// 显示窗口（直接显示，不使用动画）
// 参考 RI 项目实现：https://github.com/kexin94yyds/RI.git (showOnActiveSpace 函数)
function showWindow() {
  if (!mainWindow || isShowing) return;
  
  isShowing = true;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const { width: windowWidth } = mainWindow.getBounds();
  
  // 使用上次保存的位置，如果没有则默认在右侧
  let targetX, targetY;
  if (lastWindowPosition) {
    targetX = lastWindowPosition.x;
    targetY = lastWindowPosition.y;
    console.log('使用上次保存的位置:', lastWindowPosition);
  } else {
    // 默认在右侧
    targetX = screenWidth - windowWidth;
    targetY = 0;
    lastWindowPosition = { x: targetX, y: targetY };
  }
  
  // 设置窗口位置
  mainWindow.setPosition(targetX, targetY);
  
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
  lastShowAt = Date.now(); // 记录显示时间
  
  // 3. 200ms 后还原工作区可见性，仅在当前 Space 可见
  setTimeout(() => {
    try {
      mainWindow.setVisibleOnAllWorkspaces(false);
    } catch (e) {
      console.error('还原工作区可见性失败:', e);
    }
  }, 200);
  
  console.log('窗口已显示，层级: floating（可交互）');
}

// 隐藏窗口（直接隐藏，不使用动画）
function hideWindow() {
  if (!mainWindow || !isShowing) return;
  
  // 保存当前位置
  const currentBounds = mainWindow.getBounds();
  lastWindowPosition = { x: currentBounds.x, y: currentBounds.y };
  console.log('保存窗口位置:', lastWindowPosition);
  
  mainWindow.hide();
  isShowing = false;
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
      
      // 如果提供了自定义 URL，在切换后导航到该 URL
      if (url && currentBrowserView && currentBrowserView.webContents) {
        console.log('Navigating to custom URL:', url);
        // 使用 setImmediate 确保 BrowserView 已经完全添加到窗口
        setImmediate(() => {
          try {
            if (currentBrowserView && currentBrowserView.webContents) {
              currentBrowserView.webContents.loadURL(url);
            }
          } catch (e) {
            console.error('Error loading URL:', e);
          }
        });
      }
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
      currentBrowserView = view;
      if (overlayDepth > 0) {
        console.log('Overlay active; defer addBrowserView for dynamic provider');
      } else {
        mainWindow.addBrowserView(view);
        updateBrowserViewBounds();
      }
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

// 覆盖模式 IPC
ipcMain.on('overlay-enter', () => {
  overlayDepth = Math.max(0, overlayDepth + 1);
  if (overlayDepth === 1) {
    detachBrowserView();
  }
});
ipcMain.on('overlay-exit', () => {
  overlayDepth = Math.max(0, overlayDepth - 1);
  if (overlayDepth === 0) {
    attachBrowserView();
  }
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
        // 方法1: 使用 osascript（需要"辅助功能"权限）
        exec('osascript -e "tell application \\"System Events\\" to keystroke \\"c\\" using {command down}"', (error, stdout, stderr) => {
          if (error) {
            console.log('⚠️ osascript 复制失败，尝试备用方法...');
            // 方法2: 使用 AppleScript 的另一种方式
            exec('osascript -e \'tell application "System Events" to keystroke "c" using command down\'', (error2) => {
              if (error2) {
                console.error('❌ 模拟复制失败，需要"系统设置 → 隐私与安全性 → 辅助功能"权限');
                console.error('   错误:', error2.message);
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
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
    console.log('[getSelectedText] 开始获取选中文字...');
    
    // 方法1: 尝试从 BrowserView 中直接获取选中的文字（最可靠）
    if (currentBrowserView && currentBrowserView.webContents) {
      try {
        console.log('[getSelectedText] 尝试从 BrowserView 获取...');
        
        // 先让 BrowserView 获得焦点，确保能获取到选中文字
        currentBrowserView.webContents.focus();
        await new Promise(r => setTimeout(r, 50)); // 减少等待时间，快速获取
        
        const selectedText = await currentBrowserView.webContents.executeJavaScript(`
          (function() {
            try {
              console.log('[BrowserView] 开始获取选中文字...');
              
              // 尝试多种方式获取选中文字
              let text = null;
              
              // 方法1: window.getSelection() - 最常用
              try {
                const sel = window.getSelection();
                console.log('[BrowserView] window.getSelection:', sel ? '存在' : '不存在', 'rangeCount:', sel ? sel.rangeCount : 0);
                if (sel && sel.rangeCount > 0) {
                  text = sel.toString().trim();
                  console.log('[BrowserView] 从 window.getSelection 获取:', text ? text.length + '字符' : '空');
                  if (text) {
                    return text;
                  }
                }
              } catch(e1) {
                console.log('[BrowserView] window.getSelection 失败:', e1);
              }
              
              // 方法2: document.getSelection() - 备用
              try {
                const docSel = document.getSelection();
                console.log('[BrowserView] document.getSelection:', docSel ? '存在' : '不存在', 'rangeCount:', docSel ? docSel.rangeCount : 0);
                if (docSel && docSel.rangeCount > 0) {
                  text = docSel.toString().trim();
                  console.log('[BrowserView] 从 document.getSelection 获取:', text ? text.length + '字符' : '空');
                  if (text) {
                    return text;
                  }
                }
              } catch(e2) {
                console.log('[BrowserView] document.getSelection 失败:', e2);
              }
              
              // 方法3: 检查是否有选中的文本节点（更底层的方法）
              try {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  const range = sel.getRangeAt(0);
                  text = range.toString().trim();
                  console.log('[BrowserView] 从 range 获取:', text ? text.length + '字符' : '空');
                  if (text) {
                    return text;
                  }
                }
              } catch(e3) {
                console.log('[BrowserView] range 获取失败:', e3);
              }
              
              console.log('[BrowserView] ❌ 未找到选中文字');
              return null;
            } catch(e) {
              console.error('[BrowserView] 获取选中文字异常:', e);
              return null;
            }
          })();
        `);
        
        if (selectedText && selectedText.trim()) {
          console.log('✅ 从 BrowserView 获取选中文字成功:', selectedText.length, '字符');
          console.log('   预览:', selectedText.substring(0, 50));
          return selectedText;
        } else {
          console.log('⚠️ BrowserView 中未检测到选中文字');
        }
      } catch (e) {
        console.log('❌ 从 BrowserView 获取选中文字失败:', e.message);
      }
    } else {
      console.log('⚠️ BrowserView 不存在，跳过直接获取');
    }
    
    // 方法2: 使用剪贴板方法（适用于在其他应用中选中的文字）
    console.log('[getSelectedText] 尝试使用剪贴板方法获取选中文字...');
    
    // 先读取当前剪贴板内容
    let oldClipboard = '';
    try { 
      oldClipboard = clipboard.readText(); 
      console.log('   当前剪贴板内容:', oldClipboard ? oldClipboard.substring(0, 50) + '...' : '(空)');
    } catch (_) {
      console.log('   无法读取当前剪贴板');
    }
    
    // 确保 BrowserView 有焦点，这样 Cmd+C 才能正确复制选中内容
    if (currentBrowserView && currentBrowserView.webContents) {
      currentBrowserView.webContents.focus();
      await new Promise(r => setTimeout(r, 100)); // 等待焦点稳定
    }
    
    // 尝试模拟一次系统复制
    console.log('   正在模拟 Cmd+C...');
    await simulateSystemCopy();
    
    // 增加等待时间到 600ms，给系统足够时间完成复制
    await new Promise(r => setTimeout(r, 600));
    
    // 读取剪贴板
    let text = '';
    try { 
      text = clipboard.readText(); 
      console.log('   复制后剪贴板内容:', text ? text.substring(0, 50) + '...' : '(空)');
    } catch (_) {
      console.log('   无法读取复制后的剪贴板');
    }
    
    // 如果获取到新内容，返回
    if (text && text.trim() && text !== oldClipboard) {
      console.log('✅ 从剪贴板获取选中文字成功:', text.length, '字符');
      console.log('   预览:', text.substring(0, 50));
      return text;
    }
    
    // 如果剪贴板没有变化，但有内容，可能是：
    // 1. 用户已经手动复制过了
    // 2. 模拟复制失败（需要权限）
    if (text && text.trim()) {
      if (text === oldClipboard) {
        console.log('⚠️ 剪贴板内容未变化，可能原因：');
        console.log('   1. 模拟复制失败（需要在"系统设置 → 隐私与安全性 → 辅助功能"中允许本应用）');
        console.log('   2. 没有选中文字');
        console.log('   3. 使用剪贴板现有内容:', text.length, '字符');
      } else {
        console.log('⚠️ 使用剪贴板现有内容:', text.length, '字符');
      }
      console.log('   预览:', text.substring(0, 50));
      return text;
    }
    
    console.log('❌ 未检测到选中文字');
    return '';
  } catch (e) {
    console.error('read clipboard text error:', e);
    return '';
  }
}

async function insertTextIntoCurrentView(text) {
  if (!text) {
    console.error('[insertText] 文字为空');
    return { ok:false, error:'empty' };
  }
  if (!currentBrowserView || !currentBrowserView.webContents) {
    console.error('[insertText] 没有 BrowserView');
    return { ok:false, error:'no-view' };
  }
  
  console.log('[insertText] 开始插入文字，长度:', text.length);
  console.log('[insertText] 文字预览:', text.substring(0, 100));
  
  try {
    // 尝试通过 JavaScript 注入
    const ok = await currentBrowserView.webContents.executeJavaScript(`
      (function(){
        try {
          const text = ${JSON.stringify(text)};
          console.log('[BrowserView] 开始查找输入框...');
          
          function findPromptElement(){
            // 扩展的选择器列表，包括更多可能的输入框类型
            const selectors=[
              'textarea',
              'div[contenteditable="true"]',
              '[contenteditable="true"]',
              '[role="textbox"]',
              '[aria-label*="prompt" i]',
              '[aria-label*="message" i]',
              '[aria-label*="输入" i]',
              '[data-testid*="prompt" i]',
              '[data-testid*="textbox" i]',
              '[data-testid*="composer" i]',
              '[id*="prompt" i]',
              '[id*="input" i]',
              '[id*="composer" i]',
              '[class*="composer" i]',
              '[class*="input" i]',
              '[class*="prompt" i]'
            ];
            
            for (const s of selectors){
              try {
                const els=Array.from(document.querySelectorAll(s));
                const visible=els.filter(el=>{
                  const cs=getComputedStyle(el);
                  const rect = el.getBoundingClientRect();
                  return cs.display!=='none' && 
                         cs.visibility!=='hidden' && 
                         el.offsetParent!==null &&
                         rect.width > 50 && 
                         rect.height > 20;
                });
                if (visible.length){
                  console.log('[BrowserView] 找到输入框:', s, '数量:', visible.length);
                  // 优先选择最下方的（通常是当前活动的输入框）
                  visible.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top);
                  const selected = visible[0];
                  console.log('[BrowserView] 选择输入框:', selected.tagName, selected.id, selected.className);
                  return selected;
                }
              } catch(e) {
                console.log('[BrowserView] 选择器查询失败:', s, e);
              }
            }
            console.log('[BrowserView] 未找到输入框');
            return null;
          }
          
          function setEl(el, t){
            const tag=(el.tagName||'').toLowerCase();
            console.log('[BrowserView] 尝试设置元素:', tag);
            
            // 保存当前滚动位置，防止页面跳转
            const scrollX = window.scrollX || window.pageXOffset || 0;
            const scrollY = window.scrollY || window.pageYOffset || 0;
            const elScrollTop = el.scrollTop || 0;
            
            if (tag==='textarea' || (el.value!==undefined)){
              // 使用 preventScroll 选项（如果支持）
              try {
                el.focus({ preventScroll: true });
              } catch(_) {
                el.focus();
              }
              const cur=String(el.value||'');
              const nv=cur? (cur+'\\n'+t): t;
              el.value=nv; 
              try{ el.selectionStart=el.selectionEnd=nv.length; }catch(_){}
              el.scrollTop=el.scrollHeight;
              el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true}));
              el.dispatchEvent(new Event('change',{bubbles:true}));
              
              // 恢复滚动位置
              window.scrollTo(scrollX, scrollY);
              el.scrollTop = elScrollTop;
              
              console.log('[BrowserView] textarea 设置成功');
              return true;
            }
            if (el.isContentEditable || el.getAttribute('contenteditable')==='true'){
              // 方法1: 不调用 focus，直接操作（避免页面跳转）
              try {
                const sel = window.getSelection();
                const range = document.createRange();
                
                // 移动到元素末尾
                range.selectNodeContents(el);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
                
                // 如果有现有内容，先添加换行
                if (el.textContent && el.textContent.trim()) {
                  const textNode = document.createTextNode('\\n' + t);
                  range.insertNode(textNode);
                  range.setStartAfter(textNode);
                  range.collapse(false);
                  sel.removeAllRanges();
                  sel.addRange(range);
                } else {
                  const textNode = document.createTextNode(t);
                  range.insertNode(textNode);
                  range.setStartAfter(textNode);
                  range.collapse(false);
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
                
                // 触发事件
                el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,data:t}));
                el.dispatchEvent(new Event('change',{bubbles:true}));
                
                // 恢复滚动位置
                window.scrollTo(scrollX, scrollY);
                
                console.log('[BrowserView] contenteditable 设置成功 (方法1)');
                return true;
              } catch(e1) {
                console.log('[BrowserView] 方法1失败，尝试方法2:', e1);
              }
              
              // 方法2: 使用 preventScroll 的 focus + execCommand
              try {
                try {
                  el.focus({ preventScroll: true });
                } catch(_) {
                  el.focus();
                }
                const sel=window.getSelection(); const range=document.createRange();
                range.selectNodeContents(el); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
                if (el.textContent && el.textContent.trim()) document.execCommand('insertText',false,'\\n');
                document.execCommand('insertText',false,t);
                el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true}));
                
                // 恢复滚动位置
                window.scrollTo(scrollX, scrollY);
                
                console.log('[BrowserView] contenteditable 设置成功 (方法2)');
                return true;
              } catch(e2) {
                console.log('[BrowserView] 方法2失败，尝试方法3:', e2);
              }
              
              // 方法3: 直接设置 innerText/textContent（不调用 focus）
              try {
                const cur = el.textContent || el.innerText || '';
                el.textContent = cur ? (cur + '\\n' + t) : t;
                el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true}));
                el.dispatchEvent(new Event('change',{bubbles:true}));
                
                // 恢复滚动位置
                window.scrollTo(scrollX, scrollY);
                
                console.log('[BrowserView] contenteditable 设置成功 (方法3)');
                return true;
              } catch(e3) {
                console.log('[BrowserView] 方法3失败:', e3);
              }
              
              return false;
            }
            console.log('[BrowserView] 无法识别的元素类型');
            return false;
          }
          
          const el=findPromptElement();
          if (!el) {
            console.log('[BrowserView] 未找到输入框元素');
            return false;
          }
          return setEl(el,text);
        } catch(e){ 
          console.error('[BrowserView] 插入失败:', e);
          return false; 
        }
      })();
    `);
    
    if (ok) {
      console.log('[insertText] ✅ JavaScript 注入成功');
      return { ok: true, method: 'javascript' };
    }
    
    // 如果 JavaScript 注入失败，尝试系统级粘贴
    console.log('[insertText] JavaScript 注入失败，尝试系统粘贴...');
    const oldClipboard = clipboard.readText();
    clipboard.writeText(text);
    
    try {
      currentBrowserView.webContents.focus();
      await new Promise(r => setTimeout(r, 100));
      currentBrowserView.webContents.paste();
      console.log('[insertText] ✅ 系统粘贴成功');
      
      // 恢复原剪贴板内容
      setTimeout(() => {
        try { clipboard.writeText(oldClipboard); } catch(_){}
      }, 500);
      
      return { ok: true, method: 'system-paste' };
    } catch (e) {
      console.error('[insertText] 系统粘贴失败:', e);
      return { ok: false, error: '系统粘贴失败' };
    }
  } catch (e) {
    console.error('[insertText] 异常:', e);
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
  console.log('收到 get-selected-text 请求');
  const text = await getSelectedTextAuto();
  
  if (!text) {
    const hint = process.platform === 'darwin' 
      ? '未检测到选中文字。请确保:\n1. 已选中文字\n2. 在"系统设置 → 隐私与安全性 → 辅助功能"中允许本应用\n3. 或者先手动复制文字(Cmd+C)再按快捷键'
      : '未检测到选中文字。请先选中文字，或手动复制(Ctrl+C)后再试';
    mainWindow?.webContents.send('selected-text-error', hint);
    return;
  }
  
  console.log('准备插入文字，长度:', text.length);
  mainWindow?.webContents.send('selected-text', { text });
  
  await new Promise(r => setTimeout(r, 100));
  const res = await insertTextIntoCurrentView(text);
  
  if (!res.ok) {
    console.warn('文字插入失败:', res.error);
    mainWindow?.webContents.send('selected-text-error', '文字插入失败，请手动粘贴到输入框');
  } else {
    console.log('文字插入成功');
  }
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
  console.log('');
  console.log('📝 文字注入功能已启用:');
  console.log('   - 快捷键: Command+Shift+Y (Mac) 或 Control+Shift+Y (Windows)');
  console.log('   - 用法: 选中文字后按快捷键，文字会自动注入到输入框');
  console.log('');
  console.log('⚠️  macOS 权限提示:');
  console.log('   如果文字无法自动复制，请在"系统设置 → 隐私与安全性 → 辅助功能"中');
  console.log('   添加 AI Sidebar，允许其控制电脑。这样才能自动复制选中的文字。');
  console.log('');
  
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
    
    // 先显示窗口（如果未显示）
    if (!isShowing) {
      showWindow();
      // 等待窗口显示完成
      await new Promise(r => setTimeout(r, 200));
    }
    
    // 尝试在当前聚焦应用执行复制，再读剪贴板
    const text = await getSelectedTextAuto();
    
    if (!text) {
      const hint = process.platform === 'darwin' 
        ? '未检测到选中文字。请确保:\n1. 已选中文字\n2. 在"系统设置 → 隐私与安全性 → 辅助功能"中允许本应用\n3. 或者先手动复制文字(Cmd+C)再按快捷键'
        : '未检测到选中文字。请先选中文字，或手动复制(Ctrl+C)后再按快捷键';
      mainWindow?.webContents.send('selected-text-error', hint);
      console.warn('未获取到文字');
      return;
    }
    
    console.log('准备插入文字到输入框，长度:', text.length);
    mainWindow?.webContents.send('selected-text', { text });
    
    // 等待一下确保窗口和 BrowserView 都准备好
    await new Promise(r => setTimeout(r, 100));
    
    const res = await insertTextIntoCurrentView(text);
    if (!res.ok) {
      console.warn('文字插入失败:', res.error);
      mainWindow?.webContents.send('selected-text-error', '文字插入失败，请手动粘贴到输入框');
    } else {
      console.log('文字插入成功');
    }
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
