# 会话恢复 / Detached Window 主链笔记

本文档对应第二轮解混淆，目标是把“会话恢复”和“独立窗口”两条链拆成可追踪的维护面。

## 1. 作用域

- sidepanel 会话恢复主链：`assets/sidepanel-BoLm9pmH.js`
- detached window 可维护运行时：`service-worker-detached-window-runtime.js`
- service worker 清理/维护运行时：`service-worker-runtime.js`

## 2. scope hydrate 主链

当前已确认的 sidepanel 语义锚点：

- `__cpSessionHydrationLockRef`
- `__cpApplyDraftToCurrentScope`
- `__cpApplySnapshotToCurrentScope`
- `__cpSynchronizeExternalActiveSession`
- `__cpOpenDetachedWindow`
- `sidepanel.runtime_message_bridge`

可按下面顺序理解：

1. scope 切换
2. 进入 hydrate 总入口
3. 依次尝试 draft / snapshot / recent session 恢复
4. 监听 storage 变化并同步外部活跃会话
5. 若要切到 detached window，先持久化当前 scope 的 snapshot/draft

### 2.1 hydrate 的几个关键切面

- `__cpSessionHydrationLockRef`
  - 防止 scope 切换中的 hydrate 与外部 active session 同步同时改 UI
- `__cpApplyDraftToCurrentScope`
  - 把 draft 恢复回当前 scope 的输入态
- `__cpApplySnapshotToCurrentScope`
  - 把 snapshot 恢复回当前 scope 的消息态
- `__cpSynchronizeExternalActiveSession`
  - 外部窗口/标签页改了 active session 后，按 `draft -> snapshot -> empty` 顺序把当前 sidepanel 跟上
- `sidepanel.runtime_message_bridge`
  - sidepanel 内部只承接 `PING/ACK/EXECUTE/POPULATE/STOP`
  - detached window 的打开动作不在这里决策，而是交给 background recovered runtime

## 3. detached window 打开/复用主链

`service-worker-detached-window-runtime.js` 现在可以按 4 层阅读：

1. **账本层**
   - `normalizeDetachedWindowLockEntry`
   - `readDetachedWindowLocks`
   - `writeDetachedWindowLocks`
   - `upsertDetachedWindowLock`
   - `removeDetachedWindowLockByWindowId`

2. **URL 协议层**
   - `buildDetachedWindowUrl`
   - `parseDetachedWindowUrl`
   - 固定协议：`sidepanel.html?mode=window&tabId=...&groupId=...`

3. **发现/对账层**
   - `ensureDetachedWindowGroupContext`
   - `findDetachedWindowByGroupId`
   - `sweepDetachedWindowLocks`

4. **调度层**
   - `openDetachedWindowForGroup`
   - 顺序：`sweep -> resolve context -> reuse existing popup -> else create new -> persist lock`

## 4. detached window 收口链

`service-worker-runtime.js` 负责后台收口，不负责 sidepanel hydrate 本身。

### 4.1 scope cleanup

- `collectStoredScopeEntries`
  - 把 storage snapshot 聚合成 `scopeId -> { keys, groupIds, mainTabIds }`
- `cleanupClosedGroupScopes`
  - group 被关闭时不再删除 scope（保留对话，供后续按 URL 恢复）
  - 仅记录审计：哪些 scope “本来会被清理”
- `cleanupOrphanGroupScopes`
  - 启动/安装时扫描孤儿组，但不再删除 scope（保留对话，供后续按 URL 恢复）
  - 仅记录审计：哪些 scope 已经变成孤儿

### 4.2 detached popup 生命周期

- `onWindowRemoved`
  - host window 被关掉时，先关挂在它下面的 detached popup
  - 再按 `windowId` 清锁
- `onTabRemoved`
  - main tab 被删掉时，按 lock 关闭对应 detached popup
- `onMessage`
  - 这里只消费 `OPEN_GROUP_DETACHED_WINDOW`
  - 其余消息仍回 bundle 主桥

## 5. bundle service worker 与 recovered runtime 的接缝

`assets/service-worker.ts-H0DVM1LS.js` 现在可以理解成“旧主桥”：

- 负责：
  - native host 探测与 port 生命周期
  - sidepanel 打开 / prompt 注入
  - ACK / static indicator heartbeat
  - offscreen 音频
  - scheduled task
  - external page bridge

- 不再负责：
  - detached window 锁账本巡检
  - host window / main tab 销毁后的 detached popup 收口
  - closed-group / orphan-group session cleanup
  - `OPEN_GROUP_DETACHED_WINDOW` 的 recovered runtime 侧实现

也就是说，现在后台可以按两层读：

1. **bundle 主桥**
   - 保留原来大部分业务消息与兼容逻辑
2. **recovered runtime**
   - 单独接手 detached window / cleanup / maintenance 这些可维护链路

### 5.1 bundle 主桥内部可继续按分区阅读

当前已经有这些固定锚点：

- `service worker 启动链：先恢复 bridge/listener/offscreen，再探测 native host 和定时任务。`
- `detached window 锁巡检、group/session cleanup 则由 loader 后注册的 recovered runtime 追加，不在这里展开。`
- `recovered runtime 只额外消费 OPEN_GROUP_DETACHED_WINDOW；这里继续承接 ACK/indicator/native-host 等主桥消息。`
- `轻量 ACK 类消息：仅回包确认，让 sidepanel / 指示器 / keepalive 调用方快速结束。`
- `原生宿主消息分发：工具执行、连接状态同步、状态查询回包。`
- `sidepanel 打开主链：打开侧栏后，按重试策略把 prompt/模型/附件注入输入框。`
- `原生宿主 / MCP bridge 状态读取：优先向 native host 请求最新状态，失败时回退本地缓存。`
- `options 引导桥：把待执行任务先写入 storage，再聚焦或打开 options#prompts。`
- `定时任务执行桥：由后台统一落埋点并把任务转交 sidepanel 独立窗口。`
- `secondary -> main 聚焦桥：把副 tab 切回主 tab，并同步聚焦对应窗口。`
- `主 tab ACK 回包：这里只透传 success，供 secondary heartbeat 判断主 tab 存活。`
- `clau.de deep-link / 扩展路由桥`

可以先按下面 5 段理解：

1. native host / tool_response / status
2. sidepanel open / populate
3. ACK / heartbeat / switch-to-main
4. options / scheduled task / update sync
5. offscreen / alarm / external bridge

### 5.2 loader 的真实拼接顺序

`service-worker-loader.js` 当前顺序是：

1. `assets/service-worker.ts-H0DVM1LS.js`
2. `service-worker-detached-window-runtime.js`
3. `service-worker-runtime.js`

最后再由 loader 调：

- `createDetachedWindowRuntime(...)`
- `registerServiceWorkerRuntimeHandlers(...)`

这样可以保证：

- bundle 主桥先就位
- detached window helper 先准备好
- recovered runtime 最后注册并接管 `OPEN_GROUP_DETACHED_WINDOW` / cleanup / maintenance

## 6. 当前结论

- detached window 不再是“神秘 popup”，而是有明确 `groupId/tabId` 协议的 sidepanel window。
- service worker 里的维护逻辑已经能分成：
  - scope cleanup
  - detached popup cleanup
  - startup/install maintenance
- 第二轮后续重点不再是 runtime 壳层，而是：
  - `assets/sidepanel-BoLm9pmH.js` 的 hydrate 迁移策略
  - `assets/service-worker.ts-H0DVM1LS.js` 与这些可维护 runtime 的职责接缝
