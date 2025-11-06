// Electron 适配器 - 将 Chrome 插件 API 映射到 Electron API
// 在 popup.js 之前加载此文件

console.log('Electron 适配器加载中...');

// 创建 chrome.storage.local 的模拟实现
if (typeof chrome === 'undefined') {
  window.chrome = {};
}

if (!chrome.storage) {
  chrome.storage = {
    local: {
      get: function(keys, callback) {
        try {
          const result = {};
          const keyArray = Array.isArray(keys) ? keys : [keys];
          
          for (const key of keyArray) {
            const value = localStorage.getItem(key);
            if (value !== null) {
              try {
                result[key] = JSON.parse(value);
              } catch (e) {
                result[key] = value;
              }
            }
          }
          
          if (callback) {
            callback(result);
          }
          return Promise.resolve(result);
        } catch (e) {
          console.error('storage.get error:', e);
          if (callback) callback({});
          return Promise.resolve({});
        }
      },
      
      set: function(items, callback) {
        try {
          for (const [key, value] of Object.entries(items)) {
            localStorage.setItem(key, JSON.stringify(value));
          }
          
          if (callback) {
            callback();
          }
          return Promise.resolve();
        } catch (e) {
          console.error('storage.set error:', e);
          return Promise.resolve();
        }
      },
      
      remove: function(keys, callback) {
        try {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          
          for (const key of keyArray) {
            localStorage.removeItem(key);
          }
          
          if (callback) {
            callback();
          }
          return Promise.resolve();
        } catch (e) {
          console.error('storage.remove error:', e);
          return Promise.resolve();
        }
      }
    }
  };
}

// 创建 chrome.runtime 的模拟实现
if (!chrome.runtime) {
  chrome.runtime = {
    onMessage: {
      addListener: function(callback) {
        console.log('runtime.onMessage.addListener called (no-op in Electron)');
      }
    },
    sendMessage: function(message, callback) {
      console.log('runtime.sendMessage called:', message, '(no-op in Electron)');
      if (callback) callback();
    }
  };
}

// 创建 chrome.permissions 的模拟实现
if (!chrome.permissions) {
  chrome.permissions = {
    request: function(permissions, callback) {
      console.log('permissions.request called:', permissions, '(auto-granted in Electron)');
      if (callback) callback(true);
      return Promise.resolve(true);
    }
  };
}

console.log('Electron 适配器加载完成！Chrome API 已模拟。');

