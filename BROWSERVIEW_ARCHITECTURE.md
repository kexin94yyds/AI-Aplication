# BrowserView 架构说明

## 🎯 核心改进

从 iframe/webview 标签重构为 Electron 的 BrowserView API，实现真正的浏览器体验。

### 为什么使用 BrowserView？

1. **绕过网站限制** - 不受 X-Frame-Options 和 CSP 限制
2. **独立会话** - 每个 AI 服务有独立的 session，登录状态互不干扰
3. **真实浏览器** - 完全等同于在 Chrome 中打开网站
4. **性能更好** - 直接使用 Chromium 渲染，无额外开销

## 📁 文件结构

```
electron-main.js       - 主进程，管理 BrowserView
electron-preload.js    - Preload 脚本，IPC 桥接
js/popup.js           - 渲染进程，保留所有插件功能
index.html            - UI 界面（完整功能）
css/panel.css         - 样式
```

## 🔄 工作原理

### 1. Provider 切换流程

```
用户点击侧边栏按钮
  ↓
popup.js 检测到点击
  ↓
调用 window.electronAPI.switchProvider(key)
  ↓
preload.js 转发到主进程 (IPC)
  ↓
electron-main.js 收到请求
  ↓
创建或复用 BrowserView
  ↓
切换显示的 BrowserView
  ↓
更新 BrowserView 位置和大小
```

### 2. BrowserView 管理

每个 AI 服务对应一个独立的 BrowserView：

```javascript
const PROVIDERS = {
  chatgpt: { url: 'https://chatgpt.com', partition: 'persist:chatgpt' },
  claude: { url: 'https://claude.ai', partition: 'persist:claude' },
  // ...
};

// 缓存 BrowserView，避免重复创建
const browserViews = {};

function getOrCreateBrowserView(providerKey) {
  if (browserViews[providerKey]) {
    return browserViews[providerKey]; // 复用
  }
  
  // 创建新的 BrowserView
  const view = new BrowserView({
    webPreferences: {
      partition: provider.partition, // 独立会话
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  
  view.webContents.loadURL(provider.url);
  browserViews[providerKey] = view;
  return view;
}
```

### 3. 窗口布局

```
┌─────────────────────────────────┐
│  主窗口 (BrowserWindow)          │
│  ┌────┬─────────────────────┐   │
│  │    │                     │   │
│  │ 导 │  BrowserView        │   │
│  │ 航 │  (AI 网站内容)      │   │
│  │ 栏 │                     │   │
│  │    │                     │   │
│  │ 60 │     (动态切换)      │   │
│  │ px │                     │   │
│  │    │                     │   │
│  └────┴─────────────────────┘   │
└─────────────────────────────────┘
```

## ✨ 保留的所有功能

### 工具栏功能
- ⭐ Star/Unstar - 收藏当前页面
- 🔗 Open in Tab - 在浏览器中打开
- ❤️ Favorites - 收藏夹管理
- 🔍 Search - 页面内搜索
- 📜 History - 历史记录
- ⚙️ Settings - 快捷键设置

### 侧边栏功能
- 🎨 图标显示
- 🔄 拖拽排序
- 🔘 活动状态指示
- 📁 折叠/展开

### 键盘快捷键
- `Option + Space` - 显示/隐藏窗口
- `Tab` - 切换 AI 服务
- `Ctrl + H` - 历史记录
- `Ctrl + L` - 收藏夹
- `Ctrl + Shift + F` - 搜索
- 自定义快捷键支持

## 🔧 技术细节

### IPC 通信

**渲染进程 → 主进程**
```javascript
// popup.js
window.electronAPI.switchProvider('chatgpt');
```

**Preload 脚本**
```javascript
// electron-preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  switchProvider: (key) => ipcRenderer.send('switch-provider', key)
});
```

**主进程处理**
```javascript
// electron-main.js
ipcMain.on('switch-provider', (event, providerKey) => {
  switchToProvider(providerKey);
});
```

### 会话隔离

每个 AI 服务使用独立的 partition：

```javascript
partition: 'persist:chatgpt'  // ChatGPT 的 cookies/localStorage
partition: 'persist:claude'    // Claude 的 cookies/localStorage
// ...
```

登录状态完全隔离，互不干扰。

### 窗口位置管理

```javascript
// 始终固定在屏幕右侧
function updatePosition() {
  const screenWidth = screen.getPrimaryDisplay().workAreaSize.width;
  const windowWidth = mainWindow.getBounds().width;
  const x = screenWidth - windowWidth;
  mainWindow.setPosition(x, 0);
}

// 定时检查位置
setInterval(updatePosition, 1000);
```

### BrowserView 自适应

```javascript
// 窗口大小变化时自动调整 BrowserView
mainWindow.on('resize', () => {
  if (currentBrowserView) {
    const bounds = mainWindow.getContentBounds();
    currentBrowserView.setBounds({
      x: 60, // 左侧导航栏宽度
      y: 0,
      width: bounds.width - 60,
      height: bounds.height
    });
  }
});
```

## 📊 与插件版本对比

| 特性 | 插件版本 | BrowserView 版本 |
|------|---------|------------------|
| 网站限制 | ❌ 受 X-Frame-Options 限制 | ✅ 无限制 |
| 登录状态 | ⚠️ 可能丢失 | ✅ 持久化 |
| 性能 | 🐢 iframe 开销 | 🚀 原生渲染 |
| 功能完整性 | ✅ 完整 | ✅ 完整 |
| 独立会话 | ❌ 共享 | ✅ 完全隔离 |
| 开发者工具 | ⚠️ 有限 | ✅ 完整支持 |

## 🚀 启动和测试

### 启动应用
```bash
npm run dev
```

### 测试功能
1. ✅ 按 `Option + Space` 呼出侧边栏
2. ✅ 点击不同 AI 图标切换
3. ✅ ChatGPT、Claude、Gemini 等完整加载
4. ✅ 登录后刷新，状态保持
5. ✅ 工具栏所有按钮正常工作
6. ✅ 快捷键功能正常

### 已知问题
部分网站可能仍然无法加载（服务端限制）：
- Perplexity (ERR_BLOCKED_BY_RESPONSE)
- 通义千问 (ERR_BLOCKED_BY_RESPONSE)

这需要进一步研究绕过方案。

## 🔮 未来优化

1. **懒加载** - 只创建用户访问过的 BrowserView
2. **内存管理** - 限制同时存在的 BrowserView 数量
3. **注入脚本** - 为每个网站添加自定义功能
4. **User-Agent** - 自定义 UA 绕过检测
5. **代理支持** - 为特定站点配置代理

## 📝 开发日志

- **2025-11-06** - 完成 BrowserView 重构
- **2025-11-06** - 保留所有插件功能
- **2025-11-06** - 测试通过

---

**架构设计者**: AI Assistant  
**参考**: Slidepad, Arc Browser


