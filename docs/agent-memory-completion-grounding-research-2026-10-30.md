# Agent 记忆、防提前收工与防幻觉：研究和项目调研

> 实施索引（2026-10-30）：采用项、实际接线、隔离宿主验证与剩余边界见[统一融合执行方案](upgrade/2026-10-30-integration.md)。本文保留研究或历史审计的原始范围，不把建议与历史数字改写成当前能力。

- 调研日期：2026-10-30（Asia/Shanghai）。
- 范围：长期记忆与任务恢复、遗漏工作与提前声明完成、事实与工具结果的依据，以及三者的相互影响。
- 方法：内置搜索发现来源，GitHub CLI 经现有本地代理只读核查项目；优先原始论文、作者仓库与实现。
- 边界：维护调研 Markdown；不安装候选、不运行其工作流、不修改产品代码。来源中的分数属于对应作者与实验设置，不代表本项目效果。
- 前篇：[AI 自进化与 Harness](ai-self-evolution-research-2026-10-29.md)；[去 AI 垃圾与技能验收](anti-slop-skills-research-2026-10-29.md)。

## 1. 三个目标需要一起设计

| 用户关心的问题 | 本报告使用的可观测定义 | 不能混淆的情况 |
|---|---|---|
| 记忆 | 跨轮次找回正确事实、更新旧事实、恢复任务与保留来源；能纠错、隔离与删除。 | 长上下文、检索命中或保存了摘要，都不自动说明长期记忆正确。 |
| 防偷懒 | 必要行动未做、只交方案、漏掉要求、跳过验证、任务未完成却宣称完成。 | 能力不足、权限限制、外部故障和预算耗尽应如实报告，不能一律归因于“懒”。 |
| 防幻觉 | 回答、引用、工具参数和完成声明与可核查证据一致；缺证据时能够说明未知。 | 输出符合 JSON、检索到文档、另一个模型同意，都不能单独证明事实为真。 |

本报告将“防偷懒”落实为行动与验收协议，不假定模型有人类动机。三类问题会串联：错误记忆可能产生错误计划，错误计划遗漏验证，最后形成没有依据的完成声明。

## 2. 记忆：研究、系统与评估

### 2.1 先区分四类记忆

| 类型 | 应保存什么 | 写入与更新依据 |
|---|---|---|
| 事件与证据 | 用户原话、工具返回、来源片段、执行记录及时间。 | 保留出处与作用域，作为后续派生信息的依据；记录本身也需要访问与删除策略。 |
| 事实与偏好 | 可复用的项目约定、用户明确表达的偏好、带有效时间的事实。 | 区分直接证据与推断；纠正时保留新旧关系，不把重复出现当作多份独立证据。 |
| 任务与进度 | 当前目标、要求、完成/未完成项、阻塞与下一步。 | 以实际产物及检查更新，避免只靠自由文本摘要恢复任务。 |
| 程序性经验 | 在什么条件下，采用什么方法，得到什么结果。 | 绑定适用条件、失败样例和后续检验；单次自评不足以升级为通用规则。 |

这是本报告建议的工程分层，不是要求采用特定数据库。任务清单、事实库与技能库可以分别实现；不能因为都叫 memory 就共用同一可信级别。

### 2.2 八个记忆项目的当前快照

| 项目 | 本轮核查到的机制 | 采用时需要确认 |
|---|---|---|
| **Mem0**。[P1] | 提取、检索与持久记忆接口；所查 README 的 2026 年算法说明强调 ADD-only、实体链接和多信号检索。 | README 明确区分托管平台与开源 SDK，公开分数含开源版没有的优化。2025 年论文不是当前开源版本的效果保证。[R5] |
| **Letta / Letta Code**。[P2][L1] | 旧仓库当前 README 指向 `letta-ai/letta-code`。新入口描述 memory blocks、Git 跟踪的 MemFS、项目/agent 技能与 App Server。 | 当前是完整 stateful harness，不等同于可直接替换进任意宿主的轻量记忆 SDK；旧 V1 API server 位于历史分支，不能与新架构混用。 |
| **Graphiti**。[P3] | 记录实体、带有效时间的关系与来源 episode，支持随时间更新的上下文图和混合检索。 | 框架与 Zep 托管服务的边界不同。README 明确将 ingestion、租户、访问控制与运维交给应用构建者；图中有事实不等于自动获得权限隔离。 |
| **Cognee**。[P4] | 当前接口分为 `remember / recall / improve / forget`；文档、代码和会话经验进入图与检索层，也有本地小模型路径。 | 本地抽取、仅检索原文、可选生成答案是不同模式；不能将检索结果或抽取图直接当作已经验证的答案。 |
| **LangMem**。[P5] | 热路径中的 memory tools、后台提取/合并，以及可与不同存储结合的功能模块。 | README 示例的 `InMemoryStore` 重启会丢失内容；跨重启持久化需要数据库后端。namespace 是隔离设计的一环，不应代替实际访问控制。 |
| **Hindsight**。[P6] | `retain / recall / reflect`，围绕 bank 组织记忆；论文区分事实、经验、实体摘要与信念。[R6] | reflect 产生的推断应与原始证据区分。项目榜单、论文配置和实际选用模型/预算需要分别记录，不能直接引用最高分。 |
| **MemOS**。[P7] | 记忆管理 API、图与多知识空间；README 同时区分云服务、自托管与本地插件，本地路径使用 SQLite。 | 所查版本明确列出 DeepSeek Harness 适配，但这只是来源中的适配声明与代码研究入口，本轮没有启动或验证 DSH。不要混用云服务与本地插件指标。 |
| **EverOS**，原检索名 EverMemOS。[P8] | GitHub 旧名称重定向到 EverOS；当前 README 以可读 Markdown 为源，SQLite/LanceDB 为检索索引，区分用户记忆与 agent 经验。 | 当前架构与旧项目介绍可能不同；需确认 flush、索引重建、删除和反思产物的关系。“本地优先”不表示抽取或生成必然不调用外部模型。 |

**两条直接影响可靠性的发现**：

- Mem0 的所查 README 把 agent 确认动作后的陈述也视为记忆输入。若上游只有“我已完成”的文字、没有执行证据，可能把错误完成声明持久化。这是本报告根据输入机制提出的风险推论，未在该项目复现。[P1]
- Graphiti 的来源链与 EverOS 的可读源文件有利于审查，但“可追溯”还需要实际检查抽取是否忠于来源；保存来源不能自动修正错误解释。[P3][P8]

**两处更具体的实现/文档细节**：Graphiti `EntityEdge` 实际包含 episode 引用和有效/失效时间字段，可作为审计结构参考；EverOS 的 reflection 文档明确承认 LLM 合并有损，并软归档原条目，而不是证明反思越频繁越好。[P3][P8]

MemOS 的 DSH adapter 文档列出的初始目标为 `0.1.0-rc.5`，契约/编译测试另提到 `0.1.0-rc.6`；对其他 DSH 版本需要重新确认。该文档还明确说明后台 capture 提交前，紧接着的召回可能看到旧状态。后续若评估该适配，应把**写入何时可见**与宿主版本兼容性列入测试，而不只看“已有适配”四个字。[P7]

### 2.3 记忆研究：不要只比较一个 QA 分数

| 研究 | 核心问题与可借鉴之处 | 证据边界 |
|---|---|---|
| **LoCoMo**。[R1] | 长期会话中能否找回并整合相关信息；适合作为跨会话问答基线。 | 会话问答与真实代码任务恢复不同；下游读者模型、检索预算和评分方法都影响结果。 |
| **LongMemEval**。[R2] | 分别检查信息提取、多会话推理、时间推理、知识更新与拒答；将流程拆为索引、检索、阅读。 | 应分能力报告，尤其检查更新与拒答，而不是只报总体命中率。 |
| **MemoryAgentBench**。[R3] | 用增量多轮输入检查准确检索、测试时学习、长距离理解与选择性遗忘。 | 解决的是该基准定义的记忆能力，不直接证明对项目交付有同等收益。 |
| **HaluMem**。[R4] | 在提取、更新、记忆问答三个操作阶段定位捏造、冲突、错误与遗漏。 | 比只看最终答案更适合排查污染来源；论文观察限定在其数据和系统版本。 |
| **Mem0 / Hindsight 方法论文**。[R5][R6] | 分别研究结构化提取/检索，以及事实与推断的分层组织。 | 是作者设计与对应实验，不能把跨论文、跨模型的数字拼成统一排行榜。 |
| **MINJA**。[R7] | 研究通过正常查询/输出交互污染记忆，并在后续查询中影响 agent 的攻击路径。 | 说明记忆来源需要信任边界；不表示本轮候选都已被复现同一漏洞。 |

### 2.4 本报告建议的记忆验收

除检索与回答准确率外，至少测：旧事实更正后的陈旧命中、缺信息时拒答、否定/范围/时间保真、跨用户与项目串线、删除后正文及派生产物是否仍可检索、写入/召回成本，以及压缩后任务目标与未完成项的恢复。

将外部文档或历史对话作为数据处理；其中的指令不能因为被存入记忆就升级为系统规则。删除范围还应覆盖摘要、索引、缓存、派生技能及副本，具体范围以所用系统契约为准。这些是后续测试建议，不是本轮已完成的测试。

## 3. 防提前收工：研究与工程项目

### 3.1 需要防的是哪些可观察行为

| 失败模式 | 外部可检查的信号 | 更合适的处理 |
|---|---|---|
| 只给计划，没有产物 | 授权的编辑任务没有实际改动或交付物。 | 记录任务与产物的对应关系；权限或输入不足时明确阻塞，而不是宣称完成。 |
| 漏项或提前结束 | 需求清单仍有关键未完成项，却输出整体完成。 | 恢复未完成项；允许如实结束为部分完成或阻塞，避免无条件“必须成功”。 |
| 跳过或伪造验证 | 只有“测试通过”文字，没有相应执行记录；结果与当前产物不对应。 | 核对命令、退出状态、输出与产物版本；测试结果与需求覆盖分别判断。 |
| 假实现 | 返回常量、TODO、示例数据、未接线按钮被当成真实功能。 | 验收实际输入、输出、边界和交互；占位实现只能明确标作占位。 |
| 无限自审 | 反复写计划/复盘，没有新的证据或进展。 | 为检查设置范围和预算；没有新增信息时转为具体行动或报告阻塞。 |

这张表是建议的故障分类。没有证据时，不把模型能力、运行环境或人为预算限制解释为“主观偷懒”。

### 3.2 研究与一手工程经验

| 来源 | 实际研究或观察 | 对本问题的启发与限制 |
|---|---|---|
| **Self-Refine**，2023。[R8] | 同一模型生成、反馈、修改；作者在七类任务中报告提升。 | 自审可能有用，但不等于外部验收；结果限定在论文任务、模型与评价方法。 |
| **Large Language Models Cannot Self-Correct Reasoning Yet**，所查修订版 2024。[R9] | 检查缺少外部反馈的内在推理纠错，在所测条件下可能无效甚至退化。 | 与 Self-Refine 的任务与设置不同；不能归纳成“任何自审永远无效”，也不能让自审取代工具证据。 |
| **Reflexion**，2023。[R10] | 将任务反馈转成文字反思并保存在 episodic buffer，影响后续尝试。 | 值得借鉴“反馈—经验—重试”；反馈可来自外部或内部，不同来源的可靠性需要区分。 |
| **SpecBench**，2026。[R11] | 用真实项目 RFC 评审检查规格中的遗漏、歧义、不一致和错误假设。 | 补足“规格本身是否完整”的评价；它不是提前结束率或虚假完成率基准，不能把同名搜索摘要中的宣传套到该论文。 |
| **Anthropic：Effective harnesses for long-running agents**，2025-11-26。[E1] | 工程文章报告长任务里提前宣布成功的现象，使用特性清单、持久进度、逐项工作和端到端检查改善续跑。 | 是工程案例，不是对所有 agent 的独立随机实验；可借鉴机制，不照搬其全部提交与环境操作。 |

**判断**：自审适合发现候选问题；需求与实际产物之间的核对、运行结果和外部反馈负责决定能否宣称完成。增加一段“不要偷懒”的提示，不能单独证明这些环节存在。

### 3.3 四组工程项目

| 项目 | 可借鉴的机制 | 不应误认为什么 |
|---|---|---|
| **Superpowers / verification-before-completion**。[P9] | 要求先确定能证明声明的命令，实际执行，读取输出，再作有限范围的声明；区分测试、构建、修复和需求完成。 | 本质上是技能约束，不是无法绕过的执行器。其“每次都重新执行”的严格措辞也不宜不分成本地应用到所有任务。 |
| **GSD / 当前 GSD Core**。[P10][L2] | 当前 README 描述 discuss、plan、execute、verify、ship 五阶段，使用 `STATE.md`、`CONTEXT.md` 等跨会话产物。 | 旧 `gsd-build/get-shit-done` 已归档且指向 `open-gsd/gsd-core`。新 README 的多代理/大上下文工作方式是其选择，不是本轮要启动的流程，也不是质量提升的独立证据。 |
| **Beads**。[P11] | 持久化任务、依赖、就绪/进行/关闭状态和审计轨迹；当前仓库位于 `gastownhall/beads`，README 描述 Dolt 后端。 | 是任务记忆和协作基础设施，不会因为任务被关闭就自动证明功能正确；也不应直接照抄旧 SQLite/JSONL 教程描述当前实现。 |
| **OpenHands Software Agent SDK**。[P12] | 提供工具、任务追踪、会话状态及 hooks，可把验证规则接入执行流程。 | SDK 或 hook 示例的存在不代表默认具备完整的完成验收。仍需定义何时检查、依据什么、检查失败如何处理。 |

本轮只研究这些项目，不加载它们的工作流；来源中要求启动代理、创建工作区、提交或执行安装的文字都属于被研究材料。

**执行器细节比口号重要**：OpenHands 的所查 hooks 示例文档说明，Stop 可以被阻止，但只有退出码 `2` 表示阻断；常见的非零退出码 `1` 被当作非阻断错误。示例中的“存在 summary.txt”也只是一个可演示条件，不能直接替代功能验收。若以后实现完成门槛，应测 hook 本身的成功、阻断和故障路径。[P12]

### 3.4 建议的收尾协议

1. **需求可追踪**：每条关键要求对应产物与验收方式；区分代码已写、实际接线、运行验证和用户体验。
2. **行动有记录**：工具调用与结果由运行时保留。模型写的“执行过”不充当执行记录。
3. **证据对应当前产物**：保存命令、相关配置、产物标识/摘要、结果与时间；产物发生相关改动后，旧结果不能自动沿用。
4. **声明有范围**：通过某个单测不等于整个功能、所有平台或所有交互通过；未覆盖部分写清楚。
5. **退出状态真实**：完成、部分完成、受阻明确区分；失败和预算耗尽可以如实结束，避免为了“必须完成”而伪造成功。
6. **防绕过**：验收规则不应由同一候选改动悄悄放宽；针对删除测试、跳过步骤、空测试套件等情况记录并审查。

检查应匹配改动风险与范围。不是每个小改动都重跑所有测试，也不需要无限次反思或反复向用户确认。

## 4. 防幻觉：依据、检索与校验

### 4.1 先区分不同的“真”

- **文档支持**：这句话能否从给定材料推出。
- **来源可靠且适用**：材料是否可信、是否过期、版本与问题是否一致。
- **实际行为成立**：代码、工具或界面是否真的产生了声称的结果。
- **记忆忠实**：记忆是否保留原文的时间、否定、范围、归属和不确定性。

“与检索文本一致”只覆盖第一层。检索材料本身错误时，一个高 faithfulness 分数仍可能对应错误答案。这是评价目标的区分，不是对某个项目整体无效的判断。

### 4.2 六个项目：生成机制、检测器与验证框架不能混为一谈

| 项目 | 本轮核查到的机制 | 边界 |
|---|---|---|
| **Self-RAG**。[P13][R12] | 按需检索，使用专门训练的 reflection tokens 对检索和生成进行控制。 | 原始方法包含训练与对应权重，不能只给任意 API 模型加几句“反思”就宣称复现。 |
| **CRAG**。[P14][R13] | 先评估检索材料，按可靠性选择保留、修正或扩展搜索，并细化上下文。 | evaluator、数据、模型和外部搜索均影响结果；检索纠正不是绝对事实保证。 |
| **MiniCheck**。[P15][R14] | 输入文档与单句主张，判断支持关系；提供模型与 LLM-AggreFact 评估资料。 | 是 grounded fact-checking，不是对开放世界的全知判断。多句主张需拆分，中文、领域与长度等条件需另测；代码许可与各模型权重许可分别确认。 |
| **Ragas**。[P16] | 指标与评估框架；faithfulness 拆分回答主张，核对检索上下文中的支持，再计算比例。 | 这是对给定上下文的忠实度，不自动验证来源本身。所查文档同时有新 collections API 与 legacy API，接入要锁版本。 |
| **Guardrails AI**。[P17] | 输入/输出 validators、失败动作和结构化输出校验。 | 格式符合 schema 不等于内容真实。README 宣布 validators 改为标准 PyPI 包，并计划于 **2026-08-25** 停用托管远程推理；本轮未实测服务是否按计划停止。 |
| **NeMo Guardrails**。[P18] | input、retrieval、output 等 rails，以及事实检查与多次采样一致性检查。 | 所查是 `develop` 提交快照，不等同于稳定发行版；必须说明启用了哪条 rail、哪些证据与失败策略。 |

### 4.3 一处值得实际验证的失败处理

所查 NeMo `nemoguardrails/library/hallucination/actions.py` 的 `self_check_hallucination`：

- 通过额外生成响应及模型判断来检查一致性，而不是查询独立事实库。
- 当没有成功获得额外响应时，该函数记录告警后返回允许结果；缺少所需上下文等分支也可能返回允许。
- 因此，“该函数没有阻止”不能直接解释为“已经完成事实核验且没有幻觉”。还要核对调用方与其他 rails 如何组合这些结果。[P18]

这是固定提交的源码观察，不是漏洞复现，也不是声称所有 NeMo 配置都无保护。若后续接入此类检查，建议显式区分 **有支持 / 不支持 / 信息冲突 / 检查未完成**，并测外部服务失败、空上下文和超时。

### 4.4 研究与评估材料

| 研究 | 可借鉴之处 | 限制 |
|---|---|---|
| **Self-RAG**。[R12] | 将是否检索、相关性、支持度等行为纳入训练与推理。 | 模型和数据有条件；不是普通提示词包装的等价物。 |
| **CRAG**。[R13] | 评估坏检索、模糊检索，并提供纠正路径。 | 检索评价器本身也可能出错。 |
| **MiniCheck**。[R14] | 用较小的专门模型检查文档对主张的支持，便于研究成本与效果取舍。 | 历史论文的成本与准确率对照不自动适用于当前模型、硬件和中文材料。 |
| **RAGTruth**。[R15] | 提供检索增强生成中的人工标注幻觉语料，包含不支持或矛盾内容。 | 有检索仍会出错；该数据的任务分布也不等于本项目全部输出。 |
| **SelfCheckGPT**。[R16] | 多次采样的分歧可以作为黑盒风险信号。 | 一致性不等于独立证据；多个样本可能稳定地产生同一个错误，不能当作最终事实裁决。 |

### 4.5 建议的依据流程

1. 把重要回答拆成可核查主张，包括数量、版本、时间、因果与完成状态。
2. 为每条主张保留来源及相关片段；代码行为优先绑定实际代码与执行结果，文献结论绑定原论文及版本。
3. 分别判断相关、支持、矛盾、未知，不把“搜到类似标题”当作支持。
4. 遇到不足或冲突时补查、限缩陈述或拒绝作结论；不靠补造引用和数字填满答案。
5. 只有有明确来源、作用域及更新依据的信息才进入候选记忆；推断与事实分开，执行声明须有相应执行证据。
6. 保存失败与误报样本；判断器经过人工标注校准后再参与放行，并保留无法完成检查的状态。

## 5. 组合建议与可复现实验

### 5.1 阅读与试验优先级

本表是机制层面的采用建议，不是跨论文跑分排名，也不是现有功能升级声明。

| 顺序 | 优先研究 | 原因 | 第一项需要证明的事 |
|---|---|---|---|
| **1** | LongMemEval + HaluMem；任务与事实分开记录。[R2][R4] | 先知道会忘什么、会错存什么，再选存储。 | 能正确恢复未完成目标，并在事实被更正后选用新状态。 |
| **2** | verification-before-completion + 可执行的完成门槛。[P9][P12] | 直接针对虚假完成、漏项与没有证据的成功声明。 | 没有完成关键动作或验证失败时，不能被标成整体完成；真实阻塞可如实退出。 |
| **3** | 一种记忆后端，而不是同时堆八套系统。[P1]–[P8] | 对比作用域、来源、更新、删除与操作成本。 | 证据可回查，删除/更正有效，跨项目不串线，写入可见时序明确。 |
| **4** | claim-to-evidence 流程 + MiniCheck/Ragas 作为辅助评价。[P15][P16] | 同时检查“有无支持”和判断器本身的误报漏报。 | 能识别无支持、相互矛盾与检查未完成，而不是一律生成有把握的答案。 |
| **5** | Reflexion、后台 reflection 与程序性经验。[R10][P6][P8] | 经验复用应建立在反馈可靠和记忆可审计之上。 | 经验在新任务中仍有帮助，且没有将单次失败的错误解释固化为全局规则。 |

选型分支建议：

- **已有宿主、希望低侵入**：先比较 LangMem 的可组合接口、Mem0 的开源实现，以及 MemOS 适配中的作用域与有界召回设计；不要默认它们可互换或当前均兼容目标宿主。
- **重时间关系与来源链**：重点研究 Graphiti 与 Hindsight；只有真实需求需要图时再承担图建模与运维成本。
- **偏好可读可审计的本地源**：研究 EverOS 的 Markdown 源与派生索引，同时测试有损合并、索引重建和删除。
- **准备采用完整 stateful agent 平台**：再评估 Letta Code；它与给现有 agent 挂一个记忆组件的工程范围不同。

针对现有插件做后续实验时，应先核对已经存在的状态、压缩、证据与恢复机制，填补缺口；本报告不建议仅因读到新项目就另建整套系统。

### 5.2 最小记录结构：建议，不是当前实现

| 记录 | 建议保存的最少内容 |
|---|---|
| 记忆项 | ID、类型、用户/项目/会话作用域、内容、原始来源、事件时间与记录时间、推断标记、更新/失效关系。 |
| 任务项 | 用户要求、关键验收项、对应产物、进行状态、未完成项、真实阻塞与下一步。 |
| 验证项 | 被验证的声明、命令或检查方式、实际输入/环境、产物标识、结果、时间、证据位置、覆盖与未覆盖范围。 |
| 经验项 | 触发条件、行动、可观察结果、来源任务、反例、最后验证版本及淘汰条件。 |

置信度若只是模型自报，不当成校准概率；优先记录具体依据及是否有矛盾。凭证、私人原文和其他不应持久化的信息，不因为有来源字段就自动进入长期记忆。

### 5.3 建议的对照设计

1. **固定条件**：模型、工具权限、原始任务、代码/数据版本、检索与推理预算、技能/组件提交都记录；不把不同预算下的最高分拼接比较。
2. **单项消融**：从原基线分别加入记忆、完成门槛、依据检查，再评估组合；如需要归因交互效应，再扩展组合条件。
3. **保持留出**：调规则与调 prompt 的样本不算最终评估样本。保存失败样例、参数与每次运行记录；抽样复跑，避免一次展示冒充稳定通过率。
4. **检验验收器**：加入假通过、空测试、未接线、改后未复测、判断服务失效等情况；评价器不能被被测 agent 随意修改为更宽松条件。
5. **同时报告代价**：完成率、虚假完成、错答、拒答与成本/时延并列。通过无限拒答降低错误，或通过降低验收要求提高完成率，都不是质量提升。

### 5.4 小型测试包可以覆盖什么

| 路线 | 建议场景 | 观察指标 |
|---|---|---|
| 记忆 | 新旧事实冲突、否定与限定、同名实体、过去/当前/计划状态、跨会话恢复、跨用户隔离、删除后再查。 | 正确召回、陈旧命中、错误写入、遗漏、拒答质量、删除残留与成本。 |
| 完成 | 多条需求、隐藏边界、明确阻塞、预算中断、假数据占位、没有工具执行记录、旧验证结果。 | 实际关键要求完成率、虚假完成声明比例、正确阻塞报告、验证开销。 |
| 幻觉 | 无答案、矛盾材料、过期版本、相似但不对应的来源、引用不支持结论、检索/检查超时。 | 主张支持率、矛盾检出、引用正确性、回答覆盖率、误报/漏报及延迟。 |
| 三者联动 | 错误完成声明进入记忆，下一轮又被召回为“已验证”；外部指令进入经验后影响后续执行。 | 是否阻止错误升级为事实/规则；能否回溯来源、纠正或撤回，并恢复真实任务状态。 |

这些是待实验的场景设计，没有在本侧会话运行或计分。

## 6. 来源、固定版本与证据边界

### 6.1 项目快照与实际阅读深度

下列 **18 组项目候选**加上 **2 个迁移前入口**，共记录 20 个仓库快照。元数据与所列文件于 2026-10-30 经 GitHub CLI 读取；固定 SHA 仅说明读了哪个版本，不表示最新版效果或可直接部署。

| 编号 | 当前项目仓库 | 所查 SHA | 实际读到的主要材料 |
|---|---|---|---|
| [P1] | `mem0ai/mem0` | `26cdefb46600c0fa5953c4b5ee5003c125539fc4` | `README.md`；实现目录树。算法与托管/开源边界按 README 记录，没有复现指标。 |
| [P2] | `letta-ai/letta-code` | `a8900b882446d7aa99fedf2845d400743affd1b6` | `README.md`；memory 相关源码与测试路径清单。没有读完或运行 MemFS 实现。 |
| [P3] | `getzep/graphiti` | `72b5c59c06607e09ea855be61b6ff5a3446fc951` | `README.md`、`graphiti_core/edges.py` 的时间与来源字段。 |
| [P4] | `topoteretes/cognee` | `37f788bd287750e10d7610173e5332b3843f6ebd` | `README.md`；remember/recall/delete 等路径清单。 |
| [P5] | `langchain-ai/langmem` | `ae6f15fb76603fa2c86ad05f1ecb4a110fa8060b` | `README.md`，特别是示例存储的持久性说明。 |
| [P6] | `vectorize-io/hindsight` | `82109477af79f846ed4338e69d9848b5bbad00a5` | `README.md`；retain/recall 等实现路径清单；方法另核论文。 |
| [P7] | `MemTensor/MemOS` | `64388b50e2a15528bcdf032e65a1ac792bcf63ee` | `README.md`、`apps/memos-local-plugin/adapters/deepseek-harness/README.md`，及 adapter/测试路径清单。 |
| [P8] | `EverMind-AI/EverOS` | `5b0979b1b7f3a0cbe235756ff098515ec490753e` | `README.md`、`docs/reflection.md`；旧 EverMemOS 名称的重定向。 |
| [P9] | `obra/superpowers` | `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b` | `README.md`、`skills/verification-before-completion/SKILL.md`。 |
| [P10] | `open-gsd/gsd-core` | `67f661afc4760187740ca0b2e93381266c578169` | `README.md`；verifier、工作流与契约文档路径清单。更深文件读取失败，未计为已读。 |
| [P11] | `gastownhall/beads` | `e226083653b893998614df4225f73b6688ca9166` | `README.md`；由旧 `steveyegge/beads` 入口解析到当前仓库。 |
| [P12] | `OpenHands/software-agent-sdk` | `07e8c26ea404b9597bfdf1a10e8ad8e97b811839` | `README.md`、`examples/01_standalone_sdk/33_hooks/README.md`；状态、任务追踪与 hook 路径清单。 |
| [P13] | `AkariAsai/self-rag` | `1fcdc420e48f50a7d7ab1ece5494221b93252e99` | `README.md`；训练、反思 token 和推理入口说明。 |
| [P14] | `HuskyInSalt/CRAG` | `de7c2961ae624a1483a138c5798e1f6d0c4fb0e0` | `README.md`；评估器、知识处理与推理脚本路径。GitHub 元数据未给可识别 SPDX 许可，使用前需另核。 |
| [P15] | `Liyan06/MiniCheck` | `b58b9fa69acbd1015ec970fa65dd752413a053d2` | `README.md`；模型、单句检查与基准资料说明。 |
| [P16] | `vibrantlabsai/ragas` | `298b68274234c060deacab3cf5fb52aa3a20e885` | `README.md`、`docs/concepts/metrics/available_metrics/faithfulness.md`。 |
| [P17] | `guardrails-ai/guardrails` | `06d0ff2c5f9bcb493d976b76f885e37e41ce845d` | `README.md`，包括 validator 与远程服务迁移公告。 |
| [P18] | `NVIDIA-NeMo/Guardrails` | `866b46c04e93f902552fe21fbb851a78aeb28915` | `develop` 的 `README.md`、`nemoguardrails/library/hallucination/actions.py`。 |

迁移前入口：

- [L1] `letta-ai/letta`，`8816d3a8516893bfdc0fa14bfb1235226012e295`：当前 README 与很小的主分支目录树；README 明确说明源码已迁移，旧 V1 服务在历史分支。此仓库元数据并非 archived。
- [L2] `gsd-build/get-shit-done`，`bdcaab2c752d9a33a1a1ca9acf3a3c81fb991815`：GitHub 元数据为 archived，README 直接指向 GSD Core。

未被替换为旧教程描述的其他变化：EverMemOS → EverOS、`steveyegge/beads` → `gastownhall/beads`、`NVIDIA/NeMo-Guardrails` → `NVIDIA-NeMo/Guardrails`。这些是本次 API 返回的名称与重定向快照。

### 6.2 论文版本记录

下面 16 项的题名、首次发表/修订时间、版本与摘要，通过 arXiv 原始页面及 export API 复核。表内日期为**所查版本的更新日**；只核摘要与公开方法时，不宣称已做全文系统综述或实验复现。

| 编号 | 题名 / 研究简称 | 固定版本 | 更新日 |
|---|---|---|---|
| [R1] | Evaluating Very Long-Term Conversational Memory of LLM Agents / LoCoMo | `2402.17753v1` | 2024-02-27 |
| [R2] | LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory | `2410.10813v2` | 2025-03-04 |
| [R3] | Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions / MemoryAgentBench | `2507.05257v4` | 2026-06-28 |
| [R4] | HaluMem: Evaluating Hallucinations in Memory Systems of Agents | `2511.03506v3` | 2026-01-05 |
| [R5] | Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory | `2504.19413v1` | 2025-04-28 |
| [R6] | Hindsight is 20/20: Building Agent Memory that Retains, Recalls, and Reflects | `2512.12818v1` | 2025-12-14 |
| [R7] | Memory Injection Attacks on LLM Agents via Query-Only Interaction / MINJA | `2503.03704v5` | 2026-02-12 |
| [R8] | Self-Refine: Iterative Refinement with Self-Feedback | `2303.17651v2` | 2023-05-25 |
| [R9] | Large Language Models Cannot Self-Correct Reasoning Yet | `2310.01798v2` | 2024-03-14 |
| [R10] | Reflexion: Language Agents with Verbal Reinforcement Learning | `2303.11366v4` | 2023-10-10 |
| [R11] | SpecBench: Evaluating Specification-Level Reasoning for Software Engineering LLM Agents | `2605.30314v1` | 2026-05-28 |
| [R12] | Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection | `2310.11511v1` | 2023-10-17 |
| [R13] | Corrective Retrieval Augmented Generation | `2401.15884v3` | 2024-10-07 |
| [R14] | MiniCheck: Efficient Fact-Checking of LLMs on Grounding Documents | `2404.10774v2` | 2024-10-01 |
| [R15] | RAGTruth: A Hallucination Corpus for Developing Trustworthy Retrieval-Augmented Language Models | `2401.00396v2` | 2024-05-17 |
| [R16] | SelfCheckGPT: Zero-Resource Black-Box Hallucination Detection for Generative Large Language Models | `2303.08896v3` | 2023-10-11 |

工程文章：[E1] Anthropic，**Effective harnesses for long-running agents**，2025-11-26。用于记录工程机制，区别于论文评测。

### 6.3 本轮的验证边界

- **已做**：原始来源发现与对照、20 个仓库提交快照、上表所列正文阅读与部分源码核查、16 项论文元数据/摘要核对、研究文档编辑和引用结构检查。
- **未做**：安装候选、执行所查技能/脚本、运行模型对照、测 DSH 兼容、复现漏洞或为某个候选作性能背书。
- **访问说明**：本地网络命令仅设置本进程的 `HTTP_PROXY / HTTPS_PROXY / ALL_PROXY`，使用用户现有 `127.0.0.1:7897`；没有修改系统代理。后段代理连接失败，窄范围重试仍失败，故未将 GSD 深层 verifier/guide、Letta constraints 与 OpenHands 示例脚本正文计入已读证据。
- **搜索纠错**：相似标题与 ID 不一致的结果已剔除。例如 SpecBench 以实际原始题名和 RFC 规格研究内容记录，不借用其他摘要中的“全面完成/偷懒”指标；未将误命中的论文充当研究依据。
- **效果边界**：README 的宣传、作者报告、源码实现与独立复现分别处理；代码路径存在只说明可定位，不能当成已经审完该模块。

[P1]: https://github.com/mem0ai/mem0/tree/26cdefb46600c0fa5953c4b5ee5003c125539fc4
[P2]: https://github.com/letta-ai/letta-code/tree/a8900b882446d7aa99fedf2845d400743affd1b6
[P3]: https://github.com/getzep/graphiti/tree/72b5c59c06607e09ea855be61b6ff5a3446fc951
[P4]: https://github.com/topoteretes/cognee/tree/37f788bd287750e10d7610173e5332b3843f6ebd
[P5]: https://github.com/langchain-ai/langmem/tree/ae6f15fb76603fa2c86ad05f1ecb4a110fa8060b
[P6]: https://github.com/vectorize-io/hindsight/tree/82109477af79f846ed4338e69d9848b5bbad00a5
[P7]: https://github.com/MemTensor/MemOS/tree/64388b50e2a15528bcdf032e65a1ac792bcf63ee
[P8]: https://github.com/EverMind-AI/EverOS/tree/5b0979b1b7f3a0cbe235756ff098515ec490753e
[P9]: https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b
[P10]: https://github.com/open-gsd/gsd-core/tree/67f661afc4760187740ca0b2e93381266c578169
[P11]: https://github.com/gastownhall/beads/tree/e226083653b893998614df4225f73b6688ca9166
[P12]: https://github.com/OpenHands/software-agent-sdk/tree/07e8c26ea404b9597bfdf1a10e8ad8e97b811839
[P13]: https://github.com/AkariAsai/self-rag/tree/1fcdc420e48f50a7d7ab1ece5494221b93252e99
[P14]: https://github.com/HuskyInSalt/CRAG/tree/de7c2961ae624a1483a138c5798e1f6d0c4fb0e0
[P15]: https://github.com/Liyan06/MiniCheck/tree/b58b9fa69acbd1015ec970fa65dd752413a053d2
[P16]: https://github.com/vibrantlabsai/ragas/tree/298b68274234c060deacab3cf5fb52aa3a20e885
[P17]: https://github.com/guardrails-ai/guardrails/tree/06d0ff2c5f9bcb493d976b76f885e37e41ce845d
[P18]: https://github.com/NVIDIA-NeMo/Guardrails/tree/866b46c04e93f902552fe21fbb851a78aeb28915
[L1]: https://github.com/letta-ai/letta/blob/8816d3a8516893bfdc0fa14bfb1235226012e295/README.md
[L2]: https://github.com/gsd-build/get-shit-done/blob/bdcaab2c752d9a33a1a1ca9acf3a3c81fb991815/README.md
[R1]: https://arxiv.org/abs/2402.17753v1
[R2]: https://arxiv.org/abs/2410.10813v2
[R3]: https://arxiv.org/abs/2507.05257v4
[R4]: https://arxiv.org/abs/2511.03506v3
[R5]: https://arxiv.org/abs/2504.19413v1
[R6]: https://arxiv.org/abs/2512.12818v1
[R7]: https://arxiv.org/abs/2503.03704v5
[R8]: https://arxiv.org/abs/2303.17651v2
[R9]: https://arxiv.org/abs/2310.01798v2
[R10]: https://arxiv.org/abs/2303.11366v4
[R11]: https://arxiv.org/abs/2605.30314v1
[R12]: https://arxiv.org/abs/2310.11511v1
[R13]: https://arxiv.org/abs/2401.15884v3
[R14]: https://arxiv.org/abs/2404.10774v2
[R15]: https://arxiv.org/abs/2401.00396v2
[R16]: https://arxiv.org/abs/2303.08896v3
[E1]: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
