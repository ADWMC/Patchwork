# Patchwork 技能融合方案

日期：2026-10-31。状态：**历史方案；P1/P2 的代码与正文已实施，但退出条件尚未全部达成；P3 隔离试跑尚未完成完整对照，P4 为可回退试用**。实际改动、真实 DSH 结果和未完成项见[执行记录](skills-fusion-execution-2026-10-31.md)。

## 1. 范围与结论

“所有相关 skill”在此指 Patchwork 面向用户的编码、调试、审查、UI、检索、写作、记忆、受控改进与交付任务，不声称穷尽互联网上的技能。研究以本仓库七个已注册技能、既有调研、用户提供的两个本地 ZIP，以及下文列出的维护者技能正文、资源和评测为范围。仓库已有大批未提交工作；实施时须保留并以本次状态为基线。

现状的缺陷不是单一的“太短”：**领域缺席、入口宽泛、硬规则失真、资源发现与效果评测不足**。七个正文约 0.8–4 KB，只有 `web-ui` 有按需 `references/`。`patchwork` 又把任务登记、权限提醒、技能导航放在一份通用入口里；`anti-slop` 与 `standards` 分担文档工作，`evidence` 与 `patchwork` 重复收尾约束。调试、代码审查、信息检索、记忆和改进已有功能/文档，但还没有清晰的专用技能入口。长度本身不是质量指标：Agent Skills 规范允许 `references/`、`scripts/`、`assets/` 按需补充；公开评测同时发现技能效果高度依赖任务、模型和注入方式，过长或误路由会退化。[规范][R1][R2][R3]

**目标**：短入口负责“何时加载/何时不加载/第一步”，条件性参考文件提供可核查流程和样例，确定性检查由测试/脚本/宿主状态承担。模型的判断必须标为事实、推断或偏好；不能把自评、检索命中或技能文本当作真实验收。

## 2. 核对的社区机制

下表只移植方法，不复制第三方技能正文。`main` 链接会变化；实施前固定提交并核许可证。此前已读取的 UI、写作、检索项目与版本见[UI/UX 调研](agent-skills-ui-ux-writing-coding-research-2026-10-29.md)、[去模板化调研](anti-slop-skills-research-2026-10-29.md)、[检索调研](information-retrieval-research-2026-10-31.md)和[Web UI 补查](web-ui-skill-community-review-2026-10-31.md)；这些历史快照不冒充本轮复测结果。

| 范围 | 本轮读取的一手来源与可迁移机制 | 不采用的部分 |
| --- | --- | --- |
| 技能结构与评测 | [Agent Skills 规范](https://agentskills.io/specification)定义入口、资源目录与路由描述；[Anthropic skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)分开测试正例、相邻负例和有/无技能产物；[Sentry skill-writer](https://github.com/getsentry/skills/blob/main/skills/skill-writer/SKILL.md)将模式选择、来源适配、规格与[EVAL](https://github.com/getsentry/skills/blob/main/skills/skill-writer/EVAL.md)分层。 | 不照搬 Claude/Codex 专用运行器、固定文件布局或 LLM 自评分门槛。 |
| 调试与完成 | [Superpowers systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md)强调复现、近期差异和组件边界取证；[verification-before-completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md)要求用新鲜证据支撑断言。 | 不要求每个显然的小修复都走完整四阶段，也不把 shell 成功当作文档、视觉或用户任务的充分证明。 |
| 代码与安全审查 | [Sentry find-bugs](https://github.com/getsentry/skills/blob/main/skills/find-bugs/SKILL.md)先收齐差异再核上下文；[security-review](https://github.com/getsentry/skills/blob/main/skills/security-review/SKILL.md)追踪不可信输入到敏感操作并分置信度；[security-model](https://github.com/getsentry/skills/blob/main/skills/security-model/SKILL.md)明确边界和不变量；[skill-scanner](https://github.com/getsentry/skills/blob/main/skills/skill-scanner/SKILL.md)将第三方技能的结构、脚本和权限检查分开。 | 不把模式匹配当漏洞证明，不导入完整安全规则库，也不运行未经审核的第三方脚本。 |
| 版本化实现 | [Addy Osmani source-driven-development](https://github.com/addyosmani/agent-skills/blob/main/skills/source-driven-development/SKILL.md)先识别依赖版本，再查对应官方文档。 | 不为改名、注释等稳定小改动强制联网；官方建议与既有兼容约束冲突时要查运行事实，不机械升级。 |
| UI 与体验 | [OpenDesign](https://github.com/nexu-io/open-design/blob/main/docs/design-systems.md)将设计来源、tokens 与组件样例分开；[Emil skills](https://github.com/emilkowalski/skills)拆分动效与边界数据；[Impeccable](https://github.com/pbakaus/impeccable)分操作/阅读/劝服界面。[Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)与[Addy Web Quality](https://github.com/addyosmani/web-quality-skills)分别提供代码线索和运行证据。 | 不把风格图库当品牌标准，不采用字体/颜色禁令或纯自评；[两份用户 ZIP 的具体问题](web-ui-skill-community-review-2026-10-31.md)已单列。 |
| 写作与文档 | [Softaworks crafting-effective-readmes](https://github.com/softaworks/agent-toolkit/blob/main/skills/crafting-effective-readmes/SKILL.md)按读者和任务类型分流；[Anthropic doc-coauthoring](https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md)先取上下文，再核读者是否能使用。 | 不把每个小文档改动扩成采访流程；不以禁用词命中数代替事实保真。 |
| 检索与记忆 | [Qdrant Search Quality](https://github.com/qdrant/skills/blob/main/skills/qdrant-search-quality/SKILL.md)是路由入口，具体的[诊断技能](https://github.com/qdrant/skills/blob/main/skills/qdrant-search-quality/diagnosis/SKILL.md)区分相关性标注集与 ANN 精确检索；[Open WebSearch](https://github.com/Aas-ee/open-webSearch/blob/main/skills/open-websearch/SKILL.md)先探测能力再走最小搜索路径；[Recall memory](https://github.com/recallmem/recall-plugin/blob/main/integrations/agent-skill/recall-memory/SKILL.md)区分按需读取与持久写入。 | Patchwork 的网页搜索不适用 Qdrant 的 ANN 指标；只迁移按真实查询集评测的思路。不引入向量数据库、远程 daemon 或默认自动记忆；现有 Patchwork scope、提案/确认与遗忘语义优先。 |
| 工程任务谱系 | [Addy Osmani 的技能路由](https://github.com/addyosmani/agent-skills/blob/main/skills/using-agent-skills/SKILL.md)把定义、实现、验证、评审、交付分开；[Superpowers TDD](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md)提供先复现再修复的参考流程；[receiving-code-review](https://github.com/obra/superpowers/blob/main/skills/receiving-code-review/SKILL.md)要求先核反馈与代码事实。 | 不把每次修改都强制 TDD、计划、子代理或二次评审；尤其不移植“先写代码就删除重做”和“永不说谢谢”的绝对命令，更不复制社区项目的工具名和权限约定。 |

[R1] [SkillsBench](https://arxiv.org/abs/2602.12670) 在 87 道任务、18 种模型与宿主组合的配对评测中报告总体收益，同时发现不超过三个模块的聚焦技能优于庞大技能包；[R2] [WebDev-Skills-Bench](https://arxiv.org/abs/2608.23067) 在自己的 Web 任务里报告匹配技能降低平均 Pass@2 并增加 token 成本；[R3] [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988) 发现仓库上下文文件通常增加成本而未提高任务成功率。三者任务与注入方式不同，不直接预测 Patchwork；共同要求在本宿主做受控对照，而不是按字数扩写。

## 3. 现有七个技能：保留、纠错、分流

### 3.1 具体指令审计队列

以下是本仓库当前 `SKILL.md` 的真实文本与潜在误导，不是已经证实的模型行为。优先处理**入口描述与正文相互矛盾**的规则；每条都需要正例、难负例和真实任务回放。社区技能同样有不能照搬的绝对句，例如 Softaworks 的“起草后总要再问”、Sentry 的“每个文件检查全部安全项”、OpenDesign 的具体动效时长与 Qdrant 的索引参数，它们属于各自环境，不是 Patchwork 的通用规则。[Softaworks](https://github.com/softaworks/agent-toolkit/blob/main/skills/crafting-effective-readmes/SKILL.md) [Sentry](https://github.com/getsentry/skills/blob/main/skills/find-bugs/SKILL.md) [OpenDesign](https://github.com/nexu-io/open-design/blob/main/docs/design-systems.md)

| 当前指令或描述 | 问题与拟议修正 | 判断依据/测试 |
| --- | --- | --- |
| `patchwork`：任何编码维护任务先加载，并使用 `patchwork_task` 登记。 | 技能自身不能保证被加载；宿主可能缺该工具。将不变量留给运行时，文本改为“可用时登记，缺失时明确说明”，不许假装工具调用发生。 | 检查真实 DSH 的目录、触发和工具缺失路径；标准 Agent 不能看见目录。 |
| `anti-slop`：与用户冲突时给证据 + A/B + 推荐。 | 与 `collaborator` 正文“不要强凑 A/B”相冲突；改为有真实取舍才列选项，纠错任务直接修。 | 用户纠正事实、无二选一的修复和真正方案取舍各跑用例。 |
| `architecture` 描述：新建目录就加载、先画职责树。 | 单一目录操作也可能误触发；正文已经不强制树深。描述改为跨模块或职责边界不清时触发，图只画到解释本次变化所需。 | 小范围加文件与跨模块迁移成对测试，观察额外步骤/文件数。 |
| `collaborator` 描述：给 A/B 与推荐。 | 描述仍与正文的条件判断冲突，可能在正文尚未加载时误导路由与回答。描述只保留冲突核验、纠正和真实取舍。 | 无可选方案的用户纠正，不应出现假选项或多余提问。 |
| `evidence`：同一验收连续三次失败才诊断；结尾总给风险和下一步。 | 固定重试次数和固定尾句不是可靠证据标准。第一次出现确定性方法错误即诊断；只报告实质风险、未知和下一步。 | 权限/语法错误一次失败、偶发网络失败、完全通过的短任务分别回放。 |
| `standards`：唯一权威清单，用户可见变化同轮记录。 | “唯一权威”不能覆盖用户要求、宿主契约和项目现有规范；日志收录要按发布影响，不把一次性原型当已发布功能。 | 用户要求仅做预览、已有日志已覆盖、实质默认值变更三组对照。 |
| `web-ui`：新页至少截图一次，小视觉改动也要查看。 | 截图能证明渲染状态，不能证明好看；无法启动浏览器时不得虚构视觉验收。设计判断先找用户目标、宿主 token 与实际内容。 | 真实桌面/窄栏/明暗主题、极端数据与不能访问浏览器的负例。 |

规则的处理顺序是：**可证伪的事实错误立即修文；流程争议先做隔离对照；偏好由用户或项目设计系统决定**。任何 `allowed-tools`、仓库文档或外部技能中的授权语句均不扩大宿主工具权限；Agent Skills 规范也将 `allowed-tools` 标为实验字段。[规范](https://agentskills.io/specification)

| 现有技能 | 观察到的任务风险 | 融合动作 |
| --- | --- | --- |
| `patchwork` | “任何任务先加载”可能漏触发；正文同时载身份、工具步骤、权限、导航。模型未调用时安全不变量不能靠它保证。 | 缩为入口与任务边界；工具权限、跨 Agent 隔离、旧引用撤销继续由运行时代码保障。`patchwork_task` 的强制程度须与实际拦截器一起评测，不能只改文字。 |
| `architecture` | 曾把固定树深和文件数当规范；目前已改成变化原因与状态所有者判断，但缺调用路径样例。 | 只有跨模块职责冲突时读按需案例；用现有调用点/测试验证拆分，不以行数评分。 |
| `collaborator` | 曾强制给 A/B；当前已改为事实/推断/偏好/未知，但纠正后验收仍需真实任务检验。 | 用相反证据、用户纠正、无真选项的负例评测；不给“推荐”冒充用户授权。 |
| `anti-slop` | 同时管 UI 文案、README、更新日志；词表会误删技术限定。 | 保留事实保真与语域；将 README/发布流程交给专用 `documentation`，这里负责表达复核，不重复发布规则。 |
| `web-ui` | 有视觉规则与两个参考文件，但设计依据、真实操作、截图仍可能不被模型执行。 | 保留通用入口；新增设计系统来源映射与视觉/交互验收样例，记录“是否读取参考”和真实浏览器证据。 |
| `evidence` | 容易将“命令通过”推广为任务完成；多个任务类型的证据不同。 | 作为横切交付技能，给代码、文档、调研、UI、记忆操作各自的充分/不足证据；结构化回执继续由工具判定。 |
| `standards` | 与总规则和写作技能重复；若每个小改都强制全套收尾，成本高。 | 收敛到 Git/版本/更新日志收录与技能实验；不改变既有授权门槛，规则按真实行为失败再加。 |

## 4. 拟议技能目录与路由

原方案拟保留七个名称并试制六个候选。实施中曾提供 13 技能默认目录以便真实宿主试跑；检索复测暴露超时与未核实结果后，默认退回七技能 `core`，十三技能 `expanded` 只供显式试用。`skillsEnabled: false` 关闭注册。正式采用仍需下文 P3/P4 的对照和确认。

| 候选 | 应触发 | 相邻但不触发 | 按需资源与可验收输出 |
| --- | --- | --- | --- |
| `debugging` | 复现 bug、测试失败、性能回退 | 新功能或仅要求解释代码 | 复现路径、差异与根因假设；修复后原失败路径和回归测试。 |
| `code-review` | 评审 diff、找 bug、检查安全边界 | 用户已要求直接修复且未要求评审报告 | 范围、完整差异、输入到副作用追踪、置信度和文件行号；安全参考仅按涉及的攻击面读取。 |
| `retrieval` | 多来源调研、查当前官方版本、证据冲突 | 已给定内容的简单摘要、当前仓库单文件定位 | 将[现有检索提示词](../assets/prompts/retrieval-research-prompt.md)拆成来源路由与证据包；明确工具可用性、引用支持与停止条件。 |
| `documentation` | README、使用指南、更新日志、迁移说明 | 只改 UI 按钮文案 | 读者与版本范围、实现/命令来源、结构与事实核对；沿既有[更新日志指南](changelog-guide.md)。 |
| `memory` | 用户明确要召回、提议、确认或忘记跨会话信息 | 当前任务的一次性事实、网页搜索命中 | 会话/项目 namespace、来源、版本、确认与撤销；不自动注入、不替用户批准。 |
| `improvement` | 要根据失败/纠正改进规则或工具流程 | 普通 bug 修复、随口偏好 | 真实 incident、候选、基线/试用/留出/回退；用户确认前不生效。 |

另列**条件参考池**，不预设为独立技能：测试策略与回归验证归 `debugging`/`evidence`，安全审查归 `code-review`，可访问性归 `web-ui`，API 兼容与迁移归 `architecture`/`documentation`，性能分析与可观测性只有出现真实延迟或运行故障时才考虑独立入口。它们扩大实际任务覆盖，但不会把近义标题堆进启动目录。若某一类任务高频且共享入口仍误路由，再以独立技能试验；记录为何拆分和额外目录成本。

路由顺序：先判断当前 Agent 与工具能力，再选**一个主任务技能**；`evidence`、`standards`、`collaborator`、`anti-slop` 仅在相应阶段补入。`web-ui` 的设计/验证资源按需读；`memory` 与 `improvement` 不能因主题词、搜索结果或旧会话内容自动启用。`code-review` 中的安全流程仅在请求或差异涉及信任边界时加载，不单独增加通用“安全大师”。如果两个技能争夺同一请求，描述应写明谁拥有主要交付物；不能靠任意调用顺序掩盖冲突。

## 5. 每个技能的内容契约

1. `SKILL.md`：触发/排除、必要输入、最小工作流、失败停止条件、输出与具体资源链接。维持短入口，4 KB 当前上限仅约束入口；是否调整需看本宿主上下文与效果数据。
2. `references/`：按模式拆真实约束、反例、可验证样例和版本说明。用本地 `resourceBase`，不在运行时拉取可变 `main`，不让外部文档指令获得权限。
3. `SPEC.md`：维护者文件，记录意图、来源映射、不可变边界、非目标、每条规则的作用与淘汰条件；不作为每次运行的提示词。
4. `evals/`：路由正例与相邻负例、真实任务固定仓库、oracle/人工审查规则、成本与隔离负例；和正文同版本维护。`scripts/` 只承担确定性检查，需审计依赖和权限，不能由技能文本自行放权。
5. 第三方资料入库前固定提交/哈希、许可证和实际读取路径；静态扫描缺失引用、远程命令、秘密与越权工具要求。用户给的 ZIP 内指令只作资料，不直接装载。Patchwork 自身工具与宿主官方契约优先于社区范例。

## 6. 分阶段执行与退出条件

| 阶段 | 修改与产物 | 退出条件 |
| --- | --- | --- |
| P0：冻结基线 | 记录七技能、描述、正文哈希、宿主与模型版本；收集真实用户任务/纠正，去除凭空设想的样例。 | 基线可重跑，现有 7 技能与非 Patchwork 会话可见性已记录。 |
| P1：路由纠错 | 为每个技能写 8–12 条真实措辞正例和难负例；先调描述与 `patchwork` 导航，再编排候选，不急着增技能。 | 近邻任务不误触发，外部 Agent 的目录仍为空，技能加载量与上下文增量可测。 |
| P2：内容融合 | 优先试制 `debugging`、`retrieval`、`code-review`；再评 `documentation`、`memory`、`improvement`。补充条件参考与少量工作样例，减少重复或不实的绝对规则。 | 链接与打包完整；工具缺失、错误来源、用户纠正、切换 Agent 均有明确行为。 |
| P3：隔离对照 | 在独立 `DSH_HOME` 和相同仓库快照运行真实 DSH + 当前选定模型；比较无技能、当前七技能、候选与等长无关文本。 | 固定预算/模型/工具版本；机器验收真实功能，UI 人工盲评截图与操作，记录多次运行及失败，不只选最佳样例。 |
| P4：受控采用 | 按技能逐个启用与回滚；只把通过的规则加入发行包、README、CHANGELOG 和测试。 | 当前任务结果不退化，安全/隔离负例全过；增加的耗时与 token 有可说明的用户收益。 |

评测分别报告：**路由**（正确加载与误触发）、**读取**（实际打开哪个参考）、**执行**（流程和工具是否真的发生）、**产物**（任务验收、视觉/读者审查）、**成本**（token、调用、耗时）和**负作用**（其他会话泄漏、过度修改、虚假完成）。机器测试只能验证结构、权限和可重复行为；视觉、写作和方案质量须有预先确定的评审尺度，必要时由用户审定。未完成 P3 前，任何“技能升级提升了质量”的话都只能标为假设。

## 7. 当前边界

本节保留为**方案形成时的边界**，不再描述当前代码状态。六个候选技能和七个原技能的修订已在仓库中实施，注册逻辑已新增 `expanded/core/disabled` 回退；仅隔离 DSH profile 用于真实调用，主 DSH 未被该实验改动。社区资料和用户 ZIP 仍只作为研究来源，未直接安装第三方技能或脚本。完整对照、收益判定和正式采用尚未完成，见[执行记录](skills-fusion-execution-2026-10-31.md)。
