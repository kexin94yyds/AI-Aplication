# 窗口控制功能说明

## 功能概述

此文档说明了侧边栏应用的窗口控制功能，包括窗口拖动和置顶功能。

## 新增功能

### 1. 窗口自由拖动

侧边栏窗口现在可以自由拖动到屏幕的任意位置。

**使用方法：**
- 在窗口顶部区域（前40px高度）按住鼠标左键拖动
- 窗口会跟随鼠标移动到新位置

**技术实现：**
- 使用 `-webkit-app-region: drag` CSS 属性实现拖动区域
- 移除了原有的强制锁定在屏幕右侧的逻辑
- 窗口可以停留在任何位置

### 2. 窗口置顶功能

通过右上角的置顶按钮，可以将窗口置于所有其他应用之上。

**使用方法：**
- 点击右上角的 🔝 按钮切换置顶状态
- 按钮高亮（粉色渐变）表示已置顶
- 按钮正常（紫色渐变）表示未置顶

**功能特性：**
- 置顶状态可以随时切换
- 状态会实时更新到界面
- 只在 Electron 环境中可用

## 用户界面变化

### 拖动区域
- 位置：窗口顶部
- 高度：40px
- 范围：从左侧到右侧（为置顶按钮预留空间）
- 鼠标样式：移动光标

### 置顶按钮
- 位置：右上角（距离边缘8px）
- 尺寸：40px × 40px（圆形）
- 图标：🔝
- 样式：
  - 未置顶：紫色渐变背景
  - 已置顶：粉色渐变背景
- 交互：
  - 悬停时放大（1.1倍）
  - 点击时缩小（0.95倍）

## 技术细节

### 修改的文件

1. **index.html**
   - 添加拖动区域 `<div class="drag-zone"></div>`
   - 添加置顶按钮 `<button id="alwaysOnTopBtn"></button>`

2. **css/panel.css**
   - 新增 `.drag-zone` 样式
   - 新增 `.always-on-top-btn` 样式及交互状态

3. **electron-main.js**
   - 移除窗口移动事件监听器（强制锁定在右侧）
   - 移除位置检查定时器
   - 添加 `toggle-always-on-top` IPC 事件处理
   - 添加 `get-always-on-top` IPC 事件处理
   - 修改默认 `alwaysOnTop` 为 `false`
   - 修改 `skipTaskbar` 为 `false`（在任务栏显示）

4. **electron-preload.js**
   - 添加 `toggleAlwaysOnTop()` API
   - 添加 `getAlwaysOnTop()` API
   - 添加 `onAlwaysOnTopChanged()` 事件监听

5. **js/popup.js**
   - 添加置顶按钮的事件监听器
   - 添加置顶状态的初始化逻辑
   - 添加置顶状态变化的监听

### IPC 通信流程

#### 切换置顶
```
渲染进程 → toggleAlwaysOnTop() → IPC send 'toggle-always-on-top'
主进程 → setAlwaysOnTop(!current) → IPC reply 'always-on-top-changed'
渲染进程 → 更新按钮状态
```

#### 获取置顶状态
```
渲染进程 → getAlwaysOnTop() → IPC send 'get-always-on-top'
主进程 → isAlwaysOnTop() → IPC reply 'always-on-top-status'
渲染进程 → 返回 Promise<boolean>
```

## 兼容性

- **Electron 环境**：完整功能支持
- **浏览器扩展环境**：置顶按钮自动隐藏（浏览器扩展不支持此功能）

## 快捷键

目前没有为置顶功能分配快捷键，用户需要通过界面按钮操作。

## 注意事项

1. 窗口拖动区域会覆盖顶部40px的区域，确保不影响其他UI元素
2. 置顶按钮的 z-index 设置为 100003，确保在所有其他元素之上
3. 拖动区域使用 `-webkit-app-region: drag`，置顶按钮使用 `-webkit-app-region: no-drag`
4. 窗口不再强制停留在屏幕右侧，用户可以自由移动
5. 默认不置顶，用户可以根据需要开启

## 未来改进

可能的改进方向：
- [ ] 添加快捷键支持置顶切换
- [ ] 记住窗口位置，下次启动时恢复
- [ ] 添加"吸附到边缘"功能
- [ ] 添加窗口大小调整手柄













