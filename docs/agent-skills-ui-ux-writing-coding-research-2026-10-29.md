# UI、UX、文档与编码 Agent Skills 调研

> 实施索引（2026-10-30）：采用项、实际接线、隔离宿主验证与剩余边界见[统一融合执行方案](upgrade/2026-10-30-integration.md)。本文保留研究或历史审计的原始范围，不把建议与历史数字改写成当前能力。

- 调研日期：2026-10-29（Asia/Shanghai）。
- 研究问题：哪些技能、文档、研究与工程经验有助于 AI 写好界面、交互、更新日志、README 和代码；哪些结论有实际证据支持。
- 方法：结合内置网页搜索、GitHub CLI 仓库与代码搜索，核对维护者文档、实现入口、具体问题单和公开研究。
- 访问方式：本地 GitHub CLI 与 HTTP 请求使用现有 `127.0.0.1:7897` 代理，只设置本次命令的环境变量。
- 边界：研究资料与提出设计建议；没有安装所查技能，没有执行其脚本，也没有在项目上运行效果对照实验。
- 关联阅读：[AI 自进化与 Harness 调研](ai-self-evolution-research-2026-10-29.md)。
- 后续补充：[去 AI 垃圾：技能、工程经验与研究证据](anti-slop-skills-research-2026-10-29.md)（2026-10-30 整理，15 个仓库、7 项研究与具体社区问题记录）。

## 1. 评价标准

### 1.1 结论与阅读顺序

建议优先研究 **宿主风格一致性、真实交互验证、仓库事实驱动的写作、可核对的变更说明**，再考虑大规模技能库。更长的提示词、更多技能和更高触发率，都不能单独证明产物更好。

建议组合：

- **已有产品 UI**：interface-design 的设计约束记录 + Impeccable 的局部审查与交互补齐。
- **新视觉方向**：Anthropic frontend-design；需要设计素材检索时再使用 UI UX Pro Max。
- **UX 与质量**：Vercel 界面规范审查 + web-quality-skills 的浏览器证据与人工检查边界。
- **README 与技术文档**：crafting-effective-readmes + doc-coauthoring；表达润色参考 Clarity，内容分层参考 Diátaxis。
- **更新日志**：changelog-generator 只负责候选草稿；版本范围、破坏性变化及发布流程另行核实。
- **代码习惯**：按项目实际约束选用 Addy Osmani 的工程技能与 Vercel 的框架规则，用工具落实能确定检查的规范。

这是对公开机制的采用建议，尚未在 Patchwork 做效果对照。

### 1.2 评价方式

不按 star 数、技能数量或宣传截图决定是否采用。每个候选分别检查：

1. **范围**：解决视觉、交互、性能、写作还是发布流程中的哪一个问题。
2. **机制**：纯提示词、参考资料检索、脚本、工具调用、确定性检查，还是经过训练的能力。
3. **输入**：是否需要宿主设计系统、读者画像、仓库事实、变更差异或运行环境。
4. **输出**：是否形成可审查的产物，能否对应到具体文件与验收条件。
5. **证据**：维护者声明、源码实现、用户报告、独立评测与本地实测分别标注。
6. **代价**：上下文、执行时间、维护成本、适用范围与潜在退化。

## 2. UI 与 UX 技能

### 2.1 候选与机制

| 项目/技能 | 核查到的机制 | 适合的任务 | 需要补足或注意 |
|---|---|---|---|
| Anthropic `frontend-design` | 明确受众与视觉方向，规划色彩、字体和布局，再构建与自评。[S1] | 新页面、明确授权的视觉重塑。 | 要把既有产品规范作为输入；“有特色”不能成为任意改动宿主风格的理由。 |
| `pbakaus/impeccable` | 当前所查版本有技能入口、命令参考和二进制工具；区分任务操作、阅读、营销等界面目标，并提供 critique、audit、harden、onboard 等路径。[S2] | 局部审查、信息层级、错误与空状态、上线前打磨。 | 不只是静态提示词；使用前须确认运行依赖、版本及输出范围。检测结果也可能误报。 |
| `nextlevelbuilder/ui-ux-pro-max-skill` | 所查 Python 入口对 CSV 资料做 BM25 检索，再聚合产品、配色、字体等推荐；规则来自本地资料。[S3] | 寻找设计方向、检索特定设计问题与技术栈资料。 | 不能将其“推理”表述理解为训练出新的设计模型；推荐值仍需对照当前产品。 |
| `Dammyjay93/interface-design` | 先读现有应用、tokens、组件模式与已有设计记录，再实施和检查一致性。[S4] | 仪表盘、管理后台、编辑器、产品内嵌页面。 | 设计记录是约束载体，不能脱离当前代码和渲染结果独立当作真相。 |
| Vercel `web-design-guidelines` | 技能入口从另一个仓库读取界面规则，检查目标文件并输出定位到行的发现。[S5] | 界面代码审查与无障碍问题初筛。 | 它是动态规则入口；锁定技能 commit 不等于锁定远程规则。静态审查不能覆盖完整操作。 |
| Addy Osmani `web-quality-skills` | 将源码检查与浏览器、性能及可访问性证据结合，说明静态检查和综合分数的边界。[S6] | 运行中的页面质量检查。 | 技术检查通过仍不等于目标用户能顺利完成任务，部分检查需要人工参与。 |

**UI UX Pro Max 的源码核查点**：`core.py` 包含 BM25 排序与 CSV 读取；`design_system.py` 的生成器读取 `ui-reasoning.csv`，组织多领域查询。技能说明还区分新系统方向、局部问题与已知技术栈，并对已有 MASTER 文件的持久化覆盖设置限制。这里确认的是资料检索和规则聚合路径，没有执行脚本或验证推荐质量。[S3]

**Impeccable 的关键价值**：所查技能明确将操作型界面的扫描效率、一致性与熟悉模式放在表达性前面；营销页面则有不同目标。因此不能把“更大胆、更有辨识度”的设计策略机械套到设置页和控制台上。[S2]

### 2.2 用于宿主插件界面时，应先收集什么

以下是设计建议，不是本轮对 DSH 源码或现有 UI 的审查结论：

1. 宿主的页面入口、布局容器、导航模式和组件使用方式。
2. 语义 tokens：文本、背景、边框、焦点、危险、成功，以及字体、间距、圆角和层级。
3. 主题来源与切换方式：继承宿主状态，检查浅色、暗色及系统主题相关行为。
4. 数据和操作契约：读取、保存、运行、停止、重试分别由什么真实接口支持。
5. 当前页面的真实截图、组件状态和窄窗口表现。
6. 用户的核心任务、完成标准、错误后恢复路径。

优先复用已有组件与语义 token，再补缺失部分。不要在每个页面复制一套颜色表，也不要仅根据一张成功状态截图决定方案。

### 2.3 UI 与 UX 分开验收

| 维度 | 建议检查 | 建议保留的证据 |
|---|---|---|
| 视觉一致性 | 字体、间距、组件密度、层级、主题继承。 | 同一状态下的宿主/插件对照截图。 |
| 任务可完成性 | 主操作是否明确，保存与执行是否真的生效。 | 操作轨迹、接口结果及最终状态。 |
| 状态覆盖 | 加载、无数据、部分失败、超时、重试、未保存变化。 | 状态清单与对应测试或截图。 |
| 无障碍 | 控件名称、键盘路径、焦点、可感知的反馈。 | 语义树、自动检查和人工操作结果。 |
| 适配与性能 | 窄窗口、长内容、缩放、慢响应、布局偏移。 | 实际视口与运行条件。 |

这些建议综合了界面审查与浏览器质量技能的关注范围。[S2][S5][S6] 外观偏好由设计 brief 决定；核心任务是否完成则需要操作证据。

## 3. README、技术文档与表达

### 3.1 候选资料

| 资料 | 值得借鉴的内容 | 边界 |
|---|---|---|
| Softaworks `crafting-effective-readmes` | 按创建、补充、更新、审查区分任务；按开源、内部、个人、配置仓库区分读者；更新时对照实际项目文件。[S7] | 模板负责组织信息，不能替代运行命令或核实功能。 |
| Anthropic `doc-coauthoring` | 先收集上下文，再组织与改写，最后用没有作者背景知识的读者视角检查理解障碍。[S8] | 完整协作流程对小文档可能太重，应按任务规模调整；读者模拟也不等于目标用户验证。 |
| Addy Osmani `clarity` | 先确定文章对谁有用、依据何在，再改结构和措辞；保留事实、归属、限制与作者表达。[S9] | 消除空话不能靠编造经历、数字或确定语气，也不应追求 AI 检测器分数。 |
| Diátaxis | 区分教程、操作指南、参考和解释，按读者需求组织内容。[S10] | 是信息架构方法，不是自动生成器；无需把每份 README 都扩成四套长文。 |

### 3.2 README 应维护的事实

建议把 README 当作可核对的产品入口：

- 一句话说清解决的问题、适用对象和边界。
- 快速开始对应实际包名、版本要求、安装方式和现有命令。
- 最小使用路径给出预期结果，让读者知道何时算成功。
- 核心能力区分已实现、实验性和计划中，指标附运行条件。
- 配置说明对应真实配置项、默认值和生效方式。
- 故障排查给出可观察现象与下一步，不用泛泛的“重新安装试试”。

这是基于读者任务和仓库事实核验的建议。[S7][S8] 本轮没有执行当前仓库的安装或 README 示例命令。

**建议采用两次审查**：第一次核实事实、命令和链接；第二次检查读者能否找到答案。仅润色句子可能把错误说明写得更可信。

### 3.3 文档与经验如何存放

建议 README 保持入口角色；长篇原理放解释文档，配置全集放参考，具体任务放操作指南。架构决策记录保存当时的约束、可选方案和取舍，不必把临时调试过程全部提升为长期规则。[S10][S12]

对于中文与英文版本，建议共享事实清单与命令来源，分别组织自然表达；不要只检查标题是否一一对应而忽略默认值或功能状态漂移。

## 4. 更新日志与发布说明

2026-10-30 补充：大型项目的收录、豁免与审查规则见[官方资料专项调研](changelog-research-2026-10-30.md)，当前执行规则见[更新日志指南](changelog-guide.md)。下文保留原调研范围，不能作为后续实现已经完成的证明。

### 4.1 草稿生成、版本数据与发布流程是不同层

| 层次 | 参考 | 核查结果 |
|---|---|---|
| 用户语言草稿 | Composio `changelog-generator` | 所查目录只有 `SKILL.md`；指导读取提交、分类、转写为用户语言并复核。[S11] |
| 每次变更的发布信息 | Changesets | 当前官方 FAQ 用 Markdown 摘要与包名、版本变更类型记录变更；建议说明改了什么、为何改变、用户如何调整。[S13] |
| 从约定提交维护发布 PR | Release Please | 从 Conventional Commits 等版本信息生成更新日志与发布 PR，并在约定合并流程中推进发布。[S14] |
| 面向人的变更记录原则 | Keep a Changelog | 强调可读的变更记录，不应直接把 Git 日志当作更新日志。[S15] |

源码中一个实际维护问题：Changesets 的旧 `docs/adding-a-changeset.md` 已明确提示过时并指向新站点。因此本节同时查了当前 FAQ，未把旧路径当作最新使用指南。[S13]

### 4.2 推荐的日志生成流程

以下是对现有技能的补强建议：

1. **固定范围**：明确基准 tag/commit、目标版本和是否包含未发布变化。
2. **核对事实**：结合 diff、PR 说明、测试与产物，不能只按提交标题猜测。
3. **合并用户变化**：多个实现提交可能对应一条用户变化；同一改动的修复和回退不能重复宣传。
4. **分层表达**：写清用户能做什么、旧行为如何变化、是否需要迁移；内部重构按读者需要单列。
5. **核查边界**：破坏性变化、弃用、删除、已知问题与未验证项目应单独检查。
6. **复核版本与日期**：未发布内容留在相应草稿区域，不能因文案生成就宣告已发布。

每一条值得保留“用户变化 → 差异/PR/测试”的追溯关系。性能数字只能引用已有测量；技能示例里的数字不能直接进入自己的发布说明。

**技能能做的**：提炼、组织、发现遗漏、起草迁移说明。**另需保证的**：版本选择、事实真实性、发布状态与发布工具权限。本轮没有创建发布、版本 tag、变更集或发布 PR。

## 5. 编码技能与代码习惯

### 5.1 已核查的工程技能

- **Addy Osmani agent-skills**：检查了代码审查、源码/文档驱动实现、文档与 ADR 等技能，以及其评测说明和运行器。其做法包括区分问题严重程度、检查测试是否覆盖行为、先识别技术版本，再查相关依据。[S12]
- **Vercel react-best-practices**：规则按影响组织，优先处理请求串行和包体积等问题，再看渲染和细节优化。它包含 React/Next 特定规则，不能不看框架版本就全部套用到其他宿主。[S5]
- **Google 工程代码审查规范**：从设计、功能、复杂度、测试、命名、注释和文档等方面检查变更，并区分必要修正与个人风格意见。[S16]

这些资料提供程序与规则；是否改善本项目的正确性、可维护性和开发成本，仍需实际任务比较。

### 5.2 将“代码习惯”分成三种

| 类型 | 示例 | 建议落实方式 |
|---|---|---|
| 确定性规范 | 格式、导入规则、类型检查、禁止依赖、接口 schema。 | 交给项目现有 formatter、lint、类型检查和测试；技能负责找到并运行正确命令。 |
| 需要推理的习惯 | 根因定位、边界条件、依赖方向、错误恢复、异步状态一致性。 | 用短技能解释判断顺序，配具体案例和行为验收。 |
| 风格与偏好 | 命名倾向、目录安排、拆分尺度、注释语言。 | 优先遵循项目约定，把未强制的偏好标为建议，不无限上升为通用禁令。 |

这是对上述资料的工程化归纳。[S5][S12][S16] 不建议用任意函数行数限制或“必须抽象三层”等规则代替可读性判断。

### 5.3 比较值得沉淀的习惯

1. 先读目标模块、调用点和相关测试，找到当前契约与约定。
2. 将用户要求转换成可观察行为；修复时让验证覆盖原来失败的路径。
3. 选择能完整解决问题的有限修改，避免把功能修复和大规模风格重排混在一起。
4. 测试判断行为而非重复实现；检查错误、取消、重试、部分成功等相关路径。
5. 外部 API 与框架写法按实际版本核查，不能用另一个版本的“最佳实践”覆盖现状。
6. 交付说明写出已验证内容和剩余边界；行为、配置或使用方式变化时同步相应文档。

以上作为拟采用的习惯清单，来源是工程审查和技能方法的综合，不代表这些动作在本轮已经对生产代码执行。[S12][S16]

## 6. 研究证据、社区问题与适用边界

### 6.1 三项研究：结果依赖任务、模型和注入方式

| 研究及本次核查版本 | 作者报告 | 对采用技能的启示 |
|---|---|---|
| **SkillsBench v4**，2026-06-14 修订。[P1] | 87 个任务、8 个领域、18 组模型/harness 配置；精选技能的平均通过率从 33.9% 到 50.5%，增加 16.6 个百分点。较聚焦的技能组优于很大的资料集合。 | 有针对性的过程知识可能有效；这是该基准的结果，不能等同于本项目收益。 |
| **Signal or Noise? v1**，2026-08-24 提交。[P2] | 31 个 WebDev 技能、50 个项目和 1,000 个顺序任务；在其四模型实验中，目标技能注入降低平均 Pass@2 并增加 token 成本，部分组合有正收益。研究使用等长度无关对照和内容消融。 | 技能应按具体模型、项目和任务选择；不能把强制注入实验泛化为所有按需加载方式。 |
| **Evaluating AGENTS.md v3**，2026-09-29 修订。[P3] | 在所查设置中，仓库上下文文件一般没有提高成功率，平均推理成本增加超过 20%；作者认为非标准项目约定仍可由此表达。 | 少写可从仓库重复推导的泛泛概览，优先写必要且独特的约束，并测量成本和结果。 |

**版本提醒**：SkillsBench 早期版本常见的 16.2 个百分点与不同任务数量，不能与 v4 的 87 任务、16.6 个百分点混写。本节采用 v4 数据。

**研究边界**：本节核对了论文原始条目的摘要和版本信息，并查阅公开方法介绍；没有本地复现。arXiv 条目不自动表示已通过同行评审，本文也未核实各篇的录用状态。跨论文的任务、模型、评价器与技能来源不同，不能把正负结果直接平均成“技能总是有效/无效”。

### 6.2 社区问题单：说明工程风险，不代替普遍结论

| 一手问题记录 | 2026-10-29 核查状态 | 有限结论 |
|---|---|---|
| Impeccable #846：未修改的设计 sidecar 在 checkout/worktree 后被判陈旧。[I1] | open；报告者说明了旧版本复现，以及对后续源码条件的检查。 | 设计记忆的新鲜度不能只看时间戳。本轮未独立运行当前二进制，不能声称已复现所查版本。 |
| UI UX Pro Max #539：Windows 干净检出后，CRLF 指纹与命令引号导致校验失败或零测试发现。[I2] | closed，2026-10-22 更新。 | 跨平台技能也要验证换行、路径与测试发现数；已关闭报告不是当前全部版本仍损坏的证据。 |
| Addy agent-skills #351：描述缺少用户实际用词，导致响应式、无障碍或数据库任务路由不足。[I3] | closed，2026-07-10 更新。 | 应用真实用户措辞检查触发，避免把测试提示改得更像技能说明来掩盖问题。 |

### 6.3 触发、执行与收益要分开测

Addy 的评测设计把结构检查、词汇近似路由和实际行为分开。第二层是 TF-IDF 等近似，第三层才调用执行器并检查工具轨迹；它的维护者记录也显示，触发了技能并不保证按要求完成流程。已用源码确认运行器存在行为执行路径，但本轮没有运行。[S17]

因此建议记录三种不同结果：

- **路由结果**：应触发时有没有触发，不该触发时是否保持安静。
- **执行结果**：是否真实读了约束、改了目标文件、运行了正确验证，而非只在回复中声称完成。
- **产物收益**：与无技能相比，正确性、任务完成、维护质量和成本是否改善。

维护者的小样本试验不等于独立基准；同样，“100% 触发”也不能替代代码或界面的验收。

## 7. 采用顺序与验收方法

### 7.1 建议优先采用的六类职责

下面是拟议职责划分，本轮没有创建或安装这些技能：

| 职责 | 必要输入 | 交付和验收 |
|---|---|---|
| 宿主 UI 适配 | 入口、组件、tokens、主题机制、真实截图。 | 可运行的界面改动及主题/视口验证。 |
| UX 流程审查 | 用户任务、操作与状态清单、真实接口契约。 | 可完成的任务路径、错误恢复和交互证据。 |
| README 维护 | 当前 README、命令来源、配置与功能状态。 | 可核查的最小使用路径与事实变更。 |
| 发布说明起草 | 确定的版本范围、diff、PR、测试、已知限制。 | 每条说明有来源，明确迁移与未发布边界。 |
| 代码变更与审查 | 目标契约、相关调用点、测试、框架版本。 | 有限且完整的修改、有效验证和分级发现。 |
| 技能评测 | 正例、反例、真实任务、固定模型与工具版本。 | 路由、执行、收益与成本分别记录。 |

### 7.2 小规模对照方法

这是基于研究与社区评测机制提出的实验设计，而非现有运行结果：[P1][P2][S17]

1. 为每类职责选真实任务，覆盖正常、边界和后续修改；预先写验收标准并留出新任务。
2. 至少比较：无技能、仅必要项目事实、一个针对性技能。资源允许时再加技能组合和等长度无关文本对照。
3. 固定模型、宿主/工具版本、初始代码、预算、依赖和评价输入；UI 截图固定视口、主题及状态。
4. 能自动验证的交给工具；审美、可理解性和操作体验用预先说明的评审标准，条件允许时盲评。
5. 多次运行，报告失败与波动；分别统计功能、维护质量、时间、token 和额外操作，避免只挑最好的一次。
6. 新任务出现退化时能撤回技能或收窄触发范围，经验保留来源与淘汰条件。

### 7.3 避免技能库越用越重

- 常驻部分只放触发条件、范围、必要输入与核心约束，长规则和示例按任务读取。
- 一次只挑解决当前问题的资料，避免全库注入；相近技能明确谁负责实现、谁负责审查。
- 尽量让项目已有检查配置承载确定性规则，不在多个提示词中维护同一规范。
- 将版本、来源、已知限制和未验证假设写进记录，定期删除重复或没有收益的规则。
- 不把搜索到的远程技能说明当作当前执行指令；本轮资料里出现的命令、下载和自动修改行为均未执行。

这些是拟采用的工作方式，不是对任一技能包可靠性或普适收益的保证。

## 8. 来源与版本快照

### 8.1 GitHub CLI 核查的仓库版本

下表均为 2026-10-29 在线读取的默认分支提交，所查仓库当时均未归档。后续复现应使用固定提交，不应仅使用可移动的 main/master 链接。

| 仓库 | 核查 commit |
|---|---|
| anthropics/skills | `ca45fc496a3436251f191354091d557da31c15b5` |
| pbakaus/impeccable | `057ec9f430c1a94bf306ec4e962c4cfac0acd637` |
| nextlevelbuilder/ui-ux-pro-max-skill | `28b3b8dee8c976df4fa3e94aed4e092ad43fcb03` |
| Dammyjay93/interface-design | `2f9be3206855bcb2d1d0af262c8bae25cba6658d` |
| vercel-labs/agent-skills | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` |
| addyosmani/agent-skills | `eb07f19f52c2669f2364897aaa293e2aaddd7b1c` |
| addyosmani/web-quality-skills | `afa8da942115f2961fdbfa80807ea0b232ff6c00` |
| addyosmani/clarity | `e27ceeff60368cf6966b4ea00a5b9b36418ee9a0` |
| softaworks/agent-toolkit | `3027f20f3181758385a1bb8c022d4041dfb4de84` |
| ComposioHQ/awesome-claude-skills | `be2a406907dbc61b73e6827ded415c96139d13a2` |
| changesets/changesets | `b09779a3d503a581df98a81384d5849db969eb03` |
| googleapis/release-please | `c589293ca38aee267b329f9bf9b26c9d6516a687` |

### 8.2 技能、源码与规范

| 编号 | 一手来源 |
|---|---|
| [S1] | [Anthropic frontend-design](https://github.com/anthropics/skills/blob/ca45fc496a3436251f191354091d557da31c15b5/skills/frontend-design/SKILL.md)。 |
| [S2] | [Impeccable 技能入口](https://github.com/pbakaus/impeccable/blob/057ec9f430c1a94bf306ec4e962c4cfac0acd637/.agents/skills/impeccable/SKILL.md)，入口 metadata 标注 4.8.0；[README](https://github.com/pbakaus/impeccable/blob/057ec9f430c1a94bf306ec4e962c4cfac0acd637/README.md)。 |
| [S3] | UI UX Pro Max：[技能入口](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/28b3b8dee8c976df4fa3e94aed4e092ad43fcb03/.claude/skills/ui-ux-pro-max/SKILL.md)、[检索实现](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/28b3b8dee8c976df4fa3e94aed4e092ad43fcb03/src/ui-ux-pro-max/scripts/core.py)、[设计系统聚合](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/28b3b8dee8c976df4fa3e94aed4e092ad43fcb03/src/ui-ux-pro-max/scripts/design_system.py)。 |
| [S4] | [interface-design 技能](https://github.com/Dammyjay93/interface-design/blob/2f9be3206855bcb2d1d0af262c8bae25cba6658d/.claude/skills/interface-design/SKILL.md)。 |
| [S5] | Vercel：[web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/web-design-guidelines/SKILL.md)、[react-best-practices](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices/SKILL.md)。远程界面规则是另一个版本输入。 |
| [S6] | [web-quality-audit](https://github.com/addyosmani/web-quality-skills/blob/afa8da942115f2961fdbfa80807ea0b232ff6c00/skills/web-quality-audit/SKILL.md)。 |
| [S7] | [crafting-effective-readmes](https://github.com/softaworks/agent-toolkit/blob/3027f20f3181758385a1bb8c022d4041dfb4de84/skills/crafting-effective-readmes/SKILL.md)。 |
| [S8] | [Anthropic doc-coauthoring](https://github.com/anthropics/skills/blob/ca45fc496a3436251f191354091d557da31c15b5/skills/doc-coauthoring/SKILL.md)。 |
| [S9] | [Clarity](https://github.com/addyosmani/clarity/blob/e27ceeff60368cf6966b4ea00a5b9b36418ee9a0/SKILL.md)。 |
| [S10] | [Diátaxis 官方说明](https://diataxis.fr/)。 |
| [S11] | [Composio changelog-generator](https://github.com/ComposioHQ/awesome-claude-skills/blob/be2a406907dbc61b73e6827ded415c96139d13a2/changelog-generator/SKILL.md)。 |
| [S12] | Addy 工程技能：[代码审查](https://github.com/addyosmani/agent-skills/blob/eb07f19f52c2669f2364897aaa293e2aaddd7b1c/skills/code-review-and-quality/SKILL.md)、[按来源与版本实现](https://github.com/addyosmani/agent-skills/blob/eb07f19f52c2669f2364897aaa293e2aaddd7b1c/skills/source-driven-development/SKILL.md)、[文档与 ADR](https://github.com/addyosmani/agent-skills/blob/eb07f19f52c2669f2364897aaa293e2aaddd7b1c/skills/documentation-and-adrs/SKILL.md)。 |
| [S13] | [Changesets 当前 FAQ](https://changesets.dev/faq)；[固定版本 FAQ 源文件](https://github.com/changesets/changesets/blob/b09779a3d503a581df98a81384d5849db969eb03/site/faq.md)；[提示过时的旧文档](https://github.com/changesets/changesets/blob/b09779a3d503a581df98a81384d5849db969eb03/docs/adding-a-changeset.md)。 |
| [S14] | [Release Please README](https://github.com/googleapis/release-please/blob/c589293ca38aee267b329f9bf9b26c9d6516a687/README.md)。 |
| [S15] | [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)。 |
| [S16] | [Google：代码审查应检查什么](https://google.github.io/eng-practices/review/reviewer/looking-for.html)。 |
| [S17] | Addy 评测：[评测说明](https://github.com/addyosmani/agent-skills/blob/eb07f19f52c2669f2364897aaa293e2aaddd7b1c/evals/README.md)、[运行器](https://github.com/addyosmani/agent-skills/blob/eb07f19f52c2669f2364897aaa293e2aaddd7b1c/scripts/run-evals.js)。 |
| [S18] | [Anthropic skill-creator](https://github.com/anthropics/skills/blob/ca45fc496a3436251f191354091d557da31c15b5/skills/skill-creator/SKILL.md)：核查了触发描述、渐进加载和评测工作流，作为技能维护方法参考。 |

### 8.3 研究与社区记录

| 编号 | 来源与版本 |
|---|---|
| [P1] | [SkillsBench v4](https://arxiv.org/abs/2602.12670v4)，2026-06-14 修订。 |
| [P2] | [Signal or Noise? v1](https://arxiv.org/abs/2608.23067v1)，2026-08-24 提交。 |
| [P3] | [Evaluating AGENTS.md v3](https://arxiv.org/abs/2602.11988v3)，2026-09-29 修订。 |
| [I1] | [Impeccable #846](https://github.com/pbakaus/impeccable/issues/846)：设计 sidecar 时间戳判陈旧；本次核查 open。 |
| [I2] | [UI UX Pro Max #539](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/issues/539)：Windows 换行与测试发现；本次核查 closed。 |
| [I3] | [Addy agent-skills #351](https://github.com/addyosmani/agent-skills/issues/351)：触发描述词汇不足；本次核查 closed。 |

### 8.4 检索与核查记录

- GitHub CLI 使用了 `gh search repos`、限定仓库的 `gh search issues`，以及 `gh api` 的仓库元数据、提交、目录树、文件和问题单读取。
- 宽泛的代码搜索结果噪声较大，后续改为限定维护者仓库、固定 commit 和具体文件路径。一次带引号的 issue 查询失败后，改用 `--repo` 与直接 issue API 核实。
- 内置网页搜索用于发现候选、查原始论文与官方规范；最终技术结论优先落到维护者源码、论文原始页或具体一手报告。
- 搜索结果曾给出标题与 arXiv 标识不匹配的候选论文；打开原始条目确认后未纳入，不依据搜索摘要补造研究结论。
- 核对了 12 个仓库的版本；没有下载完整仓库、执行远程技能、生成图片或浏览器实测，也没有在本轮新增产品代码或发布自动化。
