const { app, BrowserWindow, BrowserView, globalShortcut, screen, ipcMain, shell, Tray, Menu, desktopCapturer, clipboard } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');

// ============== 网络兼容性选项（可选） ==============
// 某些网络/代理设备（尤其是不支持 ECH/HTTPS SVCB 或对 TLS1.3 有兼容性问题的环境）
// 可能导致特定站点（如 gemini.google.com）在 Electron/Chromium 中握手失败（ERR_CONNECTION_CLOSED/-100）。
// 下面的开关允许在需要时通过环境变量启用网络兼容模式：
//  - AISB_NET_COMPAT=1            禁用 ECH/SVCB/QUIC，且将最小 TLS 版本设为 TLS1.2
//  - AISB_DISABLE_ECH=1           仅禁用 ECH/SVCB
//  - AISB_IGNORE_CERT_ERRORS=1    忽略证书错误（仅调试用，勿在生产中使用）
//  - AISB_NETLOG=/path/netlog.json  记录 Chromium 网络日志，便于排查
try {
  const compat = process.env.AISB_NET_COMPAT === '1';
  const disableECH = process.env.AISB_DISABLE_ECH === '1';
  if (compat || disableECH) {
    // 禁用 Encrypted ClientHello 与 HTTPS/SVCB 记录解析（部分中间盒/代理无法处理）
    app.commandLine.appendSwitch('disable-features', 'EncryptedClientHello,UseDnsHttpsSvcb');
  }
  if (compat) {
    // 某些代理对 TLS1.3/QUIC 兼容性差，禁用 QUIC 并将最小版本设为 TLS1.2（避免 1.3 特性）
    app.commandLine.appendSwitch('disable-quic');
    app.commandLine.appendSwitch('ssl-version-min', 'tls1.2');
  }
  if (process.env.AISB_IGNORE_CERT_ERRORS === '1') {
    app.commandLine.appendSwitch('ignore-certificate-errors');
  }
  if (process.env.AISB_NETLOG && String(process.env.AISB_NETLOG).trim()) {
    app.commandLine.appendSwitch('log-net-log', String(process.env.AISB_NETLOG).trim());
  }
} catch (_) {}

// 仅记录证书错误，帮助定位（不自动放行）
try {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.error('[CERTIFICATE_ERROR]', { url, error });
    // 默认拒绝，保持安全（若调试需要跳过，请设置 AISB_IGNORE_CERT_ERRORS=1 以启用 Chromium 开关）
    callback(false);
  });
} catch (_) {}

let mainWindow = null;
let isShowing = false;
let currentBrowserView = null;
const browserViews = {}; // 缓存所有 BrowserView
let tray = null;
let currentProviderKey = 'chatgpt'; // 跟踪当前 provider
// 内嵌浏览器相关
let embeddedBrowserView = null; // 内嵌浏览器视图（用于显示链接或右侧打开 AI）
let embeddedBrowserPartition = 'persist:embedded-browser'; // 当前右侧视图所用的分区（用于实现与左侧的登录互通）
let previousBrowserView = null; // 保存打开内嵌浏览器前的 BrowserView
let isEmbeddedBrowserActive = false; // 标记内嵌浏览器是否激活
// 第三屏视图
let thirdBrowserView = null;
let thirdBrowserPartition = 'persist:third';
let isThreeScreenMode = false;
let threeSplitR1 = 1/3; // 左列在 free 宽度中的占比
let threeSplitR2 = 1/3; // 中列在 free 宽度中的占比
// 跟踪最近获得焦点的 BrowserView（用于定向刷新）
let lastFocusedBrowserView = null;
// 最近一次用于 Tab 切换的目标侧（'left' / 'right' / 'third'），用于“强制切换”体验
let lastTabTargetSide = 'left'; // 'left' | 'right' | 'third'
// 显式锁定 Tab 切换的目标侧：'left' | 'right' | 'third' | null（不锁定）
let forcedTabSide = null;
// 当 BrowserView 已处理 Tab 时，短暂抑制主窗口的全局 Tab 处理，避免双触发
let suppressGlobalTabUntilTs = 0;
function suppressGlobalTab(ms = 140) {
  try { suppressGlobalTabUntilTs = Date.now() + Math.max(60, Math.min(400, ms||140)); } catch (_) {}
}
let splitRatio = 0.5; // 分屏比例（0-1，0.5 表示各占一半）
// 分割线命中区域（与渲染进程中的 .split-divider 保持一致）
const DIVIDER_GUTTER = 24; // px，左右各一半作为留白，便于拖动
// 左侧 provider tabs 实际宽度（渲染层动态汇报，折叠时为 0）
let sidebarWidthPx = 60;
// 自定义全宽模式（非系统原生全屏）
let isFullWidth = false;
let restoreBounds = null; // 记录进入全宽之前的窗口尺寸
// 顶部 UI 占用的预留空间（像素）
let topInset = 50; // 基础工具栏高度
// 记住窗口位置（参考 RI 项目）
let lastWindowPosition = null; // 存储上次窗口位置 { x, y }
let lastShowAt = 0; // 记录最近一次显示时间，用于忽略刚显示时的 blur
let isInsertingText = false; // 标记是否正在插入文本，防止窗口位置被意外修改
let windowPositionLock = false; // 窗口位置锁定标志，防止在特定操作时位置被改变

// 统一获取“当前可注入的 AI 视图”
// 逻辑：优先最近聚焦的视图；分屏时若右侧有焦点则返回右侧，否则返回左侧；
// 非分屏时返回当前视图。
function getActiveAiView() {
  try {
    return getTargetViewForAction();
  } catch (_) { return currentBrowserView; }
}

// Helper: get the LEFT view when split is active; otherwise current view
function getLeftAiView() {
  try {
    if (isEmbeddedBrowserActive && previousBrowserView) return previousBrowserView;
    return currentBrowserView || previousBrowserView || null;
  } catch (_) { return null; }
}

// Helper: get the RIGHT embedded view (if any)
function getRightAiView() {
  try { return (isEmbeddedBrowserActive && embeddedBrowserView) ? embeddedBrowserView : null; } catch (_) { return null; }
}

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

// 仅刷新当前活动区域，不刷新整个窗口或重置分割线
function reloadActivePane(ignoreCache = false) {
  try {
    const target = getTargetViewForAction();
    if (!target || !target.webContents) return;
    if (ignoreCache && typeof target.webContents.reloadIgnoringCache === 'function') {
      target.webContents.reloadIgnoringCache();
    } else {
      target.webContents.reload();
    }
  } catch (e) {
    console.error('reloadActivePane error:', e);
  }
}

// 选择当前操作（如 Open in Tab / 刷新）应作用的视图
function getTargetViewForAction() {
  try {
    // 首选最近聚焦的 BrowserView
    let target = lastFocusedBrowserView;
    const views = mainWindow?.getBrowserViews() || [];
    if ((isEmbeddedBrowserActive && embeddedBrowserView && previousBrowserView) || (isThreeScreenMode && thirdBrowserView)) {
      const left = previousBrowserView || currentBrowserView;
      const mid = embeddedBrowserView;
      const right2 = thirdBrowserView;
      if (!target || !views.includes(target)) {
        if (right2?.webContents?.isFocused && right2.webContents.isFocused()) {
          target = right2;
        } else if (mid?.webContents?.isFocused && mid.webContents.isFocused()) {
          target = mid;
        } else if (left?.webContents?.isFocused && left.webContents.isFocused()) {
          target = left;
        } else {
          // 默认优先中间（嵌入浏览器），其次第三屏
          target = mid || right2 || left;
        }
      }
      return target;
    }
    // 非分屏：返回当前 AI 视图
    return currentBrowserView || target;
  } catch (e) {
    return currentBrowserView;
  }
}

// ============== 覆盖模式：暂时隐藏/恢复 BrowserView ==============
let overlayDepth = 0;
function ensureBrowserViewsAttached(where = 'unspecified') {
  try {
    if (!mainWindow) return;
    const views = mainWindow.getBrowserViews();
    if ((isEmbeddedBrowserActive && embeddedBrowserView && previousBrowserView) || (isThreeScreenMode && thirdBrowserView)) {
      const needLeft = previousBrowserView && !views.includes(previousBrowserView);
      const needMid = embeddedBrowserView && !views.includes(embeddedBrowserView);
      const needRight2 = thirdBrowserView && !views.includes(thirdBrowserView);
      if (needLeft) { try { mainWindow.addBrowserView(previousBrowserView); } catch (_) {} }
      if (needMid) { try { mainWindow.addBrowserView(embeddedBrowserView); } catch (_) {} }
      if (needRight2) { try { mainWindow.addBrowserView(thirdBrowserView); } catch (_) {} }
      if (needLeft || needMid || needRight2) updateBrowserViewBounds();
      if (needLeft || needMid || needRight2) console.log('[EnsureAttach] split/three re-attached by', where);
    } else if (currentBrowserView) {
      const need = !views.includes(currentBrowserView);
      if (need) {
        try { mainWindow.addBrowserView(currentBrowserView); } catch (_) {}
        updateBrowserViewBounds();
        console.log('[EnsureAttach] single view re-attached by', where);
      }
    }
  } catch (e) { console.warn('[EnsureAttach] error:', e); }
}
function detachBrowserView() {
  try {
    if (!mainWindow) return;
    if (isEmbeddedBrowserActive || isThreeScreenMode) {
      // 分屏/三分屏：移除现有视图
      try { if (embeddedBrowserView) mainWindow.removeBrowserView(embeddedBrowserView); } catch (_) {}
      try { if (previousBrowserView) mainWindow.removeBrowserView(previousBrowserView); } catch (_) {}
      try { if (thirdBrowserView) mainWindow.removeBrowserView(thirdBrowserView); } catch (_) {}
    } else if (currentBrowserView) {
      // 单视图模式：只移除当前视图
      try { mainWindow.removeBrowserView(currentBrowserView); } catch (_) {}
    }
    try { mainWindow.webContents.send('overlay-browserview', { action: 'detach', ts: Date.now() }); } catch (_) {}
  } catch (e) { console.error('detachBrowserView error:', e); }
}
function attachBrowserView() {
  try {
    if (!mainWindow) return;
    if ((isEmbeddedBrowserActive && embeddedBrowserView && previousBrowserView) || (isThreeScreenMode && thirdBrowserView)) {
      // 分屏/三分屏：恢复现有视图
      try { if (previousBrowserView) mainWindow.addBrowserView(previousBrowserView); } catch (_) {}
      try { if (embeddedBrowserView) mainWindow.addBrowserView(embeddedBrowserView); } catch (_) {}
      try { if (thirdBrowserView) mainWindow.addBrowserView(thirdBrowserView); } catch (_) {}
      updateBrowserViewBounds();
    } else if (currentBrowserView) {
      // 单视图模式：恢复当前视图
      try { mainWindow.addBrowserView(currentBrowserView); } catch (_) {}
      updateBrowserViewBounds();
    }
    try { mainWindow.webContents.send('overlay-browserview', { action: 'attach', ts: Date.now() }); } catch (_) {}
    // 再次确认已挂载
    ensureBrowserViewsAttached('attachBrowserView');
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
  try { mainWindow.webContents.setMaxListeners(0); } catch (_) {}

  // 加载 index.html（保留所有功能）
  mainWindow.loadFile('index.html');

  // 监听窗口大小变化，调整 BrowserView
  mainWindow.on('resize', () => {
    updateBrowserViewBounds();
    ensureBrowserViewsAttached('resize');
    // 移除尺寸显示（如果存在）
    try {
      // 使用 IIFE 避免在全局重复声明变量导致 SyntaxError（控制台出现 "Identifier 'x' has already been declared"）
      mainWindow.webContents.executeJavaScript(`(() => {
        const el = document.getElementById('window-size-indicator');
        if (el) el.remove();
      })();`).catch(() => {});
    } catch (_) {}
  });

  // 窗口获得焦点时通知渲染进程做输入框回焦
  try {
    mainWindow.on('focus', () => {
      const pos = mainWindow.getPosition();
      const bounds = mainWindow.getBounds();
      const isOnTop = mainWindow.isAlwaysOnTop();
      
      // 🔍 关键修复：如果窗口位置被锁定，检查并恢复位置
      if (windowPositionLock && lastWindowPosition) {
        if (pos[0] !== lastWindowPosition.x || pos[1] !== lastWindowPosition.y) {
          console.warn('[WINDOW_FOCUS] ⚠️ 焦点变化时位置被改变，强制恢复:', {
            expected: lastWindowPosition,
            actual: { x: pos[0], y: pos[1] }
          });
          mainWindow.setPosition(lastWindowPosition.x, lastWindowPosition.y);
        }
      }
      
      console.log('[WINDOW_FOCUS] 窗口获得焦点:', {
        position: { x: pos[0], y: pos[1] },
        bounds: bounds,
        isAlwaysOnTop: isOnTop,
        locked: windowPositionLock,
        timestamp: Date.now()
      });
      // 🔍 关键：焦点变化时不要重新设置窗口位置或层级，避免跳动
      // 只在必要时通知渲染进程
      try { mainWindow.webContents.send('app-focus', { ts: Date.now() }); } catch (_) {}
      // 聚焦时补挂视图，避免白屏
      ensureBrowserViewsAttached('window-focus');
    });
  } catch (_) {}
  
  // 拦截窗口级快捷键：
  // - Tab/Shift+Tab → 强制切换 AI Provider（无论当前焦点是否在视图内）
  // - Cmd/Ctrl+R、Shift+Cmd/Ctrl+R、F5 → 刷新当前焦点区域
  try {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      try {
        if (input && input.type === 'keyDown') {
          // 全局 Tab 捕获：确保在顶部 UI 或任何非 BrowserView 焦点下也能切换
          if (input.key === 'Tab' && !input.alt && !input.control && !input.meta) {
            event.preventDefault();
            // 若 BrowserView 已经处理了本次 Tab，跳过全局处理，避免左右来回出现“平衡跳动”
            if (Date.now() < suppressGlobalTabUntilTs) return;
            const dir = input.shift ? -1 : 1;
            // 优先使用显式锁定；否则使用最近一次目标侧，避免焦点漂移
            cycleToNextProvider(dir, forcedTabSide || lastTabTargetSide);
            return;
          }

          const isReloadKey = (
            ((input.key === 'r' || input.key === 'R') && (input.meta || input.control)) ||
            (input.key === 'F5')
          );
          if (isReloadKey) {
            event.preventDefault();
            const hard = !!input.shift;
            reloadActivePane(hard);
          }
        }
      } catch (_) {}
    });
  } catch (_) {}

  // 🔍 参考 Full-screen-prompt 项目：延迟检查，忽略刚显示后的短暂失焦
  try {
    mainWindow.on('blur', () => {
      // 刚显示后的短暂失焦（切 Space/全屏/层级切换）容易导致瞬间隐藏，需忽略
      const elapsed = Date.now() - lastShowAt;
      if (elapsed < 800) {
        console.log('[WINDOW_BLUR] 忽略刚显示后的短暂失焦，距离显示:', elapsed, 'ms');
        return;
      }
      
      // 不在这里隐藏窗口，保持窗口显示（参考项目也不在 blur 时隐藏）
      // 这样可以避免插入文本时的焦点变化导致窗口隐藏
    });
  } catch (_) {}

  // 监听窗口移动，保存位置
  mainWindow.on('move', () => {
    if (isShowing && mainWindow) {
      const pos = mainWindow.getPosition();
      const oldPos = lastWindowPosition ? { ...lastWindowPosition } : null;
      
      // 🔍 关键修复：如果窗口位置被锁定（比如正在插入文本），不要保存新位置
      if (windowPositionLock) {
        console.log('[WINDOW_MOVE] ⚠️ 窗口位置已锁定，忽略移动事件:', {
          old: oldPos,
          new: { x: pos[0], y: pos[1] },
          timestamp: Date.now()
        });
        // 如果位置确实改变了，立即恢复
        if (oldPos && (pos[0] !== oldPos.x || pos[1] !== oldPos.y)) {
          console.warn('[WINDOW_MOVE] ⚠️ 检测到位置变化，强制恢复:', {
            expected: oldPos,
            actual: { x: pos[0], y: pos[1] }
          });
          mainWindow.setPosition(oldPos.x, oldPos.y);
        }
        return;
      }
      
      lastWindowPosition = { x: pos[0], y: pos[1] };
      // 🔍 调试日志：记录窗口移动的来源
      const stack = new Error().stack;
      const caller = stack ? stack.split('\n')[2]?.trim() : 'unknown';
      console.log('[WINDOW_MOVE] 窗口位置已保存:', {
        old: oldPos,
        new: lastWindowPosition,
        caller: caller,
        timestamp: Date.now()
      });
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
  try { view.webContents.setMaxListeners(0); } catch (_) {}
  // 规避站点或网络对 Electron UA 的特殊处理：改为更接近 Chrome 的 UA（不影响 TLS 层）
  try {
    const ua = view.webContents.getUserAgent();
    view.webContents.setUserAgent(ua.replace(/ Electron\/[0-9.]+/, ''));
  } catch (_) {}

  // 跟踪焦点：点击该视图后，后续刷新将定向到它
  try {
    view.webContents.on('focus', () => { lastFocusedBrowserView = view; lastTabTargetSide = 'left'; });
  } catch (_) {}

  // 可选：为 BrowserView 打开独立 DevTools 便于调试（命令行 --view-dev 或环境变量 AISB_VIEW_DEVTOOLS=1）
  try {
    if (process.argv.includes('--view-dev') || process.env.AISB_VIEW_DEVTOOLS === '1') {
      setTimeout(() => { try { view.webContents.openDevTools({ mode: 'detach' }); } catch (_) {} }, 500);
    }
  } catch (_) {}

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
    
    // 链接拦截主要通过 will-navigate 事件处理，这里不需要注入脚本
    // 注入脚本可能会干扰正常的链接行为，移除它
  });

  view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`BrowserView failed to load ${providerKey}:`, errorCode, errorDescription);
  });
  
  // 链接拦截通过 will-navigate 事件处理
  
  // 拦截导航事件（当用户点击链接时）
  // 注意：这个事件会在所有导航时触发，包括内部导航
  // 我们需要小心处理，避免拦截内部导航
  view.webContents.on('will-navigate', (event, navigationUrl) => {
    // 只在非内嵌浏览器激活时拦截
    if (isEmbeddedBrowserActive) {
      return; // 允许内嵌浏览器正常导航
    }
    
    // 检查是否是外部链接
    try {
      const currentUrlStr = view.webContents.getURL();
      if (!currentUrlStr || currentUrlStr === 'about:blank') {
        return; // 当前 URL 无效，允许导航
      }
      
      const currentUrl = new URL(currentUrlStr);
      const navUrl = new URL(navigationUrl);
      
      // 如果是外部链接（不同域名），拦截并打开内嵌浏览器
      if (navUrl.origin !== currentUrl.origin) {
        event.preventDefault();
        console.log('[Link Interceptor] External link detected, opening in embedded browser:', navigationUrl);
        openEmbeddedBrowser(navigationUrl);
      }
      // 同域名的导航允许继续（内部链接）
    } catch (e) {
      // URL 解析失败，可能是特殊协议（如 about:blank），允许导航
      console.log('[Link Interceptor] URL parse failed, allowing navigation:', e.message);
    }
  });
  
  // 拦截新窗口打开（window.open）
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      // 打开内嵌浏览器而不是新窗口
      openEmbeddedBrowser(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 捕获 BrowserView 内部的 Tab 键，支持在输入框内也一键切换 AI（含 Shift+Tab 反向）
  if (!view.__aisbTabHooked) {
    view.__aisbTabHooked = true;
    try {
      view.webContents.on('before-input-event', (event, input) => {
        try {
          if (input && input.type === 'keyDown') {
            // 1) 拦截 Tab：用于切换 Provider
            if (input.key === 'Tab' && !input.alt && !input.control && !input.meta) {
              event.preventDefault();
              suppressGlobalTab();
              const dir = input.shift ? -1 : 1;
              cycleToNextProvider(dir, 'left');
              return;
            }
            // 2) 拦截刷新：仅刷新当前这个 BrowserView，避免主窗口被刷新导致分割线消失
            const isReloadKey = (
              ((input.key === 'r' || input.key === 'R') && (input.meta || input.control)) ||
              (input.key === 'F5')
            );
            if (isReloadKey) {
              event.preventDefault();
              const hard = !!input.shift;
              try {
                if (hard && typeof view.webContents.reloadIgnoringCache === 'function') {
                  view.webContents.reloadIgnoringCache();
                } else {
                  view.webContents.reload();
                }
              } catch (_) {}
              return;
            }
          }
        } catch (_) {}
      });
    } catch (e) {
      console.warn('Failed to hook before-input-event for BrowserView:', providerKey, e);
    }
  }

  // 缓存
  browserViews[providerKey] = view;
  return view;
}

// 循环切换到下一个 provider（由渲染进程调用）
function cycleToNextProvider(dir = 1, sidePreferred = null) {
  if (!mainWindow) return;
  // 决定切换目标侧：优先使用显式参数；否则根据最近一次 Tab 目标或焦点进行判断
  let side = 'left';
  // 显式锁定优先
  if (forcedTabSide === 'left') {
    side = 'left';
  } else if (forcedTabSide === 'third') {
    // 仅在第三屏存在时才强制第三屏，否则降级为右侧或左侧
    side = (isThreeScreenMode && thirdBrowserView) ? 'third'
      : (isEmbeddedBrowserActive && embeddedBrowserView) ? 'right'
      : 'left';
  } else if (forcedTabSide === 'right') {
    // 仅在右侧视图存在时强制右侧，否则优雅降级为左侧
    side = (isEmbeddedBrowserActive && embeddedBrowserView) ? 'right' : 'left';
  } else if (sidePreferred === 'left' || sidePreferred === 'right' || sidePreferred === 'third') {
    side = sidePreferred;
  } else if (isThreeScreenMode && thirdBrowserView) {
    if (lastTabTargetSide === 'third') side = 'third';
    else if (isEmbeddedBrowserActive && embeddedBrowserView) {
      side = (lastTabTargetSide === 'right') ? 'right' : 'left';
    } else {
      side = 'left';
    }
  } else if (isEmbeddedBrowserActive && embeddedBrowserView) {
    if (lastTabTargetSide === 'right') side = 'right';
    else {
      const rightFocused = (lastFocusedBrowserView === embeddedBrowserView) || (embeddedBrowserView?.webContents?.isFocused?.() === true);
      side = rightFocused ? 'right' : 'left';
    }
  }
  // 记录这次切换所针对的一侧，提升后续 Tab 连续切换的稳定性
  try { lastTabTargetSide = side; } catch (_) {}
  // 通过 IPC 通知渲染进程执行切换，并带上方向与目标侧（1=下一个，-1=上一个）
  try {
    mainWindow.webContents.send('cycle-provider', { dir: dir >= 0 ? 1 : -1, side });
  } catch (e) {
    console.error('cycleToNextProvider send failed:', e);
  }
}

// ============== Tab 目标侧锁定（渲染层控制） ==============
ipcMain.on('set-tab-lock', (event, side) => {
  try {
    const prev = forcedTabSide;
    if (side === 'right') forcedTabSide = 'right';
    else if (side === 'left') forcedTabSide = 'left';
    else if (side === 'third') forcedTabSide = 'third';
    else forcedTabSide = null;
    if (prev !== forcedTabSide) {
      try { mainWindow?.webContents.send('tab-lock-changed', { side: forcedTabSide }); } catch (_) {}
    }
    event?.reply?.('tab-lock-changed', { side: forcedTabSide });
  } catch (e) { console.warn('set-tab-lock error:', e); }
});

ipcMain.on('get-tab-lock', (event) => {
  try { event.reply('tab-lock-changed', { side: forcedTabSide }); } catch (_) {}
});

// 切换到指定的 provider
function switchToProvider(providerKey) {
  console.log('switchToProvider called:', providerKey, 'mainWindow:', !!mainWindow, 'isShowing:', isShowing, 'isEmbeddedBrowserActive:', isEmbeddedBrowserActive);
  
  if (!mainWindow) {
    console.error('mainWindow not available');
    return;
  }

  // 如果内嵌浏览器激活，应该更新 previousBrowserView（左侧显示的AI）
  if (isEmbeddedBrowserActive) {
    console.log('[Switch Provider] Embedded browser active, updating previousBrowserView');
    
    // 如果 previousBrowserView 不存在，说明是第一次打开内嵌浏览器后切换，需要从 currentBrowserView 获取
    if (!previousBrowserView && currentBrowserView) {
      previousBrowserView = currentBrowserView;
      currentBrowserView = null; // 清空 currentBrowserView，因为现在它变成了 previousBrowserView
    }
    
    // 移除旧的 previousBrowserView
    if (previousBrowserView) {
      try {
        mainWindow.removeBrowserView(previousBrowserView);
        console.log('Removed previous BrowserView from split view');
      } catch (e) {
        console.error('Error removing previousBrowserView:', e);
      }
    }
    
    // 获取或创建新视图
    const view = getOrCreateBrowserView(providerKey);
    if (!view) {
      console.error('Failed to get BrowserView for:', providerKey);
      return;
    }
    
    // 更新 previousBrowserView 为新视图
    previousBrowserView = view;
    currentProviderKey = providerKey; // 更新当前 provider
    
    // 添加到窗口并更新布局
    try {
      if (overlayDepth > 0) {
        console.log('Overlay active; defer addBrowserView for:', providerKey);
      } else {
        mainWindow.addBrowserView(view);
        console.log('Added new BrowserView to split view (left side)');
        updateBrowserViewBounds();
      }
      // 通知渲染进程切换成功
      mainWindow.webContents.send('provider-switched', providerKey);
    } catch (e) {
      console.error('Error adding BrowserView to split view:', e);
    }
    return;
  }

  // 正常情况：内嵌浏览器未激活，更新 currentBrowserView
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
    currentProviderKey = providerKey; // 更新当前 provider
    if (overlayDepth > 0) {
      console.log('Overlay active; defer addBrowserView for:', providerKey);
    } else {
      mainWindow.addBrowserView(view);
      console.log('Added BrowserView for:', providerKey);
      updateBrowserViewBounds();
    }
    // 通知渲染进程切换成功
    mainWindow.webContents.send('provider-switched', providerKey);
    // 兜底确保已挂载
    ensureBrowserViewsAttached('switchToProvider');
  } catch (e) {
    console.error('Error adding BrowserView:', e);
  }
}

// 更新 BrowserView 的边界
function updateBrowserViewBounds() {
  if (!mainWindow) return;

  const bounds = mainWindow.getContentBounds();
  
  // 左侧留出实际的导航栏宽度（折叠=0）
  const sidebarWidth = Math.max(0, Math.floor(sidebarWidthPx || 0));
  // 顶部留出空间给工具栏/面板
  const topBarHeight = Math.max(0, Math.floor(topInset || 0));
  
  // 地址栏高度：工具栏下方 56px 开始，高度 36px，所以地址栏底部在 92px
  // 为地址栏留出空间：工具栏(48px) + 间距(8px) + 地址栏(36px) = 92px
  const addressBarHeight = 36;
  const addressBarTop = 56; // 工具栏下方
  const addressBarBottom = addressBarTop + addressBarHeight; // 92px
  
  const availableWidth = bounds.width - sidebarWidth;
  const availableHeight = bounds.height - topBarHeight;
  
  // 三分屏布局：左（AI）、中（右1/嵌入）、右（第三屏）
  if (isThreeScreenMode && thirdBrowserView && previousBrowserView) {
    // 三分屏：为两条分割线预留 gutter（与渲染层 .split-divider 宽度一致）
    const halfG = Math.floor(DIVIDER_GUTTER / 2);
    const minWidth = 200;
    const totalGutters = DIVIDER_GUTTER * 2;
    const free = Math.max(0, availableWidth - totalGutters);
    // 从比例计算宽度
    let leftWidth = Math.max(minWidth, Math.floor(free * (threeSplitR1 || (1/3))));
    let midWidth = embeddedBrowserView ? Math.max(minWidth, Math.floor(free * (threeSplitR2 || (1/3)))) : 0;
    let right2Width = Math.max(minWidth, free - leftWidth - midWidth);
    // 若合计超过 free，回收到右侧
    const overflow = (leftWidth + midWidth + right2Width) - free;
    if (overflow > 0) {
      // 优先减少较大的列
      let o = overflow;
      const dec = (amt, cur) => { const d = Math.min(amt, Math.max(0, cur - minWidth)); return [cur - d, amt - d]; };
      if (leftWidth >= midWidth && leftWidth >= right2Width) { [leftWidth, o] = dec(o, leftWidth); }
      if (o > 0 && midWidth >= right2Width) { [midWidth, o] = dec(o, midWidth); }
      if (o > 0) { [right2Width, o] = dec(o, right2Width); }
    }

    const leftX = sidebarWidth;
    const midX = sidebarWidth + leftWidth + DIVIDER_GUTTER;
    const right2X = midX + midWidth + (embeddedBrowserView ? DIVIDER_GUTTER : 0);

    // 左侧视图（AI 聊天）
    previousBrowserView.setBounds({ x: leftX, y: topBarHeight, width: leftWidth, height: availableHeight });
    previousBrowserView.setAutoResize({ width: false, height: false });

    // 中间视图（地址栏下方开始）
    if (embeddedBrowserView) {
      const midY = Math.max(topBarHeight, addressBarBottom);
      const midH = availableHeight - (midY - topBarHeight);
      embeddedBrowserView.setBounds({ x: midX, y: midY, width: midWidth, height: midH });
      embeddedBrowserView.setAutoResize({ width: false, height: false });
    }

    // 右侧第三屏：也为第三屏地址栏让出空间（与中间一致）
    const thirdY = Math.max(topBarHeight, addressBarBottom);
    const thirdH = availableHeight - (thirdY - topBarHeight);
    thirdBrowserView.setBounds({ x: right2X, y: thirdY, width: right2Width, height: thirdH });
    thirdBrowserView.setAutoResize({ width: false, height: false });

    console.log('[Three Split] bounds', {
      left: { x: leftX, y: topBarHeight, width: leftWidth, height: availableHeight },
      mid: embeddedBrowserView ? { x: midX, y: Math.max(topBarHeight, addressBarBottom), width: midWidth, height: availableHeight - (Math.max(topBarHeight, addressBarBottom) - topBarHeight) } : null,
      right2: { x: right2X, y: topBarHeight, width: right2Width, height: availableHeight },
      gutters: { firstCenter: sidebarWidth + leftWidth + halfG, secondCenter: midX + midWidth + halfG }
    });
  
  // 如果内嵌浏览器激活，实现分屏布局
  } else if (isEmbeddedBrowserActive && embeddedBrowserView && previousBrowserView) {
    // 分屏布局：左侧 AI 聊天，右侧内嵌浏览器
    // 使用保存的分屏比例
    const splitPoint = Math.floor(availableWidth * splitRatio);
    // 限制最小宽度（左右各至少 200px），并为中间分割线预留命中区域
    const minWidth = 200;
    const halfG = Math.floor(DIVIDER_GUTTER / 2);
    const adjustedSplitPoint = Math.max(
      minWidth + halfG,
      Math.min(availableWidth - (minWidth + halfG), splitPoint)
    );
    
    // 左侧：AI 聊天视图（previousBrowserView）
    // 左侧：为中间分割线预留 halfG 宽度
    const leftWidth = Math.max(minWidth, adjustedSplitPoint - halfG);
    previousBrowserView.setBounds({
      x: sidebarWidth,
      y: topBarHeight,
      width: leftWidth,
      height: availableHeight
    });
    previousBrowserView.setAutoResize({
      width: false,
      height: false
    });
    
    // 右侧：内嵌浏览器视图
    // 右侧：从地址栏下方开始，为地址栏留出空间
    const rightWidth = Math.max(minWidth, availableWidth - adjustedSplitPoint - halfG);
    const rightViewY = Math.max(topBarHeight, addressBarBottom); // 从地址栏下方开始
    const rightViewHeight = availableHeight - (rightViewY - topBarHeight); // 减去地址栏占用的高度
    embeddedBrowserView.setBounds({
      x: sidebarWidth + adjustedSplitPoint + halfG,
      y: rightViewY,
      width: rightWidth,
      height: rightViewHeight
    });
    embeddedBrowserView.setAutoResize({
      width: false,
      height: false
    });
    
    console.log('[Split View] AI chat (left):', {
      x: sidebarWidth,
      y: topBarHeight,
      width: leftWidth,
      height: availableHeight,
      ratio: splitRatio
    });
    console.log('[Split View] Embedded browser (right):', {
      x: sidebarWidth + adjustedSplitPoint + halfG,
      y: rightViewY,
      width: rightWidth,
      height: rightViewHeight,
      addressBarSpace: addressBarBottom - topBarHeight
    });
  } else if (currentBrowserView) {
    // 正常全屏布局：只有 AI 聊天视图
    currentBrowserView.setBounds({
      x: sidebarWidth,
      y: topBarHeight,
      width: availableWidth,
      height: availableHeight
    });

    // 禁用自动调整，完全由手动控制
    // 这样可以防止窗口大小变化时页面自动滚动到顶部
    currentBrowserView.setAutoResize({
      width: false,
      height: false
    });
    
    console.log('Updated BrowserView bounds (full-screen):', {
      x: sidebarWidth,
      y: topBarHeight,
      width: availableWidth,
      height: availableHeight
    });
  }
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
  if (!mainWindow || isShowing) {
    console.log('[SHOW_WINDOW] 跳过：窗口不存在或已显示', { mainWindow: !!mainWindow, isShowing });
    return;
  }
  
  // 🔍 调试日志：记录调用栈
  const stack = new Error().stack;
  const caller = stack ? stack.split('\n')[2]?.trim() : 'unknown';
  console.log('[SHOW_WINDOW] 开始显示窗口，调用来源:', caller);
  
  // 🔍 关键修复：如果窗口已经可见且在合理位置，不要移动它
  // 这样可以避免在插入文本时触发不必要的位置变化
  const wasVisible = mainWindow.isVisible();
  isShowing = true;
  
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const { width: windowWidth } = mainWindow.getBounds();
  const currentPos = mainWindow.getPosition();
  
  let targetX, targetY;
  
  // 检查当前位置是否合理（在屏幕范围内）
  const isCurrentPositionValid = currentPos[0] >= 0 && 
                                  currentPos[0] < screenWidth && 
                                  currentPos[1] >= 0 && 
                                  currentPos[1] < screenHeight;
  
  if (wasVisible && isCurrentPositionValid) {
    // 如果窗口已经可见且位置合理，保持当前位置不动
    targetX = currentPos[0];
    targetY = currentPos[1];
    console.log('[SHOW_WINDOW] 窗口已可见且位置合理，保持不动:', { x: targetX, y: targetY });
  } else if (lastWindowPosition) {
    targetX = lastWindowPosition.x;
    targetY = lastWindowPosition.y;
    console.log('[SHOW_WINDOW] 使用上次保存的位置:', {
      saved: lastWindowPosition,
      current: { x: currentPos[0], y: currentPos[1] },
      willSet: { x: targetX, y: targetY }
    });
  } else {
    // 默认在右侧，注意：macOS 菜单栏高度约 38px，使用 0 会被系统自动调整
    // 为了避免不必要的位置调整，我们直接使用菜单栏高度作为默认 y 坐标
    const menuBarHeight = 38; // macOS 菜单栏标准高度
    targetX = screenWidth - windowWidth;
    targetY = menuBarHeight;
    lastWindowPosition = { x: targetX, y: targetY };
    console.log('[SHOW_WINDOW] 使用默认位置（右侧，考虑菜单栏）:', lastWindowPosition);
  }
  
  // 🔍 关键修复：只有在位置确实需要改变时才设置
  // 避免不必要的 setPosition 调用导致的跳动
  const needsMove = currentPos[0] !== targetX || currentPos[1] !== targetY;
  
  if (needsMove) {
    console.log('[SHOW_WINDOW] 需要移动窗口:', {
      from: { x: currentPos[0], y: currentPos[1] },
      to: { x: targetX, y: targetY }
    });
    
    // 使用 setPosition 而不是 setBounds，更简单直接
    mainWindow.setPosition(targetX, targetY);
    
    // 🔍 验证：setPosition 后立即检查位置
    const afterSetPos = mainWindow.getPosition();
    console.log('[SHOW_WINDOW] ✓ setPosition() 后位置:', { 
      expected: { x: targetX, y: targetY },
      actual: { x: afterSetPos[0], y: afterSetPos[1] },
      drift: { x: afterSetPos[0] - targetX, y: afterSetPos[1] - targetY }
    });
  } else {
    console.log('[SHOW_WINDOW] 窗口位置已正确，跳过移动');
  }
  
  // 保存当前位置
  lastWindowPosition = { x: targetX, y: targetY };
  
  // 🔑 关键：每次显示时都要设置这些，确保窗口覆盖在当前应用上
  // 参考 RI 项目的做法，不依赖状态，每次都重新设置
  
  // 🔍 验证：在设置属性前记录位置
  const beforeAttributesPos = mainWindow.getPosition();
  console.log('[SHOW_WINDOW] 设置窗口属性前位置:', { x: beforeAttributesPos[0], y: beforeAttributesPos[1] });
  
  try {
    // 1. 临时在所有工作区可见（含全屏），避免跳回旧 Space
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    // 🔍 验证：setVisibleOnAllWorkspaces 后检查位置
    const afterWorkspacePos = mainWindow.getPosition();
    const workspaceDrift = { x: afterWorkspacePos[0] - beforeAttributesPos[0], y: afterWorkspacePos[1] - beforeAttributesPos[1] };
    console.log('[SHOW_WINDOW] ✓ setVisibleOnAllWorkspaces() 后位置:', { 
      before: { x: beforeAttributesPos[0], y: beforeAttributesPos[1] },
      after: { x: afterWorkspacePos[0], y: afterWorkspacePos[1] },
      drift: workspaceDrift,
      hasDrift: workspaceDrift.x !== 0 || workspaceDrift.y !== 0
    });
  } catch (e) {
    console.error('设置工作区可见性失败:', e);
  }
  
  try {
    const beforeAlwaysOnTopPos = mainWindow.getPosition();
    
    // 2. 使用 floating 层级（可交互），而不是 screen-saver（太高无法交互）
    mainWindow.setAlwaysOnTop(true, 'floating');
    
    // 🔍 验证：setAlwaysOnTop 后检查位置
    const afterAlwaysOnTopPos = mainWindow.getPosition();
    const alwaysOnTopDrift = { x: afterAlwaysOnTopPos[0] - beforeAlwaysOnTopPos[0], y: afterAlwaysOnTopPos[1] - beforeAlwaysOnTopPos[1] };
    console.log('[SHOW_WINDOW] ✓ setAlwaysOnTop() 后位置:', { 
      before: { x: beforeAlwaysOnTopPos[0], y: beforeAlwaysOnTopPos[1] },
      after: { x: afterAlwaysOnTopPos[0], y: afterAlwaysOnTopPos[1] },
      drift: alwaysOnTopDrift,
      hasDrift: alwaysOnTopDrift.x !== 0 || alwaysOnTopDrift.y !== 0
    });
  } catch (e) {
    console.error('设置置顶失败:', e);
  }
  
  const beforeShowPos = mainWindow.getPosition();
  console.log('[SHOW_WINDOW] show() 前位置:', { x: beforeShowPos[0], y: beforeShowPos[1] });
  
  mainWindow.show();
  
  // 🔍 验证：show() 后检查位置
  const afterShowPos = mainWindow.getPosition();
  const showDrift = { x: afterShowPos[0] - beforeShowPos[0], y: afterShowPos[1] - beforeShowPos[1] };
  console.log('[SHOW_WINDOW] ✓ show() 后位置:', { 
    before: { x: beforeShowPos[0], y: beforeShowPos[1] },
    after: { x: afterShowPos[0], y: afterShowPos[1] },
    drift: showDrift,
    hasDrift: showDrift.x !== 0 || showDrift.y !== 0
  });
  
  // 🔑 关键修复：如果 show() 导致位置漂移（通常是 y: 0 → y: 38 避免菜单栏）
  // 我们应该接受系统调整，并更新目标位置，避免下次触发不必要的移动
  if (showDrift.x !== 0 || showDrift.y !== 0) {
    console.log('[SHOW_WINDOW] ⚠️ show() 导致位置漂移（macOS 自动调整）');
    // 更新目标位置为实际位置，这样下次 move 事件不会误判
    lastWindowPosition = { x: afterShowPos[0], y: afterShowPos[1] };
  }
  
  mainWindow.focus();
  
  // 🔍 验证：focus() 后检查位置
  const afterFocusPos = mainWindow.getPosition();
  const focusDrift = { x: afterFocusPos[0] - afterShowPos[0], y: afterFocusPos[1] - afterShowPos[1] };
  console.log('[SHOW_WINDOW] ✓ focus() 后位置:', { 
    before: { x: afterShowPos[0], y: afterShowPos[1] },
    after: { x: afterFocusPos[0], y: afterFocusPos[1] },
    drift: focusDrift,
    hasDrift: focusDrift.x !== 0 || focusDrift.y !== 0
  });
  
  lastShowAt = Date.now(); // 记录显示时间
  
  try { mainWindow.webContents.send('app-visibility', { state: 'shown', ts: Date.now() }); } catch (_) {}
  
  // 3. 200ms 后还原工作区可见性，仅在当前 Space 可见
  setTimeout(() => {
    try {
      const beforeRestorePos = mainWindow.getPosition();
      console.log('[SHOW_WINDOW] 200ms后还原工作区可见性前位置:', { x: beforeRestorePos[0], y: beforeRestorePos[1] });
      
      mainWindow.setVisibleOnAllWorkspaces(false);
      
      // 🔍 验证：还原后检查位置
      const afterRestorePos = mainWindow.getPosition();
      const restoreDrift = { x: afterRestorePos[0] - beforeRestorePos[0], y: afterRestorePos[1] - beforeRestorePos[1] };
      console.log('[SHOW_WINDOW] ✓ setVisibleOnAllWorkspaces(false) 后位置:', { 
        before: { x: beforeRestorePos[0], y: beforeRestorePos[1] },
        after: { x: afterRestorePos[0], y: afterRestorePos[1] },
        drift: restoreDrift,
        hasDrift: restoreDrift.x !== 0 || restoreDrift.y !== 0
      });
    } catch (e) {
      console.error('还原工作区可见性失败:', e);
    }
  }, 200);
  
  console.log('窗口已显示，层级: floating（可交互）');
  console.log('[SHOW_WINDOW] ========== 显示完成 ==========');
}

// 隐藏窗口（直接隐藏，不使用动画）
function hideWindow() {
  if (!mainWindow || !isShowing) return;
  
  // 保存当前位置
  const currentBounds = mainWindow.getBounds();
  const oldPos = lastWindowPosition ? { ...lastWindowPosition } : null;
  lastWindowPosition = { x: currentBounds.x, y: currentBounds.y };
  console.log('[HIDE_WINDOW] 保存窗口位置:', {
    old: oldPos,
    new: lastWindowPosition,
    timestamp: Date.now()
  });
  
  mainWindow.hide();
  isShowing = false;
  try { mainWindow.webContents.send('app-visibility', { state: 'hidden', ts: Date.now() }); } catch (_) {}
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
    const side = (typeof payload === 'object' && payload && payload.side) ? String(payload.side) : 'auto';
    console.log('IPC received switch-provider:', providerKey, url ? `(url: ${url})` : '');

    if (PROVIDERS[providerKey]) {
      const provider = PROVIDERS[providerKey];

      // 侧向策略：right/left/auto（auto 时依据分屏与最近聚焦视图判断）
      let targetSide = side;
      if (targetSide === 'auto') {
        if (isEmbeddedBrowserActive && embeddedBrowserView) {
          // 判断最近焦点是否在右侧
          const rightFocused = (lastFocusedBrowserView === embeddedBrowserView) || (embeddedBrowserView?.webContents?.isFocused?.() === true);
          targetSide = rightFocused ? 'right' : 'left';
        } else {
          targetSide = 'left';
        }
      }

      if (targetSide === 'right') {
        // 在右侧打开该 provider，使用相同分区以复用登录
        const toUrl = url || provider.url;
        openEmbeddedBrowser(toUrl, { partition: provider.partition });
        // 不改变 currentProviderKey（左侧的活动 provider），避免误导
        return;
      }

      // 默认在左侧切换 provider
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

// ============== 内嵌浏览器功能 ==============
// 打开内嵌浏览器（分屏显示：左侧 AI 聊天，右侧链接页面）
// 打开内嵌浏览器（可指定分区，便于与左侧 AI 共享登录会话）
// opts.partition: 指定 session partition，例如 'persist:chatgpt'
function openEmbeddedBrowser(url, opts = {}) {
  if (!mainWindow) {
    console.error('Cannot open embedded browser: mainWindow is null');
    return;
  }

  try {
    // 保存当前的 BrowserView（AI 聊天视图）
    if (currentBrowserView && !isEmbeddedBrowserActive) {
      previousBrowserView = currentBrowserView;
      // 不隐藏，保持显示在左侧
    }

    // 需要的分区（为空则使用默认通用浏览分区）
    const requestedPartition = (opts && typeof opts.partition === 'string' && opts.partition.trim())
      ? opts.partition.trim()
      : 'persist:embedded-browser';

    // 如分区不一致，则销毁旧的右侧视图，重新按需创建，确保登录互通
    const needRecreate = !embeddedBrowserView || embeddedBrowserPartition !== requestedPartition;
    if (needRecreate) {
      // 清理旧视图
      try {
        if (embeddedBrowserView && mainWindow) mainWindow.removeBrowserView(embeddedBrowserView);
      } catch (_) {}
      try { embeddedBrowserView?.destroy?.(); } catch (_) {}
      embeddedBrowserView = null;

      // 重新创建
      embeddedBrowserView = new BrowserView({
        webPreferences: {
          partition: requestedPartition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          enableRemoteModule: false,
        }
      });
      try { embeddedBrowserView.webContents.setMaxListeners(0); } catch (_) {}
      embeddedBrowserPartition = requestedPartition;
      // 去除 UA 中的 Electron 标识（与左侧一致）
      try {
        const ua2 = embeddedBrowserView.webContents.getUserAgent();
        embeddedBrowserView.webContents.setUserAgent(ua2.replace(/ Electron\/[0-9.]+/, ''));
      } catch (_) {}

      // 监听导航事件
      embeddedBrowserView.webContents.on('did-navigate', (event, navigationUrl) => {
        console.log('[Embedded Browser] Navigated to:', navigationUrl);
        mainWindow?.webContents.send('embedded-browser-url-changed', { url: navigationUrl });
      });

      embeddedBrowserView.webContents.on('did-navigate-in-page', (event, navigationUrl) => {
        console.log('[Embedded Browser] In-page navigation to:', navigationUrl);
        mainWindow?.webContents.send('embedded-browser-url-changed', { url: navigationUrl });
      });

      // 监听加载完成
      embeddedBrowserView.webContents.on('did-finish-load', () => {
        console.log('[Embedded Browser] Page loaded');
        mainWindow?.webContents.send('embedded-browser-loaded');
      });
    }
    // 键盘拦截：确保在右侧获得焦点时，Cmd/Ctrl+R 只刷新右侧视图
    try {
      embeddedBrowserView.webContents.on('before-input-event', (event, input) => {
        try {
          if (input && input.type === 'keyDown') {
            // 1) Tab to cycle providers (match left panel behavior)
            if (input.key === 'Tab' && !input.alt && !input.control && !input.meta) {
              event.preventDefault();
              suppressGlobalTab();
              const dir = input.shift ? -1 : 1;
              cycleToNextProvider(dir, 'right');
              return;
            }

            // 2) Reload only the embedded (right) view, not the whole window
            const isReloadKey = (
              ((input.key === 'r' || input.key === 'R') && (input.meta || input.control)) ||
              (input.key === 'F5')
            );
            if (isReloadKey) {
              event.preventDefault();
              const hard = !!input.shift;
              try {
                if (hard && typeof embeddedBrowserView.webContents.reloadIgnoringCache === 'function') {
                  embeddedBrowserView.webContents.reloadIgnoringCache();
                } else {
                  embeddedBrowserView.webContents.reload();
                }
              } catch (_) {}
              return;
            }
          }
        } catch (_) {}
      });
    } catch (_) {}
    // 跟踪焦点：点击右侧内嵌浏览器后，刷新定向到右侧
    try {
      embeddedBrowserView.webContents.on('focus', () => { lastFocusedBrowserView = embeddedBrowserView; lastTabTargetSide = 'right'; });
    } catch (_) {}

    // 加载 URL
    embeddedBrowserView.webContents.loadURL(url);
    isEmbeddedBrowserActive = true;
    lastTabTargetSide = 'right';

    // 添加到窗口（与 AI 聊天视图同时显示）
    if (overlayDepth > 0) {
      console.log('[Embedded Browser] Overlay active; defer addBrowserView');
    } else {
      mainWindow.addBrowserView(embeddedBrowserView);
      updateBrowserViewBounds(); // 更新两个视图的边界，实现分屏
    }

    // 通知渲染进程
    mainWindow.webContents.send('embedded-browser-opened', { url });
    console.log('[Embedded Browser] Opened in split view:', url);
    // 兜底确保已挂载
    ensureBrowserViewsAttached('openEmbeddedBrowser');
  } catch (e) {
    console.error('[Embedded Browser] Error opening:', e);
  }
}

// 关闭内嵌浏览器，恢复全屏显示 AI 聊天
function closeEmbeddedBrowser() {
  if (!isEmbeddedBrowserActive || !embeddedBrowserView) {
    return;
  }

  try {
    // 先设置状态，确保 updateBrowserViewBounds 知道要恢复全屏
    isEmbeddedBrowserActive = false;
    lastTabTargetSide = 'left';
    
    // 移除内嵌浏览器视图
    if (mainWindow && embeddedBrowserView) {
      mainWindow.removeBrowserView(embeddedBrowserView);
    }

    // 恢复之前的 BrowserView（AI 聊天视图）为全屏
    if (previousBrowserView && mainWindow) {
      // 确保 previousBrowserView 在窗口中
      try {
        const views = mainWindow.getBrowserViews();
        if (!views.includes(previousBrowserView)) {
          mainWindow.addBrowserView(previousBrowserView);
        }
      } catch (e) {
        console.warn('[Embedded Browser] Error checking/adding previous view:', e);
      }
      
      currentBrowserView = previousBrowserView;
      
      // 更新布局为全屏（因为 isEmbeddedBrowserActive 已设置为 false，会走全屏分支）
      if (overlayDepth > 0) {
        console.log('[Embedded Browser] Overlay active; defer restore BrowserView');
      } else {
        updateBrowserViewBounds(); // 恢复全屏布局
      }
    } else if (currentBrowserView && mainWindow) {
      // 如果没有 previousBrowserView，确保 currentBrowserView 是全屏显示
      updateBrowserViewBounds();
    }

    previousBrowserView = null;

    // 通知渲染进程
    mainWindow?.webContents.send('embedded-browser-closed');
    console.log('[Embedded Browser] Closed, restored full-screen AI chat');
  } catch (e) {
    console.error('[Embedded Browser] Error closing:', e);
  }
}

// IPC 处理器：打开内嵌浏览器
ipcMain.on('open-embedded-browser', (event, url) => {
  if (!url || typeof url !== 'string') {
    console.error('[Embedded Browser] Invalid URL:', url);
    return;
  }
  openEmbeddedBrowser(url);
});

// IPC 处理器：关闭内嵌浏览器
ipcMain.on('close-embedded-browser', () => {
  closeEmbeddedBrowser();
});

// IPC 处理器：从 BrowserView 内部打开内嵌浏览器（由注入的脚本触发）
ipcMain.on('open-embedded-browser-from-view', (event, url) => {
  if (!url || typeof url !== 'string') {
    console.error('[Embedded Browser] Invalid URL from view:', url);
    return;
  }
  console.log('[Embedded Browser] Opening from BrowserView:', url);
  openEmbeddedBrowser(url);
});

ipcMain.on('get-current-url', (event) => {
  try {
    const view = getTargetViewForAction();
    if (view && view.webContents) {
      const url = view.webContents.getURL();
      event.reply('current-url', url);
    } else {
      event.reply('current-url', null);
    }
  } catch (_) {
    event.reply('current-url', null);
  }
});

// IPC 处理器：导航内嵌浏览器
ipcMain.on('navigate-embedded-browser', (event, url) => {
  if (!url || typeof url !== 'string') {
    console.error('[Embedded Browser] Invalid URL for navigation:', url);
    return;
  }
  if (!isEmbeddedBrowserActive || !embeddedBrowserView) {
    console.warn('[Embedded Browser] Not active, opening new embedded browser');
    openEmbeddedBrowser(url);
    return;
  }
  console.log('[Embedded Browser] Navigating to:', url);
  try {
    embeddedBrowserView.webContents.loadURL(url);
  } catch (e) {
    console.error('[Embedded Browser] Navigation error:', e);
  }
});

// IPC 处理器：导航第三屏浏览器
ipcMain.on('navigate-third-browser', (event, url) => {
  if (!url || typeof url !== 'string') { console.error('[Third Browser] Invalid URL for navigation:', url); return; }
  if (!isThreeScreenMode || !thirdBrowserView) { console.warn('[Third Browser] Not active, opening third screen'); openThirdScreen(url, { partition: thirdBrowserPartition }); return; }
  try { thirdBrowserView.webContents.loadURL(url); } catch (e) { console.error('[Third Browser] Navigation error:', e); }
});

// Tab 键切换 provider（由渲染进程触发）
ipcMain.on('cycle-provider-next', () => {
  cycleToNextProvider();
});

// 全宽切换与状态查询
ipcMain.on('toggle-full-width', () => {
  toggleFullWidth();
});
ipcMain.on('get-full-width-state', (event) => {
  event.reply('full-width-state', { isFullWidth });
});

// 渲染进程告知当前“强制切换”的目标侧
ipcMain.on('active-side', (event, side) => {
  lastTabTargetSide = (side === 'right') ? 'right' : (side === 'third' ? 'third' : 'left');
});

// 聚焦右侧内嵌浏览器，便于连续 Tab/Shift+Tab 切换
ipcMain.on('focus-embedded', () => {
  try {
    if (embeddedBrowserView && embeddedBrowserView.webContents) {
      embeddedBrowserView.webContents.focus();
      lastFocusedBrowserView = embeddedBrowserView;
      lastTabTargetSide = 'right';
    }
  } catch (_) {}
});

// ============== 第三屏（右2）支持 ==============
function ensureThirdView(partition = thirdBrowserPartition) {
  if (thirdBrowserView && thirdBrowserPartition === partition) return;
  try { thirdBrowserView?.destroy?.(); } catch (_) {}
  thirdBrowserView = null;
  thirdBrowserPartition = partition || 'persist:third';
  thirdBrowserView = new BrowserView({
    webPreferences: {
      partition: thirdBrowserPartition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      enableRemoteModule: false,
    }
  });
  try { thirdBrowserView.webContents.setMaxListeners(0); } catch (_) {}
  // 去除 UA 中的 Electron 标识
  try {
    const ua3 = thirdBrowserView.webContents.getUserAgent();
    thirdBrowserView.webContents.setUserAgent(ua3.replace(/ Electron\/[0-9.]+/, ''));
  } catch (_) {}
  // 监听第三屏 URL 变化，便于同步地址栏
  try {
    thirdBrowserView.webContents.on('did-navigate', (event, url) => {
      try { mainWindow?.webContents.send('third-browser-url-changed', { url }); } catch (_) {}
    });
    thirdBrowserView.webContents.on('did-navigate-in-page', (event, url) => {
      try { mainWindow?.webContents.send('third-browser-url-changed', { url }); } catch (_) {}
    });
    thirdBrowserView.webContents.on('did-finish-load', () => {
      try {
        const url = thirdBrowserView.webContents.getURL();
        mainWindow?.webContents.send('third-browser-url-changed', { url });
      } catch (_) {}
    });
  } catch (_) {}
  // 监听键盘：Tab/刷新
  try {
    thirdBrowserView.webContents.on('before-input-event', (event, input) => {
      try {
        if (input && input.type === 'keyDown') {
          if (input.key === 'Tab' && !input.alt && !input.control && !input.meta) {
            event.preventDefault();
            suppressGlobalTab();
            const dir = input.shift ? -1 : 1;
            cycleToNextProvider(dir, 'third');
            return;
          }
          const isReload = (((input.key === 'r' || input.key === 'R') && (input.meta || input.control)) || input.key === 'F5');
          if (isReload) { event.preventDefault(); try { thirdBrowserView.webContents.reload(); } catch (_) {} }
        }
      } catch (_) {}
    });
  } catch (_) {}
  // 跟踪焦点
  try { thirdBrowserView.webContents.on('focus', () => { lastFocusedBrowserView = thirdBrowserView; lastTabTargetSide = 'third'; }); } catch (_) {}
}

function openThirdScreen(url, opts = {}) {
  if (!mainWindow) return;
  try {
    // 确保左侧与中间存在
    if (!isEmbeddedBrowserActive || !embeddedBrowserView) {
      openEmbeddedBrowser('about:blank', { partition: 'persist:embedded-browser' });
    }
    // 创建/复用第三屏视图
    const part = (opts && typeof opts.partition === 'string' && opts.partition.trim()) ? opts.partition.trim() : thirdBrowserPartition;
    ensureThirdView(part);
    if (url) {
      try { thirdBrowserView.webContents.loadURL(url); } catch (_) {}
    }
    isThreeScreenMode = true;
    try { mainWindow.addBrowserView(thirdBrowserView); } catch (_) {}
    updateBrowserViewBounds();
    // 通知渲染层第三屏已打开，用于补齐分割线/地址栏等 UI 状态
    try { mainWindow.webContents.send('third-screen-opened', { url: thirdBrowserView.webContents.getURL?.() || url || '' }); } catch (_) {}
  } catch (e) { console.error('openThirdScreen error:', e); }
}

function closeThirdScreen() {
  try {
    if (!thirdBrowserView) return;
    if (mainWindow) {
      try { mainWindow.removeBrowserView(thirdBrowserView); } catch (_) {}
    }
    // 保留 thirdBrowserView 对象以便下次复用其 session，但退出三分屏模式
    isThreeScreenMode = false;
    updateBrowserViewBounds();
    try { mainWindow?.webContents.send('third-screen-closed'); } catch (_) {}
  } catch (e) { console.error('closeThirdScreen error:', e); }
}

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

// 查询当前分屏/三分屏状态，供渲染层在初始化时同步 UI（避免事件竞态导致分割线缺失）
ipcMain.on('get-split-state', (event) => {
  try {
    event.reply('split-state', {
      isEmbedded: !!isEmbeddedBrowserActive,
      isThree: !!isThreeScreenMode
    });
  } catch (_) {
    try { event.reply('split-state', { isEmbedded: false, isThree: false }); } catch (__){ }
  }
});

// 三分屏开关
ipcMain.on('set-three-screen-mode', (event, enable) => {
  try {
    const next = !!enable;
    if (isThreeScreenMode !== next) {
      isThreeScreenMode = next;
      updateBrowserViewBounds();
    }
  } catch (e) { console.warn('set-three-screen-mode error:', e); }
});

// 设置三分屏比例（r1、r2 为 free 宽度中的占比）
ipcMain.on('set-three-ratios', (event, payload) => {
  try {
    if (!payload) return;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v)));
    const r1 = clamp(payload.r1, 0.05, 0.9);
    const r2 = clamp(payload.r2, 0.05, 0.9);
    if (Number.isFinite(r1) && Number.isFinite(r2)) {
      threeSplitR1 = r1; threeSplitR2 = r2;
      updateBrowserViewBounds();
    }
  } catch (e) { console.warn('set-three-ratios error:', e); }
});

// IPC：打开第三屏
ipcMain.on('open-third-screen', (event, payload) => {
  try {
    const url = (payload && payload.url) || null;
    openThirdScreen(url || 'about:blank');
  } catch (e) { console.error('ipc open-third-screen error:', e); }
});

// IPC：切换第三屏 provider（使用对应分区，实现登录复用）
ipcMain.on('switch-third-provider', (event, payload) => {
  try {
    const key = payload && payload.key;
    const url = payload && payload.url;
    const p = PROVIDERS[key];
    const part = p && p.partition ? p.partition : 'persist:third';
    openThirdScreen(url || (p && p.url) || 'about:blank', { partition: part });
  } catch (e) { console.error('switch-third-provider error:', e); }
});

// IPC：聚焦第三屏
ipcMain.on('focus-third', () => {
  try {
    if (thirdBrowserView && thirdBrowserView.webContents) {
      thirdBrowserView.webContents.focus();
      lastFocusedBrowserView = thirdBrowserView;
      lastTabTargetSide = 'third';
    }
  } catch (_) {}
});

// 关闭第三屏
ipcMain.on('close-third-screen', () => {
  closeThirdScreen();
});

// 根据焦点或显式侧关闭右侧或第三屏
ipcMain.on('close-active-pane', (event, payload) => {
  try {
    const side = payload && payload.side;
    if (side === 'all') {
      // 始终回到左侧单屏：先关第三屏，再关右侧
      try { closeThirdScreen(); } catch (_) {}
      try { closeEmbeddedBrowser(); } catch (_) {}
      return;
    }
    if (side === 'third') { closeThirdScreen(); return; }
    if (side === 'right') { closeEmbeddedBrowser(); return; }
    // 未显式指定：依据最近焦点
    if (lastFocusedBrowserView === thirdBrowserView) { closeThirdScreen(); return; }
    if (lastFocusedBrowserView === embeddedBrowserView) { closeEmbeddedBrowser(); return; }
    // 兜底：优先关第三，其次右侧
    if (thirdBrowserView) closeThirdScreen();
    else if (isEmbeddedBrowserActive) closeEmbeddedBrowser();
  } catch (e) { console.error('close-active-pane error:', e); }
});

// 设置左侧导航栏宽度（由渲染进程根据 DOM 实际宽度上报）
ipcMain.on('set-sidebar-width', (event, px) => {
  try {
    const next = Math.max(0, Math.min(600, Math.floor(px || 0))); // 0~600 合理范围
    if (next !== sidebarWidthPx) {
      sidebarWidthPx = next;
      try { console.log('[SidebarWidth]', sidebarWidthPx, 'px'); } catch (_) {}
      updateBrowserViewBounds();
    }
  } catch (_) {}
});

// 设置分屏比例（0-1，0.5 表示各占一半）
ipcMain.on('set-split-ratio', (event, ratio) => {
  try {
    const newRatio = Math.max(0.2, Math.min(0.8, parseFloat(ratio || 0.5)));
    if (newRatio !== splitRatio) {
      splitRatio = newRatio;
      updateBrowserViewBounds();
      console.log('[Split View] Ratio updated to:', splitRatio);
    }
  } catch (e) {
    console.error('[Split View] Error setting ratio:', e);
  }
});

// 覆盖模式 IPC
ipcMain.on('overlay-enter', () => {
  const prev = overlayDepth;
  overlayDepth = Math.max(0, overlayDepth + 1);
  if (overlayDepth === 1) {
    console.log('[Overlay] enter → depth=1 (detach BrowserView)');
    detachBrowserView();
    try { mainWindow?.webContents.send('overlay-state', { action: 'enter', depth: overlayDepth, ts: Date.now() }); } catch (_) {}
  } else {
    console.log('[Overlay] enter → depth=' + overlayDepth + ' (no-op)');
    try { mainWindow?.webContents.send('overlay-state', { action: 'enter', depth: overlayDepth, ts: Date.now() }); } catch (_) {}
  }
});
ipcMain.on('overlay-exit', () => {
  const prev = overlayDepth;
  overlayDepth = Math.max(0, overlayDepth - 1);
  if (overlayDepth === 0) {
    console.log('[Overlay] exit → depth=0 (attach BrowserView)');
    attachBrowserView();
    try { mainWindow?.webContents.send('overlay-state', { action: 'exit', depth: overlayDepth, ts: Date.now() }); } catch (_) {}
  } else {
    console.log('[Overlay] exit → depth=' + overlayDepth + ' (no-op)');
    try { mainWindow?.webContents.send('overlay-state', { action: 'exit', depth: overlayDepth, ts: Date.now() }); } catch (_) {}
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
  const view = getActiveAiView();
  if (!view || !view.webContents) return { ok:false, error:'no-view' };
  try { view.webContents.focus(); } catch (_) {}
  try {
    const result = await view.webContents.executeJavaScript(`
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
              // Gemini editor
              '.ql-editor',
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
    try { view.webContents.paste(); return { ok:true, method:'system-paste' }; } catch (e) { return { ok:false, error:String(e) }; }
  } catch (e) {
    return { ok:false, error:String(e) };
  }
}

// 主动将 BrowserView 内的提示输入框设为焦点
async function focusPromptInCurrentView() {
  const view = getActiveAiView();
  if (!view || !view.webContents) return { ok:false, error:'no-view' };
  try { view.webContents.focus(); } catch (_) {}
  try {
    const result = await view.webContents.executeJavaScript(`
      (function() {
        try {
          function findPromptElement() {
            const selectors = [
              'textarea',
              // Gemini editor
              '.ql-editor',
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
          function placeCaretAtEnd(el) {
            try {
              if (el.isContentEditable) {
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                return;
              }
              if (typeof el.selectionStart === 'number') {
                const len = (el.value||'').length;
                el.selectionStart = el.selectionEnd = len;
              }
            } catch (_) {}
          }
          const el = findPromptElement();
          if (!el) return { ok:false, error:'no-input' };
          try { el.focus(); } catch(_){}
          placeCaretAtEnd(el);
          return { ok:true };
        } catch (e) {
          return { ok:false, error: String(e && e.message || e) };
        }
      })();
    `);
    return result && result.ok ? result : { ok:false, error: (result && result.error)||'unknown' };
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

// 优先从应用内的 BrowserView 读取选中的文字（左右任意一侧），
// 若没有再回退到系统层面的选区读取。
async function getSelectedTextFromViews() {
  try {
    if (!mainWindow) return '';
    // 当前附着在窗口上的视图（分屏时有两个）
    const views = (typeof mainWindow.getBrowserViews === 'function') ? mainWindow.getBrowserViews() : [];
    const candidates = [];
    for (const v of views) {
      if (v && v.webContents) candidates.push(v);
    }
    // 同时兜底把两侧引用加入（即便未附着，也尝试读取）
    if (currentBrowserView && !candidates.includes(currentBrowserView)) candidates.push(currentBrowserView);
    if (embeddedBrowserView && !candidates.includes(embeddedBrowserView)) candidates.push(embeddedBrowserView);

    let best = '';
    const code = `(() => {
      try {
        let t = '';
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.rangeCount) {
          const s = String(sel.toString() || '');
          if (s) t = s;
        }
        if (!t) {
          const ae = document.activeElement;
          if (ae) {
            const tag = (ae.tagName || '').toLowerCase();
            if (tag === 'textarea' || tag === 'input') {
              const start = ae.selectionStart || 0;
              const end = ae.selectionEnd || 0;
              if (end > start) t = String((ae.value || '').slice(start, end));
            } else if (ae.isContentEditable || ae.getAttribute?.('contenteditable') === 'true') {
              const s = sel && sel.toString ? String(sel.toString() || '') : '';
              if (s) t = s;
            }
          }
        }
        return t || '';
      } catch (_) { return ''; }
    })();`;
    for (const v of candidates) {
      try {
        const t = await v.webContents.executeJavaScript(code);
        if (t && String(t).trim().length > best.length) best = String(t).trim();
      } catch (_) {}
    }
    return best;
  } catch (_) { return ''; }
}

// 获取当前选中的文字
async function getSelectedText() {
  try {
    // 1) 先尝试从我们应用内的各个视图读取（支持“左选右贴/右选左贴”）
    const fromViews = await getSelectedTextFromViews();
    if (fromViews && fromViews.trim()) return fromViews;

    // 2) 再回退到系统层面（前台应用或通过剪贴板复制）
    if (process.platform === 'darwin') {
      // macOS: 使用 AppleScript 直接获取选中的文字
      return new Promise((resolve) => {
        exec('osascript -e \'tell application "System Events" to get the value of attribute "AXSelectedText" of (first process whose frontmost is true)\'', (error, stdout, stderr) => {
          if (error) {
            // 如果直接获取失败，尝试通过复制到剪贴板的方式
            console.log('直接获取选中文字失败，尝试通过剪贴板方式...');
            getSelectedTextViaClipboard().then(resolve).catch(() => resolve(''));
            return;
          }
          const text = (stdout || '').trim();
          resolve(text || '');
        });
      });
    } else {
      // Windows/Linux: 通过剪贴板方式
      return await getSelectedTextViaClipboard();
    }
  } catch (e) {
    console.error('获取选中文字失败:', e);
    return '';
  }
}

// 通过复制到剪贴板然后读取的方式获取选中文字（备用方法）
async function getSelectedTextViaClipboard() {
  try {
    // 保存当前剪贴板内容
    const originalClipboard = clipboard.readText();
    
    // 模拟复制操作（Cmd+C）
    await simulateSystemCopy();
    
    // 等待一小段时间确保复制完成
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // 读取剪贴板内容
    const selectedText = clipboard.readText();
    
    // 恢复原始剪贴板内容
    if (originalClipboard) {
      clipboard.writeText(originalClipboard);
    }
    
    return selectedText || '';
  } catch (e) {
    console.error('通过剪贴板获取选中文字失败:', e);
    return '';
  }
}

// 向 BrowserView 的输入框插入文字
async function insertTextIntoCurrentView(text) {
  const view = getActiveAiView();
  if (!view || !view.webContents) {
    return { ok: false, error: 'no-view' };
  }
  
  if (!text || !text.trim()) {
    return { ok: false, error: 'empty-text' };
  }
  
  try {
    // 先聚焦到 BrowserView
    view.webContents.focus();
    
    // 等待一小段时间确保焦点已切换
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const result = await view.webContents.executeJavaScript(`
      (function() {
        try {
          function findPromptElement() {
            const selectors = [
              'textarea',
              // Gemini editor
              '.ql-editor',
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
          
          function insertTextAtCaret(el, text) {
            try {
              if (el.isContentEditable) {
                // contenteditable 元素
                const selection = window.getSelection();
                let range;
                if (selection.rangeCount > 0) {
                  range = selection.getRangeAt(0);
                } else {
                  // 如果没有选中范围，创建一个新的范围并放在元素末尾
                  range = document.createRange();
                  range.selectNodeContents(el);
                  range.collapse(false);
                }
                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                // 触发 input 事件
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                // textarea 或 input 元素
                const start = el.selectionStart || 0;
                const end = el.selectionEnd || 0;
                const value = el.value || '';
                el.value = value.substring(0, start) + text + value.substring(end);
                el.selectionStart = el.selectionEnd = start + text.length;
                // 触发 input 事件
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } catch (e) {
              console.error('插入文字失败:', e);
            }
          }
          
          const el = findPromptElement();
          if (!el) return { ok: false, error: 'no-input' };
          
          // 聚焦到输入框
          try { el.focus(); } catch(_){}
          
          // 插入文字
          const textToInsert = ${JSON.stringify(text)};
          insertTextAtCaret(el, textToInsert);
          
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e && e.message || e) };
        }
      })();
    `);
    
    return result && result.ok ? result : { ok: false, error: (result && result.error) || 'unknown' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Read current prompt text from a given view
async function getPromptTextFromView(view) {
  if (!view || !view.webContents) return '';
  try {
    const text = await view.webContents.executeJavaScript(`
      (function(){
        try {
          function findPromptElement() {
            const selectors = [
              'textarea',
              '.ql-editor',
              'div[contenteditable="true"]',
              '[role="textbox"]',
              '[aria-label*="prompt" i]',
              '[data-testid*="prompt" i]',
              '[data-testid*="textbox" i]',
              'input[name="q"]',
              'input[type="text"]'
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
          if (!el) return '';
          if (el.isContentEditable) {
            return (el.innerText || el.textContent || '').trim();
          }
          if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
            return String(el.value || '').trim();
          }
          return '';
        } catch (_) { return ''; }
      })();
    `);
    return String(text || '').trim();
  } catch (_) { return ''; }
}

// Insert text into a specific view
async function insertTextIntoView(view, text) {
  if (!view || !view.webContents) return { ok:false, error:'no-view' };
  if (!text || !String(text).trim()) return { ok:false, error:'empty-text' };
  try {
    view.webContents.focus();
    await new Promise(r=> setTimeout(r, 50));
    const result = await view.webContents.executeJavaScript(`
      (function() {
        try {
          function findPromptElement() {
            const selectors = [
              'textarea',
              '.ql-editor',
              'div[contenteditable="true"]',
              '[role="textbox"]',
              '[aria-label*="prompt" i]',
              '[data-testid*="prompt" i]',
              '[data-testid*="textbox" i]',
              'input[name="q"]',
              'input[type="text"]'
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
          function insertTextAtCaret(el, text) {
            try {
              if (el.isContentEditable) {
                const selection = window.getSelection();
                let range;
                if (selection.rangeCount > 0) { range = selection.getRangeAt(0); }
                else { range = document.createRange(); range.selectNodeContents(el); range.collapse(false); }
                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                const start = el.selectionStart || (el.value||'').length;
                const end = el.selectionEnd || start;
                const value = el.value || '';
                el.value = value.substring(0, start) + text + value.substring(end);
                el.selectionStart = el.selectionEnd = start + text.length;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } catch (e) { console.error('insertTextAtCaret failed', e); }
          }
          const el = findPromptElement();
          if (!el) return { ok:false, error:'no-input' };
          try { el.focus(); } catch(_){}
          insertTextAtCaret(el, ${JSON.stringify(String(text))});
          return { ok:true };
        } catch (e) { return { ok:false, error: String(e && e.message || e) }; }
      })();
    `);
    return result && result.ok ? result : { ok:false, error: (result && result.error) || 'unknown' };
  } catch (e) {
    return { ok:false, error: String(e) };
  }
}

// Click a plausible "send" button inside the page for a given view
async function submitInView(view) {
  if (!view || !view.webContents) return { ok:false, error:'no-view' };
  try {
    const result = await view.webContents.executeJavaScript(`
      (function(){
        try {
          const candidates = [
            'button[data-testid="send-button"]:not([disabled])',
            'button[aria-label*="Send" i]:not([disabled])',
            'button[type="submit"]:not([disabled])',
            'button[aria-label*="发送" i]:not([disabled])',
            'button[aria-label*="send" i]:not([disabled])',
            'button[aria-label*="Send message" i]:not([disabled])'
          ];
          let btn = null;
          for (const sel of candidates) { try { btn = document.querySelector(sel); } catch (_) { btn = null; } if (btn) break; }
          if (btn) { try { btn.click(); return { ok:true, method:'button' }; } catch (_) {} }

          // Fallback: press Enter on active element / prompt (for sites like Google Search)
          function findPromptElement() {
            const selectors = [
              'textarea', '.ql-editor', 'div[contenteditable="true"]', '[role="textbox"]',
              '[aria-label*="prompt" i]', '[data-testid*="prompt" i]', '[data-testid*="textbox" i]',
              'input[name="q"]', 'input[type="text"]'
            ];
            for (const selector of selectors) {
              const els = Array.from(document.querySelectorAll(selector));
              const visible = els.filter(el => { const s = window.getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null; });
              if (visible.length) { visible.sort((a,b)=>b.getBoundingClientRect().top - a.getBoundingClientRect().top); return visible[0]; }
            }
            return null;
          }
          const el = document.activeElement && document.activeElement !== document.body ? document.activeElement : findPromptElement();
          if (el) {
            try {
              const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
              el.dispatchEvent(ev);
              const ev2 = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
              el.dispatchEvent(ev2);
              return { ok:true, method:'enter' };
            } catch (_) {}
          }

          return { ok:false, error:'no-send-button' };
        } catch (e) { return { ok:false, error: String(e && e.message || e) }; }
      })();
    `);
    return result && result.ok ? result : { ok:false, error: (result && result.error) || 'unknown' };
  } catch (e) {
    return { ok:false, error: String(e) };
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

// 聚焦当前 BrowserView 的提示输入框
ipcMain.on('focus-prompt', async () => {
  const res = await focusPromptInCurrentView();
  try { mainWindow?.webContents.send('focus-prompt-result', res); } catch (_) {}
});

// Align/Injection IPC handlers
ipcMain.handle('inject-text', async (event, payload) => {
  const text = (payload && payload.text) ? String(payload.text) : '';
  return await insertTextIntoCurrentView(text);
});
ipcMain.handle('inject-and-send', async (event, payload) => {
  const text = (payload && payload.text) ? String(payload.text) : '';
  const res = await insertTextIntoCurrentView(text);
  if (res && res.ok) {
    const v = getActiveAiView();
    try { await submitInView(v); } catch (_) {}
  }
  return res;
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

// 🔍 关键修复：锁定/解锁窗口位置（用于插入文本时防止窗口跳动）
ipcMain.on('lock-window-position', (event, shouldLock) => {
  const wasLocked = windowPositionLock;
  windowPositionLock = shouldLock === true;
  console.log('[WINDOW_POSITION_LOCK]', windowPositionLock ? '锁定' : '解锁', '窗口位置');
  
  // 如果锁定，保存当前位置并确保不会改变
  if (windowPositionLock && mainWindow && isShowing) {
    const currentPos = mainWindow.getPosition();
    if (!lastWindowPosition) {
      lastWindowPosition = { x: currentPos[0], y: currentPos[1] };
    } else {
      // 如果已经有保存的位置，使用它（不要用当前位置覆盖）
      // 这样可以防止在锁定期间位置被意外改变
    }
    console.log('[WINDOW_POSITION_LOCK] 锁定时的位置:', lastWindowPosition);
    
    // 🔍 关键修复：立即验证并恢复位置，防止在锁定瞬间位置被改变
    const verifyPos = mainWindow.getPosition();
    if (verifyPos[0] !== lastWindowPosition.x || verifyPos[1] !== lastWindowPosition.y) {
      console.warn('[WINDOW_POSITION_LOCK] ⚠️ 锁定瞬间位置不匹配，强制恢复:', {
        expected: lastWindowPosition,
        actual: { x: verifyPos[0], y: verifyPos[1] }
      });
      mainWindow.setPosition(lastWindowPosition.x, lastWindowPosition.y);
    }
    
    // 🔍 关键修复：在锁定期间，定期检查并恢复位置（防止系统自动调整）
    if (!wasLocked) {
      // 只在第一次锁定时启动监控
      const positionGuard = setInterval(() => {
        if (!windowPositionLock || !mainWindow || !isShowing) {
          clearInterval(positionGuard);
          return;
        }
        if (!lastWindowPosition) return;
        
        const currentPos = mainWindow.getPosition();
        if (currentPos[0] !== lastWindowPosition.x || currentPos[1] !== lastWindowPosition.y) {
          console.warn('[WINDOW_POSITION_LOCK] ⚠️ 检测到位置变化，强制恢复:', {
            expected: lastWindowPosition,
            actual: { x: currentPos[0], y: currentPos[1] }
          });
          mainWindow.setPosition(lastWindowPosition.x, lastWindowPosition.y);
        }
      }, 50); // 每50ms检查一次
      
      // 存储 interval ID，以便在解锁时清理（如果需要）
      mainWindow.__positionGuardInterval = positionGuard;
    }
  } else if (!windowPositionLock && wasLocked) {
    // 解锁时，清理监控
    if (mainWindow && mainWindow.__positionGuardInterval) {
      clearInterval(mainWindow.__positionGuardInterval);
      mainWindow.__positionGuardInterval = null;
    }
  }
  
  event.reply('window-position-lock-status', windowPositionLock);
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
  
  // ============== 截屏全局快捷键 ==============
  const screenshotKey = process.platform === 'darwin' ? 'Command+Shift+K' : 'Control+Shift+K';
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
  
  // ============== 选中文字插入到侧边栏输入框 ==============
  const insertTextKey = process.platform === 'darwin' ? 'Command+Shift+Y' : 'Control+Shift+Y';
  const gotInsertText = globalShortcut.register(insertTextKey, async () => {
    console.log('选中文字插入快捷键触发:', insertTextKey);
    try {
      // 如果窗口未显示，先显示窗口
      if (!isShowing) {
        showWindow();
        // 等待窗口显示完成
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // 获取选中的文字
      const selectedText = await getSelectedText();
      
      if (!selectedText || !selectedText.trim()) {
        console.log('未检测到选中的文字');
        return;
      }
      
      console.log('获取到选中的文字:', selectedText.substring(0, 50) + '...');
      
      // 确保有可注入的 AI 视图（分屏时为左侧 AI）
      if (!getActiveAiView()) {
        // 如果没有，切回当前记录的 provider 或默认 provider
        switchToProvider(currentProviderKey || 'chatgpt');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // 插入文字到输入框
      const result = await insertTextIntoCurrentView(selectedText);
      
      if (result.ok) {
        console.log('✓ 文字已成功插入到输入框');
      } else {
        console.error('✗ 插入文字失败:', result.error);
      }
    } catch (e) {
      console.error('选中文字插入功能出错:', e);
    }
  });
  if (!gotInsertText) console.error('选中文字插入快捷键注册失败:', insertTextKey);
  else console.log('✓ 选中文字插入快捷键已注册:', insertTextKey);

  // ============== Align: 左侧输入 -> 右侧 AI 并发送 ==============
  const alignKey = process.platform === 'darwin' ? 'Command+Shift+A' : 'Control+Shift+A';
  const gotAlign = globalShortcut.register(alignKey, async () => {
    try {
      // Ensure window visible
      if (!isShowing) { showWindow(); await new Promise(r=> setTimeout(r, 200)); }

      const leftView = getLeftAiView();
      const rightView = getRightAiView();
      const thirdView = (isThreeScreenMode && thirdBrowserView) ? thirdBrowserView : null;
      if (!leftView) { console.warn('[Align] No left view'); return; }

      // Read text from left prompt
      const text = await getPromptTextFromView(leftView);
      if (!text || !text.trim()) {
        console.warn('[Align] No prompt text detected on the left');
        return;
      }

      // First, send on the left as well
      try { await submitInView(leftView); } catch (_) {}

      // Inject into right and send (if available)
      if (rightView) {
        const ins = await insertTextIntoView(rightView, text);
        if (ins && ins.ok) { try { await submitInView(rightView); } catch (_) {} }
        else { console.warn('[Align] Failed to inject into right:', ins && ins.error); }
      }

      // Inject into third and send (if available)
      if (thirdView) {
        const ins3 = await insertTextIntoView(thirdView, text);
        if (ins3 && ins3.ok) { try { await submitInView(thirdView); } catch (_) {} }
        else { console.warn('[Align] Failed to inject into third:', ins3 && ins3.error); }
      }

      // Focus右或第三，优先第三
      try {
        if (thirdView) { thirdView.webContents.focus(); lastFocusedBrowserView = thirdView; }
        else if (rightView) { rightView.webContents.focus(); lastFocusedBrowserView = rightView; }
      } catch (_) {}
    } catch (e) {
      console.error('Align (Cmd+Shift+A) failed:', e);
    }
  });
  if (!gotAlign) console.error('Align 快捷键注册失败:', alignKey);
  else console.log('✓ Align 快捷键已注册:', alignKey);
  
  // 首次启动时显示窗口并加载默认 provider
  setTimeout(() => {
    // 仅显示窗口，具体加载哪个 Provider 交由渲染进程的首帧初始化决定
    // 避免强制切到 ChatGPT 覆盖用户的首次点击（例如点了 Gemini 但被切回 ChatGPT）
    showWindow();
    // 兜底：稍后确认视图已挂载（渲染层会通过 switch-provider 指定）
    setTimeout(() => ensureBrowserViewsAttached('startup'), 300);
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
