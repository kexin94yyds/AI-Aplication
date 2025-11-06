const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  isElectron: true,
  
  // Provider 切换 - 使用 BrowserView
  switchProvider: (providerKey) => {
    console.log('[Preload] switchProvider called with:', providerKey);
    ipcRenderer.send('switch-provider', providerKey);
  },
  
  // 在浏览器中打开 URL
  openInBrowser: (url) => {
    ipcRenderer.send('open-in-browser', url);
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
  
  // 置顶控制
  toggleAlwaysOnTop: () => {
    ipcRenderer.send('toggle-always-on-top');
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
  }
});

// 日志
console.log('[Preload] Electron Preload 脚本已加载 - BrowserView 模式');
