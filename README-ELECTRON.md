# AI 侧边栏 - Mac 桌面应用

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行应用

```bash
# 开发模式（带开发者工具）
npm run dev

# 正常模式
npm start
```

### 3. 使用快捷键

按 **Option + Space** 呼出/隐藏侧边栏

## 功能特性

✅ **已实现**
- 从右侧滑入/滑出动画
- 全局快捷键：Option + Space
- 支持多个 AI 提供商（ChatGPT, Claude, Gemini 等）
- 本地存储支持
- 始终置顶窗口

🚧 **待完善**
- 窗口大小记忆
- 自定义快捷键
- 自动启动
- 系统托盘图标

## 开发说明

### 项目结构

```
.
├── electron-main.js       # Electron 主进程
├── electron-preload.js    # 预加载脚本
├── electron-adapter.js    # Chrome API 适配器
├── index.html             # 主界面
├── js/
│   ├── popup.js          # 主逻辑
│   ├── history-db.js     # 历史记录
│   └── utils.js          # 工具函数
└── css/
    └── panel.css         # 样式

```

### 关键技术点

1. **窗口动画**：使用定时器实现平滑的滑入/滑出效果
2. **API 适配**：通过 electron-adapter.js 将 Chrome 插件 API 映射到 localStorage
3. **全局快捷键**：使用 Electron 的 globalShortcut API

## 故障排除

### 快捷键不工作？
- 确保没有其他应用占用 Option + Space
- 检查系统"安全性与隐私"设置，给予应用辅助功能权限

### 窗口显示异常？
- 尝试重启应用
- 检查开发者控制台是否有错误信息（npm run dev）

## 下一步计划

1. ✅ 基础原型（窗口 + 快捷键）
2. 🔄 适配现有功能
3. ⏳ 添加系统托盘
4. ⏳ 自动更新功能
5. ⏳ 打包发布

