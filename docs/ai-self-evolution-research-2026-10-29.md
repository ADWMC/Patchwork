# AI 自主进化、代码质量与 Harness 优化调研

> 实施索引（2026-10-30）：采用项、实际接线、隔离宿主验证与剩余边界见[统一融合执行方案](upgrade/2026-10-30-integration.md)。本文保留研究或历史审计的原始范围，不把建议与历史数字改写成当前能力。

- 调研日期：2026-10-29。
- 范围：近期论文、作者项目页、社区开源实现与问题单，重点关注类似 SoL-Pi 的编码 Agent 运行时优化。
- 证据边界：文献与公开仓库核查，未在本项目复现论文实验。论文效果为作者报告，不代表 Patchwork 已取得相同收益。
- 本文性质：研究记录与实验建议，不是当前功能实现声明。主线升级方案见 [2026-10-29 升级方案](upgrade/2026-10-29/README.md)。
- 专题延伸：[UI、UX、README、更新日志与编码技能调研](agent-skills-ui-ux-writing-coding-research-2026-10-29.md)，包含源码机制、研究结果、社区问题与采用建议。
- 新专题：[Agent 记忆、防提前收工与防幻觉](agent-memory-completion-grounding-research-2026-10-30.md)（2026-10-30），区分长期记忆、完成验收与事实依据，记录项目快照、研究证据和待验证实验。
- 版本提示：本次复核的 Self-Harness 为 arXiv v3（2026-08-20 修订），SlopCodeBench 为 v2（2026-05-07 修订）。arXiv 条目不自动等于同行评审结论，工程博客也不等于严格对照实验。

## 1. 结论

对 DSH/Patchwork 最值得优先研究的是 **有验证、有淘汰机制的 Harness 自进化**：

> 从真实失败中提出有限范围的改动，在固定评价条件及后续任务中检验，通过后保存为可回退版本，无效经验及时淘汰。

Harness 指模型外部的运行系统，包括工具、上下文、记忆、技能、执行流程和验证机制。Self-Harness、Meta-Harness 与 Harness² 都为这条路线提供了直接参考。[1][2][3]

建议阅读与实验顺序：

1. **Self-Harness**：建立最小、受控的改进闭环。
2. **GEPA / optimize_anything**：实现候选搜索、诊断反馈与选择。
3. **SlopCodeBench**：补足连续需求变化下的代码质量评价。
4. **Meta-Harness**：完善实验档案与轨迹诊断。
5. **Harness²**：再探索任务内适配与跨任务学习。

这是本次调研的工程判断，不是论文之间的统一排行榜。不同模型、任务、预算与评测版本不能直接比较。

## 2. “自主进化”需要分清的层次

| 层次 | 改变什么 | 如何证明有效 | 代表工作 |
|---|---|---|---|
| 当前任务内修正 | 本次计划、代码、工具选择与上下文 | 本任务的执行反馈和验收 | Harness² 的任务内循环 |
| 跨任务 Harness 演化 | 技能、提示、工具实现、配置、工作流 | 后续任务与留出任务上的对照结果 | Self-Harness、Meta-Harness、GEPA |
| 模型与 Harness 共同优化 | 模型参数以及运行系统 | 训练与 Harness 各自贡献、联合评测 | Self-HPO |
| 优化器自身演化 | 负责生成改进的元 Agent | 后续搜索效率、任务表现与稳定性 | Hyperagents |

多写一份复盘、增加一条规则或保存一段记忆，只能证明产生了候选经验；实际行为改善需要独立检验。[1][2][5][6][9]

## 3. 近期重点研究

### 3.1 Self-Harness — 2026-06

**核心方法：** 固定模型与评测器，从运行轨迹挖掘弱点，生成有限范围的 Harness 修改，通过回归验证后接纳。[1]

**对本项目的启发：**

- 可以围绕现有模型 API 进行实验，先不涉及权重训练。
- 每个候选应绑定具体失败、预期作用、修改范围和回归结果。
- 评价器与被优化代码需要明确边界，避免候选通过改写评价标准获得虚假提升。

**边界：** 论文与仓库可能随版本更新改变结果。复现实验应锁定 commit、模型、任务集及评测器，不把不同版本数字混在一起。

来源：[论文](https://arxiv.org/abs/2606.09498)；[官方仓库 qzzqzzb/Self-Harness](https://github.com/qzzqzzb/Self-Harness)。

### 3.2 Harness² — 2026-10-09

**核心方法：** 两层循环。任务内执行“提议—试跑—组合”；任务结束后保留有证据支持的经验，服务后续任务。模型权重保持不变。[2]

**对本项目的启发：**

- 研究按任务适配的工具指导、技能选择和执行策略。
- 区分临时适配与持久经验，防止单次任务的特殊条件变成全局规则。
- 经验是否有效，需要在之后的任务中继续观察。

**边界：** 没有标准答案时，反馈可靠性本身就是研究问题，不能把 Agent 自评当作最终正确性证明。

来源：[论文](https://arxiv.org/abs/2610.14224)；[官方仓库 google-research/harness2](https://github.com/google-research/harness2)。

### 3.3 Meta-Harness — 2026-03

**核心方法：** 优化器读取历代候选源码、分数和完整执行轨迹，自主搜索 Harness 代码。[3]

**对本项目的启发：**

- 实验档案需要同时保留“修改了什么”和“为什么有效或失败”。
- 总分之外保留具体失败任务、工具结果与诊断反馈。
- 在扩展搜索规模前，先建立可重放的样本与候选版本管理。

来源：[论文](https://arxiv.org/abs/2603.28052)；[官方仓库 stanford-iris-lab/meta-harness](https://github.com/stanford-iris-lab/meta-harness)。

### 3.4 GEPA / optimize_anything — 2025–2026

**核心方法：** 根据评分及详细诊断反馈演化候选。后续通用化工作将优化对象扩展到代码、配置和 Agent 架构等文本化产物，并维护不同任务上的优势候选。[4]

**对本项目的启发：**

- 很适合搭建小规模候选优化平台。
- 优先选择一个可评价机制，例如工具参数生成、验证命令选择或技能检索。
- 反馈应包含失败原因及轨迹，避免只返回一个总分。
- 同时保留质量、成本或不同任务类型上的优势候选，避免过早只剩一个版本。

**边界：** 优化结果受评价器和任务分布约束；搜索时表现好，不代表新任务也会改善。

来源：[GEPA 论文](https://arxiv.org/abs/2507.19457)；[optimize_anything 后续工作](https://arxiv.org/abs/2605.19633)；[官方仓库 gepa-ai/gepa](https://github.com/gepa-ai/gepa)。

### 3.5 Self-HPO — 2026-10-16

**核心方法：** 交替优化 Harness 与模型策略：分析失败、修改 Harness，再在新 Harness 下进行强化学习。[5]

**对本项目的启发：**

- 将模型能力和外部运行策略之间的相互作用纳入实验设计。
- 纯 API 插件可先借鉴 Harness 候选生成与评价部分。
- 如未来引入训练，需要分别评价固定模型下的 Harness 收益、固定 Harness 下的训练收益与联合收益。

**边界：** 完整方法需要训练资源。论文中的联合提升不能直接归因于插件或提示词修改。

来源：[论文](https://arxiv.org/abs/2610.22791)；[作者项目页](https://www.cs.virginia.edu/~tqf5qb/blog/self-hpo/)。

### 3.6 Hyperagents — 2026-03-24

**核心方法：** 允许系统修改任务 Agent，也修改负责生成下一轮改进的元 Agent。[6]

**对本项目的启发：** 在实验和评价底座成熟后，可以研究优化器的搜索策略、反思方式与候选生成过程。

**边界：** 优化目标与搜索过程同时变化，归因和稳定性要求更高，不宜作为第一版实现起点。

来源：[Meta 官方研究页](https://ai.meta.com/research/publications/hyperagents)。

### 3.7 基础路线：DGM 与 SICA — 2025

DGM、SICA 展示了 Agent 修改自身代码、用编码任务评价、保存候选并继续演化的路线。DGM 维护多条演化分支，使暂时不占优的版本仍可能成为后续改进的起点。[7]

**对本项目的启发：** 候选管理采用版本档案；保留失败原因和有价值分支，不能只在一个版本上反复覆盖。

来源：[DGM 论文](https://arxiv.org/abs/2505.22954)；[SICA 论文](https://arxiv.org/abs/2504.15228)。

## 4. 从 SoL-Pi 学什么

SoL-Pi 的参考价值包括四个效率机制，也包括候选筛选、实验评价与保留过程。官方项目页描述了从大量方向筛选到四项机制的流程，并明确将效率与能力保持放在一起评价；过程也包含人工方向判断与实现整理。[8]

对 Patchwork 的启发：

- 机制候选先实验，不能因“理论上省 token”就默认启用。
- 同时报告任务完成、失败、成本、延迟与适用场景。
- 区分反事实估算、实际 provider usage 和真实对照实验。
- 按任务分布分析收益与退化，保留失败样本。
- 描述自治程度时，写清人工参与环节。

官方结果中部分效率指标改善，并不意味着每个任务集的完成能力同步提升。因此不能只展示成本下降或输出变短。[8]

来源：[SoL-Pi 官方项目页](https://nvlabs.github.io/SoL-Pi/index.html)；[官方仓库](https://github.com/NVlabs/SoL-Pi)。

## 5. AI 如何把代码写好

### 5.1 将“能通过当前测试”与“能承受后续变化”分别评价

SlopCodeBench 让 Agent 连续应对变化的需求，扩展此前自己写的代码，观察重复代码与复杂度集中等结构退化。论文中的提示词干预改善了初始质量，但没有阻止后续退化。[10]

本项目的评价应包含：

- 功能验收与错误路径。
- 连续两到三轮需求扩展后的正确性。
- 重复实现、职责集中与接口变动范围。
- 接手修改所需的理解成本与回归影响。

这些指标是建议评价维度，不是本项目已经测得的结果。

来源：[SlopCodeBench 论文](https://arxiv.org/abs/2603.24755)；[官方仓库](https://github.com/SprocketLab/slop-code-bench)。

### 5.2 用后续任务验证“经验是否真的生效”

2026-10-26 的研究 How Do Coding-Agent Harnesses Self-Evolve? 检查会话复盘产生的修改，并在后续任务中对照。其结果提示：复盘规则不一定减少目标问题，部分修改还会给无关任务增加工作量。样本有限，不应泛化为所有自进化方法无效。[9]

工程上应分别验收：

1. 是否生成了候选经验。
2. 后续任务是否实际加载并执行了它。
3. 目标问题是否减少。
4. 是否引入额外工作、质量退化或其他副作用。

来源：[论文](https://arxiv.org/abs/2610.34938)。

### 5.3 让完成声明有真实执行依据

长任务工程实践支持把交付要求转成可验证行为，分步实现，并通过真实运行检查结果。独立评估者可以沿页面、API 和数据库路径发现生成者自评遗漏的缺陷，但评价器同样需要校准，并非每项任务都值得承担相同评审成本。[11]

建议流程：

- 修改前明确交付行为、接口边界、影响范围和验收方式。
- 沿现有结构完成最小可验证改动。
- 根据变更范围选择单元、集成、端到端或真实宿主验证。
- 保存命令、退出状态、关键输出和对应版本。
- 对复杂或高影响变更增加独立评估；最终回到可执行证据。

来源：[Anthropic：Effective harnesses for long-running agents](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents)；[Harness design for long-running application development](https://www.anthropic.com/research/harness-design-long-running-apps)。

## 6. 两条配套路线

### ACE：结构化积累经验

Agentic Context Engineering 使用结构化、增量更新的 playbook 积累上下文经验，减少反复整体重写造成的信息丢失。[12]

适合研究项目技能与经验如何组织，但仍需后续任务评价，不能把记忆条目增加当作能力增长。

来源：[论文](https://arxiv.org/abs/2510.04618)。

### RLM：改进长上下文访问

Recursive Language Models 将长材料置于可查询的外部环境，让模型通过程序查找、拆解并递归处理。[13]

适合研究大型仓库和长日志的访问方式。它主要改变推理时的信息处理，不直接证明跨任务学习。

来源：[论文](https://arxiv.org/abs/2512.24601)。

## 7. 建议的最小研究原型

以下为基于文献的工程提案，尚未执行。

### 7.1 实验闭环

```text
真实任务与失败轨迹
        ↓
提出单一、有限范围的候选改动
        ↓
固定模型与环境，比较原版和候选
        ↓
功能质量 + 后续维护质量 + 成本/延迟
        ↓
留出任务验证
        ↓
接纳为可回退版本 / 淘汰并记录原因
        ↓
后续任务继续观察
```

### 7.2 每个候选的最小记录

| 字段 | 用途 |
|---|---|
| candidate_id / parent_id | 版本和演化关系 |
| source_failure_ids | 产生改动的具体失败证据 |
| hypothesis / change_scope | 预期作用及修改范围 |
| model / harness_commit / environment | 固定实验条件 |
| evaluation_set / held_out_set | 区分优化样本和新任务 |
| quality / maintenance / cost / latency | 分别记录各维度结果 |
| regressions / side_effects | 保留退化与额外工作 |
| decision / rollback_target | 接纳、淘汰及回退依据 |

### 7.3 首批候选方向

1. 工具参数生成与错误后的纠正。
2. 验证命令的选择和证据关联。
3. 项目技能检索与按需加载。
4. 大输出的保真收纳和召回。
5. 计划边界与上下文维护时机。

建议每轮只优化一个方向，避免同时修改提示词、工具、记忆和评价器后无法归因。

### 7.4 评价原则

- 同一模型、相同起始工作区和相同预算，比较原版与候选。
- 先满足预先约定的正确性和质量门槛，再比较效率。
- 评价集包含失败样本、无关任务和后续需求扩展。
- 单独标注真实调用、录制回放、合成测试与反事实估算。
- 运行权限、凭据和评价数据边界由宿主控制，候选不能自行扩大。
- 保存原始轨迹和版本，确保结论可复核。
- 经验有适用范围、启用证据与淘汰条件，避免永久累积无效规则。

## 8. 来源索引

以下均为论文、作者项目页、研究机构文章或官方项目仓库。实际实施前应锁定论文版本、代码 commit 与数据集版本。

| 编号 | 资料 |
|---|---|
| [1] | Self-Harness — https://arxiv.org/abs/2606.09498 |
| [2] | Harness² — https://arxiv.org/abs/2610.14224 |
| [3] | Meta-Harness — https://arxiv.org/abs/2603.28052 |
| [4] | GEPA — https://arxiv.org/abs/2507.19457；optimize_anything — https://arxiv.org/abs/2605.19633 |
| [5] | Self-HPO — https://arxiv.org/abs/2610.22791 |
| [6] | Hyperagents — https://ai.meta.com/research/publications/hyperagents |
| [7] | DGM — https://arxiv.org/abs/2505.22954；SICA — https://arxiv.org/abs/2504.15228 |
| [8] | SoL-Pi — https://nvlabs.github.io/SoL-Pi/index.html |
| [9] | How Do Coding-Agent Harnesses Self-Evolve? — https://arxiv.org/abs/2610.34938 |
| [10] | SlopCodeBench — https://arxiv.org/abs/2603.24755 |
| [11] | Anthropic long-running agent / application harness articles，链接见第 5.3 节 |
| [12] | Agentic Context Engineering — https://arxiv.org/abs/2510.04618 |
| [13] | Recursive Language Models — https://arxiv.org/abs/2512.24601 |

## 9. 社区项目与实际工程经验

补查日期：2026-10-29。以下依据项目维护者文档、GitHub 源码和具体问题单；已用 GitHub API 核对仓库状态与所列提交。没有安装、运行这些项目，也没有执行自动提交、回退或真实模型调用。这里的“可借鉴”是工程判断，不是本项目已测出的收益。

### 9.1 先区分三类“进化”

- **经验和技能积累**：把执行记录整理成规则、记忆或技能，改变后续提供给模型的上下文。
- **Harness / 工作流改进**：修改工具、执行流程、上下文管理和验证步骤。
- **模型训练实验**：修改训练代码并重新训练、比较模型指标。

这些机制不能混称为模型自动变聪明。尤其要区分“生成了更好的技能文本”“文本评分上升”与“真实工具调用、代码测试及后续维护任务表现改善”。

### 9.2 候选项目对比

| 项目 | 实际机制与证据 | 可以借鉴什么 | 主要边界 |
|---|---|---|---|
| **pi-autoresearch** | Pi 扩展提供实验执行、指标解析、结果记录及保留/回退机制，存在检查失败时拒绝保留的代码分支。[C1] | 小范围候选、明确指标、实验档案、失败后保留诊断信息。 | 正确性检查脚本是可选的；指标变好不自动等于代码整体变好。 |
| **Superpowers** | 以技能组织需求澄清、计划、TDD、根因调试、审查及完成前验证。[C2] | 明确验收条件，按证据推进，实现与验证闭环。 | 属于工作流指导，不是自训练；文档描述不能替代受控效果评测。 |
| **ECC / continuous-learning-v2** | 用 hooks 采集观察，形成带证据、置信度和项目范围的原子经验，再聚合为技能。[C3] | 经验溯源、项目隔离、纠正与降权、按需提取。 | 捕获、后台分析、生成技能、实际加载是不同环节；每环都要验收。 |
| **GSD Pi** | 当前核查的 open-gsd/gsd-pi 将计划、执行、验证与项目状态保存结合起来。[C4] | 持久化任务状态、上下文恢复、验证证据和任务推进。 | 主要解决工程执行组织；不能据此宣称具备自进化能力。 |
| **Hermes Agent Self-Evolution** | 提供技能优化、数据划分和候选比较入口；但所查入口采用文本预测与代理评分。[C5] | 候选技能版本、训练/验证/留出集、约束检查框架。 | 当前入口的分数不是完整 Hermes 工具执行效果，详见 9.4。 |
| **Karpathy autoresearch** | 围绕有限训练代码修改、固定训练时间及验证指标，循环保留或淘汰实验。[C6] | 固定预算、限制修改面、客观反馈、可追踪结果。 | 原始任务是模型训练实验，不是通用编码 Agent 的现成升级包。 |

### 9.3 最贴近落地的三个方向

**A. pi-autoresearch：将“我改进了”变成可检查的实验记录。**

核查入口是 `extensions/pi-autoresearch/index.ts`。实验执行器读取命令结果与指标；结果记录器区分保留、淘汰、崩溃和检查失败。若存在 `.auto/checks.sh`，通过基准运行后会执行它；记录器也会拒绝把刚刚检查失败的运行标为保留。[C1]

两个限制需要一起读：没有检查脚本时，不能把这个门槛当作已有正确性保障；基于运行波动的置信度只提供提示，不会自动淘汰，也不是严格显著性检验。本项目若借鉴，应让宿主掌握测试和接纳条件，而不是把所有决定权交给候选。

此外，该实现会在保留结果时暂存并提交 Git 改动，在淘汰等情况下回退代码；诊断档案可以继续保留。因此它适合隔离实验目录，不能在夹杂其他工作的工作区直接试跑。本次只读源码，没有执行这些操作。[C1]

**B. Superpowers：提升代码质量靠流程证据，而非更长的提示词。**

值得参考的是：开始前明确行为与验收条件；修复时定位原因；实现后跑与改动相关的验证；审查结果决定是否继续。维护者把这些步骤组织成可复用技能。[C2]

对本项目的建议是按改动规模选择流程：简单修复保留直接验证，跨模块改造补设计与审查。不要仅因装了技能就假定编码能力提高，应比较任务通过率、返工和后续修改表现。这里没有独立验证其效果，也不把项目热度作为质量证据。

**C. ECC：学习对象应该是小而有来源的经验。**

v2 文档描述的经验包含触发条件、行为、来源与置信度，并区分项目范围和全局范围。适合借鉴的是“何时适用、证据来自哪里、用户纠正后如何降权”，而不是把所有历史对话永久塞进系统提示。[C3]

特别注意：该文档列出的后台 observer 默认关闭；原生 Windows 的 Git Bash / MSYS2 路径还存在后台进程随 hook 退出而终止的问题，文档要求该观察器路径使用 WSL2、Linux 或 macOS。这个限制针对其后台分析链路，不能泛化为整个 ECC 在 Windows 均不可用。[C3]

### 9.4 源码和问题单揭示的三个坑

#### 1. Hermes：评分器存在，不等于实际优化入口用了它

核查的调用关系：

1. `evolution/skills/skill_module.py` 中的技能模块使用 DSPy 文本预测器，将技能说明与任务输入转换为输出文本；该路径没有运行完整 Hermes 工具轨迹。
2. `evolution/core/fitness.py` 同时提供较丰富的 LLM 评审类和一个快速指标函数。
3. 实际 `evolution/skills/evolve_skill.py` 的 GEPA、备用优化器及留出集比较使用的是 `skill_fitness_metric`。
4. 所查指标函数通过预期文本与输出的词集合重合度形成代理分数，并限制到有效范围。[C5]

**结论：这个入口的技能分数上升，不能证明真实编码、工具选择或仓库测试变好。** 有留出集是有价值的结构，但留出集仍然沿用代理评分。若借鉴，优先替换评价执行器：实际启动隔离宿主，收集工具轨迹、测试结果与产物，再讨论优化算法。

#### 2. ECC：hook 有日志，不等于经验已进入模型

公开问题单 [#3260](https://github.com/affaan-m/ECC/issues/3260) 报告 **continuous-learning v1** 将学习提示写到 stderr，提示出现在 hook 附件里却没有作为模型上下文送达，导致经验提取未发生。核查时该问题仍为 open；这是报告者给出的复现与诊断，本次未独立复现。[C7]

不能据此断言当前 v2 全部失效，也不能把这一 v1 问题与上一节的 Windows 后台进程问题合并为一个缺陷。它们共同提示的验收方式是逐段检查：

```text
事件发生 → 观察记录落地 → 分析器实际运行 → 经验生成
       → 在相关任务检索/加载 → 对执行结果产生可验证影响
```

只有安装成功、配置文件存在或 hook 打印日志，不足以证明整条学习链路工作。

#### 3. GSD：社区资料会指向已经归档的实现

本次 GitHub API 核查中，`gsd-build/get-shit-done` 与 `gsd-build/gsd-2` 都标为 archived。另行核查的 `open-gsd/gsd-pi` 仍未归档，其 README 描述计划、实施、验证和持久化项目状态，并提示 npm 包名迁移。[C4][C8]

因此做技术选型时要同时确认仓库状态、包名与版本，不能拿旧教程直接当作当前安装指南。这里记录仓库状态与当前实现，不据此推断项目组织沿革或兼容性。

### 9.5 对 Patchwork 的建议：组合机制，不照搬整套项目

优先组合 **Pi-autoresearch 的实验闭环 + Superpowers 的工程验证 + ECC 的经验溯源**；项目状态与上下文恢复参考 GSD。Hermes 的候选与数据划分框架可研究，但先补真实执行评价器。

这是基于上述公开机制的设计建议，尚未做项目内效果验证：

1. **先有基线和验收证据。** 选取项目真实任务，记录功能正确性、后续维护、成本与耗时；固定模型、预算、起始代码和测试条件。
2. **再收集候选经验。** 每条经验对应失败轨迹、触发范围和版本；先停留在候选状态，避免一次失败直接变成永久规则。
3. **一次只改一层。** 分别试工具说明、技能、检索或执行策略；先过正确性门槛，再比较成本与速度。
4. **用新任务决定是否接纳。** 在留出任务和后续需求上比较原版与候选；同时记录正向效果、退化、拒绝原因和回退目标。

建议界面展示可追溯证据：候选来源、原版/候选结果、使用的验证命令、失败项、接纳理由、版本与回退点。不要用“已学习 N 条”代替效果指标，也不要把代理文本分数命名为“编码能力提升”。

### 9.6 社区来源与版本快照

下面的提交链接用于固定本次核查内容；问题单和仓库归档状态是 2026-10-29 的在线快照，可能继续变化。远程技能文档在本次工作中只作为研究材料，没有安装或激活。

| 编号 | 一手来源与核查版本 |
|---|---|
| [C1] | [pi-autoresearch 源码](https://github.com/davebcn87/pi-autoresearch/blob/04b8a50dac7efe80ffc91648bd00ed9b022e24c2/extensions/pi-autoresearch/index.ts)，commit `04b8a50dac7efe80ffc91648bd00ed9b022e24c2`。 |
| [C2] | [Superpowers README](https://github.com/obra/superpowers/blob/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/README.md)，commit `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b`。 |
| [C3] | [ECC continuous-learning-v2 文档](https://github.com/affaan-m/ECC/blob/25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b/skills/continuous-learning-v2/SKILL.md)，commit `25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b`；文档内版本为 v2.1。 |
| [C4] | [GSD Pi README](https://github.com/open-gsd/gsd-pi/blob/e87c89292c626fd3f69614113d9a0d9d21f0ce33/README.md)，commit `e87c89292c626fd3f69614113d9a0d9d21f0ce33`。 |
| [C5] | Hermes Self-Evolution，commit `0a929e3aa20e15cf04dc7c28492a7d41a5139125`：[优化入口](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/evolution/skills/evolve_skill.py)、[技能执行模块](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/evolution/skills/skill_module.py)、[评分实现](https://github.com/NousResearch/hermes-agent-self-evolution/blob/0a929e3aa20e15cf04dc7c28492a7d41a5139125/evolution/core/fitness.py)。 |
| [C6] | [Karpathy autoresearch README](https://github.com/karpathy/autoresearch/blob/228791fb499afffb54b46200aca536f79142f117/README.md)，commit `228791fb499afffb54b46200aca536f79142f117`。 |
| [C7] | [ECC issue #3260](https://github.com/affaan-m/ECC/issues/3260)：v1 学习提示没有送达模型的用户报告；创建于 2026-09-29，本次核查时 open。 |
| [C8] | 归档状态核查：[get-shit-done 仓库 API](https://api.github.com/repos/gsd-build/get-shit-done)、[gsd-2 仓库 API](https://api.github.com/repos/gsd-build/gsd-2)、[GSD Pi 仓库 API](https://api.github.com/repos/open-gsd/gsd-pi)。 |
