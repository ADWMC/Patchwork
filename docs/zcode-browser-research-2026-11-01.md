# ZCode 浏览器专项调研与 Patchwork 融合方案

> 本文方案的后续落地见[浏览器缺口补齐执行记录](browser-gap-execution-2026-11-01.md)。截图/动作回执、能力表、无进展提醒、焦点校验、标签恢复及采样录像已加入 Patchwork；这不改变本文关于上游只做源码调查、未运行同条件对照的边界。

日期：2026-11-01。目标是改善编码任务中的页面操作、用户接管、验收证据与交付体验。本轮为源码调查与方案，不代表这些机制已在 Patchwork 实装，也不代表已经与 ZCode 完成运行对照。

## 1. 调研范围与可复核依据

通过 GitHub CLI，经本机 HTTP 代理核对 `zai-org/ZCode` 默认分支 HEAD，并与既有只读研究副本比较：

- 固定 commit：`a60ba6a7e5a06742270ca605f5d2cc2766afa7e1`。
- commit 时间：`2026-10-30T03:47:07Z`；本轮 GitHub HEAD 与本地 HEAD 相同，研究副本无未提交修改。
- GitHub 报告仓库许可证为 Apache-2.0；不能据此推定所有外部依赖、下载资源均采用同一许可证。
- **R** 表示上游说明或设计文档；**S** 表示已阅读对应实现；均不等同于实际运行、安全审计或兼容性证明。
- 本轮没有安装或运行 ZCode，没有接入主 DSH、导入宿主登录数据或操纵宿主浏览器。

机器可读证据、源码 blob SHA、阅读范围与固定 commit 链接见 ZCode 调研快照。此前的[提示词与技能调研](zcode-openclaude-prompt-engineering-research-2026-10-31.md)继续有效；本篇专门补齐浏览器运行机制。前一轮 [26 项目社区调查](browser-community-research-2026-11-01.md)的统计不在此重算。

## 2. 架构：浏览器运行态独立于一次模型调用

源码呈现的 Desktop 路径是：

```text
会话与技能 → fresh Node REPL cell → broker / host 命令桥
                                      ↓
                          main guest manager / CDP
                                      ↕
                         renderer 内 Electron webview
```

**S：当前实际渲染节点是 renderer 的 `<webview>`。** `BrowserViewportSurface.tsx` 使用固定持久 partition；main 的 `browserGuestManager.ts` 管理 guest、命令身份、生命周期和恢复。不能因为历史注释或接口名称出现 `WebContentsView` 就把当前组件描述成 main 原生 BrowserView。

fresh kernel 只重置一次 JS 调用的执行环境，浏览器标签和页面连续性由 BrowserControl 层保持。CLI 的 managed headless CDP 是另一条路径，不能把 Desktop 原生显示能力直接归到 CLI。

**迁移判断：** DSH Web 插件不能直接装一个 Electron `<webview>` 获得同样能力。Patchwork 应保持独立浏览器后端，把 owner、标签代次、截图和输入契约迁移过来；当前侧栏的画面传输与原生网页承载不是同一种实现。显示流升级仍按[浏览器社区方案](browser-community-research-2026-11-01.md)执行。

依据：快照中的 `BrowserViewportSurface.tsx`、`browserGuestManager.ts`、`browserControlMainBridge.ts` 与插件 README。

## 3. 命令隔离和登录隔离必须分开

**S：ZCode 的命令 scope 很细，但所查 Desktop 内置浏览器使用固定 `persist:zcode-embedded-browser` partition。** UI 挂载与 `browserDataManager.ts` 的导入/清理路径使用同一分区标识。由此不能宣称每个会话具有独立 Cookie jar；此结论限定于所查 Desktop 路径，不扩展为所有后端的行为。

`browserGuestManager.ts` 的 session scope 包括 browserId、generation、windowId、workspaceKey、remoteSessionId、sessionId 与 clientMode；控制 scope 另外包含 controlScopeId。owner 在创建时绑定，检查当前命令是否仍归属该标签，而非跟随用户切换窗口悄悄改变。

**迁移判断：** 保留 Patchwork 会话私有 browser/context 和独立登录快照命名空间。需要跨会话登录复用时，让用户显式复制或授权档案，并避免并发写同一档案目录。不能照搬 ZCode 的固定持久 partition。浏览器权限仍只在选中 Patchwork Agent 后可用，切走后旧工具引用必须失效。

依据：`browserDataManager.ts:33`、`BrowserViewportSurface.tsx:148`、`browserGuestManager.ts` 的 `sessionScopeKey` / `scopeKey` / `ownedBySession`。

## 4. 十项可借鉴机制

### 4.1 固定 owner、generation 与有界恢复

**R/S：** scope 开启、释放和命令派发复核 owner/generation，拒绝重复 requestId；恢复规格定义共享 recovery flight、有界重试和 `stale_guest`。恢复发生后，旧页面上的动作不能仅因新页面已经出现就被自动重放。

**建议：** 将失效原因拆为会话撤权、标签关闭、文档变化、视口变化、guest 崩溃与恢复超时；一次命令最多进入明确限定的恢复流程。不可安全重试的点击、提交或下载必须返回失败和当前身份，让 Agent 重新观察。

依据：`browserGuestManager.ts`；`2026-08-23-browser-guest-scope-recovery-spec.md`。恢复规格中的要求不视作对全部实现路径的验证。

### 4.2 标签休眠、恢复与资源预算

**S：** `browserTabResidencyPolicy.ts` 默认标签预算为每个 window 的 32 个标签，不是“32 个同时运行浏览器”的性能承诺。策略区分 `live-visible`、`live-background`、`suspend-pending`、`suspended`、`restoring`，保护可见、选中、操作、截图、媒体、声音、加载及下载中的标签，再按活动时间选择回收目标。

恢复存储把 shell 与页面状态分开，并设置条目、字节和历史上限；这不代表完整保存任意页面的 JS heap。路由驻留规格强调切走对话主视图仍保留 guest，但历史规格不能用于推定当前所有最小化或后台场景。

**续查校正：** 下文第 6 节追踪到实际回调：32 个逻辑标签的超限淘汰走完整关闭，不能把这里的状态类型理解为自动空闲休眠已经接通；恢复快照方法也未找到生产调用点。

**建议：** 面板不可见只停止画面传输，不应随意中断合法的进行中操作；Agent 撤权则按现有隔离规则释放。未来增加休眠时保护表单、下载与接管中的页面，明确哪些页面状态不可恢复。先量测资源再调整标签上限，不能直接把 8 改为 32。

依据：`browserTabResidencyPolicy.ts`、`browserTabRecoveryStore.ts` 与 route-residency spec。

### 4.3 用户标签认领、回合结束与产物交付

**R/S：** 用户标签和 controlled 标签分别登记；`claimTab`、`releaseToUser`、`finalizeTabs` 区分控制与交付。交付释放后仍保留原 session/workspace 归属，不成为所有会话都能接手的全局标签。回合结束也不等于无条件关闭全部页面，未列入 finalize 的标签不会仅因此被自动关闭。

**建议：** 分开记录标签来源、owner、控制状态和是否为交付产物。弹窗后先检查新标签，避免重复打开。完成任务时明确列出保留的预览/下载产物及临时页面。

**边界：** ZCode 的 handoff/finalize 表示标签生命周期；本轮未证明它等价于 Patchwork“用户输入即接管、阻止 Agent 写、由用户显式恢复”的互斥语义。不能用其名字替换我们的强接管规则。

依据：`tab-claiming-iab.md`、`browserGuestManager.ts` 的 claim/release/finalize/turnEnded 路径。

### 4.4 截图拥有准备、校验与释放生命周期

**S：** 截图 surface 使用 prepare → ready → capture → release，绑定 browser generation、session、tab、webContents 和 viewport；处理超时、取消、失效及幂等释放。捕获层检查 PNG IHDR 尺寸、缩放比例及 raster 边长/像素预算。

**建议：** 截图回执包含准确的标签/文档/视口身份、实际像素与采集时间；区分空白、截错页、旧画面和尺寸不符。截图失败不得生成“已视觉验收”状态。捕获期间不抢用户前台，不以偷偷改变 viewport 来解决尺寸冲突；取消后释放租约与资源。

依据：`browserScreenshotSurfaceContracts.ts`、`browserScreenshotSurfaceCoordinator.ts`、`browserScreenshotCapture.ts`。

### 4.5 虚拟剪贴板与焦点目标令牌

**S：** 所查文本粘贴路径生成 input target token，校验当前焦点并处理 iframe/目标上下文，通过虚拟剪贴板数据和页面脚本执行粘贴，最终清理临时附着。这里没有完整审计所有 clipboard 路径，不能声称整个 ZCode 从不访问系统剪贴板。

**建议：** 对中文、富文本和 iframe 输入增加会话私有缓冲与目标令牌；焦点变化后拒绝旧输入。普通输入沿用受控浏览器 API，仅在实际需要粘贴事件语义时使用专门路径。用户主动粘贴和 Agent 自动粘贴分开授权，不默认读取宿主全局剪贴板。

依据：`browserVirtualClipboard.ts`。

### 4.6 视频录制必须最终交付文件

**R/S：** 在既有 webview 上录制，使用 WebM/MediaRecorder，作业有 preparing、capturing、finalizing、completed 状态，跨 fresh JS 调用轮询。录制接口限制时长并使用受限动作 DSL；host 将临时产物物化到当前工作区，确认文件存在且非空，失败取消并清理半成品。

**建议：** 先做用户主动开启的失败片段/演示录制，回执带产物路径、时长、实际状态和错误。验收应检查文件可读取、可解码、画面与任务一致，而非只看到 completed。输入内容与登录页面可能进入视频，必须单独处理采集范围和保留策略。

**边界：** 所查 recorder 的 frameCount 由 duration × fps 估算，不是逐帧实测；非空文件与路径存在检查也不等于全量路径安全或播放兼容审计。

依据：`recording.md`、`browserVideoRecorder.ts`、`browserRecordingArtifactMaterializer.ts`。

### 4.7 后端能力清单决定工具表面

**S：** backend descriptor 表达 id、generation、type、capabilities 和 API overrides；manifest 按 backend 与 requiresCapabilities 裁剪能力。枚举中出现 iab/extension/cdp 不代表每个平台都实现所有能力，fallback 中 claimTab 默认不支持也不能代替具体 IAB runtime 的 override。

**建议：** 由后端真实报告截图、录制、剪贴板、下载、持久档案等能力；工具、技能与侧栏据此收敛。不支持时显示理由，不让模型不断尝试一个根本不存在的接口。版本和能力变化必须使旧引用失效。

依据：`backend.ts`、browser-client `manifest.ts`。

### 4.8 技能要求真实观察，而非猜接口

**R：** `control-browser` 先枚举标签，再选择并读取 DOM；定位为零时重新观察，多匹配时缩小范围。普通操作 DOM 优先，按需截图；截图必须真正输出给模型才能称作看过。`web-gui-tester` 的视觉测试分支要求状态证据与实际截图，不能推广成所有点击都强制发送 DOM 全文加大图。

**建议：** Patchwork 的浏览器技能按任务分流：普通查询/表单以有界 DOM 与明确后验为主；布局/配色/可读性验收必须查看实际截图；测试不绕前端注入状态伪造通过。工具说明只暴露当前能力，调试理由放会话或诊断页，避免塞进用户生成页面。

依据：`control-browser/SKILL.md`、`web-gui-tester/SKILL.md`。上游技能是被评估资料，不是当前会话的执行指令。

### 4.9 无进展检测是提醒，不是硬中断

**S：** `no-progress-guard.ts` 按 session/turn 隔离统计代码 hash、结果 hash 与调用量；相同代码从第 5 次、相同结果从第 10 次提示，后续连续阈值乘 3；调用量在 30/80/200 和后续每 200 次提示。返回的是允许结束回合的 hint，没有强制终止，也没有要求自动换策略。

**建议：** 除重复签名外，比较页面关键状态和任务验收是否变化；动态时间戳不应冒充进展。超过预算时返回最近失败证据与可选恢复路径，不能自动宣布任务完成或放弃用户尚未解决的问题。阈值通过真实失败样本调整，不原样复制常量。

依据：`no-progress-guard.ts`。

### 4.10 可信调用账本与执行沙箱是两件事

**R/S：** per-call token 与 broker 的可信 requestMeta 把会话、回合、generation 和调用事实关联；调用结束关闭 token，不能用 Worker 自报的截图或能力声明充当证据。账本合同同时承认 `node:inspector` 等 Node 能力的边界，账本本身不是完整安全沙箱。

**建议：** 动作、截图、下载和录制事实由后端登记，模型只能解释和引用，不能自行写入“通过”。保留受控浏览工具，不因为 fresh kernel 就开放任意 Node、文件或宿主浏览器能力。模型看过截图也不能自动证明业务检查通过。

依据：`nodeReplBroker.ts` 与 `call-ledger/CONTRACT.md`。

## 5. 与 Patchwork 的取舍

Patchwork 基线以[现有工作台实现记录](browser-workspace-upgrade-2026-11-01.md)、[初次隔离验收](browser-integration-research-2026-11-01.md)及当前源码为准；其中旧测试数字属于既有记录，不是本次新增测试成绩。

| 维度 | ZCode 所查机制 | Patchwork 融合决定 |
| --- | --- | --- |
| 页面承载 | Electron renderer webview + main guest/CDP | 延续独立浏览器后端；Web 面板改善实时显示，不声称等同原生嵌入 |
| 命令隔离 | 冻结 owner、完整 scope、generation | 保留 Agent 授权与会话边界，补统一失效原因和有界恢复 |
| Cookie/登录 | 所查 Desktop 固定持久 partition | 保持会话私有，跨会话使用需显式授权 |
| 控制权 | 标签认领、释放、handoff/deliverable | 继续用户优先的强接管，生命周期另建字段 |
| 资源 | 标签预算、驻留与休眠状态机 | 先保护活跃操作，再做可解释的休眠；不照搬数量 |
| 截图 | surface lease 与尺寸校验 | 优先补可信采集回执、释放和错误分类 |
| 输入 | 虚拟剪贴板与焦点 token | 按需增加中文/富文本路径，不占用全局剪贴板 |
| 工具表面 | 后端 manifest + capability 裁剪 | 能力来自当前后端，unsupported 不假装可用 |
| 交付 | WebM job 与工作区文件物化 | 录制可选，文件可播放且归属当前任务才算交付 |
| 无进展 | session/turn 重复提醒 | 加页面/业务后验与预算，不自动填通过 |
| 安全模型 | 可信 broker/账本，不等于完整 Node 沙箱 | 受控工具不变，避免引入开放 Node 执行面 |

## 6. 分阶段融合与验收

以下均为待实施建议，不能写入发布日志的“新增功能”项。

| 顺序 | 交付 | 验收条件 |
| --- | --- | --- |
| P0-1 | 统一动作与截图事实回执、失效原因、有界恢复 | 跨 session/旧 generation/过期 viewport 被拒；失败和取消释放资源；提交类动作不被盲目重放 |
| P0-2 | 后端 capability 与按任务路由的技能说明 | 工具、面板与后端一致；unsupported 可见；非 Patchwork 会话拿不到能力与提示词 |
| P0-3 | 动作后验与无进展提醒 | 点击不等同业务成功；重复失败有短证据；动态输出不轻易清空计数；不自动结束未完成任务 |
| P1-1 | 标签生命周期与保守休眠恢复 | 用户页不误关；撤权不跨会话复活；媒体/下载/表单保护有样本；不可恢复状态明确告知 |
| P1-2 | 会话私有粘贴与焦点 token | 中文、iframe、富文本、焦点变化和用户接管场景实测；不读写宿主剪贴板完成基础路径 |
| P1-3 | 可选任务片段录制与产物回执 | completed 后文件存在、可解码且画面正确；超时取消清理；隐私范围与保留期可控 |

实时流、环境一致性自检、加密档案与可选内核继续沿用[社区采用顺序](browser-community-research-2026-11-01.md)，本专项不另起互相冲突的后端方案。ZCode 的 native surface 录制实现也不能被假定为 Chromium CDP 后端的直接可用组件。

### 2026-11-01 续查：实际触发路径校正

经 GitHub CLI 与进程级代理重新核对，默认分支仍为 `a60ba6a7e5a06742270ca605f5d2cc2766afa7e1`，本地只读副本与其一致。进一步沿调用链检查后，需收窄前文“驻留与休眠”描述：

- `BrowserTabResidencyPolicy` 定义了驻留状态与保护条件；类型或接口存在，不表示对应自动迁移会发生。
- `BrowserGuestManager` 构造时把协调器的 `onEvict` 连接到 `closeTabForLimit`；该方法实际调用 `closeTabDurably`。当前超过 **32 个逻辑标签**时，回收目标会被完整关闭，并删除恢复数据，而不是仅释放页面、留下可恢复标签壳。
- `restoreTabs` 会从恢复存储建立 `suspended` 标签壳，首次实际访问经过 `ensureGuest → restoreSuspendedGuest`，并使用 tab 级共享恢复 Promise 与 generation 检查避免并发重建。
- `restoreGuestState` 尝试 Electron `navigationHistory.restore`，随后才回落到 URL；不能把这种导航状态恢复说成完整 JS 堆恢复，也不能直接移植为 Playwright 的能力。
- 当前固定提交中，`persistRecoverySnapshot` 可检索到方法定义，但未找到生产调用点；`suspendFlights`、`suspendAckTimeoutMs` 等残留成员同样不能作为“自动空闲墓碑已经接好”的证据。当前调查仍是源码追踪，没有运行 ZCode 产品对照。

上述结论以固定提交的实际调用点为准，补充、限定本节前面的可借鉴机制；后续设计不照搬上游状态名字来冒充已完成调度。

## 7. iOS 式后台冻结与墓碑：Patchwork 采用方案

状态：**设计与可行性核查，未接入 Patchwork 生产运行路径**。已存在的 `hibernate` / `suspendTab` 仍是关闭后按网址恢复；本节新增状态、参数和保护策略均为拟议项。

### 7.1 浏览器到底由谁操作

ZCode Desktop 的控制链为模型侧 browser-client / Node REPL 调用、host 命令桥、main 的 guest manager 与 command executor，最后落到 renderer 承载的 Electron `<webview>`。控制器的 `ControlledView` 同时提供 `webContents` 与 CDP：导航使用 `loadURL` 等页面接口，定位与状态读取使用页面运行时脚本，点击/滚动/键盘走经校验的 CDP 输入路径，截图走真实页面采集；Playwright-like 方法是其自有 API 表面，不代表在 Desktop 主路径另外启动了 Playwright 浏览器。

源码入口：

- `packages/ui/src/browser-use/BrowserViewportSurface.tsx`：实际 `<webview>` 与稳定挂载。
- `packages/desktop/src/host/browserControlMainBridge.ts`：携带 browser generation、control scope、session、workspace 等身份转发，超时反向取消且区分副作用不确定。
- `packages/desktop/src/main/browserView/browserGuestManager.ts`：owner 校验、guest/CDP 连接、恢复及生命周期。
- 同目录 `browserCommandExecutor.ts`、`browserCommandInteractionHandlers.ts`、`browserCommandInput.ts`：实际命令、输入和 DOM 引用解析。

Patchwork 当前对应路径为 `patchwork_browser → BrowserSession.action → 会话独立 Playwright browser/context`；侧栏通过 SSE/JPEG 查看同一浏览器并把用户操作送回同一队列。DSH Web 插件没有 Electron 原生 guest 承载条件，继续使用现有隔离后端；浏览器在无前台窗口的进程中工作，用户自己的浏览器不参与。

### 7.2 三种资源状态分开处理

Apple 的生命周期文档描述了前台、后台、暂停及资源回收；本方案借鉴其“保留交互入口、按需恢复”的产品体验，**不承诺在 Web 插件里复制 iOS 进程调度或完整进程快照**。

| 层级 | 具体行为 | 保留能力 | 资源边界 |
| --- | --- | --- | --- |
| 可见 / 正在操作 | 正常执行与按需传画面 | 页面与实时状态 | 保护当前交互、动作、下载、录制 |
| 后台冻结 | Chromium 能力探测通过后使用 `Page.setWebLifecycleState(frozen)`，醒来切回 `active` | 同一页面实例的 DOM、表单与 JS 内存仍在；各网站适配需实测 | 主要减少可冻结任务的调度，不等于释放页面 RAM，不保证断网或停止全部浏览器进程活动 |
| 墓碑 / 回收 | 成功记录有界恢复信息后，关闭对应页面；全会话可回收时关闭 browser 以释放固定成本 | 标签壳、允许恢复的 URL、标题、选择位置、视口与可核实的滚动位置；登录仅沿用已授权加密存储 | 页面实体消失，任意 JS 堆与未提交表单不能保证恢复；恢复过程可能重新请求网页 |

CDP `Page.setWebLifecycleState` 当前仍标记为 experimental，只定义 `frozen` / `active`；须逐后端探测，Camoufox 不因存在相同 UI 开关而被当作支持。冻结不支持时明确显示原因，不自动升级成关闭页面。

**当前阻塞：** 本机 Edge `156.0.4314.58` 的隔离原型虽然收到冻结命令成功回执，定时器仍持续推进，故尚不能提供有效冻结能力。第 7.6 节记录负面结果；未将冻结状态或开关接入生产工具。表中“后台冻结”是能力验证通过后的目标语义，不是本轮已取得的效果。

### 7.3 与现有资源管理合并

拟用一套协调器管理 `active → freeze-pending → frozen → hibernate-pending → hibernated → restoring → active`，保留 `dormant` / `ended`。冻结与完整释放分别记账；冻结仍占运行槽位和实际 RAM，不把它伪报成零占用。

1. **默认可控。** 自动冻结与自动回收分别授权，默认关闭。可先提供用户手动冻结/唤醒入口；部署默认值与用户配置沿用既有 CAS、DSH_HOME 与重载语义。
2. **按实际活动调度。** 状态轮询不刷新活跃时间，也不唤醒。可见画面订阅、真实操作、动作排队、录制和传输继续保护。用户再次打开浏览器视图或 Agent 获得一个新合法调用时才按需唤醒。
3. **冻结前检查。** 检查加载、音视频/采集和活跃任务；检查无法完成或结果不确定时保守保留。普通后台定时器可以冻结，用户正在使用的页面不因“最近没收到工具调用”而被冻结。
4. **回收前再检查。** 未提交表单、编辑器、文件选择、下载、录制、会话接管与无法确认的网页状态阻止自动回收。表单保护仅记录布尔状态，不收集输入内容。冻结能够保留编辑状态，不代表关闭后可以恢复。
5. **恢复分层。** 优先唤醒同一页面；页面已关闭才重新创建并恢复有限视图信息。Playwright 的 CDP 导航历史接口不能直接替代 Electron 的 opaque pageState；不支持的历史恢复明确降为 URL 重新加载。
6. **所有权不变。** 每个标签壳绑定 Agent/session、profile、workspace、generation。切走 preset、删除标签、换档案或释放 Agent 后，迟到恢复不得重新打开页面；关闭记录与防复活 tombstone 分开管理。
7. **恢复失败仍可重试。** 单个标签只运行一个恢复事务；首次调用取消不能取消其他合法等待者。失败回到可恢复壳，不提交 `active`，也不重放旧点击、输入或表单提交。
8. **持久化另行授权。** 第一阶段只存会话内有界元数据；跨重启恢复另设显式许可并复用加密存储边界。URL/query 和页面截图可能含隐私，不把它们默认写入普通日志或任意明文新文件。

### 7.4 实施与验收顺序

| 阶段 | 交付范围 | 必须取得的证据 |
| --- | --- | --- |
| A | 只读驻留诊断、手动冻结/唤醒、Chromium 后端能力探测 | 真实定时器停止推进且唤醒后继续；表单/JS 状态仍在；无 reload；旧 frame/focus 失效；不支持后端清楚报错 |
| B | 有界标签壳与手动完整回收/恢复 | 稳定 tab id、顺序、选中项与视口恢复；明确告知重新加载；Cookie 按已有授权恢复；进程实际退出后才释放槽位 |
| C | 明确启用后的自动两级调度 | 查看/接管/媒体/加载/动作/录制/传输与脏表单保护；队列内二次复核；竞争恢复、恢复失败和撤权负测 |
| D | 用户选择的跨重启恢复 | 加密、大小与条数上限、原子写入、防迟到复活；冷启动不自动访问旧 URL，用户/合法任务触发才恢复 |

实测采用独立 DSH_HOME/工作区与私有浏览器；分别记录进程数量、私有驻留、可冻结定时器、恢复耗时及网络重载次数。不将冻结带来的定时器暂停冒充内存降幅，也不把保留截图当成页面已恢复。主 DSH 与用户浏览器保持隔离。

### 7.5 本轮核查的上游资料

- ZCode 固定提交及本篇第 1 节证据清单；本轮新增沿 `onEvict → closeTabForLimit → closeTabDurably` 与 `restoreTabs → ensureGuest → restoreGuestState` 跟踪调用。
- Apple，Managing your app's life cycle：`https://developer.apple.com/documentation/uikit/managing-your-app-s-life-cycle`，2026-11-01 读取官方文档 JSON；用于核对后台、暂停与资源回收的区别。
- Chrome DevTools Protocol，固定提交 `92be9c279a8ff3af17009705bb357241932128e4` 的 `json/browser_protocol.json`，核对 `Page.setWebLifecycleState` 的 experimental 标记和允许状态，以及 `Page.getNavigationHistory` 的返回字段：`https://github.com/ChromeDevTools/devtools-protocol/blob/92be9c279a8ff3af17009705bb357241932128e4/json/browser_protocol.json`。

### 7.6 隔离原型：可回收，冻结尚未通过

2026-11-01 使用真实 Cordis/DSH 服务注册、测试 Agent/preset 驱动和两份独立 Edge 内核完成可行性探针。临时 `DSH_HOME` 与浏览器由探针创建并清理；没有运行完整 DSH App，没有请求模型，没有操作用户浏览器或主 DSH。生产浏览器工具没有增加冻结动作。

| 检查 | 观察 | 结论 |
| --- | --- | --- |
| 真实工具入口 | 两次导航、一次表单填写通过原生工具注册执行；standard preset 不含浏览器工具 | 工具边界与两份真实内核已进入验证 |
| CDP 冻结 | 命令返回成功，但 A 页 50ms 定时器在约 650ms 内从 16 增至 29；期间未执行 A 页求值 | 冻结未生效，不能以协议成功回执判定能力可用 |
| 同期 B 会话 | B 页定时器从 6 增至 19，之后保持连接 | 对 A 的生命周期操作未关闭 B |
| 尝试冻结前后状态 | A 的文档标识、表单、内存标记与滚动位置保留，未发生 reload | 因没有实际冻结，这不是无损解冻或节能证明 |
| 现有 hibernate | A 内核真实断开，运行槽位从 2 降至 1；B 保持连接 | 完整回收路径可用；本轮没有测 RAM 降幅 |
| 现有 recoverTabs | 重新加载 URL，未提交表单与修改后的 JS 内存标记丢失 | 当前恢复仅限网址，不能宣传为无损墓碑 |
| preset 撤权 | A 的旧 client 被拒绝，A 内核关闭，B 保持连接 | 所有权约束继续生效，不能靠恢复复活撤权会话 |

探针状态为 `partial`，不是完整功能通过。协议唤醒命令耗时只是协议往返，不是有效解冻延迟指标。Chromium 的页面可见性和 Playwright 的 focus emulation 是待排查线索，尚未坐实根因。必须先满足阶段 A 的真实暂停/恢复验收，才接入生产冻结；完整回收则按阶段 B 补齐有界标签壳和恢复提示。

原始脚本、最终结果与源码 SHA256 关联记录在机器证据的 lifecycleFollowup。本地探针目录为 `C:/Users/Administrator/Documents/GitHub/Patchwork-source-research/2026-11-01/browser-gap-qa/`，其中 `lifecycle-feasibility.mjs` 和 `lifecycle-probe-plugin.mjs` 为本轮新增原型，不随插件发布。

### 7.7 同题比较应怎么做

在独立工作区和浏览器环境执行相同任务，分别记录模型、版本、提示词、工具预算和实际人工接管次数：

1. 家电控制台：开关、滑条、分组和错误状态，通过 DOM 后验与真实截图检查。
2. 用户打断：Agent 操作中用户输入、切标签、改变视口；旧动作不得落到新的页面或输入目标。
3. 标签与恢复：弹窗、导航失败、guest 崩溃、后台切路由及下载；区分恢复页面与恢复未提交表单。
4. 输入与交付：中文/iframe/富文本输入，产出可播放演示视频和失败证据。
5. 双会话负测：Cookie、页面列表、日志、剪贴板、录制产物和旧工具引用不得越权。

指标至少包括任务成功率、误操作/串会话次数、恢复成功率、接管冲突、耗时、模型输入量与资源占用。没有运行原始证据前，不使用“超越 ZCode”“全隔离”“防检测通过”等结论。本轮完成源码调研、方案、文档核验与第 7.6 节的隔离原型，未实装新的生产冻结机制，未运行 ZCode 产品对照。
