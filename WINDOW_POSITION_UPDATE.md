# 窗口位置记忆与显示优化

参考项目：[RI - Replace-Information](https://github.com/kexin94yyds/RI.git)

## 📝 改进内容

### 1. **移除滑动动画，采用直接显示/隐藏**
参考 RI 项目的 `showOnActiveSpace()` 函数实现，不再使用平滑的滑动动画，而是直接显示和隐藏窗口。

**优点：**
- ✅ 响应更快速
- ✅ 视觉效果更简洁
- ✅ 没有动画卡顿问题
- ✅ 类似笔记应用的自然体验

### 2. **窗口位置记忆**
- 使用 `lastWindowPosition` 变量存储窗口的最后位置 `{ x, y }`
- 每次移动窗口时自动保存位置
- 每次呼出窗口时，在上次保存的位置显示
- 首次启动默认在屏幕右侧

### 3. **手动隐藏控制**
- 不使用自动隐藏功能
- 用户通过快捷键手动控制窗口显示/隐藏
- 更灵活的使用方式

## 🔧 技术实现

### showWindow() 函数
```javascript
function showWindow() {
  // 1. 使用保存的位置或默认位置
  let targetX, targetY;
  if (lastWindowPosition) {
    targetX = lastWindowPosition.x;
    targetY = lastWindowPosition.y;
  } else {
    targetX = screenWidth - windowWidth;
    targetY = 0;
  }
  
  // 2. 直接设置位置（不使用动画）
  mainWindow.setPosition(targetX, targetY);
  
  // 3. 设置临时全工作区可见
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // 4. 设置置顶层级
  mainWindow.setAlwaysOnTop(true, 'floating');
  
  // 5. 显示窗口
  mainWindow.show();
  mainWindow.focus();
  lastShowAt = Date.now();
  
  // 6. 200ms 后还原工作区可见性
  setTimeout(() => {
    mainWindow.setVisibleOnAllWorkspaces(false);
  }, 200);
}
```

### hideWindow() 函数
```javascript
function hideWindow() {
  // 1. 保存当前位置
  const currentBounds = mainWindow.getBounds();
  lastWindowPosition = { x: currentBounds.x, y: currentBounds.y };
  
  // 2. 直接隐藏（不使用动画）
  mainWindow.hide();
  isShowing = false;
}
```

## 🎯 用户体验

### 使用流程：
1. **首次呼出**：按快捷键，窗口出现在屏幕右侧
2. **移动窗口**：拖动窗口到任意位置（自动保存位置）
3. **手动隐藏**：按快捷键隐藏窗口
4. **再次呼出**：窗口在上次的位置直接出现

### 快捷键：
- `Alt+Space` / `Shift+Cmd+Space` / `F13` - 呼出/隐藏侧边栏（手动切换）

## 📊 对比

| 功能 | 之前 | 现在 |
|------|------|------|
| 显示方式 | 从最近边滑入 | 直接显示 |
| 隐藏方式 | 从最近边滑出 | 直接隐藏 |
| 位置记忆 | ✅ | ✅ |
| 隐藏控制 | 快捷键 | 快捷键 |
| 响应速度 | 较慢（动画） | 快速（无动画） |
| 视觉效果 | 平滑过渡 | 简洁直接 |

## 🔍 关键变量

- `lastWindowPosition`: 存储上次窗口位置 `{ x, y }`
- `lastShowAt`: 记录最近一次显示时间戳（保留供未来使用）
- `isShowing`: 窗口是否正在显示

## 📚 参考资料

- [RI 项目](https://github.com/kexin94yyds/RI.git)
- RI 项目的 `electron-main.js` 第 16-117 行：窗口显示与失焦处理
- RI 项目的 `electron-main.js` 第 158-178 行：笔记窗口位置保存

## ✨ 主要改进

1. **直接显示/隐藏** - 移除滑动动画，响应更快速
2. **位置记忆** - 每次呼出在上次的位置显示
3. **简洁体验** - 参考 RI 项目，类似笔记应用的使用体验

---

**更新时间**: 2025-11-08  
**参考项目**: [RI - Replace-Information](https://github.com/kexin94yyds/RI.git)  
**用户反馈**: 不使用自动隐藏功能，保持手动控制

