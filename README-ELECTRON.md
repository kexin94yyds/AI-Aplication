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
- 分屏右侧地址栏支持“锁定 Tab 到右侧”（Lock ▶︎ 按钮）

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

### 使用技巧：锁定 Tab 到右侧
- 在分屏模式下，地址栏内有一个 “Lock ▶︎” 按钮。
- 点击开启后，Tab/Shift+Tab 将始终只在右侧循环切换（无论当前焦点在哪里）。
- 再次点击可解除锁定；状态在本地记忆（重启后自动恢复）。

## 故障排除

### 快捷键不工作？
- 确保没有其他应用占用 Option + Space
- 检查系统"安全性与隐私"设置，给予应用辅助功能权限

### 窗口显示异常？
- 尝试重启应用
- 检查开发者控制台是否有错误信息（npm run dev）

### 加载外部站点出现 SSL/TLS 错误（ERR_CONNECTION_CLOSED / 握手失败）？
- 现象：控制台看到类似日志
  - `handshake failed; returned -1, SSL error code 1, net_error -100`
  - `Failed to load URL: https://gemini.google.com/app with error: ERR_CONNECTION_CLOSED`
- 常见原因：某些网络/公司代理/安全网关对最新版的 TLS 特性（如 ECH、HTTPS SVCB 记录、TLS1.3）兼容不佳，或对 Electron/Chromium 的网络栈处理存在差异。
- 解决建议（按需启用，默认关闭）：
  1) 启用网络兼容模式（禁用 ECH/SVCB/QUIC 且将最小 TLS 版本设为 1.2）
     - macOS/Linux:
       - `AISB_NET_COMPAT=1 npm run dev`
       - 或 `AISB_NET_COMPAT=1 npm start`
  2) 仅禁用 ECH/SVCB：
       - `AISB_DISABLE_ECH=1 npm run dev`
  3) 记录 Chromium 网络日志，便于排查：
       - `AISB_NETLOG=/tmp/netlog.json npm run dev`
  4) 临时忽略证书错误（仅调试使用，勿在生产环境）：
       - `AISB_IGNORE_CERT_ERRORS=1 npm run dev`

提示：如果在 Chrome/Edge 中可正常访问，而在本应用中报上述错误，通常是网络设备/代理对 Electron 的新 TLS/DNS 特性兼容性问题。启用第 1 条“网络兼容模式”最常见可解。

## 打包与发布

### 快速打包

项目已配置好 `electron-builder`，支持一键打包：

```bash
# 1. 安装依赖（如果还没安装）
npm install

# 2. 快速验证（生成未打包的应用目录，不生成安装器）
npm run pack

# 3. 生成安装包/可执行文件
npm run dist
```

### 打包输出

#### macOS
- **DMG 安装包**：`dist/AI Sidebar-*.dmg`
- **ZIP 压缩包**：`dist/AI Sidebar-*.zip`
- **未打包目录**：`dist/mac-arm64/AI Sidebar.app`

#### Windows
- **NSIS 安装包**：`dist/AI Sidebar Setup *.exe`
- **未打包目录**：`dist/win-unpacked/`

#### Linux
- **AppImage**：`dist/AI Sidebar-*.AppImage`
- **未打包目录**：`dist/linux-unpacked/`

### 打包配置说明

打包配置位于 `package.json` 的 `build` 字段：

- **应用 ID**：`com.example.ai-sidebar`（可自定义）
- **产品名称**：`AI Sidebar`
- **分类**：macOS 为 `productivity`，Linux 为 `Utility`
- **图标**：使用 `images/image.png`（1024x1024）
- **文件包含**：仅包含运行所需文件（html/js/css/images/vendor 等）
- **压缩**：已启用 `asar` 减小体积

### macOS 权限说明

#### 屏幕录制权限（截屏功能）
首次使用截屏功能时，系统会要求授予"屏幕录制"权限：
1. 系统设置 → 隐私与安全性 → 屏幕录制
2. 勾选你的应用
3. 重启应用

#### 辅助功能权限（文字选择功能，可选）
若希望"选中文字自动复制"功能更完善，需要"辅助功能"权限：
1. 系统设置 → 隐私与安全性 → 辅助功能
2. 勾选你的应用

### 代码签名与公证（可选）

#### 本地自用
- 无需签名，直接使用打包的应用即可
- macOS 首次打开可能提示"无法验证开发者"，在"系统设置 → 隐私与安全性"中点击"仍要打开"

#### 分发给他人
建议进行代码签名和公证，避免用户看到安全警告：

1. **获取开发者证书**：
   - 注册 Apple Developer 账号（$99/年）
   - 在 Xcode 或 Apple Developer 网站创建证书

2. **配置签名**：
   在 `package.json` 的 `build.mac` 中添加：
   ```json
   "mac": {
     "identity": "Developer ID Application: Your Name (TEAM_ID)"
   }
   ```

3. **启用公证**（可选）：
   ```json
   "afterSign": "scripts/notarize.js"
   ```
   需要配置 Apple ID 和 App-Specific Password

### 常见问题

#### 图标问题
- 当前使用 `images/image.png`（1024x1024）
- 如需更清晰的图标，可替换为 `.icns`（macOS）或 `.ico`（Windows）
- 图标文件需至少 512x512 像素

#### 打包体积
- 首次打包会较大（包含 Electron 运行时）
- 已启用 `asar` 压缩减小体积
- 可通过排除不必要的文件进一步优化

#### 构建错误
- **macOS**：确保安装了 Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```
- **Windows**：需要允许 PowerShell 脚本执行
- **Linux**：确保安装了必要的构建工具

### 测试打包结果

```bash
# macOS
open dist/mac-arm64/AI\ Sidebar.app

# 或直接运行 DMG
open dist/AI\ Sidebar-*.dmg
```

## 下一步计划

1. ✅ 基础原型（窗口 + 快捷键）
2. ✅ 适配现有功能
3. ✅ 截屏和文字选择功能
4. ✅ 打包发布配置
5. ⏳ 添加系统托盘
6. ⏳ 自动更新功能
7. ⏳ 代码签名和公证
