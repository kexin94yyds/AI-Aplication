# AI Sidebar 问题排查日志

本文档记录 AI Sidebar 开发过程中遇到的典型问题及其解决方案，供后续参考。

---

## 问题 #1：窗口在全屏应用前来回跳动

**日期**：2025-11-24

**现象描述**：
当用户在全屏覆盖的应用（如全屏浏览器、全屏 IDE）前面呼出 AI Sidebar 时，窗口会来回跳动，无法稳定停留在全屏应用上方。

**问题定位**：
`electron-main.js` 中的 `showWindow()` 函数

**根本原因**：
在 `showWindow()` 函数中，原本的逻辑如下：

1. 调用 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` 让窗口在所有工作区可见（包括全屏应用的 Space）
2. 调用 `show()` 和 `focus()` 显示窗口
3. **200ms 后调用 `setVisibleOnAllWorkspaces(false)` 还原工作区可见性**

问题出在第 3 步：当窗口显示在全屏应用的 Space 上时，调用 `setVisibleOnAllWorkspaces(false)` 会让窗口回到它原来的 Space，导致窗口从全屏应用上"跳走"。如果用户再次尝试呼出，窗口又会短暂出现在全屏应用上，然后 200ms 后再次跳走，形成来回跳动的现象。

**解决方案**：
移除 200ms 后还原 `setVisibleOnAllWorkspaces(false)` 的代码，让窗口保持在所有工作区可见的状态。

**修改的代码位置**：

1. `showWindow()` 函数（约 1411 行）：删除了 200ms 后的 setTimeout 回调
2. `toggle-always-on-top` IPC 处理程序（约 2875 行）：同步删除了类似的还原逻辑

**修改前**：
```javascript
// 3. 200ms 后还原工作区可见性，仅在当前 Space 可见
setTimeout(() => {
  try {
    mainWindow.setVisibleOnAllWorkspaces(false);
  } catch (e) {
    console.error('还原工作区可见性失败:', e);
  }
}, 200);
```

**修改后**：
```javascript
// 🔑 关键修复：不再还原工作区可见性
// 之前 200ms 后调用 setVisibleOnAllWorkspaces(false) 会导致窗口在全屏应用前面来回跳动
// 因为这会让窗口回到原来的 Space，而不是停留在当前全屏应用的 Space
// 保持 setVisibleOnAllWorkspaces(true) 可以让窗口始终覆盖在当前 Space（包括全屏应用）
console.log('[SHOW_WINDOW] 保持窗口在所有工作区可见（避免全屏应用前跳动）');
```

**经验总结**：
- macOS 的多桌面（Spaces）和全屏应用机制比较特殊，窗口的工作区可见性设置需要谨慎处理
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` 是让窗口覆盖全屏应用的关键
- 不要在短时间内切换工作区可见性状态，否则可能导致窗口在不同 Space 之间跳动

---

*后续问题请按照上述格式添加到本文档末尾*





