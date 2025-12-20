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
  closeThirdScreen: () => {
    ipcRenderer.send('close-third-screen');
  },
  closeActivePane: (side) => {
    ipcRenderer.send('close-active-pane', { side });
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
  // 第三屏浏览器导航与事件
  navigateThirdBrowser: (url) => {
    ipcRenderer.send('navigate-third-browser', url);
  },
  onThirdBrowserUrlChanged: (callback) => {
    ipcRenderer.on('third-browser-url-changed', (event, data) => callback(data));
  },
  setSplitRatio: (ratio) => {
    ipcRenderer.send('set-split-ratio', ratio);
  },
  
  // 第三屏（三分屏）支持
  setThreeScreenMode: (enable) => {
    try { ipcRenderer.send('set-three-screen-mode', !!enable); } catch (_) {}
  },
  setThreeSplitRatios: (r1, r2) => {
    try { ipcRenderer.send('set-three-ratios', { r1, r2 }); } catch (_) {}
  },
  openThirdScreen: (url) => {
    try { ipcRenderer.send('open-third-screen', { url }); } catch (_) {}
  },
  switchThirdProvider: (key, url) => {
    try { ipcRenderer.send('switch-third-provider', { key, url }); } catch (_) {}
  },
  focusThirdScreen: () => {
    try { ipcRenderer.send('focus-third'); } catch (_) {}
  },
  onThirdClosed: (callback) => {
    ipcRenderer.on('third-screen-closed', () => callback && callback());
  },
  onThirdOpened: (callback) => {
    ipcRenderer.on('third-screen-opened', (event, data) => { try { callback && callback(data); } catch (_) {} });
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

  // 截图多屏同步模式（Align 开关）
  setAlignScreenshotMode: (enabled) => {
    try { ipcRenderer.send('set-align-screenshot-mode', !!enabled); } catch (_) {}
  },
  onFocusPromptResult: (cb) => { ipcRenderer.on('focus-prompt-result', (e, res) => { try { cb(res); } catch (_) {} }); },
  
  
  // 置顶控制
  toggleAlwaysOnTop: () => {
    ipcRenderer.send('toggle-always-on-top');
  },

  // 顶部预留区域（保障浮层位于 BrowserView 之上）
  setTopInset: (px) => {
    try { ipcRenderer.send('set-top-inset', Math.max(0, Math.floor(px||0))); } catch (_) {}
  },

  // 查询当前是否处于分屏/三分屏模式（用于渲染层初始化时同步 UI 状态）
  getSplitState: () => {
    return new Promise((resolve) => {
      try {
        ipcRenderer.once('split-state', (event, payload) => {
          try {
            const safe = payload && typeof payload === 'object' ? payload : {};
            resolve({
              isEmbedded: !!safe.isEmbedded,
              isThree: !!safe.isThree
            });
          } catch (_) {
            resolve({ isEmbedded: false, isThree: false });
          }
        });
        ipcRenderer.send('get-split-state');
      } catch (_) {
        resolve({ isEmbedded: false, isThree: false });
      }
    });
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

  // Text injection helpers for Align/Multisend
  injectText: async (text) => {
    try { return await ipcRenderer.invoke('inject-text', { text }); } catch (e) { return { ok:false, error: String(e) }; }
  },
  injectAndSend: async (text) => {
    try { return await ipcRenderer.invoke('inject-and-send', { text }); } catch (e) { return { ok:false, error: String(e) }; }
  },

  // 侧向指示（渲染层 -> 主进程）
  setActiveSide: (side) => {
    try {
      const s = (side === 'right' || side === 'third') ? side : 'left';
      ipcRenderer.send('active-side', s);
    } catch (_) {}
  },

  // Tab 锁定（将 Tab/Shift+Tab 强制绑定到某一侧；传入 'left' | 'right' | 'third' | null）
  setTabLock: (side) => {
    try {
      const s =
        side === 'left' ? 'left'
        : side === 'right' ? 'right'
        : side === 'third' ? 'third'
        : null;
      ipcRenderer.send('set-tab-lock', s);
    } catch (_) {}
  },
  getTabLock: () => new Promise((resolve) => {
    const handler = (event, payload) => { try { resolve((payload && payload.side) || null); } catch (_) { resolve(null); } finally { ipcRenderer.removeListener('tab-lock-changed', handler); } };
    ipcRenderer.on('tab-lock-changed', handler);
    try { ipcRenderer.send('get-tab-lock'); } catch (_) { resolve(null); }
  }),
  onTabLockChanged: (cb) => {
    ipcRenderer.on('tab-lock-changed', (event, payload) => { try { cb(payload && payload.side); } catch (_) {} });
  },

  // 聚焦右侧内嵌浏览器，确保连续 Tab/Shift+Tab 无需点击
  focusEmbedded: () => {
    try { ipcRenderer.send('focus-embedded'); } catch (_) {}
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
  },
  
  // 窗口最大化/恢复
  toggleMaximize: () => {
    try {
      ipcRenderer.send('toggle-maximize');
    } catch (e) {
      console.error('[Preload] toggleMaximize error:', e);
    }
  },
  
  // 获取窗口是否最大化
  isMaximized: () => {
    return new Promise((resolve) => {
      ipcRenderer.once('is-maximized-response', (event, isMaximized) => {
        resolve(isMaximized);
      });
      ipcRenderer.send('is-maximized');
    });
  },
  
  // 监听窗口最大化状态变化
  onMaximizeChanged: (callback) => {
    ipcRenderer.on('maximize-changed', (event, isMaximized) => {
      callback(isMaximized);
    });
  },
  
  // 关闭窗口
  closeWindow: () => {
    try {
      ipcRenderer.send('close-window');
    } catch (e) {
      console.error('[Preload] closeWindow error:', e);
    }
  },

  // 页面内搜索 (Cmd+F)
  findInPage: (text, options = {}) => {
    try {
      ipcRenderer.send('find-in-page', { text, options });
    } catch (e) {
      console.error('[Preload] findInPage error:', e);
    }
  },
  findInPageNext: (text) => {
    try {
      ipcRenderer.send('find-in-page', { text, options: { forward: true, findNext: true } });
    } catch (e) {
      console.error('[Preload] findInPageNext error:', e);
    }
  },
  findInPagePrev: (text) => {
    try {
      ipcRenderer.send('find-in-page', { text, options: { forward: false, findNext: true } });
    } catch (e) {
      console.error('[Preload] findInPagePrev error:', e);
    }
  },
  stopFindInPage: () => {
    try {
      ipcRenderer.send('stop-find-in-page');
    } catch (e) {
      console.error('[Preload] stopFindInPage error:', e);
    }
  },
  onFindInPageResult: (callback) => {
    ipcRenderer.on('find-in-page-result', (event, result) => {
      try { callback(result); } catch (_) {}
    });
  },
  onToggleSearch: (callback) => {
    ipcRenderer.on('toggle-search', () => {
      try { callback(); } catch (_) {}
    });
  },
  focusRenderer: () => {
    try { ipcRenderer.send('focus-renderer'); } catch (_) {}
  },

  // ============== History 面板 ==============
  toggleHistoryPanel: () => {
    try { ipcRenderer.send('toggle-history-panel'); } catch (_) {}
  },
  onGetHistoryData: (cb) => {
    ipcRenderer.on('get-history-data', () => { try { cb(); } catch (_) {} });
  },
  sendHistoryData: (data) => {
    try { ipcRenderer.send('history-panel-data', data); } catch (_) {}
  },
  onOpenHistoryItem: (cb) => {
    ipcRenderer.on('open-history-item', (e, d) => { try { cb(d); } catch (_) {} });
  },
  onExportHistory: (cb) => {
    ipcRenderer.on('export-history', () => { try { cb(); } catch (_) {} });
  },
  onImportHistory: (cb) => {
    ipcRenderer.on('import-history', () => { try { cb(); } catch (_) {} });
  },
  onImportHistoryData: (cb) => {
    ipcRenderer.on('import-history-data', (e, data) => { try { cb(data); } catch (_) {} });
  },
  onClearAllHistory: (cb) => {
    ipcRenderer.on('clear-all-history', () => { try { cb(); } catch (_) {} });
  },
  onStarHistoryItem: (cb) => {
    ipcRenderer.on('star-history-item', (e, d) => { try { cb(d); } catch (_) {} });
  },
  onDeleteHistoryItem: (cb) => {
    ipcRenderer.on('delete-history-item', (e, d) => { try { cb(d); } catch (_) {} });
  },
  onRenameHistoryItem: (cb) => {
    ipcRenderer.on('rename-history-item', (e, d) => { try { cb(d); } catch (_) {} });
  },
  refreshHistoryPanel: () => {
    try { ipcRenderer.send('refresh-history-panel'); } catch (_) {}
  },

  // ============== Favorites 面板 ==============
  toggleFavoritesPanel: () => {
    try { ipcRenderer.send('toggle-favorites-panel'); } catch (_) {}
  },
  onGetFavoritesData: (cb) => {
    ipcRenderer.on('get-favorites-data', () => { try { cb(); } catch (_) {} });
  },
  sendFavoritesData: (data) => {
    try { ipcRenderer.send('favorites-panel-data', data); } catch (_) {}
  },
  onOpenFavoritesItem: (cb) => {
    ipcRenderer.on('open-favorites-item', (e, d) => { try { cb(d); } catch (_) {} });
  },
  onExportFavorites: (cb) => {
    ipcRenderer.on('export-favorites', () => { try { cb(); } catch (_) {} });
  },
  onImportFavorites: (cb) => {
    ipcRenderer.on('import-favorites', () => { try { cb(); } catch (_) {} });
  },
  onImportFavoritesData: (cb) => {
    ipcRenderer.on('import-favorites-data', (e, data) => { try { cb(data); } catch (_) {} });
  },
  onClearAllFavorites: (cb) => {
    ipcRenderer.on('clear-all-favorites', () => { try { cb(); } catch (_) {} });
  },
  onDeleteFavoritesItem: (cb) => {
    ipcRenderer.on('delete-favorites-item', (e, d) => { try { cb(d); } catch (_) {} });
  },
  onRenameFavoritesItem: (cb) => {
    ipcRenderer.on('rename-favorites-item', (e, d) => { try { cb(d); } catch (_) {} });
  },
  refreshFavoritesPanel: () => {
    try { ipcRenderer.send('favorites-panel-get-data'); } catch (_) {}
  }
});

// 日志
console.log('[Preload] Electron Preload 脚本已加载 - BrowserView 模式');
