const { app, BrowserWindow, BrowserView, globalShortcut, screen, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let isShowing = false;
let currentBrowserView = null;
const browserViews = {}; // 缓存所有 BrowserView

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
  // 顶部留出 50px 给 hover zone 和工具栏
  const topBarHeight = 50;
  
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

// IPC 事件处理
ipcMain.on('switch-provider', (event, providerKey) => {
  console.log('IPC received switch-provider:', providerKey);
  switchToProvider(providerKey);
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
  
  // 注册全局快捷键：Option + Space
  const ret = globalShortcut.register('Alt+Space', () => {
    console.log('全局快捷键触发：Option + Space');
    toggleWindow();
  });
  
  if (!ret) {
    console.error('快捷键注册失败');
  }
  
  console.log('快捷键已注册:', globalShortcut.isRegistered('Alt+Space'));
  console.log('应用已启动！按 Option + Space 呼出侧边栏');
  
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
