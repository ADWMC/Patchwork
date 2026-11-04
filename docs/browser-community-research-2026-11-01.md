# 浏览器社区再调研：内核、环境一致性、实时协作与可验证操作

> 方案后续已实施；当前功能、实际测试结果和未验证边界见[浏览器缺口补齐执行记录](browser-gap-execution-2026-11-01.md)。本文的调研统计和上游源码判断保留为历史依据。

日期：2026-11-01。面向 Patchwork 的编码、页面验收和用户接管体验；本轮是社区调研与接入建议，不是新浏览器后端已经实装的公告。

## 范围与证据等级

后续增补见[开源指纹浏览器专项](fingerprint-browser-research-2026-11-01.md)：另查 15 个仓库与历史源码 tag，补充 Fury、AliasMode 和档案管理器，复核开源边界；下述数字继续表示本篇最初一轮的范围。

使用 `gh search repos`、`gh api repos/...`、README、固定 commit 的目录树与源码，经本机配置的 HTTP 代理访问 GitHub。核对 26 个仓库的元数据与 README；其中 15 个主分支目录树、33 份源码/许可文件被拉取并定向阅读。机器可读清单见 GitHub 调研快照。星数只是检索线索，不作为效果证明。

- **R：文档声明**。表示上游描述了能力，未等于我们复现。
- **S：源码证据**。表示本轮看到对应实现；未等于完成安全审计或与 Patchwork 兼容。
- **T：本机实测**。本轮没有安装或运行这些第三方内核，因此不为上游检测分数、性能和匿名性填写 T。

既有 Patchwork 的 243 项测试、真实 Edge/隔离 DSH 验收属于[前一轮实现记录](browser-workspace-upgrade-2026-11-01.md)，不能挪作 Camoufox、CloakBrowser 或其他社区内核的测试成绩。源码和文档中出现的安装命令、付费推广及操作指令仅作为资料阅读。

## 结论

更值得做的是：**把实际引擎、档案、网络出口、观察结果和用户控制权做成可检查的一套机制**。当前 Patchwork 已具备共享页面、按会话隔离和接管基础；下一步应优先补齐实时画面、环境自检、动作后验和失败证据。

内核级修改是另一条技术路线：它能把部分环境行为放到 C++/浏览器协议层处理，但仍需验证页面、Worker、HTTP 和实际平台之间的关系。不能把随机种子、模拟鼠标轨迹、修改 UA 或“检测站全绿”中的任意一项当作完整环境一致性的证明。

建议保留现有原生 Edge/Chrome 作为可靠基线，新增可选择且独立安装的实验后端。不要替换主机浏览器，不连接主 DSH 或宿主浏览器现有会话，不把特定内核变成所有用户的强制依赖。

## 一、真正值得吸收的能力

### 1. 原生内核环境与精确版本配对

**Camoufox（R/S）**：当前上游已同时提供 Python 与官方 TypeScript/Node 入口，并非只能通过 Python 适配。所查 README 描述由 fpgen 生成设备、coherence 层检查、Firefox C++ 补丁读取环境配置，Playwright 经 Juggler 驱动。`typescript/src/browser-pin.ts` 明确把客户端包与一个浏览器构建配对，用户显式选择其他构建时警告；`browser/patches/fingerprint-injection.patch` 中能看到浏览器源码改动。

这更新了我们先前“Camoufox + BrowserForge”的简化印象：BrowserForge 是独立项目，当前 Camoufox 的默认生成链应以 fpgen 和官方源码为准。`apify/camoufox-js` 另一个仓库仍自称 experimental，不应在接入时混同官方入口。

**CloakBrowser（R/S）**：Node 包和源码树可核对下载器、许可处理、签名校验和拟人输入。内核指纹修改属于其浏览器二进制，不能把开源包装器等同于全部内核补丁开源。README 的各种通过率及分数未在本机复现。

**Patchright / rebrowser-patches（R/S）**：修改 Playwright/自动化协议路径，重点包括执行上下文与 `Runtime.enable` 一类自动化暴露。rebrowser 此次已有对应 `playwright-core/1.64.1` 的补丁，能与我们的版本讨论兼容性，但这只是版本线索，不是直接打补丁的理由。它们不负责提供完整虚拟硬件环境。

**迁移建议**：抽象 `BrowserBackend`，至少分别报告 `engineFamily`、`engineBuild`、`driverBuild`、`profileSchema`、`capabilities`；同一会话不静默换内核。档案保存具体构建与生成器版本，并在启动前检查配对。Camoufox 使用 Firefox/Juggler，不能沿用只适配 Chromium CDP 的实现假设。每种后端单独通过隔离、接管、输入、存储和截图测试。

### 2. 环境一致性体检，而不是一个好看的“隐匿分数”

**Donut Browser（S）** 的 `fingerprint_consistency.rs` 明确区分一致、不一致和没有比较。其实际检查重点是代理出口地区/时区与档案语言、时区；它不是覆盖所有指纹面的检测器，而且模块只测量，不静默重写身份。

**Camoufox（S）** 的 `coherence.ts` 有具体设备约束与修正规则，例如 OS、GPU、屏幕、DPR、CPU 组合。**Anti-Mage（R/S）** 从相反方向寻找自相矛盾：所查 `sec_scopes.go` 比较主线程、Worker、嵌套 Worker 和多类 iframe 的 UA、平台、语言、CPU 与时区；其 README 的品牌评分只是作者实验，未独立核验。**CreepJS / BotD（R）** 可补充浏览器表面和自动化迹象的检测视角，不能作为匿名性证书。

**迁移建议**：增加用户可触发的本地自检页，返回逐项 `一致 / 不一致 / 未检测 / 不支持`，带引擎版本、探针版本、测量时间和原因；禁止把缺失项算通过。首批检查 HTTP UA、UAData/client hints、主页面/Worker/iframe、语言、时区、screen/viewport/DPR；字体、WebGL/WebGPU、Canvas、Audio 和 WebRTC 分批加入。

仅使用我们自己控制的本地探针进行基础验收；外部检测站是可选补充，不自动把原始设备指纹或登录状态上传出去。用户主动选择代理出口检查时说明实际查询服务；结果只提示，不擅自修改运行中的身份。

### 3. 实时画面、丢旧帧和输入回执

**Steel Browser（S）** 的 `page-screencast.ts` 使用 `Page.startScreencast`、`screencastFrameAck` 和 WebSocket，按页面共享抓帧源；每个 viewer 只保留待发送的最新帧，前一帧发送完成才继续，从而避免慢客户端积压。代码还处理无人观看时停止和状态稳定后的画面刷新。源码中的帧 ACK 节奏是上游实现参数，不能当作我们已经达到的帧率。

**agent-browser（S）** 已有独立流模块、来源检查和帧确认机制。**Neko（R/S）** 是 Docker 中的虚拟桌面 + WebRTC 路线，涉及音视频、桌面输入和房间控制；比只传网页 JPEG 完整，也更重。**CloakBrowser Manager（R/S）** 则在 Linux 使用 KasmVNC/noVNC，Windows/macOS 采用原生浏览器窗口，并非所有平台都在 Web 面板内原生嵌入浏览器。

**迁移建议**：Patchwork 第一阶段使用 Chromium CDP → 受鉴权 WebSocket → 侧栏，保留 JPEG 轮询回退。继续携带真实会话、tab、文档/视口代次；用户输入有序执行，服务端返回动作序号和结果。隐藏时停止、慢连接只保留最新帧、图片编码尺寸与页面视口分开。不能直接照抄 Steel 的视口覆写逻辑，否则会破坏我们既有 screen/DPR 与设备档案。

只有明确需要音频、视频或完整桌面时再评估 WebRTC；Neko 的 Linux/Docker 部署不应成为 Windows 插件的默认安装门槛。实时侧栏流也不自动进入模型上下文。

### 4. 加密档案、身份固定与显式共享

**Donut（R/S）** 有临时档案、密码保护、可选端到端同步；本轮阅读的本地档案加密文件有 AES-256-GCM 文件封装和校验流程。同步端到端加密属于 README 声明，本轮没有完整审计其密钥协议。**Persona Studio（R/S）** 使用可选安全后端对代理密码等秘密字段加密，其他档案字段仍可读；这不等于所有 Cookie 和完整档案都已加密。

**迁移建议**：优先解决我们当前未加密的登录快照。复用成熟加密库，单档案数据密钥，OS 密钥库或用户口令负责解锁；模型拿不到解密密钥。清楚显示锁定、解锁、磁盘保存与临时运行状态，错误时阻止启动，不能退回明文保存。运行中的浏览器仍需访问明文状态，加密静态文件不等于完整 OS 隔离。

默认继续按会话私有。若用户希望另一个会话使用同一登录环境，提供显式授权的“复制档案/授予使用”，记录来源与权限；不能因为 cwd 相同就复用，也不能两个 Agent 同时写同一个用户目录。身份固定与安全更新需要分开：固定不代表永久使用过时内核，升级须创建新 revision、备份并验证，而非悄悄重生成身份。

### 5. 语义差异与操作后验

**agent-browser（R/S）** 同时提供交互元素引用、文本快照差异和截图差异；`diff.rs` 中能看到文本比较和像素差异阈值处理。截图差异不是理解页面的智能裁判，动画、字体和动态时间会影响结果。

**Stagehand（R）** 是观察、动作、结构化提取和定位能力参考。其 README 同时介绍本地 SDK 与 Browserbase 云端能力；持久环境、代理及托管录制不能都当作 SDK 自带的免费本地功能。**Ulixee Hero（R/S 目录）** 值得借鉴把网络、DOM 与交互关联起来的整体方法，完整接入会引入另一套自动化基础设施。

**迁移建议**：工具返回动作前后少量有意义的差异：哪个控件状态改变、预期文本是否出现、是否发生导航或下载、检查是否超时。点击成功只证明事件执行，不能自动得出业务成功。交互引用绑定 tab 与页面代次，页面变化后重新定位；模型收到有界变化摘要，需要时再取完整截图。不要在每次操作后反复发送整页文本和高分辨率图片。

### 6. 可回放的失败证据

**rrweb（R）** 提供 DOM 快照和变化/交互回放；其回放并不是重新执行原站点 JavaScript。**Browsertrix Crawler（R）** 面向高保真网页归档，是保存网络内容、复现检索证据的参考，并非适合直接塞入侧栏的轻量依赖。Steel 的录制与交互日志、Browserless 的调试界面也提供产品思路。

**迁移建议**：先做轻量任务 trace：导航、动作、控制权、URL、截图引用、失败原因、耗时及已脱敏网络元数据。用户可导出失败包给我们排障；默认不录完整页面、输入正文、请求正文、Authorization/Cookie。需要完整录制时明确开启、限定保留周期，并验证密码输入、截图和 DOM 中的秘密是否被覆盖。仅屏蔽 password 输入值不能证明整份录制已脱敏。为日志系统保存结构化事件，为对话返回短说明，避免把调试说明塞进用户网页。

### 7. WebMCP：页面直接提供结构化能力

**agent-browser（R/S）** 有实验性 WebMCP 工具发现和调用；`webmcp.rs` 中保留 origin，把页面描述/结果标记为 `untrusted`，处理页面上下文变化和输出大小。这使“查询页面状态或调用网站明确提供的方法”成为另一条路径，可能减少部分基于坐标的操作，但取决于站点支持，不能取代普通浏览器交互。

**迁移建议**：先提供只读发现，作为当前标签下的外部数据。执行需要用户按站点授权、工具参数校验和明确的写操作判定；调用前后复核文档身份。网页工具不能直接注册进 DSH 全局工具集，不能改变 preset、浏览器控制权或 shell 权限。当前实验不作为首轮必做项。

### 8. 代理能力必须看完整链路

**ShardBrowser（R/S）** 宣称原生 SOCKS5 UDP、QUIC/WebRTC 和出口 TCP 指纹配合；所查 SDK/`runtime.json` 能确认它另行下载并管理特定 Chromium 构建与指纹资源，而不是只改 UA 的小库。本文未运行其内核，也未审计完整网络实现，不把宣传等同于已经证明的防泄露能力。

**迁移建议**：先验证普通 HTTP、HTTPS CONNECT、SOCKS5、认证错误、WebRTC 和 DNS 行为，暴露真实结果与失败原因。浏览器档案不能修复代理服务器的 TCP 栈；换 UA 也不能改变网络出口的 TLS/TCP 表现。不要为了功能表把 VPN、系统 DNS 改写或全局代理加进普通会话。需要代理桥接时只在该会话的独立进程/目录内运行，撤权时回收。

## 二、完整项目清单与采用判断

下列判断是本轮阅读后的接入建议，不是已通过的兼容性结果。具体 commit、GitHub 返回的许可证标识和源码路径均在快照 JSON 中。

| 项目 | 本轮证据 | 值得借鉴 / 当前决定 |
| --- | --- | --- |
| [Camoufox](https://github.com/daijro/camoufox) | R/S | Firefox 原生环境、coherence、官方 Node 接口、客户端/内核版本配对；优先做可选后端实验 |
| [CloakBrowser](https://github.com/CloakHQ/CloakBrowser) | R/S | 独立内核启动、签名验证、输入轨迹；包装器与二进制分开授权，不直接打包内核 |
| [CloakBrowser Manager](https://github.com/CloakHQ/CloakBrowser-Manager) | R/S | 档案管理与 Linux 远程可见控制；GUI 的 MIT 不覆盖内核许可 |
| [Donut Browser](https://github.com/donutbrowser/donutbrowser) | R/S | 本地档案、加密、明确的未知状态、地区一致性；较完整产品参考，Wayfern 引擎与自动化套餐另核对 |
| [Persona Studio](https://github.com/TechQaiser/persona-studio) | R/S | 多引擎准备状态、安装进度、身份固定和自检；较小项目，不依其自评分直接选型 |
| [ZenCloak](https://github.com/jiabirc6/ZenCloak) | R | Windows DPAPI、健康报告与本地管理；成熟度证据有限，仅作设计参考 |
| [ShardBrowser](https://github.com/ProxyShard/ShardBrowser) | R/S | 引擎/SDK manifest、代理链路；核验二进制来源、授权和维护后再讨论接入 |
| [fingerprint-chromium](https://github.com/adryfish/fingerprint-chromium) | R/目录 | README 明确源码在版本 tag，采用延迟公布；主分支仅 4 文件不能据此断言“没有源码”，当前二进制也不能被默认视作已可重建 |
| [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) | R/目录 | Chromium 驱动补丁；可选驱动对照，不能替代完整指纹方案 |
| [rebrowser-patches](https://github.com/rebrowser/rebrowser-patches) | R/S | 具体 Playwright 1.64.1 源码补丁；仅研究独立依赖实验，不就地修改共享 node_modules |
| [Apify fingerprint-suite](https://github.com/apify/fingerprint-suite) | R | 延续当前生成/注入基线；原有源码分析见前文档，版本匹配和实际表现仍要验 |
| [BrowserForge](https://github.com/daijro/browserforge) | R | Python 指纹/headers 生成，独立于当前 Camoufox 默认链路；不增加重复运行时 |
| [Scrapfly fpgen](https://github.com/scrapfly/fingerprint-generator) | R | 条件设备分布、模型版本；生成器是数据组件，不提供完整浏览器 |
| [Apify camoufox-js](https://github.com/apify/camoufox-js) | R | 实验性 JS 移植；与上游官方 TypeScript 入口分别比较，不优先混用 |
| [Anti-Mage](https://github.com/N4darae/anti-mage) | R/S | 跨 realm 自洽检查、证据不足时不下结论；不移用作者品牌评分 |
| [CreepJS](https://github.com/abrahamjuliot/creepjs) | R | 浏览器表面与差异诊断；用作可选自测参考，不以单站评分代替验收 |
| [BotD](https://github.com/fingerprintjs/BotD) | R | 客户端自动化检测探针；结果用于诊断，不当作环境是否匿名的判决 |
| [Steel Browser](https://github.com/steel-dev/steel-browser) | R/S | CDP 流、背压、共享抓帧源、交互事件；最值得优先迁移的结构 |
| [Neko](https://github.com/m1k1o/neko) | R/S | WebRTC、虚拟桌面与控制权；远程桌面后端候选，不强制 Docker |
| [agent-browser](https://github.com/vercel-labs/agent-browser) | R/S | 快照/截图差异、交互引用、实时流、WebMCP；借鉴工具粒度和观察成本控制 |
| [Stagehand](https://github.com/browserbase/stagehand) | R | observe/act/extract 及复杂页面定位；先借鉴机制，不叠加另一套模型循环 |
| [Ulixee Hero](https://github.com/ulixee/hero) | R/目录 | 多层浏览器表现和观测；完整栈过重，不作为首批依赖 |
| [rrweb](https://github.com/rrweb-io/rrweb) | R | DOM 事件回放；需要严格录制边界，任务 trace 优先 |
| [Browsertrix Crawler](https://github.com/webrecorder/browsertrix-crawler) | R | 高保真归档；信息检索的证据保存方向，不直接并入浏览器控制器 |
| [Lightpanda](https://github.com/lightpanda-io/browser) | R | 轻量 JS/DOM 自动化和检索；README 明确没有图形渲染引擎，不能替代我们真实视觉验收，默认遥测也需单独配置 |
| [Browserless](https://github.com/browserless/browserless) | R/S 许可 | 调试、排队与会话产品参考；根 LICENSE 为 SSPL-1.0 或商业许可，不按普通宽松许可依赖直接合入 |

## 补充：ZCode 专项（第 27 个项目）

按用户补充要求，通过 GitHub CLI 另行核对 `zai-org/ZCode`，固定 commit 为 `a60ba6a7e5a06742270ca605f5d2cc2766afa7e1`。专项定向阅读 25 份源码/文档，记录见 [ZCode 浏览器专项](zcode-browser-research-2026-11-01.md)及独立证据快照。本节是增补，不修改前一轮 26 个仓库、15 个目录树、33 份文件的历史统计。

值得吸收的是冻结 owner 与 generation、标签驻留/恢复、截图 surface 生命周期、输入目标校验、录制文件交付、后端能力裁剪、重复调用提醒及可信事实账本。当前 Desktop 采用 renderer `<webview>` + main guest/CDP，不能直接复制到 DSH Web 插件。所查内置浏览器还使用固定持久 partition，命令隔离不等于每会话独立 Cookie；Patchwork 保持会话私有档案和用户优先的强接管。

专项把截图/动作回执、能力表和无进展提醒归入 P0，标签恢复、私有粘贴和可选短片段录制归入 P1；完整录像、音视频和远程运行仍按本文后续阶段评估。两份方案共用现有后端，不引入第二套浏览器或开放 Node 执行面。未安装或运行 ZCode，不能将这些源码发现写成实测成绩。

## 三、落到 Patchwork 的执行顺序

### P0：直接改善当前用户体验

1. **实时流**：新增独立 stream route 和前端 transport；服务端鉴权、来源检查、逐会话订阅、最新帧背压、隐藏停止、断连回退。保持点击的 tab/代次/坐标绑定。
2. **环境检查**：新增本地探针与可见报告，不弹一个无依据的综合分数；区分配置值、浏览器实测值和未覆盖项。修正我们目前仅检查 Chromium 主版本的兼容门。
3. **动作后验与 trace**：对开关、表单、导航提供确定的前后状态断言，把失败包连到已有日志/证据页。模型对“是否成功”的判断需要真实回执。

### P1：可维护的环境与登录生命周期

4. **加密保存**：档案密钥、解锁状态、原子存储、迁移与删除；支持 session id 对应目录的受控备份。旧明文状态迁移有明确结果，不能双存。
5. **稳定构建与安装器**：隔离缓存、版本 manifest、签名或可信校验、下载进度、失败回退、可追溯升级；禁止在模型导航网页时静默下载安装可执行文件。
6. **登录与多标签流程**：用户完成登录后由用户恢复 Agent；popup/opener 绑定、受控上传下载、弹窗处理与标签保留策略。下载必须授权到工作区并有大小/类型限制，不能自动运行文件。

### P2：分别验证可选后端

7. 原生 Chromium 保留基线；Camoufox 官方 Node 后端与 Patchright 驱动后端分别做同题对照，不将补丁、JS 注入和多个生成器层层叠加。
8. 覆盖真实代理/存储、启动取消、撤权、用户接管、独立双会话和异常释放；输出明确能力表。Firefox 的流传输、网络事件与 selector 差异必须显式适配。
9. CloakBrowser/ShardBrowser 仅在二进制授权、更新、签名及重建边界被核实后列入可选安装。此轮不打包、不后台下载。

### P3：按真实需求扩展

10. WebMCP 只读发现与站点授权调用；再考虑完整录像、WebRTC 音视频和远程沙箱。没有使用场景时不为“功能多”加常驻服务。

建议新增模块：`backends/`、`stream/`、`health/`、`trace/`、`vault/`，现有 `session.mjs` 负责会话与控制权编排，不把所有逻辑继续堆入一个文件。继续使用 DSH 设计 token；失败说明在侧栏或对话展示，不覆盖用户制作的页面。

## 四、验收题与指标

以下是待执行的验收设计，不是已有分数。

| 任务 | 必须观察到的结果 |
| --- | --- |
| 家电面板开关、滑块、中文命名 | 真实页面状态/持久化回执；按钮事件发出不算完成 |
| 页面滚动、拖拽、动态动画 | 测动作到可见回执的 p50/p95、错帧拒绝、带宽与 CPU；区分动画导致的截图差异 |
| 用户接管期间 Agent 持续请求写操作 | 所有写操作拒绝，观察继续；网络重连不能夺回控制权 |
| 主页面 + Worker + iframe 环境测量 | 保存各表面结果、发现矛盾、未测不通过；不要求先有漂亮分数 |
| 双会话同一网址、同一 cwd | 页面、标签、登录、代理和流订阅隔离；切走 preset 立即停止访问 |
| 浏览器崩溃、插件重载、过期锁 | 无迟到写回、能区分恢复/数据损坏/仍占用，不能丢状态后显示正常 |
| 断网/代理认证失败/内核不匹配 | 保留用户当前页面或返回清楚的受限状态，不静默降级和改变身份 |
| 导出失败包 | 能复现控制序列，密码、令牌、Cookie、正文和截图秘密检查有结果 |

和 ZCode 做比较时固定题目、模型、视口、网络条件、浏览器构建、超时与人工介入规则；公开完整任务数、成功/失败/未完成、耗时分布和成本。只有真正跑完同条件对照后才谈“超越”。

## 五、源码锚点与读取限制

快照 JSON 中每个 `sourceFiles.url` 都指向固定 commit。优先复核这些路径：

- Camoufox：`typescript/src/coherence.ts`、`typescript/src/browser-pin.ts`、`browser/patches/fingerprint-injection.patch`、`typescript/README.md`。
- Donut：`src-tauri/src/fingerprint_consistency.rs`、`src-tauri/src/profile/encryption.rs`、`src-tauri/src/browser_version_manager.rs`。
- Steel：`api/src/plugins/browser-socket/page-screencast.ts`、`handlers/cast.handler.ts`、`api/src/services/cdp/instrumentation/browser-interaction-sanitize.ts`。
- agent-browser：`cli/src/native/diff.rs`、`cli/src/native/webmcp.rs`、`cli/src/native/stream/websocket.rs`。
- CloakBrowser：`js/src/download.ts`、`js/src/license.ts`、`js/src/human/mouse.ts`、`BINARY-LICENSE.md`；Manager 另查 `LICENSE`、`backend/runtime.py`、`backend/vnc_manager.py`。
- Anti-Mage：`internal/scan/sec_scopes.go`、`sec_webrtc.go`、`band.go`；Neko：`server/internal/api/room/control.go`、`server/internal/capture/screencast.go`。
- Persona：`engine/persona/engines.py`、`probe.py`、`crypto.py`；Shard：`runtime.json`、`sdks/node/src/runtime.ts`；rebrowser：`patches/playwright-core/1.64.1/src.patch`。

fingerprint-chromium 的旧版 tag 源码尚未拉取验证；追加请求遇到本机代理连接失败，因此只记录 README 明示的延迟公布政策和已读主分支目录，不给其可重建性下结论。所有上游网站“通过检测”的分数、本机 Windows 上其他内核的表现、加密实现的完整密码学审计和托管套餐内容均未完成实测。

**后续更新（2026-11-01）：** 上段保留最初调查时的状态；随后已成功读取 fingerprint-chromium 的 `148.0.7778.215` 历史 tag、构建配方与选定补丁，固定提交和边界见[指纹浏览器专项](fingerprint-browser-research-2026-11-01.md)。未执行重建，也未据此认定当前最新二进制的全部补丁已经公开。
