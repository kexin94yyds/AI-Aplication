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

// ============== 截屏和文字选择功能 ==============
if (window.electronAPI) {
  console.log('初始化截屏和文字选择功能...');
  
  // Toast 提示函数
  function showToast(text, level = 'info') {
    try {
      let box = document.getElementById('electron-toast');
      if (!box) {
        box = document.createElement('div');
        box.id = 'electron-toast';
        box.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;background:#111827;color:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:12px;max-width:60%;opacity:.98;';
        document.body.appendChild(box);
      }
      box.textContent = String(text || '');
      box.style.background = level === 'error' ? '#b91c1c' : (level === 'warn' ? '#92400e' : '#111827');
      box.style.display = 'block';
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => {
        try { box.style.display = 'none'; } catch (_) {}
      }, 2200);
    } catch (_) {}
  }
  
  // 获取当前活动的 BrowserView iframe
  function getActiveBrowserViewFrame() {
    try {
      // BrowserView 模式下，provider iframe 在主 index.html 之外
      // 我们需要通过 postMessage 与 BrowserView 通信
      // 由于无法直接访问 BrowserView 的 DOM，我们需要让主进程来处理
      return null; // BrowserView 无法直接访问
    } catch (_) {
      return null;
    }
  }
  
  // 查找输入框（用于在主窗口中显示截图预览）
  function findPromptElement() {
    try {
      // 在主窗口中，我们可能需要创建一个预览界面
      // 或者直接通知 BrowserView
      return null;
    } catch (_) {
      return null;
    }
  }
  
  // 将截图发送到 BrowserView
  function sendImageToBrowserView(dataUrl, { autoPasted } = { autoPasted: true }) {
    try {
      console.log('[Electron Adapter] 收到截图，大小:', (dataUrl.length / 1024).toFixed(2), 'KB');
      
      // 主进程会尝试自动粘贴
      const tip = autoPasted
        ? '截图已捕获，正在自动插入到输入框…'
        : '截图已捕获！若未出现请 Cmd/Ctrl+V 粘贴';
      showToast(tip, 'info');
    } catch (e) {
      console.error('发送截图失败:', e);
      showToast('发送截图失败', 'error');
    }
  }
  
  // 监听截屏结果
  window.electronAPI.onScreenshotCaptured((data) => {
    console.log('[Electron Adapter] 收到截图:', data);
    sendImageToBrowserView(data.dataUrl, { autoPasted: !!data.autoPasted });
  });
  
  // 监听截屏错误
  window.electronAPI.onScreenshotError((error) => {
    console.error('[Electron Adapter] 截屏错误:', error);
    showToast('截屏失败: ' + error, 'error');
  });
  
  // 监听自动粘贴结果
  window.electronAPI.onScreenshotPasteResult?.((res) => {
    if (!res) return;
    if (res.ok) {
      showToast('图片已自动插入到输入框', 'info');
    } else {
      showToast('⚠️ 未能自动插入图片，请按 Cmd/Ctrl+V 粘贴', 'warn');
    }
  });
  
  console.log('截屏功能已初始化！');
  console.log('- 按 Cmd+Shift+K (Mac) 或 Ctrl+Shift+K (Windows) 截屏');
  
  // ============== 收藏同步功能 ==============
  // 监听从 history-panel 发来的收藏请求
  window.electronAPI.onStarHistoryItem?.((data) => {
    console.log('[Electron Adapter] 收到收藏请求:', data);
    if (data && data.url) {
      // 调用 popup.js 中的 addFavorite 函数
      if (typeof window.addFavorite === 'function') {
        window.addFavorite({
          url: data.url,
          title: data.title || '',
          provider: data.provider || 'Unknown'
        }).then(() => {
          showToast('已添加到收藏', 'info');
          // 刷新历史面板
          window.electronAPI?.refreshHistoryPanel?.();
        }).catch((e) => {
          console.error('添加收藏失败:', e);
          showToast('添加收藏失败', 'error');
        });
      }
    }
  });
  
  // 监听删除历史记录请求
  window.electronAPI.onDeleteHistoryItem?.((data) => {
    console.log('[Electron Adapter] 收到删除历史请求:', data);
    if (data && data.url && typeof window.HistoryDB?.removeByUrl === 'function') {
      window.HistoryDB.removeByUrl(data.url).then(() => {
        showToast('已删除', 'info');
        window.electronAPI?.refreshHistoryPanel?.();
      }).catch((e) => {
        console.error('删除历史失败:', e);
      });
    }
  });
  
  // 监听删除收藏请求
  window.electronAPI.onDeleteFavoritesItem?.((data) => {
    console.log('[Electron Adapter] 收到删除收藏请求:', data);
    if (data && data.url) {
      (async () => {
        try {
          const list = await window.loadFavorites?.() || [];
          const filtered = list.filter(f => f && f.url !== data.url);
          await window.saveFavorites?.(filtered);
          showToast('已删除收藏', 'info');
          window.electronAPI?.refreshFavoritesPanel?.();
        } catch (e) {
          console.error('删除收藏失败:', e);
        }
      })();
    }
  });
}
