# History 数据同步修复说明

## 问题描述

之前 `SYNC_MIRROR_FROM_PLUGIN = true` 是硬编码的，导致：
- ❌ **浏览器插件**不会写入 sync 文件
- ❌ **Electron 应用**不会写入 sync 文件  
- ❌ **没有任何组件**会更新数据库

## 修复方案

修改 `js/popup.js` 第 163 行，让模式根据环境自动判断：

```javascript
const SYNC_MIRROR_FROM_PLUGIN = IS_ELECTRON; // Electron=只读，插件=写入
```

## 修复后的数据流

### 浏览器插件（Chrome Extension）
```
用户浏览 AI 网站
    ↓
自动检测 deep link (如 chatgpt.com/c/xxx)
    ↓
调用 addHistory() 
    ↓
写入 IndexedDB (本地)
    ↓
通过 history-db.js 调用 window.electronAPI.sync.write('history', data)
    ↓
写入 sync/history.json 文件
```

### Electron 应用
```
启动时读取 sync/history.json
    ↓
导入到 IndexedDB (本地)
    ↓
监听 sync 文件变化 (fs.watch)
    ↓
文件更新时自动重新导入
    ↓
界面显示最新数据
```

## 工作原理

| 环境 | IS_ELECTRON | SYNC_MIRROR | AI_SYNC_WRITE | 行为 |
|------|-------------|-------------|---------------|------|
| **浏览器插件** | false | false | **true** | ✅ 写入 sync 文件 |
| **Electron 应用** | true | true | **false** | ✅ 只读取 sync 文件 |

## 数据同步时机

### 插件端（写入）
- ✅ 访问深度链接时自动记录 (chatgpt.com/c/xxx)
- ✅ 手动点击 "Add Current" 
- ✅ 点击 "Star" 收藏
- ✅ 重命名 history 条目

### Electron 端（读取）
- ✅ 应用启动时导入
- ✅ 检测到 sync 文件变化时自动更新
- ❌ 不会自动记录新 URL（避免冲突）
- ✅ 可以手动添加（但不写回 sync）

## 验证方法

### 1. 在浏览器插件中测试
```bash
# 打开 Chrome 插件
# 访问 https://chatgpt.com/
# 开始一个新对话（会生成 /c/xxx URL）
# 检查 sync/history.json 是否更新
cat sync/history.json | jq 'length'  # 应该增加记录
```

### 2. 在 Electron 应用中测试
```bash
# 启动 Electron 应用
npm run electron

# 检查是否能看到插件中添加的历史记录
# 打开 History 面板，应该显示相同的数据
```

### 3. 验证实时同步
```bash
# 1. 打开 Electron 应用
# 2. 在浏览器插件中添加新历史
# 3. 等待 1-2 秒
# 4. 在 Electron 应用中刷新 History 面板
# 应该能看到新添加的记录
```

## 注意事项

⚠️ **重要**：
- Electron 应用启动时，会**覆盖**本地 IndexedDB，使用 sync 文件的数据
- 如果需要在 Electron 中添加历史，可以手动操作，但不会同步回插件
- 建议主要使用**插件**来管理和记录历史

## sync 文件位置

默认路径（可以通过环境变量 `AISIDEBAR_SYNC_DIR` 修改）：
```
/Users/apple/AI-sidebar 更新/AI-Sidebar/sync/
├── history.json
└── favorites.json
```

## 相关代码

- `js/popup.js` 第 163 行：同步模式配置
- `js/history-db.js` 第 83, 115 行：写入 sync 文件
- `electron-main.js` 第 74-93 行：监听 sync 文件变化
- `electron-main.js` 第 1003 行：启动时初始化 sync

## 故障排查

### 插件不写入 sync 文件
1. 检查是否在浏览器环境运行（不是 Electron）
2. 检查控制台是否有错误
3. 确认 sync 目录存在且有写入权限

### Electron 应用看不到数据
1. 检查 sync 文件路径是否正确
2. 查看控制台日志：`Sync HTTP server started at...`
3. 确认 sync/history.json 文件是否存在且有内容

### 数据不实时更新
1. 重启 Electron 应用（会重新读取）
2. 检查 fs.watch 是否正常工作
3. 手动刷新 History 面板

## 未来改进

- [ ] 添加冲突检测（如果 Electron 和插件同时修改）
- [ ] 支持双向同步（Electron 也能写回）
- [ ] 添加同步状态指示器
- [ ] 支持云端同步（Supabase/Firebase）




