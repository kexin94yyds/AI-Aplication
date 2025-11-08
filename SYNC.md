AI Sidebar 数据同步（插件 <-> 桌面端）

目录：/Users/apple/AI-sidebar 更新/AI-Sidebar/sync/

文件

- favorites.json
- history.json

JSON 结构

- favorites.json: 数组，每项
  - url: string
  - provider: string (可空)
  - title: string (可空)
  - time: number (epoch 毫秒，可空，缺省为当前时间)

- history.json: 数组，每项
  - url: string
  - provider: string (可空)
  - title: string (可空)
  - time: number (epoch 毫秒)

同步规则

- 桌面端启动时读取上述两个文件并与本地数据合并（按 url 去重，保留 time 更新的记录）。
- 桌面端内修改 favorites / history 会立即写回对应 JSON。
- 桌面端监听两个文件变化，外部（插件）写入时会自动合并更新 UI。
- 已做自触发抑制：桌面端自己的写入不会触发无限回调。

插件侧写入示例（伪代码）

```js
// 写入 favorites.json
const data = [
  { url: "https://chatgpt.com/", provider: "chatgpt", title: "ChatGPT", time: Date.now() }
];
writeJson("/Users/apple/AI-sidebar 更新/AI-Sidebar/sync/favorites.json", data);

// 写入 history.json 同理
```

注意：浏览器扩展无法直接写入本地文件系统，如需在插件侧落地文件请通过本地 helper（Native Messaging、Node/脚本、或 Electron）完成。

