# Tool Executor / Indicator 主链笔记

本文档对应第三轮解混淆，目标是把：

- `tool_call`
- `tool executor`
- `tab 编排`
- `indicator`
- `tool_result`

拆成可读、可定位、可维护的几段。

## 1. bridge 外层消息链

文件：

- `assets/mcpPermissions-qqAoJjJ8.js`

当前已固定的读法：

1. bridge 收到 `tool_call`
2. 解析 `toolUseId / tool / args / permissionMode / sessionScope`
3. 调 `wn(...)` 进入 MCP tool executor
4. 成功或失败后都统一封成 `tool_result`
5. 外层 `tool_result` 继续复用原始 `toolUseId`

关键锚点：

- `bridge tool_call -> tool executor -> tool_result 总链`
- `tool_call 外层只负责解析 bridge payload、补齐执行上下文，再把实际执行交给 wn。`
- `tool_result 外层回包会复用原始 toolUseId；`

## 2. 内层 tool_use / 外层 toolUseId 分工

`wn(...)` 里会新建一个内层 `tool_use` id。

分工如下：

- 内层 `tool_use` id
  - 只服务 provider / `processToolResults(...)`
- 外层 `toolUseId`
  - 继续服务 bridge 的 `tool_call / tool_result` 归属

也就是说：

- **provider 层** 看内层 `tool_use`
- **bridge 协议层** 看外层 `toolUseId`

同一条链里，另外两个键也已经固定：

- `tabId`
  - `tabId 是实际执行目标键，只从 tool args 进入后台工具链；`
- `requestId`
  - `requestId 仍留给权限握手。`

也就是：

- `toolUseId` 管外层归属
- `requestId` 管 permission 握手对账
- `tabId` 管真实执行上下文

## 3. tabs 工具簇与 tool executor 前置条件

`assets/mcpPermissions-qqAoJjJ8.js` 里先把这 3 个工具单独收口为：

- `tabs_context_mcp`
- `tabs_create_mcp`
- `tabs_close_mcp`

对应代码里的白名单：

- `const Xa = ["tabs_context_mcp", "tabs_create_mcp", "tabs_close_mcp"];`

这组白名单的作用很直接：

- 其他浏览器工具在没有 `context.tabId` 时会先报 `No tab available`
- 只有这 3 个工具允许在“还没拿到 tab 上下文”时先跑起来

源码里已经把职责写得很清楚：

1. `tabs_context_mcp`
   - `Get context information about the current MCP tab group.`
   - `CRITICAL: You must get the context at least once before using other browser automation tools so you know what tabs exist.`
   - session 作用域下，如果还没有组，要靠 `createIfEmpty: true` 先建出当前 session 的 group

2. `tabs_create_mcp`
   - `Creates a new empty tab in the MCP tab group.`
   - 如果当前 session 还没有 group，会直接报：
     - `No tab group exists for this session yet. Call tabs_context_mcp with createIfEmpty: true first`

3. `tabs_close_mcp`
   - `Close a tab in the MCP tab group by its tab ID.`
   - 只允许关闭当前 session 可见的 tab
   - 如果关掉的是最后一个 tab，源码说明是：
     - `If the closed tab is the last one in the group, Chrome auto-removes the group.`
   - 典型错误边界：
     - `Tab ${o} does not exist (may have already been closed). Call tabs_context_mcp to see current tabs.`
     - `Tab ${o} is not in this session's tab group. Only tabs visible to this session can be closed.`

这段的关键不是 UI，而是把“tab 上下文建立 / 新建 / 收口”从其他工具里剥离出来。

这里再补一个和 indicator 边界直接相关的点：

- `tabs_context_mcp` 首次建组前若还没有真实 tab，上面的 no-tab 例外会先放行，但不会提前点亮 indicator。

## 4. MCP tool executor 主链

`wn(...)` 当前可按下面顺序理解：

1. `tab 编排阶段`
   - 决定这次工具实际落到哪个 tab / group / domain / url
2. blocklist / 域名策略判定
3. 前台激活 / debugger attach
4. `执行前的 indicator/debugger 挂载链`
5. provider `processToolResults(...)`
6. `执行结束后的 indicator/completion prefix 收口链`

关键锚点：

- `MCP 工具执行主入口`
- `tab 编排阶段`
- `执行前的 indicator/debugger 挂载链`
- `真正执行工具的 provider 主调用`
- `执行结束后的 indicator/completion prefix 收口链`

补充两个直接来自源码的边界：

- `tool executor 上下文对象：`
  - `toolUseId 是本次工具调用/结果的稳定归属键；tabId/tabGroupId/sessionScope 只负责选择执行环境。`
- `tool executor 的标准 tool_result 封装器：`
  - `tool_use_id 对应外层 tool_call id，错误统一降成 is_error + content，不引入 requestId。`

## 5. permission_required 链

bridge 场景下：

1. tool executor 里触发 `onPermissionRequired`
2. background 生成 `requestId`
3. `requestId` 写入 pending permission ledger
4. 发出 `permission_request`
5. sidepanel 权限窗回 `permission_response`
6. background 用 `requestId` resolve pending promise

这里仍然保持：

- `requestId`：permission_request / permission_response 对账键
- `toolUseId`：外层 tool_call / tool_result 归属键
- `tabId`：sidepanel / permission popup 作用域键

对应的重试链也已经固定：

- `handleToolCall(...)` 遇到带 `type` 的对象时，当前约定它仍是 `permission_required sentinel`，不是最终 `tool_result`。
- 普通工具的 `permission_required sentinel` 统一形状：
  - `{ type, tool, url, toolUseId, actionData? }`
  - `actionData` 只给 permission popup 做最小预览，不回填完整执行上下文。
- 不同 producer 家族目前已经能稳定分成 4 类：
  - `javascript_tool`：只透出脚本文本，不带 timeout / eval 细节。
  - `form_input / upload_image`：只回填 `ref / coordinate / value / imageId` 这类最小 DOM 命中线索。
  - `find / get_page_text / read_page / read_console_messages / read_network_requests / navigate`：默认只返回基础四元组，不附 `actionData`。
  - `GIF 导出上传`：复用 `upload_image` 家族，但 popup 只吃 `coordinate` 预览，不携带 gif 二进制。
- 这几类前置顺序也已经补清：
  - `navigate`：只有普通 URL 分支会做协议补全、blocklist 与域 permission；`back / forward` 只复用历史栈，不重走 permission gate。
  - `get_page_text / read_page`：共用“先 permission，后 hideIndicator/read DOM”的读页模板；permission popup 分支不会提前隐藏 indicator。
  - `upload_image`：先过目标域 permission，再做原始 URL 安全校验与 message image 解析；permission popup 不会读取历史图片二进制。
- 两个执行前 gate 也已经固定：
  - `A(...) / __cpMcpPreExecuteSameDomainGuard`：域权限通过后的同域重校验闸门，只比较调用前 URL 与执行瞬间 tab 当前 URL 的 hostname；中途跳域就阻断真实页面动作。
  - `A(...)` 当前覆盖 `click / type / key / drag / scroll_to / hover / javascript_tool / file upload / form_input / GIF export upload / upload_image`。
  - `A(...)` 的调用家族可以稳定拆成 3 组：
    - 页面级动作：`type / key / javascript_tool`。不依赖 ref 命中，guard 通过后直接落到当前页面/焦点上下文。
    - 定位/指针动作：`click / double_click / triple_click / drag / scroll_to / hover`。会先做 ref/coordinate 解析，再过 guard，最后发鼠标/滚动。
    - 表单/上传动作：`file upload / form_input / upload_image / GIF export upload`。guard 通过后才继续碰 file input、表单控件或历史图片二进制。
  - `M / __cpMcpScreenshotViewportContextLedger`：screenshot viewport context 账本，只保存 `viewportWidth / viewportHeight / screenshotWidth / screenshotHeight` 这 4 个尺寸字段，给后续 coordinate 路径换算使用，不保存图片字节。
  - `ne(...) / __cpMcpScaleScreenshotCoordinatesToViewport`：截图坐标 -> 当前 viewport 坐标缩放器；纯 coordinate 路径先缩放，再进 guard。
  - `me(...) / __cpMcpResolveRefToViewportCenter`：`read_page/find` 的 ref 解析器；会先从 `__claudeElementMap` 解引用并清理失效 ref，`scrollIntoView` 到可视区中心，再返回中心点坐标，并给 span 记一笔 `ref_lookup_ms`。
  - `window.__generateAccessibilityTree` 才是 `read_page/find` 共用的 ref writer；`file_upload / form_input / upload_image(ref)` 都是直接 consumer，不走 `me(...)` 这条“ref -> 中心点坐标”链。
  - `file_upload`：直接从 `__claudeElementMap` 解引用元素；只有命中 `<input type=file>` 才继续桥接到 `DOM.setFileInputFiles`。stale ref 在这里区分成 `not found / detached / garbage collected` 三类。
  - `form_input`：同样直接消费 `__claudeElementMap`；先二次验活并清理 stale ref，再分发到 `select / checkbox / radio / date-time / range / number / generic input|textarea` 分支。
  - `upload_image(ref)`：直接消费 `__claudeElementMap`；命中 `<input type=file>` 走 `files` 注入，否则统一按 drag-drop target 派发 `dragenter / dragover / drop`，不做 droppable 能力校验。
  - `clearContext / clearAllContexts`：当前只看到定义，没有显式调用；这本 screenshot context 账本实际主要靠后续 `screenshot -> setContext(...)` 覆盖刷新，不靠主动 clear。
  - `scroll`：也会先复用 screenshot context 做坐标缩放，但不像 `click / hover / drag` 那样再进入 `A(...)` 同域重校验。
  - `zoom`：只消费最近一次 screenshot context，不会回写或清理这本账本。
  - 顺序差异要特别注意：
    - `click(ref)` / `hover(ref)`：先解 ref 成中心点坐标，再进 `A(...)`。
    - `scroll_to`：先过 `A(...)`，再解 ref / `scrollIntoView`。
    - `click(coordinate)` / `hover(coordinate)` / `drag`：先按截图上下文做坐标缩放，再进 `A(...)`。
  - `Me(...) / __cpMcpBeforeunloadNavigationGuard`：`navigate` 专用的 beforeunload 三态收口器，把 leave-site 对话框统一降成 `accepted / blocked / none`。
- `tool executor permission_required 重试链`：
- 先等 permission handler resolve，再按 `toolUseId` 写一次性授权，最后重跑原始 `tool_call`。
- `update_plan`：审批通过后直接回 `"User has approved your plan..."` 文本，不重跑普通工具；它的 `permission_required` 只承担计划审批闸门。
- `rn(...) / __cpDomainTransitionPermissionRequiredFactory`：
  - `DOMAIN_TRANSITION` 专用 `permission_required producer`
  - 继续复用统一 sentinel 形状，但 `toolUseId` 在这里本地生成，`requestId` 仍留给 bridge 权限握手。
- popup 权限链的 `requestId` 是 background <-> sidepanel 的唯一关联键。
- `toolUseId` 留在 bridge/tool 层，`tabId` 只负责 sidepanel 作用域与前缀恢复，不参与最终 resolve。

## 6. indicator / tab 编排衔接

`mcpPermissions` 里已经把“工具真正落到 tab 之后”这段链补清：

- `执行前的 indicator/debugger 挂载链`
- `只要工具落到真实 tab，这里就会登记运行态、点亮前缀，并记录 requestId -> tab 的运行中账本。`
- `tabs_context_mcp 首次建组前若还没有真实 tab，上面的 no-tab 例外会先放行，但不会提前点亮 indicator。`
- `执行结束后的 indicator/completion prefix 收口链`
- `tab 执行完成后的延迟收尾。`
- `强制移除 indicator/prefix 的兜底清理入口。`
- `service worker 重启或恢复时，批量清理遗留的运行态前缀。`

这意味着当前可以把执行生命周期稳定读成：

1. `tabs_context_mcp / tabs_create_mcp / tabs_close_mcp` 负责把 tab 上下文准备好
2. `tab 编排阶段` 选出真正执行的 tab
3. indicator/debugger 在执行前挂载
4. provider 跑实际工具
5. completion prefix / debugger detach 在执行后收口
6. 如果 service worker 中途重启，还有批量清理兜底

## 7. indicator 收口链

文件：

- `assets/agent-visual-indicator.js-Ct7LqXhp.js`

当前已确认：

- 动态执行态 indicator
- 静态 tab-group indicator
- Stop 按钮
- 后台 heartbeat

都属于同一条“执行态可视化链”。

而在 `mcpPermissions` 里还多了：

- `强制移除 indicator/prefix 的兜底清理入口`
- `service worker 重启或恢复时，批量清理遗留的运行态前缀`

所以第三轮目前已经能把“执行态 UI”和“工具执行生命周期”对齐起来。

## 8. 四个工具 consumer 的接法

这四个工具不再负责“先把 tab 上下文建出来”，而是消费前面已经冻结的：

- `tabs_context_mcp / tabs_create_mcp / tabs_close_mcp`
- `tab 编排阶段`
- `permission_required`
- `indicator`
- `tool_result`

### computer

- `computer 是浏览器前台交互总入口。`
- `computer 的 action -> permission 映射与 wait 例外。`
- `wait` 只做 sleep，不读页面也不触发域权限。
- 其余 action 会被收口到 `READ_PAGE_CONTENT / CLICK / TYPE`。
- `permission_required 的 actionData 回填边界。`
- 这里只补点击截图/坐标、`type` 文本、drag 起止坐标。
- `scroll_to / hover 与 read_page/find ref 链。`
- `统一 tabContext。`
- `click helper 会先临时隐藏 indicator，再走 mouseMoved -> mousePressed -> mouseReleased。`
- `screenshot 先探测 viewport，再走 CDP captureScreenshot；超限时回退内容脚本压缩链。`
- `screenshot 会把 viewport/screenshot 尺寸写进上下文，供后续坐标动作做缩放换算。`
- `scroll 优先尝试 CDP scrollWheel；无效或超时再回退 DOM/事件注入滚动。`
- `scroll 成功后会尽量补一张新截图，给后续模型继续定位。`
- `left_click_drag 复用截图上下文做坐标换算，再串成完整拖拽事件序列。`
- `zoom 会校验 region 边界，并用 CDP clip 截取局部高分辨率截图。`

### find

- `find 的 accessibility tree -> createAnthropicMessage(modelClass=small_fast) -> provider 文本提取。`
- 先抓整页 accessibility tree，再交给 `small_fast` provider 做自然语言匹配。
- `read_page / find` 的 `ref_X` 统一由 `window.__generateAccessibilityTree(...)` 这条页面侧 WeakRef 账本产出；`find` 只是筛选已有 ref，不自己生成新 ref。
- `find` 只解析 provider 文本里的 `ref_X | role | name | type | reason` 行，不会回到 `__claudeElementMap` 验活；拿到 stale ref 时，真正报错发生在后续 click / form_input / upload_image 等 consumer。
- `find 的 query 裁剪。`
- provider 提示词不会直接吃整页文本，而是先按 query 命中行收窄片段。
- `provider 文本提取兼容层。`
- provider 返回的 `output_text / content / message / choices` 都会被归一化，再解析成 `ref/role/name/type`。
- `统一 tabContext。`

### navigate

- `navigate 的 Me beforeunload / unsaved changes(force)。`
- `Me(...)` 专门把 `Leave site?` 对话框收口成 `accepted / blocked / none`。
- `navigate 的 back / forward / 普通 URL 三路。`
- `back/forward` 直接走历史导航。
- `普通 URL 补 https + blocklist + permission。`
- 普通 URL 会先补协议，再过组织/安全 blocklist 与域权限检查。
- `统一 tabContext。`

### read_page

- `read_page 的 hideIndicatorForToolUse。`
- 读 accessibility tree 前会先把执行态 indicator 暂时隐藏，避免 overlay 混入页面结构。
- `read_page` 是原始 ref 产出面；`ref_id` 只是在既有 ref 树上聚焦某个子树，不改写 ref 身份空间。
- `read_page 的 main frame 失败转 allFrames。`
- 主 frame 没有有效 `pageContent` 时，会回退到 `allFrames` 聚合输出。
- `read_page 的 finally restoreIndicatorAfterToolUse。`
- 无论主路径、allFrames 回退还是异常返回，最终都会恢复 indicator。

## 9. sidepanel 结果消费

后台把 `tool_result` 送回聊天时间线之后，前端并不是原样平铺，而是会再过一层 sidepanel consumer：

- `sidepanel 工具标题压缩器。`
- 这层只把 `tool name + input` 压成卡片头部摘要，不负责展示完整结果。
- `read_page 标题只消费 filter，不在头部透出 depth/ref_id/max_chars。`
- `find 标题只展示截断后的 query。`
- `navigate 标题只展示截断后的 url。`
- `sidepanel 的工具结果卡片 consumer。`
- 它会联合消费 `toolInfo/result/lastScreenshot`，决定头部摘要、展开态文本和调试图层。
- `computer 结果卡片优先读 input.action；如果 result.content 里还能解析出 action，就用它兜底恢复展示分支。`
- `debug 展开态会把 click 坐标和 drag 路径叠加到最近一张 screenshot 上。`
- `timeline group 的缩略图优先显示工具结果自带图片；没有图片时才退回 lastScreenshot + 坐标覆盖层。`

## 10. sidepanel 时间线账本

在结果卡片之前，sidepanel 还会先经过一层“账本 + 分组”：

- `sidepanel 的 tool_result 账本入口。`
- user 消息里的 `tool_result` 会先按 `tool_use_id` 建索引。
- `tool_result 图片会顺手写入 screenshotsByTab。`
- 这本截图账本后面会被 click 坐标覆盖层、drag path 和 timeline thumbnail 复用。
- `tool_use 渲染时会向后扫描同消息后的 user tool_result。`
- 这一步是在把 assistant 的 `tool_use` 和 user 侧回写的 `tool_result` 对齐。
- `TimelineGroup 构造器会把连续的 tool_use/tool_result 相邻块折成一个 group。`
- `timeline block renderer 读的是 tool_use 块，但展示时会去 toolResultsByToolId 账本里取对应结果。`
- `turn_answer_start 会把 assistant 输出切成“时间线阶段”和“最终回答阶段”两段。`
- `messageGroups 里的 tool_group 会被渲染成可折叠 TimelineGroup。`
- `_s(...) / __cpSidepanelBuildToolRenderContext`：扫描整段消息，建立 `toolResultsByToolId + screenshotsByTab` 共用账本；不负责 `messageGroups` 分组。
- `Jw(...) / __cpSidepanelRenderMessageBlockDispatcher`：单个 assistant block dispatcher；`tool_use` 优先吃上游传入的 `toolResult`，没有时才向后扫描 user `tool_result`。
- `$b(...) / __cpSidepanelRenderBrowserToolTimelineCard`：浏览器工具统一卡片壳；在 `TimelineGroup` 模式下同时消费 `toolResult / screenshotsByTab / coordinate`。
- `Vb(...) / __cpSidepanelRenderBrowserToolResultCard`：`computer / read_page / find / navigate` 等结果卡片正文 consumer；debug overlay 也统一在这里。
- `mb(...) / __cpSidepanelRenderTimelineThumbnailWithPreview`：统一的 timeline screenshot thumbnail + preview 组件；可叠点击坐标，不负责 drag path。
- `Fb(...) / __cpSidepanelRenderClickCoordinateOverlay`：把点击坐标按当前图片显示比例投影，并做中心放大。
- `zb(...) / __cpSidepanelRenderDragPathOverlay`：把拖拽起点、终点和箭头路径叠加到 screenshot；当前只用于 debug 展开态，不进入 timeline thumbnail 回退链。
- `Yw(...) / __cpSidepanelBuildAssistantTimelineGroups`：按 `turn_answer_start` 切分“执行时间线”和“最终回答”，再把连续 `tool_use/tool_result` 折成 `TimelineGroup`。
- `ik(...) / __cpSidepanelRenderActiveToolTimeline`：最后一组活跃 timeline 的主 consumer；读取 `renderContext.toolResultsByToolId` 后把 `tool_use` 和 `tool_result` 对齐送进 `Jw(...)`。
- `Ul / __cpSidepanelTimelineGroupShell`：可折叠 `TimelineGroup` 外壳，只做折叠和动画，不做 `tool_result` 对账。

### 分组构造与拼接层

这一层现在可以按 4 个函数读：

- `_s(...)` 是 sidepanel timeline renderContext 账本，不负责 messageGroups 构造。
- `i1(...)` 是 messageGroups 构造入口。
- `i1(...)` 的起始判定是三段式：当前消息已是工具态，或“运行中且后面已无真实 user 文本”的 assistant 尾段，或后 3 条内仍会继续接工具链。
- `tool_group 起始判定：当前消息已是工具态，或后 3 条内仍会继续接工具链。`
- `tool_group 扩张边界：遇到真实 user 文本，或不会继续接工具链的 assistant 正文后停止。`
- `ok(...)` 负责把 `tool_group / single / result / compact summary` 分流成不同 renderer。
- `ok(...)` 只消费已经构造好的 `messageGroups`；`tool_group -> ik(...)`，`single assistant -> sk(...) -> Yw(...)`。
- `Yw(...)` 只处理单条 assistant 消息内部的 block 组装；`tool_group` 路径不会经过 `Yw(...)`。
- `compact summary 不走普通消息 renderer，而是单独走 Conversation summary 折叠卡片。`
- `showThumbs 只给 assistant 正文块；要么它已经到对话尾部，要么后面已经出现新的真实 user 提问。`
- `lastHumanMessage 绑定最后一个真实 user 组；lastAssistantMessage 绑定其后的 assistant 尾段容器。`
- `ak(...)` 把 `messageHistory -> compact divider -> 当前 messageGroups -> extras/footer/chatInput` 拼成同一滚动层。
- `ak(...) / __cpSidepanelRenderConversationScrollLayer` 是会话滚动层装配器，不参与 `messageGroups` 分组。
- `底部 thinking/compacting 状态只在“仍在跑、没有 permission prompt、且最后一组没有展开 timeline”时显示。`
- `sidepanel 当前消息会先折成 messageGroups，再交给 ok/ak 做 tool_group 与普通消息分流渲染。`
- `Ds(...) / __cpSidepanelMaintainBottomViewportSpacer` 会同时参考 `lastAssistantMessage / lastHumanMessage / extras / chatInput` 计算 `extraSpace`。
- `YY(...) / __cpSidepanelRenderChatInputFooter` 是底部 sticky 输入区根组件；通过 `ak(children)` 挂进滚动层，不参与 `messageGroups` 渲染。
- `chatInputContainerRef` 真正挂在输入卡片容器上，供 `Ds(...)` 的 `extraSpace` 计算与 sticky 底栏定位复用。
- `BR(...) / __cpSidepanelRenderScrollToBottomGuard` 是底部输入区的“滚动到底部”守卫；依赖 `sentinelElement + autoscrollRef` 判断按钮显隐。
- `__cpSidepanelAutoscrollControllerRef` / `__cpSidepanelMessageBottomSentinelRef` 是顶层 `autoScrollRef/sentinelRef` 两个 ref 槽位；`YY` 会把 `sentinelRef.current` 作为 `sentinelElement` 交给 `BR`。
- `FY(...) / __cpSidepanelProvideComposerShortcutMenuState`：slash/shortcut 命令菜单 provider，提供 `activeIndex/submenuOpen/submenuItems` 等交互状态，并注册全局 keydown 处理导航。
- `HY(...) / __cpSidepanelRenderInputAnchoredShortcutMenu`：命令菜单 overlay；主菜单优先锚到 `[data-chat-input-container]`，不存在则退回外部 `clientRect()`；子菜单默认右侧展开，溢出时翻转并把 top/left 钳制到 8px padding。
- `BY(...) / __cpSidepanelRenderComposerCommandMenu`：命令菜单装配器；异步加载 shortcut submenu 数据，组合 `FY + HY` 完成渲染、关闭与 editor focus。
- `GY(...) / __cpSidepanelBuildSlashShortcutSuggestionConfig`：tiptap suggestion 配置装配器；当用户输入 `/` 触发 suggestion 时，它会用 ReactRenderer 挂载 `BY(...)` 菜单组件，并把 DOM element append 到 `document.body`。
- `KY(...) / __cpSidepanelSlashShortcutSuggestionExtension`：slash `/` 的 tiptap 扩展入口；把 `char:"/" + allowSpaces:true` 的触发规则与 `GY(...)` 的 suggestion 配置注入 ProseMirror plugin。
- `activeBanner` 复用 `YY(...)` 顶部 banner 槽；`eligibility/error/refusal/messageLimit/highRisk/notification/announcement` 都从这里分流。

### 状态 Pill 与尾部联动

- `Wx(...)` 是可折叠的状态 pill 头部，只负责文案、caret 展开和 summary suffix。
- `Kx(...)` 是最后一组工具时间线的状态 pill 容器。
- `Wx(...) / __cpSidepanelRenderTimelineStatusPillHeader` 只负责状态头部显示与展开，不负责时间线窗口裁剪。
- `Kx(...) / __cpSidepanelRenderTimelineStatusWindow` 负责可见 blocks 窗口、live working status 与退出缓冲区。
- `working status 可见条件：仍在流式执行、已有 timeline blocks、且还没进入 turn over 锁存。`
- `fadeOnStatus 会把状态文案变化当成时间线阶段切点。`
- `collapse 模式只保留“等待输入工具 + 最近 N 个非 thinking 工具”；fadeOnStatus 则只展示最近一次状态切点之后的新阶段 blocks。`
- `当前活跃的 ik 链固定走 fadeOnStatus，不走 collapse，也不传 streamingMinHeight。`
- `可见时间线窗口收缩时，会把被移出的块暂存到退出缓冲区，给 fade/collapse 动画一个短暂收尾。`
- `onStatusDisplayVisibilityChange 只在 live working status 真正显示时通知父层。`
- `ik(...)` 里的 `turnIsOver`：有 timelineBlocks 时，需要 finalBlocks/后续 result-user/completion signal 任一命中；纯 answer_start 场景则靠 foundTurnAnswerStart 等边界兜底。
- `turn_answer_start` 只是阶段分割标记，本身不渲染。
- `timeline statusText 优先吃 currentStatusProp，没有外部状态时才回退默认 Working。`
- `ik(...)` 固定把 `Kx` 切到 `fadeOnStatus`；状态文案变化会把最后一组时间线切成新的可见阶段。
- `等待输入工具判定：approval_options+approval_key、mcp_auth_required、外部 isToolAwaitingInput 谓词，以及 AskUserQuestion 都算“等待用户动作”。`
- `等待输入工具保活链：只要 tool_use 还没被 actionedToolIds 标记消费，就算窗口裁剪也必须继续保留可见。`
- `streamingMinHeight 只在“未展开、当前窗口里没有等待输入工具、且还有可见 blocks”时生效。`
- `状态 pill 文案切换：live status 可见且位置在 pill 内时显示 statusText；否则回退成 step count summary。`
- `ik(...)` 当前不会额外传 `actionedToolIds / isToolAwaitingInput`；当前主链的等待输入主要靠 tool_use 自带 `approval/mcp_auth_required/AskUserQuestion` 字段兜底。

## 11. sidepanel runtime 消息桥

在时间线之前，background 发来的 runtime 消息还会先过 sidepanel 主桥：

- `service-worker / sidepanel / mcpPermissions` 现在是三层分工，不再是一条 listener 包办所有事。
- `service-worker` 负责打开目标 panel、ACK 探测、scheduled task 转发；`sidepanel` 才真正消费 `PING/ACK/EXECUTE_TASK/POPULATE_INPUT_TEXT`；`mcpPermissions` 负责 `MCP_PERMISSION_RESPONSE` 的 `requestId` 对账。
- `PING_SIDEPANEL 只是活性探针，收到后立即回 success + 当前 tabId。`
- `MAIN_TAB_ACK_REQUEST 只让主 tab 回 ACK；secondary tab 收到但不匹配时直接忽略。`
- `STOP_AGENT` 当前不按 `targetTabId` 过滤；sidepanel 收到后会直接走 `cancel + permission deny` 收口。
- `EXECUTE_TASK 会先按 windowSessionId / targetTabId 过滤目标 sidepanel。`
- `OPEN_SIDE_PANEL` 的 `tabId` 只负责打开/绑定目标 sidepanel；后续 `POPULATE_INPUT_TEXT` 不再携带 `tabId`。
- `scheduled task 只是给 prompt 加任务名前缀；真正发送仍复用普通 sendMessage 主链。`
- `scheduled task` 真正的定向键是 `windowSessionId`；当前这条 bridge 不生产 `targetTabId`。
- `POPULATE_INPUT_TEXT 负责把 prompt / permissionMode / selectedModel / attachments 一次性灌进 sidepanel 草稿态。`
- `POPULATE_INPUT_TEXT` 自身不再按 `tabId/sessionId` 过滤；面板选路发生在 `service-worker` 打开目标 panel 和 `EXECUTE_TASK` 分支里。
- `POPULATE_INPUT_TEXT` 是“草稿灌入 + 条件满足时延迟自动发送”分支；`pendingPrompt` 也从这里建立。
- `带附件的 populate 走“先注入草稿/附件，再延迟触发发送”。`
- `浏览器控制权限放行后，如果 sidepanel 里还有 pendingPrompt，会补发一次 sendMessage。`
- `MCP_PERMISSION_RESPONSE` 在 `service-worker` 主桥里只是轻量 ACK；`requestId/allowed` 不在这里解析，而是留给 `mcpPermissions` 背景账本。
- `MAIN_TAB_ACK_RESPONSE` 收口时只消费 `success`；`secondaryTabId / mainTabId / timestamp` 只服务探测阶段与 ACK cache。
