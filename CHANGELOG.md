# 更新日志

记录面向使用者的变化、升级动作和影响使用的限制。收录与写作规则见[更新日志指南](docs/changelog-guide.md)。

## 1.0.0（2026-11-04 · 覆盖发布）

- 设置页支持无会话只读预览：新增 `GET /api/plugins/patchwork-coding-agent/settings`，只返回当前 `DSH_HOME` 的配置快照（`config` / `loadedConfig` / `revision`），不返回任何会话状态。未连接 Patchwork 会话时，设置页可查看配置并标为只读；保存仍然走会话鉴权的 config 路由，连接后才会启用。
- 新增“检查更新”：设置页手动触发 `POST /api/plugins/patchwork-coding-agent/update-check`，只读查询 GitHub `releases/latest`，比较 SemVer 并显示当前版本/最新版本/Release 链接。不自动检查、不发送凭据或会话状态；非 GitHub 来源或网络失败时只报告原因。

## 1.0.2（2026-11-04，仅 tag）

- 修复 Windows 8.3 短路径（如 `RUNNER~1`）导致 Superagent 审阅把工作区内产物误判为越界的问题；工作区与产物路径统一改用 `realpathSync.native` 解析，并继续归一化扩展长度路径和大小写。

## 1.0.1（2026-11-04，仅 tag）

- 修复 Windows 扩展长度路径（`\\?\...`）导致 Superagent 审阅把工作区内产物误判为越界的问题；CI 上该路径会返回扩展形式，现在比较前统一归一化。

## 1.0.0 初始内容（已被覆盖发布取代）

以下为相对 v0.2.0 基线提交 `ef19dc7` 的累积变更。这是首个稳定版发布；包版本为 `1.0.0`。

### 安全修复

- 公开检索每一跳（含 robots）在连接前检查地址与主机范围，直连和代理 CONNECT 固定到已批准 IP，保留 Host/SNI/TLS 校验；修复十六进制 IPv4-mapped IPv6 私网误判，禁止传输层自行跟随未经批准的跳转。
- 可选 EPR 在候选筛选和模型发送边界统一拒绝 password、cookie、Authorization、嵌套 token 和私钥正文，敏感输出保留原文路径，不再送入约简请求。默认仍关闭。

- 记忆工具返回可供模型使用的记录 ID 和按需召回正文，列表只返回最多 5 条元数据；卸载取消排队写入。输出 schema 使用宿主支持的 nullable 联合，避免工具注册失败。

- 可选浏览器组件安装器的 ZIP 读取依赖 `yauzl` 升至 `3.2.1`，修复畸形 NTFS 扩展时间戳可能触发越界异常的问题（GHSA-gmq8-994r-jv83）。

### 修复

- 修复在 DSH 0.2.1 及更新宿主上安装后所有 Agent preset 被禁用的问题。`@deepseek-ai/dsh-agent-preset` 与 `@deepseek-ai/dsh-home-paths` 不再作为发布包依赖被提升到 profile 根，而是声明为兼容范围 peer，由目标 DSH 的 base/web bundle 提供宿主同版本；本地测试用 devDependencies 固定 0.2.1-rc.5。此前精确依赖 `@deepseek-ai/dsh-agent-preset@0.2.0-rc.2` 会让 `dsh-app-boot` 的版本门禁禁用包括 `patchwork` 在内的全部 preset 行，导致技能、任务、记忆等工具整体不可见。升级方式：重新打包并用 `dsh plugin --profile <name> add <new-tarball>` 覆盖安装；若 profile 曾手动固定旧版 `@deepseek-ai/dsh-agent-preset`，需同步移除或升级到与宿主一致。
- 设置页保存条不再使用底部 sticky 定位，窄栏和宽栏下都不会遮挡最后的配置项、提示与运行记录详情。
- 工作台不再同时用下拉和快捷按钮重复表达同一状态；记忆状态、日志级别改为单一筛选入口，降低窄栏筛选区高度。
- `patchwork_task` 的 `check` 现在返回有界命令输出（最多 4000 字符并带截断标记），模型无需为了查看输出再单独运行 shell；工具描述同步要求直接使用该输出，避免产物和验收被误标 stale。
- 重开会话或页面后，持久化的主控队列会从原生记录惰性恢复并显示在主控视图；此前只有模型再次调用 inspect 才创建控制器。
- 记忆页在默认“本会话私有”范围为空时提示项目共享记录存在，并提供“查看项目共享”入口；`patchwork_memory inspect` 对项目共享记录返回 `MEMORY_PROJECT_SCOPE_REQUIRED`，不再只报 `MEMORY_NOT_FOUND`。
- 只读 Superagent 执行器在简单总结/读取任务中不再被要求登记 `patchwork_task` 和语义验收，减少无意义的 task/check 步骤；需要产物或行为验收的任务仍按原验收顺序执行。
- `patchwork_improvement list` 返回最近来源回执元数据，`incident` 可直接使用其中的 id；候选缺少 trigger/hypothesis/changeScope 时返回具体缺失字段。
- `obs_recall` 新增可选 `maxBytes`，可在 1..15360 字节内请求更小的精确页面；机制计数的维护提示拆分为结构/证据数量，避免汇总值与说明不一致。
- 代码检索审查修复：`search`/`references` 默认扫描全部已索引文件（此前默认前 40 个会漏掉后面的调用者），并用 Bloom token 预筛降低扫描量；`affected` 支持相对 import 与 `tsconfig.json`/`jsconfig.json` 的 `paths` 别名；`callers`/`callees`/`impact` 返回 `targets`/`ambiguous`，同名符号不再被静默合并。
- 项目文档审查修复：`read`/`status` 拒绝或标记 symlink，写入前校验最近已存在父目录的 realpath 必须留在工作区；`apply` 通过 `.patchwork/locks/` 文件锁串行化，并发创建只有一个成功；`patchwork_project_docs` 不再依赖 `codeEnabled`，关闭代码检索时仍可用。

### 变更

- **依赖与宿主基线直接迁移到 DSH 0.2.1-rc.5**：开发依赖、peer 最低版本、`@deepseek-ai/cordis` 与 schemastery 统一升级；随包 profile 模板改用 `dsh-base` / `dsh-web-app@0.2.1-rc.5`；preset fixture 重命名为 `tests/fixtures/dsh-v0.2.1-rc.5.standard.patch.yml`，生成器不再引用 rc.2 源码 commit。`dsh-web-app@0.2.1-rc.5` 的 standard 工具行与旧 fixture 内容一致，因此 preset 工具行未变；真实组合 harness 补充 `session-projections` 和 `working-directory`，以匹配 rc.5 工具对投影与工作目录服务的依赖。历史日期文档、实验和检查记录保留当时的版本与结论。
- 工作台重组为 **总览 / 执行 / 证据 / 管理 / 诊断 / 设置** 六个一级页面，每个重领域最多两个二级视图：执行（任务、主控）、证据（工具、检索）、管理（记忆、改进）、诊断（能力、日志）。一级和二级标签显示待处理数量；没有队列、检索或改进数据时隐藏对应二级视图，记忆在关闭或空数据时保留查看入口。宽屏下主控、日志和记忆使用列表/详情布局，机制与设置使用双列网格。
- 任务、主控、技能加载、引用对比、配置保存、结构检查以及 UI 端记忆/改进操作统一写入诊断日志；新增任务、主控、技能、引用、设置、结构检查机制和对应事件文案，日志支持最近 15 分钟 / 1 小时 / 4 小时范围筛选。日志仍只保存白名单元数据，不记录提示词、命令原文或凭据。
- GitHub Actions 扩充：`Validate` 增加 pnpm 缓存、依赖审计和真模型审计证据校验；新增 `CodeQL` 静态分析、PR `Dependency review`、每周 `Security audit`，以及标签/手动触发的 `Package`（只上传两个 `.tgz`，不发布 npm、不创建 Release）。所有 Actions 固定到完整 commit SHA，不调用付费模型。
- 支持 DSH 多版本：主包与可选浏览器包声明 `engines.dsh: ">=0.2.1-rc.2 <0.3.0-0"`；新增单次/批处理工具执行适配，兼容 0.2.2-alpha.3 的 `tools.execute({ calls })`；preset 归一化移除被删除的 `list-agents` 子路径，并同时携带新旧子代理模型选择键。0.2.1-rc.2、0.2.1-rc.5 与 0.2.2-alpha.3 均通过 452 项测试；新增 `DSH compatibility` 工作流与 `scripts/set-dsh-version.mjs`，详见[多版本说明](docs/dsh-multi-version-2026-11-04.md)。

### 新增

- 执行页新增任务 handoff 恢复快照、最近 20 次纠正历史和带确认的任务取消；主控页新增等待输入执行器的补充输入框、队列对账恢复入口、补充输入次数和超时预算。
- 管理页新增记忆召回预览（只读、最多 5 条、可显式包含项目共享）和通用改进候选表单（rule / memory-policy / tool-flow / ui-copy 四类受限策略）；改进状态支持“已拒绝”筛选。
- 检索证据新增独立来源对比：选择两条已发送摘录和同一顶层 JSON 字段，结果只返回 supported / conflict / unknown。
- 诊断/能力新增机制执行计数、当前计划和本次运行归档句柄；计数明确标注为进程内执行事实，不代表 token、延迟或成本收益。
- 设置页新增恢复默认、JSON 导出、校验后 JSON 导入和枚举中文标签；导入只进入草稿，仍需显式保存。

- 新增只读本地代码检索 `patchwork_code`：`map` 生成有 token 预算的仓库地图，`outline` 读取单文件符号/导入，`find` 查定义，`references` 做词法引用，`search` 做字面量/词边界/正则检索。索引缓存放在 `DSH_HOME`，按 git HEAD 与文件 mtime 复用；跳过依赖、构建产物、二进制和敏感文件，路径必须留在当前工作区。模型真实调用已验证 map/find/references/search 链路；修复了搜索/引用结果含 `undefined` 导致宿主 “not lossless JSON” 的缺陷。
- 新增按需工作区代码图：`patchwork_code graph-status/graph-enable/graph-start/graph-stop/callers/callees/impact/affected`。配置写入 `<workspace>/.patchwork/config.json`，默认关闭，由模型显式启用并启动；未启用/未启动分别返回 `CODE_GRAPH_DISABLED` / `CODE_GRAPH_NOT_STARTED`。实现为 Patchwork 原生词法调用图，不依赖 CodeGraph 的平台包、MCP 服务、watcher 或遥测。
- `patchwork_task define` 支持可选 `brief`（goal、successCriteria、unknowns、assumptions、budget），随任务状态/压缩恢复保存，并在任务页显示；不改变授权，也不把 brief 当作验收。
- Superagent 新增 `explore` 只读任务模式：只允许读取/代码检索，不登记任务验收，要求返回 findings/deadEnds/confidence；主控继续以原生执行器隔离上下文。
- 诊断/能力新增本地代码检索计数和探索成本（read/grep/glob/code、重复查询、读入字节）；连续 8 次探索且无编辑时注入一次模型可见的软提示，不硬拦合法搜索。
- 新增真实模型审计 schema/报告生成器和离线校验器：`scripts/real-model-audit.mjs` 从 session dump 生成 manifest、events、tool-calls、result、report；`scripts/verify-real-model-audit.mjs` 校验哈希、状态与 `mainDshTouched:false`。2026-11-04 的旧会话证据已迁移到 `docs/checks/real-model/2026-11-04/`。
- 通过 `pnpm-workspace.yaml` overrides 将 `undici` 升到 8.12.2、`fast-uri` 升到 3.1.9、`zod` 升到 4.6.6，处理 Dependabot 报告的传递依赖告警；完整测试通过。
- 新增 `patchwork_project_docs`：受控读取/校验/创建/更新 `AGENTS.md` 与 `DESIGN.md`。更新必须匹配当前 sha256，只允许这两个文件名，路径限制在工作区，拒绝明显密钥和超大内容；不自动创建、不授予权限。诊断/能力页显示两文件状态，报告见[项目文档说明](docs/project-docs-2026-11-04.md)。
- 设置项增至 26 项，新增代码检索开关、索引文件上限与地图 token 预算；工作台“代码”分类可搜索、恢复默认、导入导出。
- 技能参考按需扩充：`web-ui` 增加 Flex/Grid 布局心智模型，`debugging` 增加 JS 异步排查，`collaborator` 增加需求澄清清单，`standards` 增加 Git 恢复与提交边界；正文仍只做路由，不常驻提示词。

- 重整仓库首页的安装路径、能力与边界说明，提供适配浅深色的横幅和双语导航；英文入口从 `README.en.md` 改为 `README_EN.md`，详细调研与验证记录继续由文档导航索引。

- 仓库统一维护 `main` 分支，补充固定依赖版本的 GitHub CI、贡献和安全反馈入口；旧技能静态预览移至 `docs/archive/skills-preview/`，原生 WebUI 入口仍为 `src/client`。调研和验证文档增加分类导航，本地研究快照及会话审计数据移出仓库备份，不进入版本控制。

- Superagent 执行器指令按 read/write 和父任务约束列出允许能力，与派发守卫共用定义；补充 `update_plan` 的 text 字段示例、任务与队列 revision 区分，以及“登记产物后直接 check，独立 shell 会使产物失效”的验收语义和恢复提示。针对真实调用误用，不扩大工具权限；社区提示词的取舍与复验见[优化记录](docs/superagent-prompt-optimization-2026-11-01.md)。

- 可选浏览器的人工输入改为有界、有序、去重的轻量通道，不再逐字符做 ARIA 观察和完整状态读取；普通点击、滚动不再终止画面流。显示优先采用已鉴权的一次性票据和二进制 WebSocket，保留 SSE／JPEG 回退，并按实际显示确认保留最新帧。
- 可选浏览器补齐拖拽、双击、横向滚动、输入法提交、显式复制、可取消导航，以及适应宽度／100%／150%和可退出的扩大视图；继续沿用 DSH 控件与主题 token。Agent 新增有界交互元素引用、限长 read、条件 wait、hover／scrollTo 和最多 8 步的表单 batch。

- 独立可选浏览器包复用 DSH 宿主控件，环境选择、提示和折叠使用宿主 Menu／Tooltip／DisclosureRow，设置使用 Input／Switch；插件界面圆角、字体、颜色与浮层阴影沿用 DSH token。移除系统原生下拉弹层与标题提示，修复元素选中后退出拾取的时序。
- 独立可选浏览器包的标注改为类似“检查元素”的交互：悬停高亮真实元素并显示标识、尺寸，点击选中后聚焦说明，不触发页面按钮。支持开放 Shadow DOM、过期请求丢弃和窄栏显示；iframe 内部及完整 DevTools 编辑功能尚未实现，使用边界见[可选包说明](packages/browser/README.md#页面标注与快捷操作)。
- 可选浏览器包改用两层浏览器框架：上层标签页，下层导航与胶囊地址栏。环境、资源和检查收进更多菜单，底栏保留控制权与录像状态；支持浅深色、窄侧栏和键盘菜单。改动仅属于独立可选包，验证范围见[浏览器界面记录](docs/browser-chrome-2026-11-01.md)。
- 浏览器拆分为独立可选 DSH 包 `@patchwork/browser`：运行时、独立侧栏、Playwright/指纹依赖和组件安装器均迁至 `packages/browser`。安装主包不会注册浏览器工具或入口；安装可选包后，任意模式可显式授权当前会话，切换模式或停用时撤权。原浏览器资源设置移出 Patchwork 设置页，组件命令改为 `patchwork-browser-components`；采用 DOM 观察与语义定位，继续使用现有画面流。迁移方式见[可选包说明](docs/browser-optional-package-2026-11-01.md)。

### 新增

- 按 10 个社区项目的源码与界面资源扩充[功能工作台](docs/ui-community-expansion-2026-11-01.md)：总览待处理入口、主控列表 / 依赖详情、真实技能目录、验收与工具筛选、检索来源 / 摘录 / 记录、记忆快捷筛选、改进策略对照、日志冻结与根调用过滤、23 项设置用途和保存差异。浅暗主题和侧栏继续沿用 DSH；未知指标不填假值，普通会话不暴露这些功能。
- 可选浏览器环境增加搜索、类型筛选与切换前差异；切换、清登录、删除、手动回收使用界面内确认，编辑绑定打开时版本。资源页显示实际采样、实例与保护原因，浏览器仍独立安装，主包不携带内核。

- 记忆页升级为[详细管理](docs/memory-management-2026-11-01.md)：搜索正文与条件、按范围/状态/有效性筛选、20 条分页、手动新增提案、修订确认、暂停/恢复、来源与版本历史、所选 JSON 导出和原子批量遗忘。修订确认前保留原版本；项目共享操作明确提示影响范围。遗忘撤销召回与旧引用，仍保留历史和磁盘备份。
- 记忆工具 `list` 新增状态筛选与分页，最多返回 5 条元数据；`inspect` 按明确 ID 读取单条。管理页按需读取正文，全局轮询不带正文或项目共享记录；新增 CAS、跨会话、旧修订复活防护与真实 UI 管理链验证。

- 接入 DSH 内部 Superagent 主控本体：`patchwork_superagent` 提供原生 Session 持久队列、依赖、读取并发、本模块工作区写任务串行、原生执行器、有界重试、纠正后下游失效和显式恢复；`/patchwork-superagent` 查看状态。继承宿主权限与 SoL，模型报告须经过最终真实验收；切换模式/卸载撤销所属执行器，不接外部消息源、Webhook 或投递服务。社区固定源码取舍、隔离验证与边界见[接入记录](docs/superagent-native-2026-11-01.md)。

- 早期融合 DSH Superagent 原型的交接与幂等输入机制：`patchwork_task handoff` 提供有界、只读的当前要求、纠正及证据指针；最近 128 个输入指纹随原生 Session 保存，减少冷启动后的重复失效。该阶段的[适配与验证](docs/superagent-fusion-2026-11-01.md)保持历史记录；当前主控和原生执行器另见本轮接入记录。

- Patchwork 搜索／抓取新增显式 `transport:browser`：需要本会话同时授权独立浏览器，复用私有 Chromium 的临时空登录上下文，保留 host／robots／公网地址与预算边界，不切换用户标签。浏览器仍是可选依赖，HTTP 默认不变；接入说明、社区取舍索引与验证边界见[浏览器接入记录](docs/browser-runtime-integration-2026-11-01.md)，此说明随主包分发。

- 独立浏览器可选包接入实验性 AliasMode 原生指纹：显式安装固定 Windows x64 内核，按会话保存身份、按进程重启切换，不叠加 JS 注入；新身份空登录，失败尝试恢复旧环境。真实 DSH 工具调用已验证换指纹、Canvas 变化、重启稳定性、Cookie／localStorage／IndexedDB 隔离与双会话互不干扰；自检补充 Client Hints 一致性。主包不携带内核，详见[原生指纹验收](packages/browser/docs/native-fingerprint-2026-11-01.md)。

- 复用现有指纹浏览器调研，追加通过 GitHub CLI 核对 18 个仓库的固定源码、发布资产和许可范围；收敛 AliasMode Chromium／Camoufox／Fury 原生内核试验顺序，补充进程级身份切换、生成器版本缺口与隔离验收要求。此项为[调研与实施取舍](docs/fingerprint-browser-research-2026-11-01.md#本次补查与指纹环境实施取舍)，不表示新增内核已安装或完整指纹已通过验证。

- 独立浏览器包把“指纹”提升为顶部入口，新增更换设备参数／完整指纹样本、独立新环境与空登录命名空间；样本主版本不匹配时禁止启用并保留原页面。设备参数已做真实切换验证，完整指纹注入兼容限制见[执行记录](packages/browser/docs/fingerprint-switching-2026-11-01.md)。

- 独立可选浏览器包新增页面点选／框选标注、说明与按需裁图、Space 临时交互、当前会话发送及失败重试；增加仅授权 Agent 可见的浏览器技能、精确 URL 复用、开关／下拉框语义操作与面板快捷键。不会随主包安装；ZCode 工具／技能取舍、后续体验路线与真实验证范围见[融合记录](packages/browser/docs/experience-design-2026-11-01.md)。

- 可选浏览器包提供组件下载/安装命令 `patchwork-browser-components`，支持便携 Chromium、采样录像编码器和 SDK 配对的 Camoufox：提供下载计划、进度、代理、离线安装、完整文件校验、显式替换、上一版本回退、卸载和缓存清理。仅操作明确指定的 `DSH_HOME`；大内核采用流式下载/解压，组件运行期间拒绝替换和卸载。历史[组件说明](docs/browser-components-2026-11-01.md)中的主包命令以[可选包迁移说明](docs/browser-optional-package-2026-11-01.md)为准。

- 浏览器侧栏增加资源管理：查看本会话内存采样与匿名实例汇总、手动回收内核/恢复网址、显式允许本会话自动回收；默认同一 Node 宿主最多运行 2 个浏览器，自动回收关闭，接管/查看/录像/排队操作/传输受保护。Windows Chromium 按需采样私有驻留，15 秒缓存，512 MiB 仅为软目标。配置保存后重载，跨进程预算与其他平台采样尚未实现，详见[使用与验证](docs/browser-resource-management-2026-11-01.md)。
- 增加 `check:release` 包内容预检和[分发方案](docs/browser-distribution-2026-11-01.md)：默认小插件复用系统内核，可选组件独立安装；portable Chromium 现已接入统一安装器，二进制不进入插件包。

- 浏览器“检查与记录”新增本地环境自检、鉴权实时画面流及 JPEG 回退、脱敏 trace、带尺寸/代次/哈希的截图回执、可选动作后验、无进展提醒、标签休眠与显式恢复、工作区文件上传及单次下载授权。可选采样 WebM 录像使用独立安装的 ffmpeg，最高 4 帧/秒且会跳过忙碌时段；运行时不下载依赖，也不操作宿主浏览器。使用方法与本轮验证范围见[执行记录](docs/browser-gap-execution-2026-11-01.md)。
- 增加可选 Camoufox 后端适配与独立安装脚本，隔离固定的 SDK/Playwright 依赖，启动前检查文件完整性；未安装时明确提示，不静默切换内核。Windows x64 真实内核已验证基本浏览，其他平台兼容性与站点反检测结果仍未验证，不计为默认支持的反检测能力。

- 补充[开源指纹浏览器专项调研](docs/fingerprint-browser-research-2026-11-01.md)：核对 15 个仓库、一个历史源码 tag 和 58 份源码/构建/许可文件，区分管理器、SDK、内核补丁与发布二进制；新增 Fury、AliasMode、Camoufox Profile Manager 等取舍，补取 fingerprint-chromium 历史源码，并记录源码推导的未知项误判和 Canvas 累积修改风险。本条仅交付调研与融合建议，未安装新内核或更改运行行为。
- 补充 [ZCode 浏览器专项调研](docs/zcode-browser-research-2026-11-01.md)与 25 份固定 commit 源码/文档的证据清单：梳理真实 webview/CDP 控制链、命令所有权与共享登录分区；续查纠正 32 个逻辑标签超限走完整关闭，并给出后台冻结、保留标签壳后完整回收与按需恢复的分层方案。隔离原型确认现有回收可释放内核且不关闭另一会话，但网址恢复会丢失未提交表单与 JS 内存；当前 Edge 的 CDP 冻结回执成功而定时器仍推进，故冻结能力未通过。本条交付调研、方案与原型证据，未实装新生产机制或运行 ZCode 产品对照。
- 新增浏览器社区再调研与固定 commit 的 GitHub 证据清单：核对 26 个项目、15 个主分支目录树、33 份源码/许可文件，提出实时流、环境一致性自检、动作后验、加密档案与可选内核的采用顺序；区分开源包装器、单独授权的二进制和未复现的上游评分，本条不表示新增后端已实装。
- 可选浏览器包提供与 `patchwork_browser` 共用的独立侧栏工作台：支持最多 8 个标签、导航、点击、滚动、键入、前后退和视口适配，提供“文”输入栏支持中文/IME 文字发送；用户操作自动暂停 Agent 写操作，只有用户可恢复。操作在服务端串行，带标签和画面代次的输入在导航、视口或标签变化后拒绝执行；不连接宿主浏览器，逐请求验证实际 Agent 与 preset。
- 浏览器增加会话私有环境档案：语言、时区、屏幕、像素比、外观、HTTP(S)/SOCKS5 代理及显式开启的 Cookie / localStorage / IndexedDB 保存；代理凭据只引用环境变量，模型仅见脱敏摘要。新增设备模板与实验性完整指纹的兼容校验；本机 Edge 156 暂无匹配样本，完整注入明确拒绝，设备模板保持真实 UA。限制与验收见[升级记录](docs/browser-workspace-upgrade-2026-11-01.md)。
- 可选浏览器包提供原生 `patchwork_browser`：按授权 Agent 独立启动 Playwright Core 无痕浏览器，支持导航、快照、交互、视口、刷新及图像截图；任意有效模式均须用户显式授权当前会话，工作区内的本地 HTML 可直接打开。默认复用系统 Edge/Chrome，也可显式安装便携内核。
- 新增离线家居控制台 Web UI 评测题与 StepFun 隔离运行产物，覆盖设备开关、亮度／档位、离家模式、刷新持久化和响应式布局；独立浏览器交互通过，Agent 最终运行超时，成绩不记为完整交付。
- 任务工具 `patchwork_task` 和状态命令 `/patchwork-task`：记录阶段、要求、纠正版本、覆盖集合与产物绝对路径，逐项绑定真实宿主验收回执。
- 任务状态随原生 Session 保存，支持冷启动恢复及完整会话 ZIP 导出；恢复损坏时显式阻塞，分支不继承原任务的通过状态。
- 侧栏日志页支持级别/机制筛选、搜索、详情和最近 200 条诊断元数据的 JSON 导出；支持的宿主保存到原生 Session，旧宿主明确回退到有界内存。
- 任务内可登记候选经验，并用 `scripts/check-evolution.mjs` 检查实验档案的对照、覆盖、成本和回退信息；候选不会自动成为跨会话规则。
- 新增 `patchwork_search` 原生无密钥多 provider 搜索工具：在 Patchwork Agent 内并行查询 Bing、Brave Search 和 DuckDuckGo 公共 HTML 页面，返回有界、去重的标题/URL/snippet，并报告部分 provider 失败；支持代理环境、provider 列表、超时和结果数配置，外部内容标记为不可信数据。
- 新增独立 `patchwork_fetch` 原生受控抓取工具：只接受公开 HTTP(S) 地址，执行 host allowlist、DNS/SSRF、robots.txt、有限重定向复核、响应字节和文本长度限制，返回有界 HTML/纯文本摘录；抓取结果写入当前会话检索账本为 `sent`，失败写入机器可读失败码，页面内容保持 `external-untrusted`。
- 新增显式 `patchwork_memory` 管理工具和“记忆”页：记录先进入 `proposed`，会话私有与项目共享分命名空间，确认/忘记要求当前 Patchwork Agent、用户确认和 revision CAS；读取按需发生，自动注入保持关闭，删除递增 namespace epoch 并留下 tombstone 防止迟到写入复活。
- 补充信息检索社区项目评估：核查 SearXNG、SearchWala、Websurfx、Hister、vgrep、lilbee、LibreX、searxng-mcp 和 YaCy 的 provider 隔离、健康状态、共识排序、引用、索引 scope 与许可证，并把可迁移机制和排除项写入[信息检索调研](docs/information-retrieval-research-2026-10-31.md)。
- 补充信息获取社区项目评估：核查 Crawl4AI、Firecrawl、Browser Use、Stagehand、Open Deep Research、dzhng/deep-research、MarkItDown 和 ScrapeGraphAI 的抓取、浏览器、深研编排、转换和安全边界，并记录 `discover → fetch → extract → admit` 链路。
- 新增[信息获取执行方案](docs/information-retrieval-execution-plan-2026-10-31.md)：将社区项目调研收敛为 `provider health → evidence ledger → 受控抓取 → 有限研究 → 隔离评测` 的分阶段交付，并明确 UI、日志、安全和真实 DSH 验收门。
- 新增[未完成方案执行路线图](docs/remaining-plans-execution-roadmap-2026-10-31.md)：明确长期记忆、自进化、检索、日志、UI/UX 和 SoL 后续工作的真实状态、依赖关系、退出条件与暂不做事项。
- 检索诊断纳入白名单日志机制：`patchwork_search` 现在返回 provider family、健康状态、结果数和查询指纹，并报告 `healthy`、`zero_result`、`parser_drift`、`blocked` 与 `transport_error`；`patchwork_fetch` 记录抓取边界、失败码和耗时；日志面板可按“检索”或“抓取”筛选，仍不记录查询原文、URL 正文或网页全文。
- 受控改进从真实失败、浏览器后验和任务纠正建立来源链，拒绝伪造回执或模型自填成绩；内置 runner 隔离运行受限 typed policy 的 baseline/candidate/留出契约，绑定版本与文件 SHA256。用户确认后仅本会话实际应用交付提醒、召回上限、字段交叉核对或审查详情策略，支持真正回滚；切换 Agent 撤销。契约实验不证明模型质量提升，项目全局应用未开放。
- 新增 [Patchwork Contract Benchmark](benchmarks/patchwork/README.md)：参考 Terminal-Bench 的 task/test/oracle 形态，提供 8 道公开演示、4 道隐藏回归和 4 道安全负测；每题使用独立临时 `DSH_HOME`，机器验收覆盖 scope、任务纠正、检索、记忆、日志、改进、机制和 WebUI，并提供 [外部基准调研](docs/benchmark-research-2026-10-31.md)。
- 新增 [Patchwork Coding Task Benchmark](benchmarks/coding/README.md)：提供 8 道代码维护题和公开/隐藏验收；题集质量报告记录 8/8（100%）oracle 通过，并明确不把题集质量当作 Agent 完成率。真实 Agent 营销数据需另附模型、DSH 版本、隔离工作区、隐藏测试输出和 run id。
- coding runner 增加 `--output`、`--run-id`、`--keep` 和 `--driver`；真实 DSH driver 可在每题独立工作区中运行 Agent，runner 会以隐藏测试和 `allowedPaths` 共同评分；未提供 driver 时明确拒绝执行，避免伪造 Agent 成绩。
- Patchwork 技能目录新增 `debugging`、`code-review`、`retrieval`、`documentation`、`memory` 和 `improvement` 六个按需技能及条件参考；默认保留七技能 `core`，`skillsMode: expanded` 可显式试用十三技能，`skillsEnabled: false` 可关闭技能注册。隔离检索复测出现超时和未核实结果，因此扩展目录尚未默认采用；真实效果边界见[融合执行记录](docs/skills-fusion-execution-2026-10-31.md)。

### 调整

- 录像旧安装入口转接统一安装器；Camoufox 可直接下载固定官方发行，不再要求手工寻找内核。侧栏环境增加便携 Chromium 选项；安装不自动切换会话内核或扩展 Agent 的操作权限。

- 历史 `scripts/publish.mjs` / 新 `pack:local` 默认只制作本地 tgz；安装改为必须显式指定 `--install --profile NAME` 和目标 `DSH_HOME`，不再默认写入主 `web` profile。Playwright 与指纹依赖改为按需加载；不同内核切换前需先关闭现有浏览器。

- 地球探索评测页移除左上角和底部难读的操作提示，放大标题，并修正地球和城市标记的投影；原始模型产物与人工修订版分开保存，修订结果不计入 DSH 技能成绩。
- 项目开源协议由 MIT 改为 GNU AGPL v3.0（`AGPL-3.0-only`），发行包附完整许可证；同步包元数据、项目页面和文档声明，此前版本已授予的许可不被撤回。
- Agent 在交付前检查使用文档与更新日志，用户可见变化同轮维护；不适用时说明具体理由。既有技能同时补充任务理解、非代码验收、事实保真和候选评估流程。
- `web-ui` 技能按小改动、新页面/改版和既有产品分流；补充按需资料路由、五类分层审查与颜色决策参考，要求核对语义色、浅深色、实际色对和状态，再看真实渲染。保留动效决策、边界数据和截图复核，设计理由留在会话而非页面；路由和作用域已验证，视觉收益仍待模型 A/B 与用户盲评。采用取舍见[统一调研](docs/human-centered-ai-ui-research-2026-10-31.md)。
- 针对家居控制台的“AI 模板味”反馈，`web-ui` 增加按需去模板味复核，优先检查内容组织、重复状态表达和截图中的空白；Patchwork Agent 的 UI 工作现在自动获得技能正文提示。隔离 DSH 探针验证提示进入该 Agent 的请求表面，未挂载 Patchwork 的控制会话无提示、无该技能；这不是模型视觉品质提升的 A/B 结果。
- 技能注册现向宿主声明按需参考资料目录；`web-ui` 增加设计证据契约和状态/尺寸/任务验证矩阵。补查 OpenDesign 与两份用户提供的本地设计资料，记录其可用机制和不可靠的绝对规则；`architecture`、`collaborator` 移除可能诱导过度拆分或假二选一的硬规则。见[七技能审计](docs/skill-reliability-audit-2026-10-31.md)。
- [全技能调研与融合方案](docs/skills-fusion-plan-2026-10-31.md)进入实施：纠正七技能中的假二选一、宽泛触发、固定重试和无条件工具调用；一次性只读任务无需登记，未登记任务仍禁止结构化写入。新增技能补充按需参考、相邻反例与停止条件；13 技能路由样本、原生隔离检查与真实 DSH 试运行分别记录，不把一次模型调用当作质量提升证明。
- Patchwork 的 DSH 原生侧栏采用总览、主控、机制、证据、日志和设置六页导航，浏览器由可选包注册独立入口。界面使用宿主设置卡片的底色、细描边、圆角与原生分段页签，跟随浅深色主题。当前任务与验收合并为一张卡，工具记录单独展示；没有候选时隐藏空的改进卡片。设置覆盖 23 项可写配置并复用前后端校验，明确 DSH_HOME 部署范围；主控提供版本绑定的人工接纳、退回、重试和队列操作，语义接纳不冒充机器通过。浏览器资源策略由可选包管理；技术细节默认折叠，证据保留本次、检索、记忆、改进分类及完整产物路径。重新构建并重新加载插件后可见。
- 日志改为扁平记录列表与下方详情，保留组合筛选、完整诊断元数据导出和可展开技术字段。面板使用 Ionicons 5 Outline 图标，随 DSH 浅深色外观切换并适配窄侧栏；发行包保留图标的 MIT 许可声明。
- 完成提醒依据当前任务的登记验收，不再接受无关 shell 成功作为依据；新输入使旧证据保守失效，已登记任务的结构化写入须先重述契约。
- 长工具结果归档后提供首尾摘录；本地 Node spec 失败日志可保留完整失败段，不额外调用模型。未知格式仍需单独验证。

### 修复

- 记忆读改写置于跨进程 owner lease 内，按命名空间显式限额，取消/切换后拒绝迟到写入；损坏与权限失败停止写入并保留原文件、原子有效备份。孤儿锁与恢复锁可恢复，不抢活跃进程；记忆页补齐丢弃、来源和恢复反馈。
- 检索操作 ID 和原始时间恢复后保持稳定；实际摘录通过敏感检测并输出后才能引用，精确引文与字段交叉比较可追溯，冲突/未知不会保留 verified。普通语义事实仍需人工判断。
- 编码评测拒绝失败、缺身份或无请求证据的驱动成绩；隐藏测试在可信驱动结束后的独立裁判副本执行，真实 Buffer diff 覆盖等长修改、删除和二进制哈希。哈希只能核对受信驱动记录一致性，不独立证明模型调用。
- 增加显式隔离 UI/浏览器验收入口、默认缺陷负测、源码指纹和文档链接门；九处移出仓库的历史产物/私人审计引用改为公开归档摘要。完整范围和复跑见[24 项闭环指南](docs/closure-2026-11-01.md)。

- 修复 Windows 工作区与临时目录位于不同盘符时，结构提示将工作区外文件误判为项目文件的问题；第三方文件不再触发本项目的拆分或命名建议。

- 任务交接依据原生有效消息历史去重，避免步骤尚未提交或上下文压缩后因内存缓存而遗漏要求；有界交接不再被 ObservationPack 替换成观测句柄。OCC 在边界与压缩后复核任务版本，取消、纠正、切换模式及销毁会撤销旧续跑，切换模式和新输入同时取消正在进行的维护请求。
- 修复真实模型续作中 `patchwork_task correct` 省略标题／阶段时的隐式必填与模糊报错：已有任务继承未改的标题、阶段及实例约束，仍要求当前 revision；明确传入的非法字段继续拒绝，纠正不会提升阶段或移除实例约束。

- 可选内核运行目录压平并处理 Windows 长路径；取消安装会停止本次安装器的下载子进程并释放锁。修复 ZIP 链接条目读取卡住，以及静态页面因跳过首帧而迟迟没有实时画面的问题。

- 随包 profile 模板引用从过期的插件 `0.1.2` 对齐当前 `0.2.0`，宿主依赖对齐核对过的 `0.2.1-rc.2`。本轮变更尚未发布，试装使用本地 tgz，在线模板不代表可获取本轮代码。

- 浏览器档案修改语言时保留硬件身份，设备身份 revision 与环境配置分离；缺失或不支持的测量不再算作自检通过。截图会拒绝尺寸或页面代次不一致的结果，PNG 导出不再携带 JPEG 编码参数。
- 修正实时帧切换期间点击被 Blob URL 校验静默丢弃的问题；同一会话多个查看端共用抓帧，关闭一个不打断其他端。下载最终失败时不提交文件，标签恢复失败保留后续队列；录像上限不再依赖浏览器空闲，缺失依赖不显示为已安装。

- 写入后接续命令的非零退出、超时或缺失退出码不再被当作成功验收；写入期间任务变化时，保留写入回执并跳过接续命令。
- 纠正、产物变化、过期异步结果及覆盖不足不能复用为当前通过状态；工具省略 coverage 时使用 `all`，拒绝空集合和错误的产物关联。
- 原生上下文压缩修正边界、并发、重入、无操作及取消时的计量与结算，避免重复或错误处理压缩请求。
- 撤回初版共享 Playwright MCP 接入：真实双会话探针发现 Patchwork 会话之间会串页面；改为每 Agent 独立浏览器后复测 `firstSeesSecond: false`，切走或释放 Agent 时关闭浏览器。

### 安全

- 登录快照改为 AES-256-GCM，AAD 绑定会话与档案；Windows 使用 DPAPI 包装密钥，其他系统需显式提供私有存储密钥。旧明文只在成功加密后删除，加密失败禁止明文回退。档案增加跨进程独占租约、存活 owner 检查及死亡 owner 恢复；键盘输入增加焦点令牌并禁止调用系统剪贴板快捷键。浏览器不再沿用 Playwright 默认的明文密码库与关闭 sandbox 参数。

- 专属工具、技能、评审命令与机制仅在选择 Patchwork Agent 后装载；切走后撤销注册并拒绝保留的旧工具引用，其他会话不获得这些能力。
- 非 Patchwork 会话的面板只显示锁定说明，停止状态轮询并卸载证据与草稿；能力判断不再依赖可伪造的 header、cwd 或显示名。
- 离开 Patchwork 会话时取消仍在等待的配置保存请求，防止旧请求结果回填已卸载面板；服务端继续在写入前重验授权，取消请求不承诺回滚已经提交的配置。
- 接入 DSH 原生页签可见状态，后台保留的会话侧栏和隐藏页签停止请求，并卸载证据与未保存草稿，避免切换后仍在后台轮询。
- 已知结构化写入在派发前复核工作区、只读参考对象、声明阶段和任务版本，并解析 symlink/junction；普通 shell 不提供相同的强制路径边界。

### 升级注意

- 需迁移自定义浏览器面板：键盘请求增加 `focusId`，实时流使用带 `x-patchwork-token` 的 Fetch SSE；token 不放入 URL。新 `expected` 后验、`capabilities`、`health`、`trace`、回执和安装状态已同步到工具输出。启用跨平台登录保存或可选录像前按[执行记录](docs/browser-gap-execution-2026-11-01.md)配置对应的私有依赖；备份旧档案时也须安全保管密钥，DPAPI 文件不可视作可跨 OS 用户移植的明文密钥。

- 部署默认值移到 preset 的 `patchwork-runtime` 行；profile 根 `patchwork-agent` 行只负责 Web 桥接，请勿在根部重复挂载 `@patchwork/coding-agent/runtime`。面板保存的覆盖仍位于 `DSH_HOME/patchwork/config.json`，供后续 runtime 加载。使用前在新会话 Agent 选择器选择 Patchwork。
- `patchwork_task` 操作字段均在顶层，修改使用最新 `baseRevision`；`check.id` 对应验收项，`artifact.id` 对应要求中的 targets。
- 依赖基线主要为 DSH 0.2.0-rc.2，真实宿主验证使用隔离的官方 0.2.1-rc.2；整体依赖迁移尚未完成。
- `patchwork_browser` 增加标签与环境摘要；侧栏画面响应增加 `x-patchwork-frame-id`、`x-patchwork-tab-id` 和 `x-patchwork-viewport`。直接接入侧栏接口的调用方发送像素/键盘操作时须带对应标签和画面凭据。切换环境会关闭当前标签；登录保存默认关闭，启用后使用加密快照，旧明文在成功加密后移除；崩溃或撤权时不承诺保存未提交状态。

### 已知边界

- 本轮浏览器升级的全仓回归、独立真实浏览器和 DSH 原生探针通过，窄栏组件补测通过；完整 DSH 侧栏长流程仍未通过验收。Camoufox 仅验证独立 SDK 安装/导入，未运行其内核；详细状态与脱敏证据见[执行记录](docs/browser-gap-execution-2026-11-01.md)。
- `ready` 仅表示已登记检查通过，不证明要求集合完整或语义全部正确；最终回答尚无硬拦截，普通 shell 与 strict 策略均不提供 OS 强沙箱。
- 诊断元数据不复制提示词、完整命令或工具原文，但这不代表宿主历史、任务标题/路径和归档证据已全面脱敏。分享完整 ZIP 前仍需检查内容，原文证据不自动删除。
- 尚无受控性能对照，不能据此宣称 token、延迟或自进化收益。

实现、验证环境及失败记录见[融合执行报告](docs/upgrade/2026-10-30-integration.md)与[SoL 实验报告](docs/experiments/2026-10-30-solpi/report.md)；日志保留策略见[日志文档](docs/logging.md)。
