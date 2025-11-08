const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  isElectron: true,
  
  // Provider 切换 - 使用 BrowserView
  switchProvider: (providerKey, url) => {
    try {
      const payload = (typeof providerKey === 'object' && providerKey)
        ? providerKey
        : { key: providerKey, url };
      console.log('[Preload] switchProvider called with:', payload);
      ipcRenderer.send('switch-provider', payload);
    } catch (e) {
      console.error('[Preload] switchProvider error:', e);
    }
  },
  
  // 在浏览器中打开 URL
  openInBrowser: (url) => {
    ipcRenderer.send('open-in-browser', url);
  },
  
  // 内嵌浏览器功能
  openEmbeddedBrowser: (url) => {
    ipcRenderer.send('open-embedded-browser', url);
  },
  closeEmbeddedBrowser: () => {
    ipcRenderer.send('close-embedded-browser');
  },
  onEmbeddedBrowserOpened: (callback) => {
    ipcRenderer.on('embedded-browser-opened', (event, data) => callback(data));
  },
  onEmbeddedBrowserClosed: (callback) => {
    ipcRenderer.on('embedded-browser-closed', () => callback());
  },
  onEmbeddedBrowserUrlChanged: (callback) => {
    ipcRenderer.on('embedded-browser-url-changed', (event, data) => callback(data));
  },
  navigateEmbeddedBrowser: (url) => {
    ipcRenderer.send('navigate-embedded-browser', url);
  },
  setSplitRatio: (ratio) => {
    ipcRenderer.send('set-split-ratio', ratio);
  },
  // 左侧导航栏宽度（用于让出 BrowserView 左边距）
  setSidebarWidth: (px) => {
    ipcRenderer.send('set-sidebar-width', px);
  },
  
  // 获取当前 BrowserView 的 URL
  getCurrentUrl: () => {
    return new Promise((resolve) => {
      ipcRenderer.once('current-url', (event, url) => {
        resolve(url);
      });
      ipcRenderer.send('get-current-url');
    });
  },
  
  // 监听 provider 切换事件
  onProviderSwitched: (callback) => {
    ipcRenderer.on('provider-switched', (event, providerKey) => {
      callback(providerKey);
    });
  },
  
  // 监听 BrowserView URL 变化
  onBrowserViewUrlChanged: (callback) => {
    ipcRenderer.on('browserview-url-changed', (event, data) => {
      callback(data);
    });
  },
  
  // ============== 截屏功能 ==============
  captureScreenshot: () => {
    ipcRenderer.send('capture-screenshot');
  },
  onScreenshotCaptured: (callback) => {
    ipcRenderer.on('screenshot-captured', (event, data) => callback(data));
  },
  onScreenshotError: (callback) => {
    ipcRenderer.on('screenshot-error', (event, error) => callback(error));
  },
  onScreenshotPasteResult: (callback) => {
    ipcRenderer.on('screenshot-auto-paste-result', (event, data) => callback(data));
  },
  // 主动请求聚焦 BrowserView 中的提示输入框
  focusPrompt: () => { try { ipcRenderer.send('focus-prompt'); } catch (_) {} },
  onFocusPromptResult: (cb) => { ipcRenderer.on('focus-prompt-result', (e, res) => { try { cb(res); } catch (_) {} }); },
  
  
  // 置顶控制
  toggleAlwaysOnTop: () => {
    ipcRenderer.send('toggle-always-on-top');
  },

  // 顶部预留区域（保障浮层位于 BrowserView 之上）
  setTopInset: (px) => {
    try { ipcRenderer.send('set-top-inset', Math.max(0, Math.floor(px||0))); } catch (_) {}
  },

  // 覆盖模式：临时隐藏 BrowserView，让面板真正浮在上面
  enterOverlay: () => { try { ipcRenderer.send('overlay-enter'); } catch(_){} },
  exitOverlay: () => { try { ipcRenderer.send('overlay-exit'); } catch(_){} },

  // 全宽切换（非操作系统原生全屏，保持当前 Space）
  toggleFullWidth: () => {
    ipcRenderer.send('toggle-full-width');
  },
  getFullWidthState: () => {
    return new Promise((resolve) => {
      ipcRenderer.once('full-width-state', (event, state) => resolve(state));
      ipcRenderer.send('get-full-width-state');
    });
  },
  onFullWidthChanged: (callback) => {
    ipcRenderer.on('full-width-changed', (event, state) => callback(state));
  },
  onAppFocus: (callback) => {
    ipcRenderer.on('app-focus', (event, payload) => { try { callback(payload); } catch (_) {} });
  },
  onAppVisibility: (callback) => {
    ipcRenderer.on('app-visibility', (event, payload) => { try { callback(payload); } catch (_) {} });
  },

  // Overlay debug events from main process
  onOverlayState: (callback) => {
    ipcRenderer.on('overlay-state', (event, payload) => { try { callback(payload); } catch (_) {} });
  },
  onOverlayBrowserView: (callback) => {
    ipcRenderer.on('overlay-browserview', (event, payload) => { try { callback(payload); } catch (_) {} });
  },
  
  // 获取置顶状态
  getAlwaysOnTop: () => {
    return new Promise((resolve) => {
      ipcRenderer.once('always-on-top-status', (event, status) => {
        resolve(status);
      });
      ipcRenderer.send('get-always-on-top');
    });
  },
  
  // 监听置顶状态变化
  onAlwaysOnTopChanged: (callback) => {
    ipcRenderer.on('always-on-top-changed', (event, status) => {
      callback(status);
    });
  },
  
  // Tab 键切换 provider（支持方向）
  onCycleProvider: (callback) => {
    ipcRenderer.on('cycle-provider', (event, payload) => {
      try { callback(payload); } catch (_) { callback && callback(); }
    });
  },

  // 文件同步（与浏览器插件共享数据）
  sync: {
    setBase: (dir) => { ipcRenderer.send('sync-set-base', dir); },
    read: (name) => new Promise((resolve) => {
      ipcRenderer.once('sync-read-resp', (e, payload) => {
        if (payload && payload.name === name) resolve(payload.data); else resolve(null);
      });
      ipcRenderer.send('sync-read', { name });
    }),
    write: (name, data) => {
      ipcRenderer.send('sync-write', { name, data });
    },
    onUpdated: (cb) => {
      ipcRenderer.on('sync-updated', (e, payload) => { try { cb(payload && payload.name, payload && payload.data); } catch(_){} });
    }
  },
  
  // 存储 API（使用 localStorage 作为简单实现）
  storage: {
    get: async (key) => {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (e) {
        return null;
      }
    },
    set: async (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove: async (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    }
  },
  
  // 🔍 关键修复：锁定/解锁窗口位置（用于插入文本时防止窗口跳动）
  lockWindowPosition: (shouldLock) => {
    try {
      ipcRenderer.send('lock-window-position', shouldLock);
    } catch (e) {
      console.error('[Preload] lockWindowPosition error:', e);
    }
  }
});

// 日志
console.log('[Preload] Electron Preload 脚本已加载 - BrowserView 模式');
