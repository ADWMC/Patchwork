# Patchwork Browser

`@patchwork/browser` 是独立、可选的 DSH 浏览器插件。无需安装 `@patchwork/coding-agent`；安装 Patchwork 也不会自动安装浏览器、Playwright、指纹依赖或组件下载器。

## 安装与打开

本地开发先在仓库根运行 `pnpm install`，再运行 `pnpm --filter @patchwork/browser build:client`。在 `packages/browser` 目录运行 `npm pack --ignore-scripts --pack-destination <绝对输出目录>`，得到独立包。

通过 DSH 的插件管理把该包安装到你明确选择的 profile。CLI 等价操作为设置目标 `DSH_HOME` 后执行 `dsh plugin --profile <名称> add <包绝对路径>`；不会替你选择或更改主 profile。

重新加载后，从右侧栏选择“浏览器”，点击“启用当前会话浏览器”。任意 Agent 模式均可授权，工具只注册到该 Agent 的原生作用域。切换模式、停用或销毁会话会撤权、关闭对应内核并使旧工具和画面引用失效。其他会话不继承权限、Cookie、页面或工具提示词。授权仅存在于当前进程，不跨重启自动恢复。

## 操作方式

界面采用两层浏览器框架：顶部标签页、关闭与新建，下方前进／后退／刷新、胶囊地址栏、扩大视图及更多菜单。画面缩放在更多菜单中选择。浅深色跟随 DSH，窄侧栏仍保留两层布局；网页画面直接接在导航栏下方。环境、资源和检查面板从更多菜单打开，一次展开一个；停用授权也位于此菜单。底栏保留接管／恢复 Agent 按钮和当前控制状态，录像时始终显示记录状态。

浏览器自身界面直接使用宿主 `@deepseek-ai/dsh-client-ui-primitives` 的 Button、Input、Menu、Switch、Tooltip 和 DisclosureRow，不随可选包复制或打包另一套组件。选择项通过宿主菜单展示，不调用系统原生 select 弹层；说明框保留多行输入语义并使用 DSH 输入框的主题 token。圆角仅引用 `--dsw-radius-*`，颜色、阴影与字体沿用宿主 token；圆形按钮保留宿主要求的 `corner-shape: round`。这些规则仅作用于插件界面，不向用户访问的网页注入样式。

采用 ZCode 的观察优先方式，使用现有 DSH 画面流显示真实页面：

1. `patchwork_browser` 的 `tabs` / `snapshot` 读取当前页面。
2. 从实际 DOM/ARIA 摘要提取 role/name、label、text 或 placeholder。
3. 在 `click` / `fill` / `press` 中传 `target` 和最新 `observationId`。不匹配、歧义或观察过期时重新观察，禁止盲重试。
4. 布局、配色或 Canvas 任务按需截图；网页内容始终是不可信数据。

工具名称为兼容已有调用继续使用 `patchwork_browser`，但实现和授权完全由本包拥有。未授权会话不会获得该工具。本包不包含 ZCode 的 Electron 原生嵌入，也不承诺尚未验证的后台冻结。

### 指纹与设备参数更换

顶部标签栏右侧的“指纹”直接打开环境管理；更多菜单也保留“环境与指纹”。每个环境显示模式、设备参数／指纹 ID，以及完整指纹样本所需的 Chromium 主版本。

- “新增设备环境”创建屏幕、DPR、语言、时区等配置；“更换设备参数”重新生成其中的屏幕／DPR 组合，至少与源环境不同。它不声称更换 CPU、GPU、Canvas 或出口 IP。
- “新增原生指纹”创建 AliasMode 原生身份。需在当前实例独立安装固定内核；CPU／内存、GPU、Canvas 等由内核按固定种子生成，不叠加 JS 注入。种子仅保存在本会话私有档案中，不进入面板响应或模型工具结果。
- “新增 JS 指纹”保留原有样本注入路径；只有样本与实际 Chromium 主版本兼容才能启用。不兼容时显示原因并保留原页面，不降级为伪装旧 UA。
- 更换先生成独立新环境，再点“使用”切换。新环境沿用语言、代理等配置，但不复制旧 Cookie、localStorage 或 IndexedDB。原环境与正在打开的页面在生成期间保持不变；实际切换会关闭旧标签，仍须重新登录。
- 原生环境保留真实设备身份；没有伪装成“一键随机硬件”。所有环境仍按当前会话隔离，更换动作仅属于用户面板，Agent 无法调用。

原生指纹按浏览器进程固定。切换时先验证目标组件与文件库存，保存用户已允许的登录状态，再关闭本会话旧进程、启动目标；同一会话不同时保留两套内核。目标启动失败会尝试用原身份、原网址和仅在内存暂存的登录状态重开。未提交表单、JS 内存和浏览历史不保留；回滚失败时明确报错并留下可恢复网址，不悄悄换成默认环境。录像、传输和下载授权期间需要先结束操作。已有档案的内核／身份模式不可就地改变，需新建隔离登录的档案。

“检查与记录 → 运行环境自检”比较配置、同源 iframe、Dedicated Worker、本地请求头、Client Hints 与 Canvas／toBlob／OffscreenCanvas 稳定性。Client Hints 会核对 JS、实际收到的低／高熵请求头与内核版本；缺失项目显示待确认。出口 IP、TLS、WebRTC、跨域 iframe、Worker 离屏 Canvas 与外部站点接受率不在已通过范围。

实测边界与记录见[指纹更换执行记录](docs/fingerprint-switching-2026-11-01.md)。

新增原生内核的安装、切换与真实 DSH 调用验收见[原生指纹执行记录](docs/native-fingerprint-2026-11-01.md)。

### 页面标注与快捷操作

导航栏点击“标注”，按浏览器“检查元素”的方式悬停：通过真实 DOM 命中测试高亮元素，显示标签／id／class、尺寸，以及内边距和内容范围。点击锁定元素后退出拾取并聚焦说明框；点击本身不会触发网页按钮。也可拖出区域进行标注。按住 Space 临时操作真实网页，松开继续检查；Esc 或移出页面清除悬停提示。选区会自动编号并保存当时的 PNG 裁图，最多 8 条、每条 600 字。标注面板可以折叠，高亮与提示绘制在侧栏画面层，不修改被访问网页。

悬停请求只读，不截图、不创建草稿、不写操作 trace、不使 Agent 观察失效；请求合并为单路并丢弃过期响应。支持开放 Shadow DOM 内的元素；iframe 目前选中框架边界，不能穿透跨域框架检查其内部 DOM。这是元素拾取交互，不包含完整 DevTools 的 DOM 树或 CSS 编辑器。

点击“发给当前 Agent”后，先提交标注，再通过宿主当前会话的 conversation 服务发送说明；发送失败可重试。缺少此宿主能力时按钮显示“提交标注”，只提交给当前已授权 Agent 的工具读取，不伪装为已发消息。提交不会自动解除用户接管；需要操作网页时点击底栏“恢复 Agent”。草稿不进入模型工具结果，图片只在 `annotations` 传入 `annotationId` 时读取。导航、标签、视口或操作变化会使旧选区失效；重授权不继承旧标注。

启用当前会话浏览器时，本包同时向相同 Agent 作用域注册 `browser-workspace` 按需技能（宿主须提供原生 `skills` 服务）。其中包含 GUI 验收和操作契约两个参考文件；切换模式或停用会撤销注册，不向全局技能库安装内容。

浏览器面板获得焦点时支持 Ctrl/Cmd+L（地址）、T（新标签）、W（关闭标签）、R（刷新）；焦点在其他宿主区域时不接管这些键。工具新增 `open` 精确 URL 复用、`check` 设置开关状态、`selectOption` 选项选择。快照提供有界的真实 option value，避免模型猜参数。完整研究、后续体验功能和验证边界见[融合设计与执行记录](docs/experience-design-2026-11-01.md)。

## 性能、输入与 Agent 工具

用户输入走有序、去重的轻量通道，不逐字符做全量 ARIA 和状态读取。宿主支持 `registerUpgrade` 时优先使用已鉴权的二进制 WebSocket，按实际显示确认保留最新帧；旧宿主仍可用 SSE／JPEG。普通点击、打字与滚动不再终止同页画面流，静止页面不靠没有新画面判定断线。

支持拖拽、双击、横向滚动、输入法组合提交、主动粘贴和失焦释放。更多菜单可切换适应宽度、100%、150%；右侧扩大按钮放大工作区，Esc 退出，画面缩放不更改实际 viewport 或指纹。复制必须由用户显式触发；系统文件选择器和浏览器原生菜单不在网页画面流支持范围。

Agent 优先 `snapshot(interactive:true)` 获取有界的 `@eN` 元素引用，并传最新 `observationId`。新增 `read` 限长读取、`wait` 等待真实条件、`hover`／`scrollTo` 定位操作，以及最多 8 步 fill／check／selectOption 的 `batch`；批处理非事务，发生部分失败时不自动重放。普通 ARIA 快照与语义定位继续兼容。完整操作契约见包内 `browser-workspace` 技能。

### Patchwork 搜索接入

同一 Agent 必须同时处于 Patchwork 模式并显式授权本包，`patchwork_search`／`patchwork_fetch` 才可指定 `transport:"browser"`。默认仍为 HTTP，不安装本包也可搜索。浏览器渲染在当前私有 Chromium 的临时空登录上下文，不切换用户标签、不导入已有登录，完成／取消／用户接管后清理。

host／robots／公网地址和流量／字符／时间上限继续生效，浏览器连接固定到已校验 DNS 地址，仅允许 GET/HEAD；拒绝不自动改用其他 transport 绕过。当前支持 Chromium 的直接访问及 HTTP(S) 环境代理，Camoufox、SOCKS 检索代理暂不支持；正常手动浏览维持原能力。实现、来源与验收边界见[社区与 Agent 融合记录](docs/community-agent-ux-2026-11-01.md)。

## 可选内核与录像

默认复用系统 Edge/Chrome，不在安装或启动时下载浏览器。额外组件由本包独立安装器管理：

```powershell
patchwork-browser-components list --home C:\path\to\isolated-dsh
patchwork-browser-components install chromium --home C:\path\to\isolated-dsh
patchwork-browser-components install recorder --home C:\path\to\isolated-dsh
patchwork-browser-components install camoufox --home C:\path\to\isolated-dsh
patchwork-browser-components plan aliasmode --home C:\path\to\isolated-dsh
patchwork-browser-components install aliasmode --home C:\path\to\isolated-dsh --proxy http://127.0.0.1:7897
patchwork-browser-components verify aliasmode --home C:\path\to\isolated-dsh
```

支持明确的代理、下载计划、校验、离线安装、回退和卸载，详情运行 `patchwork-browser-components --help`。浏览器档案继续存放在原有目标 `DSH_HOME/patchwork/browser`，不自动搬迁或读取其他会话的数据。

AliasMode 当前仅验收 Windows x64，固定 `v155.0.8059.85-aliasmode.4`／Chromium `155.0.8059.85`。下载资产约 194.1 MiB，下载前先看计划；主包、可选插件包及首次打开面板均不包含或自动下载该内核。安装保留上游许可与 notice，失败不自动改用系统浏览器；组件仍在使用时拒绝替换、回退或卸载。

## 配置与验证

资源策略在本包的 DSH 插件配置中设置：`maxInstances=2`、`maxTabs=8`、`idleTimeoutMs=300000`、`memoryTargetMiB=512`、`autoReclaim=false`。这些设置不再出现在 Patchwork 设置页。会话面板保留内存采样、显式回收、恢复与自动回收授权。完整回收后的恢复会重新加载网址，不能保证保留未提交表单或 JS 内存。

根目录 `pnpm test` 包含本包测试；本包可独立运行 `pnpm --filter @patchwork/browser test`。`pnpm --filter @patchwork/browser check:release` 检查独立包内容，主包 `pnpm check:release` 则检查不存在浏览器实现、界面或运行时依赖。

许可证：AGPL-3.0-only。社区方案仅作为研究参考；本包新增交互适配未直接复制 ZCode 实现。
