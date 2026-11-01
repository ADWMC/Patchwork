# 浏览器缺口补齐执行记录

日期：2026-11-01。授权范围：把浏览器社区、ZCode、开源指纹浏览器调研中属于 Patchwork 的缺口落到实现；主 DSH、宿主浏览器和其他会话保持隔离。上游缺陷通过不采用有问题的实现、增加回归门处理，不擅自修改第三方仓库或宣称替上游修复。

## 执行清单

| 项目 | 验收目标 | 状态 |
| --- | --- | --- |
| 身份与实测 | 缺失比较为 unknown；语言修改不重生成硬件；版本与身份分离 | 已实现；本地自检真实通过，扩大检测面仍有边界 |
| 登录加密 | 登录快照加密、AAD 绑定档案、密钥不进入浏览器进程或模型、旧明文受控迁移 | 已实现；Windows DPAPI 加密落盘、关闭后恢复真实通过 |
| 档案租约 | 同档案独占写、撤权释放、死亡 owner 可恢复、版本冲突拒绝 | 已实现并有回归；不抢活 owner，PID 复用时保守拒绝 |
| 后端与能力 | 真实能力表、独立引擎配置、版本追溯、不支持项可见 | Chromium 已验证；Camoufox 独立 SDK 安装和导入通过，真实内核未运行 |
| 观察与证据 | 截图尺寸/代次校验、动作后验、重复失败提示、脱敏任务 trace | 已实现并有真实页面验证 |
| 画面传输 | 可见时实时流、背压、隐藏停止、断线回退，不改变设备档案视口 | Chromium CDP 与鉴权 HTTP SSE 真实通过；多个查看端共用抓帧，Firefox 用 JPEG |
| 输入与标签 | 焦点校验、会话私有粘贴、标签生命周期与安全恢复 | 焦点、接管、休眠/恢复与异常 context 恢复真实通过 |
| 交付 | 可选录像、工作区文件交付、失败清理，不把 job 状态等同于可用文件 | 上传/单次下载/截图/trace/WebM 真实通过；失败下载在最终提交前拒绝 |
| UI 与说明 | DSH token、操作入口与受限原因、更新日志、技能按需说明 | 真实侧栏有交互与主题证据；320/380 像素组件补测通过；完整原生侧栏脚本未通过 |
| 验证 | 回归、真实独立浏览器、隔离 DSH、双会话与撤权负测 | 全仓 264 项回归通过；独立真实浏览器 11 组通过；隔离 DSH 原生探针通过 |

Browser plugin/对应 browser skill 未列于本次可用技能，按 frontend-testing-debugging 的 Playwright 分支执行，并遵守用户既有“宿主浏览器还要用”的约束。验证流程：隔离侧栏入口 → 环境与自检操作 → 状态和画面回执；保留截图、DOM、控制台与真实交互证据。

不能由本地实现补出的事实：第三方闭源内核的完整补丁、缺失的再分发授权、公开二进制的可复现构建证明，以及匿名性或任意网站检测保证。这些作为后端接入门，未满足时明确不支持，不能填写已通过。

## 新接口与操作

Agent 工具增加 `capabilities`、`health`、`trace`；`expected` 可指定 `urlIncludes` 或 `selector` 对应的 `text` / `visible`。回执中的 `completed` 指调用结束，`postcondition: unasserted` 不代表任务通过。截图附 CSS 视口尺寸、文档代次、标签、时间与 SHA256；图片编码尺寸不一致时拒绝交付。trace 最多 200 条，只存时间、动作种类、控制者、匿名标签、结果、耗时和无进展标志，不存 URL、选择器、键入内容、请求头或页面正文。汇总以 `browser` 机制写入现有会话诊断日志。

侧栏“检查与记录”控制自检、截图与 trace 文件导出、录像、工作区文件传输和标签休眠。用户端 `focusId` 只对当前页面焦点有效；键入前还检查远端 activeElement，导航/切标签/视口变化使令牌失效。禁止 Ctrl/Meta+C/X/V 与 Insert 等系统剪贴板组合；粘贴事件仅把用户明确提供的文本发送到当前会话页面，不读取后台 OS 剪贴板。

实时流使用带 `x-patchwork-token` 请求头的 Fetch SSE，不用 URL token。服务端立即 ack CDP 帧，每会话最多 8 个查看端共用一条 CDP 抓帧源，关闭其中一个不会打断其他端；每个连接仅保留最新帧，受输出背压与 150ms 发送间隔限制；每次发送重验 Agent 和 client。隐藏页面取消订阅，断线或 Firefox 退回鉴权 JPEG。流不自动加入模型上下文。标签恢复只在本进程内保留有界 URL，用户显式触发后重新导航；失败和未尝试的 URL 保留，可重试且不重复已成功项；不自动重放表单，不把它称作断电后完整恢复。

上传只接受实际工作区文件和 file input 选择器，上限 50 MiB。下载必须在面板授权下一次（60 秒），其余取消；交付文件限制 50 MiB，并写入 `.patchwork/browser-artifacts/<session-hash>/`。截图、trace、录像也进入此命名空间，返回字节数与 SHA256，拒绝空文件、越界目录和输出目录符号链接。下载授权与产物均不共享给其他会话。

## 可选依赖：显式安装、独立目录

以下命令在 **PowerShell** 使用。先设置目标隔离环境的 `DSH_HOME`；不要为了测试更改主 DSH。安装器不在模型工具中暴露，也不在运行时自动执行。

```powershell
$env:DSH_HOME='E:\\isolated-patchwork-home'
node scripts/setup-browser-recorder.mjs
```

录像安装器通过当前固定 Playwright 1.64.1 的官方安装命令只下载 ffmpeg 与其平台工具，缓存限于 `DSH_HOME/patchwork/browser/backends/recorder/`，记录来源、build 和可执行文件 hash。启动前再验 hash；未安装时面板明确提示。先打开页面再开启录像，采样当前选中标签，最高 4 帧/秒；忙碌/背压跳帧，因此不是完整实时录屏或动作时间线。独立计时器在忙碌或没有活动页面时也执行 15 分钟上限，WebM 交付上限 256 MiB。停止后检查编码器退出码、帧数、文件大小及 WebM 容器头再交付；失败或撤权清理临时文件。录像内容可能包含秘密，默认关闭，主动导出到工作区后的文件由用户管理。

Camoufox 当前上游 SDK 与本插件默认驱动存在协议代差，独立依赖树固定已发布的 `camoufox@0.5.8` 与 `playwright-core@1.62.0`，不修改插件/宿主 1.64.1。源码快照 package.json 的 0.5.7 在 npm 中实际不存在，安装审查发现后改用已核实的 0.5.8，并固定 npm SHA512 integrity 与安装 lock hash；没有把源码版本号直接当作可安装版本。适配器调用官方 SDK 的 `Camoufox({from_options})`，Browser 对象保持在自己的驱动，不把它连接到 1.64 的 Juggler；不叠加 Apify Chromium 指纹。只支持原生/设备模式。

```powershell
node scripts/setup-browser-backend.mjs --backend camoufox --executable 'E:\\verified-camoufox\\camoufox.exe' --sha256 '<已核实的64位小写SHA256>' --source '<该二进制的来源>'
```

这是有意保留的显式安装门：脚本不替用户下载任意第三方内核，不把 GitHub SDK 的开源许可推定为二进制再分发许可。安装时固定 SDK、生成独立 lockfile、记录 executable hash；启动验版本与 hash，未知配置拒绝。暂不提供自动升级；替换前保留原目录作为回退，重新以新目录安装并复核。当前完整依赖/DLL 的供应链证明不等于单个 executable 的 hash，适配代码可用也不代表 Camoufox 本机端到端已经通过。

## 已知边界

- 本地 probe 覆盖配置、同源 iframe、普通 Worker、收到的 HTTP UA/语言、Canvas 重复读取/PNG blob 一致性和主线程 OffscreenCanvas；跨域 iframe、Worker OffscreenCanvas、WebRTC/DNS、外网出口和 TLS 仍未验证。缺失或 unsupported 始终可见，不算通过。
- 保留真实 UA 的设备模式不伪装 UAData。完整 Chromium 样本仍需主版本匹配；未提供可信样本就拒绝，不能以删除校验“补齐”。
- 暂无原生 DOM 文本选择、拖放、下载到任意路径、跨重启标签/表单恢复、自动过验证码或匿名性保证。Firefox 实时 CDP 流不适用，诚实使用截图回退。
- 强接管即时阻止后续写检查点；已经进入浏览器进程的单个 Playwright 操作无法原子回滚，不关闭用户正在接管的页面来伪造取消。观察、流、临时文件、日志和旧引用继续受真实 Agent 授权约束。
- AES/DPAPI 是磁盘防护，不是对同 OS 用户任意进程的强隔离。非 Windows 密钥管理与跨平台内核运行需目标平台验证；PID 复用时租约宁可拒绝，不猜测 owner 已死。

## 验证记录与复核方式

[脱敏验收清单](checks/browser-gap-validation-2026-11-01.json)分开记录回归测试、真实浏览器、DSH 原生探针、界面验收和可选 SDK；每份原始证据记录文件名、字节数与 SHA256。清单不包含访问 token、Cookie、模型密钥、页面正文或本机个人目录。不把未测项目计入通过数。

- `npm test`：264 项通过，失败、取消和跳过均为 0。
- 真实独立 Edge `156.0.4314.58`：11 组通过，覆盖动作后验、本地身份自检、CDP 实时画面、焦点与接管、上传和单次下载、脱敏 trace 与截图、标签生命周期、有效 WebM、Windows DPAPI 登录恢复、双会话与撤权、鉴权 HTTP SSE。
- 真实隔离 DSH 原生探针：两个 Patchwork Agent 均获得工具，标准 Agent 无工具；面板操作与 Agent 观察同一页面，两个会话不串页；关闭 A 后 B 仍可用；390×844 调整和图片附件有效，工作区 HTML 可打开，工作区外文件拒绝。探针没有发出模型请求，不能将这些结果宣传成模型任务成功率。
- Camoufox：实际安装并导入 `camoufox@0.5.8` 和独立 `playwright-core@1.62.0`，核对 peer、Node 要求和 npm integrity；没有下载或启动 Camoufox 内核，不能将 SDK 导入写成内核通过。
- 界面验收单独记录；实际侧栏曾暴露实时帧切换时点击被 Blob URL 比较丢弃，现改用已加载帧的标签/代次凭据，仍保留服务端校验。完整回归状态以清单的 `userInterface` 为准。
- 窄栏补测使用真实 `BrowserPanel`、`PANEL_CSS` 和鉴权浏览器后端，在组件测试壳中运行；320/380 像素 × 浅色/深色四种组合均无横向溢出，表单控件保持在容器内，未捕获的前端异常为 0。此壳使用明确的测试 token 值；DSH 原生主题切换另由真实侧栏验证，不能把组件壳称为完整 DSH 验收。
- **完整原生侧栏脚本未通过。** 较早的实际侧栏运行已观察到实时画面、家电开关点击、中文输入、用户接管、自检、截图交付、上传失败提示、宿主主题切换、环境保存、标签休眠恢复与隐藏停流；脚本在收尾阶段因测试定位器失败，此后重跑又被隔离 DSH 的启动连接和测试会话列表可见性阻断。未将部分运行与组件补测拼成一次完整原生通过。此前固定 Blob URL 的点击缺陷已在真实侧栏复核点击与文字输入成功；连续动作仍须等待新画面，过期凭据继续拒绝。
- 发布检查：客户端构建与源码一致（157269 字节）；10 份文档的 151 处本地链接有效；`npm pack --dry-run --json` 的 248 个文件包含本轮 16 项必需模块、安装器、构建及验收文件；未发布新版本。

仓库内可复核命令（PowerShell）：

```powershell
npm test
node scripts/build-client.mjs --check
git diff --check
npm pack --dry-run --json
```

原生 DSH 探针必须指定一个独立的 `DSH_HOME`，只加载本仓库 overlay，不能复用主 DSH：

```powershell
$env:DSH_HOME='E:\isolated-patchwork-validation'
dsh headless --patch ./cordis.patch.yml --patch ./presets/patchwork.patch.yml --patch ./docs/experiments/2026-11-01-browser/probe.overlay.yml
```

本轮临时 UI 脚本、截图和独立依赖保存在仓库外的研究工作区，不混入发行包。测试实例只监听 loopback，测试后只停止对应的自建进程；主 DSH、用户浏览器、全局代理及主配置不作修改。运行期能力、说明与未发布更新日志一起维护，历史调研保留原始时间点并链接本记录。
