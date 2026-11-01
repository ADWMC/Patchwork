# 去 AI 垃圾：技能、工程经验与研究证据

> 实施索引（2026-10-30）：采用项、实际接线、隔离宿主验证与剩余边界见[统一融合执行方案](upgrade/2026-10-30-integration.md)。本文保留研究或历史审计的原始范围，不把建议与历史数字改写成当前能力。

- 初次调研：2026-10-29；补充与整理：2026-10-30（Asia/Shanghai）。文件名保留初次调研日期。
- 本轮目标：扩充 UI/UX、写作和编码技能候选，重点检查去模板化、去空话、去冗余与质量验证。
- 方法：内置网页搜索 + 经现有 `127.0.0.1:7897` 代理运行 GitHub CLI，核查默认分支提交、技能正文、实现与具体问题记录。
- 边界：仅研究并维护调研文档；没有安装技能、执行其脚本或在当前产品代码上做清理。
- 前篇：[UI、UX、README、更新日志与编码技能调研](agent-skills-ui-ux-writing-coding-research-2026-10-29.md)。

## 1. 先定义要消除的质量问题

本报告将“AI 垃圾”作为用户提出的质量问题集合，不用它推断作者身份。判断依据是内容、行为与任务效果，不是检测器给出的 AI 概率。

| 对象 | 希望减少的问题 | 必须保留的内容 |
|---|---|---|
| 文案与文档 | 空话、重复结构、无来源的夸大、错误或失效的说明。 | 事实、数字、归属、限定条件、必要术语与可执行信息。 |
| UI 与 UX | 套模板、不匹配产品任务、装饰掩盖信息、状态缺失。 | 宿主规范、核心任务、真实数据与接口行为、无障碍。 |
| 代码 | 无用抽象、重复逻辑、死代码、无意义注释、遗漏验证。 | 公开契约、必要错误处理、安全边界、兼容性与有效测试。 |
| 技能本身 | 重复规则、过宽触发、只会检查词表、以自评分数代替效果。 | 适用范围、输入前提、行为证据、版本与撤回依据。 |

## 2. 新增候选与源码核查

### 2.1 写作与文档：四个候选，适用边界不同

| 候选 | 所查内容与价值 | 限制及采用意见 |
|---|---|---|
| **blader/humanizer** | 当前技能检查空泛铺垫、固定节奏、夸大、虚借权威和聊天残留；明确要求保留已有信息，不补造事实，并允许有实际作用的限定。[K1] | 值得作为编辑审查参考；它提供启发式，不是作者身份检测器，也没有在本项目得到效果验证。 |
| **op7418/Humanizer-zh** | 中文改写约束细化到事实、计划/完成状态、归因、范围、否定和文档结构；提供边界样例和结构检查脚本。[K2] | 与英文项目有来源关系，不能算独立验证；尤其值得借鉴保真约束，而不是把中文连接词都删掉。 |
| **hardikpandya/stop-slop** | 简短的表达规则和自评量表，针对空话、公式化结构和机械节奏。[K3] | 当前规则一律删除副词、被动句和破折号，要求句子有人的施事者。对技术说明、科学文稿和未知施事者情形过强；不宜照搬为统一门槛。 |
| **stephenturner/skill-deslop** | 对科学写作增加术语、语域、明确归因和引用方面的说明。[K4] | 仍保留多项强风格偏好。应保留必要的不确定性、学科惯例与非人的真实施事者；“看起来更自然”不是科学准确性证明。 |

后两项的采用限制是本报告对规则适用性的判断，不是已经测出的错误率。前两项也不能因为写了保护约束就假定每次执行都能遵守。

### 2.2 UI 与 UX：再补三组不同用途的资料

| 候选 | 所查机制 | 采用意见 |
|---|---|---|
| **TasteSkill：taste / redesign / output** | taste 提供视觉与动效偏好；redesign 检查现有界面并要求沿用技术栈、保持功能；output 检查交付是否遗漏或充满占位。[K9] | 可以选取状态覆盖、依赖核对和局部改进方法。默认高视觉变化、动效与字体/颜色禁令属于风格选择，不适合不加判断地用于宿主插件。完整输出也不应变成无关扩写。 |
| **Scoville UI** | 从既有框架、设计系统和组件归属出发，区分源码、渲染、几何和交互证据。[K10] | 适合参考“有什么证据才能声称验证过”。所查文档注明其宿主测试范围，不能当成已验证兼容 DSH。 |
| **Brian Lovin：rams** | 对界面源码做视觉与无障碍检查，包含控件名称、键盘/焦点和状态项。[K5] | 适合作为具体检查清单；源码规则可能漏报或误报，不能代替浏览器和实际交互。 |

**TasteSkill 的一个具体冲突**：所查 taste 入口设置偏高的视觉变化和动效默认值，禁止某些字体、配色与布局，并默认某些 React/Next 架构。对已经有完整 tokens、布局和框架的插件，这些不是中立的“去垃圾规则”。优先采用 redesign 的保留功能与原技术栈原则，再选与当前任务相符的规则。[K9]

### 2.3 代码与工程质量：从提示词走向可核对的工具

| 候选 | 所查机制 | 采用意见 |
|---|---|---|
| **Anthropic code-simplifier / Sentry 同名技能** | 强调保持行为、处理最近改动、可读性优先于极短代码；Sentry 明确注明源自 Anthropic。[K6][K7] | 可以参考范围和行为约束。两份实现有同源关系，不能当两组效果证据；内置 ES module、函数等偏好还需服从项目约定。 |
| **Brian Lovin：deslop** | 短流程：检查分支差异，关注多余注释、不适当的防御式代码、类型逃逸和风格不一致。[K5] | 适合差异内清理建议，但基准分支不能永远硬编码为 main；删 try/catch 或检查前必须确认错误边界与调用前提。 |
| **Brian Lovin：knip** | 先识别项目和配置入口，再处理未使用文件、依赖和导出；明确区分跨文件发现和文件内 lint。[K5] | 比“看到未使用就删”更可取。框架入口、动态加载和插件注册必须纳入配置；本轮未安装或运行 Knip。 |
| **hellozheat/no-more-slop** | 代码技能附带 Python 扫描器，输出表面模式与结构两类分数，并比较阈值。[K11] | 比纯自评多了可重复计算的部分，但分数来自规则权重，不是校准过的质量或 AI 概率。 |
| **peteromallet/desloppify** | Harness 结合机械检测、主观评审、任务队列和持续状态；技能文档分别描述机械与主观分数。[K12] | 值得研究有定位的发现与修复记录。采用前要验证检测器、评分一致性和实际行为，不能只追目标分。 |
| **millionco/deslop-js** | 所查入口解析源文件、构建依赖图；工具检测未使用项、循环与重复，并区分置信级别。[K13] | 适合作为静态证据来源。解析入口、框架和路径不对时可能产生大批误报，不能一键把报告变成删除清单。 |
| **Matt Pocock：架构改进 / TDD** | 架构技能从近期变更和模块接口负担出发；TDD 强调通过公开接口验证行为，按小切片推进。[K8] | 对“多套几层抽象”和测试耦合实现有参考价值。其固定术语、提问和确认流程属于作者工作方式，不应全局强加。 |
| **Sentry：find-bugs / blog-writing-guide** | 分别提供差异审查与证据要求，以及技术文章的读者结构、可运行代码和避免夸大的要求。[K7] | 适合补充“清理后是否正确”和“宣传是否有依据”。品牌语气、营销与 SEO 规则不应直接迁入别的项目。 |

### 2.4 三个需要警惕的“去垃圾指标”

1. **禁用词命中数。** 可以提示重复措辞，但不能判断该词在当前文体是否必要。删除限定词可能改变事实强度。
2. **代码 slop 分。** no-more-slop 的所查实现对命中项权重求和并封顶，再与阈值比较；双分通过只是满足这些规则，不证明行为正确。[K11]
3. **综合健康分。** Desloppify 的所查评分代码将主观评分池权重设为 `0.75`，机械部分为其余 `0.25`；这是评分体系的设计，不表示每个任务都固定这样分配，也不是独立验证的代码质量标尺。[K12]

建议始终同时保存具体发现、文件位置、适用前提、原始验证与改动结果。分数用于找线索，不作为唯一接纳标准。

### 2.5 10 月 30 日再补两个候选：保护作者声音与分语域编辑

| 候选 | 核查到的机制 | 局限与采用意见 |
|---|---|---|
| **kjmagnan1s/anti-slop** | 将 detect、rewrite、ingest 分开；有作者声音保护清单、轻量编辑原则、不同语域配置、规则数量预算及回归样例。明确不凭模式断言作者身份，不为增强具体性编造事实。[K14] | 值得借鉴规则维护与保护作者声音的方法，但仍有破折号、三项并列等强风格约束；每次 detect/rewrite 都要求另开验证代理，也会增加成本。本轮只阅读，不启动这些流程。 |
| **kimhons/humanize** | 声称包含 38 项模式，区分 academic、docs、blog、commit；支持作者样本，并附带 `humanize_score.py`。[K15] | 比单一词表更重视语境，但默认触发范围很宽。评分是英语正则与启发式计数，不是校准后的“人类程度”，不能直接用于中文质量判断。 |

**anti-slop 的公开测试究竟证明什么**：其 2026-09-02 报告列出 9 个 slop 样例和 6 个黄金样例，由作者驱动的代理作检查。黄金原文只保存在作者机器，外部读者无法完整重现；P2 命中被记录但不算门槛失败。因此，应称“有作者报告和双向回归设计”，而不是“独立证明零误报”。公开触发用例还覆盖不该启动的摘要任务与不该断言作者身份的任务，值得借鉴。[K14]

**humanize 的两个源码问题**：

- `score_text` 将加权命中数按空白分词数量归一化、乘以 5 并封顶为 100。英语正则、作者指定权重与阈值是该分数的来源；本轮没有执行脚本，也没有确认其跨语种效果。[K15]
- 所查技能的统计改写示例，给输入中的单个显著性陈述补上效应量、区间、样本量等具体数值；另一示例把知识范围限定改为更强的“没有先前研究”。这些是**示例保真的风险**，不是本报告测出的模型失败率。需要的数据必须来自真实材料，不能仿照例子补造。[K15]

**宣传里的研究数字也要回查**：TasteSkill 的 `research/laziness/findings/empirical-results.md` 写了多项实验结论、提示刺激的提升数字及季节性解释，但该结果文件没有提供可逐条定位的论文标识、实验设计和原始数据。它不是 TasteSkill 本身的效果评测；本报告不采纳其中的提升幅度和机制归因作为可靠结论。[K9]

## 3. 研究证据与社区经验

### 3.1 七项研究：研究对象与结论的边界

下表是原始论文摘要、元数据和公开方法的定向核查，不是系统综述，也不是本项目复现实验。研究说明需要测什么，不能直接证明某个 GitHub 技能有效。

| 研究与版本 | 可以支持的判断 | 不能据此推出的结论 |
|---|---|---|
| **SlopCodeBench**，所查 v2：2026-05-07。[R1] | 连续需求下，功能测试通过与代码冗余、复杂度、可维护性是不同维度。评估不能只看一次任务是否完成。 | 不能把该基准结果直接当作本报告任何 deslop 技能的实测成绩，也不能由复杂度单独判断实现优劣。 |
| **Generative AI enhances individual creativity but reduces the collective diversity of novel content**，Science Advances，2024-07-12。[R2] | 在短故事创作实验中，AI 点子帮助可提高个体作品评价，同时使作品集合更相似。质量与多样性需要分开测。 | 实验不是技术文档、产品 UI 或代码研究；不能概括成所有 AI 辅助都降低质量。 |
| **AI Suggestions Homogenize Writing Toward Western Styles and Diminish Cultural Nuances**，所查 v2：2025-03-12，CHI 2025。[R3] | 印度与美国参与者的英语写作研究提示：建议可能使表达趋同，文化差异也可能被削弱。 | 对中文写作和其他语言的影响需要单独验证，不能只靠英文禁用词表处理。 |
| **Identity distortion in AI writing: Political bias and homogenization**，所查 v3：2026-09-16。[R4] | 政治写作实验区分了作者偏好、读者评价与身份/立场保真；文字更顺或更讨喜不等于忠实表达。 | 研究语境特定，不能把其政治偏差结论泛化到所有模型、语言和技术写作。 |
| **Benchmarking Linguistic Diversity of Large Language Models**，TACL，2025。[R5] | 提供词汇、句法与语义多样性的分层评估；可以帮助避免只用词频衡量去模板化。 | 主要研究生成文本的多样性；多样性高不保证正确、清晰或符合产品语气。 |
| **GPT detectors are biased against non-native English writers**，所查 v3：2023-07-10。[R6] | 当时所测检测器、语料和条件下存在对非母语英语作者的偏差；检测器分数不能替代内容质量验收。 | 不能将其结果不加复核地套到所有 2026 年检测器，更不能把检测结果当作者身份的定论。 |
| **People who frequently use ChatGPT for writing tasks are accurate and robust detectors of AI-generated text**，v1：2025-01-26。[R7] | 熟悉 AI 写作的人在研究设置下能较好识别生成文本模式；人的经验可以成为评审信息之一。 | 识别来源与判断内容是否准确、有用是两件事；人工判断也不是通用质量标签。 |

**对技能评估的启示**：同时检查事实/行为、完成任务的效果、风格适配、多样性和成本。不要用“更不像 AI”一个指标替代这些目标。没有发现足以在本项目证明“装上某个技能就稳定提升质量”的本地证据。

### 3.2 社区问题单：把经验落到具体失败模式

以下状态在 2026-10-30 通过 GitHub CLI 复核；问题单是报告者的证据，不代表本报告已经复现，也不自动代表当前版本仍有同一缺陷。

| 项目与记录 | 报告了什么 | 可迁移的教训 |
|---|---|---|
| Humanizer **#187**，已关闭。[I1] | 报告者指出技能改写示例加入输入没有的访谈、调查或旅行细节；本单依据是示例检查。 | “增加人味”不能靠编造经历；逐条核对新增主张，而不只比较数字。 |
| Humanizer **#212**，已关闭。[I2] | 三项并列或限定语的规则会丢掉重要性排序、同时发生等语义关系。 | 保留名称和数字还不够；需检查排序、范围、因果、时间与强度。 |
| Humanizer **#306**，已关闭。[I3] | 报告者审查技能中的示例，指出“超过某数量”被改成精确数量等事实变化；这不是一次线上模型运行报告。 | 提示词的示例也要测保真。当前版本已有明确保护约束，历史示例问题不能直接充当当前失败率。 |
| deslop-js **#15 / #42**，均已关闭。[I4][I5] | 分别涉及 Windows 路径分隔导致依赖边缺失，以及 React Native 平台变体的未使用项误报。 | 批量清理前，先核对操作系统、解析器、平台后缀与真实入口；本轮不判断所查版本仍有这些问题。 |
| Desloppify **#759**，核查时开放。[I6] | 报告者称误报处理后，同一扫描的输出/历史与最终存储分数不一致。 | 保存原始发现与状态变更，核对“为何分数变了”；总分上升不能单独证明代码改善。 |

### 3.3 哪类经验比“提示词很强”更值得借鉴

- **保真优先**：Humanizer-zh 把否定、归属、计划/完成、范围与结构写成具体检查项，比笼统要求“更自然”可审查。[K2]
- **说明测试局限**：该项目公开短样例、结构检查和作者对照记录，同时承认采样参数、模型覆盖和样本数量的限制。小规模展示不能包装成稳定通过率。[K2]
- **同时测漏检与误改**：anti-slop 为已知问题与作者黄金文本设置不同门槛，并控制规则增长；这比不断加禁用词更有评估意识，但私有样本和作者评审仍限制外部复现。[K14]
- **实现能解释分数**：检查 no-more-slop 与 Desloppify 的实际评分代码，才能区分规则计数、主观判断和真实外部验收。[K11][K12]
- **先解释发现，再修改**：依赖图工具适合定位线索；实际入口、动态注册和兼容约定仍需由仓库证据确认。[K5][K13]

## 4. 可采用的方法与验收

### 4.1 采用优先级

这是根据机制与风险作出的采用建议，不是技能效果排名。以下“采用”指从来源提炼约束；本轮未安装或启用这些技能。

| 优先级 | 建议借鉴 | 具体用途 | 接纳条件 |
|---|---|---|---|
| **优先** | Humanizer / Humanizer-zh 的保真约束。[K1][K2] | README、更新日志、技术说明中的去空话与编辑。 | 改前改后核对事实、范围、限定与来源；不靠编造经历增加语气。 |
| **优先** | code-simplifier + find-bugs 的范围与证据要求。[K6][K7] | 在真实差异中清理冗余，同时审查回归。 | 锁定目标分支与行为契约；保留必要边界检查，通过与改动相关的验证。 |
| **优先** | Scoville 的证据分层 + 前篇 Impeccable/interface-design 的界面方法。[K10] | 既有宿主内的界面改进与状态覆盖。 | 实际读宿主 tokens、组件、暗色行为；渲染及交互证据覆盖变更。 |
| **按需** | knip / deslop-js 之一。[K5][K13] | 未使用依赖、文件与导出的定位。 | 先正确配置入口并抽查误报；不要同时堆多个工具追相似分数。 |
| **试验性** | Desloppify / no-more-slop。[K11][K12] | 比较检查覆盖、发现定位与修复队列。 | 先验证评分可解释性及误报，再决定是否引入工作流。 |
| **摘取规则** | stop-slop、skill-deslop、taste。[K3][K4][K9] | 特定语域或新视觉方向的提示。 | 每条规则都服从文体与宿主需求；不把作者的审美偏好当成普遍质量标准。 |

### 4.2 写作、README 与更新日志

1. **先有事实清单**：从指定版本、差异、接口和验证结果整理主张。保留原出处，未知项明确标注。
2. **再做表达编辑**：删无信息铺垫、重复解释和未经支持的评价；必要术语与限定保留。
3. **逐项检查保真**：数字、单位、名称、否定、范围、比较/排序、因果与相关、同时/先后、计划/完成、可能/保证、作者/引用归属。
4. **README 做真实任务检查**：安装与使用步骤是否对应当前仓库；示例能否成立；前提、失败路径和兼容范围是否说明。
5. **更新日志锁定版本区间**：用户可感知变化、修复条件、破坏性变化、迁移步骤分别核对；不把内部重排自动宣传成功能升级。

验收依赖事实与可执行信息，不要求每段换句式、不禁止一切三项并列，也不以检测器通过作为交付条件。

### 4.3 代码与代码习惯

1. 确认基准分支、改动范围、仓库规范及入口；不要从“所有防御都是垃圾”开始。
2. 优先处理能解释成本的重复、死分支、无用抽象、失真注释和类型逃逸；指出具体调用点或依赖证据。
3. 保留契约、异常处理、安全校验、事务和兼容边界。删除前说明谁保证输入、错误交给谁处理。
4. 做与改动对应的行为验证；涉及接口和错误路径时检查相关边界。不要为了删代码而同步删掉唯一能发现回归的测试。
5. 评价可维护性时可加入后续需求任务：下一次修改是否更容易、是否少引入重复。小文件数、低行数和高扫描分都只是辅助指标。

### 4.4 UI 与 UX

1. 先读取宿主的入口、布局、tokens、字体、组件、主题和暗色切换；在同一语义体系里设计。
2. 用任务划分信息层级：用户来完成什么、先看什么、哪些信息能按需展开。不要只追求截图有特色。
3. 覆盖加载、空态、错误、禁用、成功、长文本和窄屏；交互控件有名称、焦点与键盘路径。
4. 区分源码审查、实际渲染、尺寸/溢出和真实交互。没有相应证据时，报告“未验证”，不宣称完整适配。
5. 从真实任务完成情况、可理解性、状态可见性及宿主一致性评价。换一种渐变、字体或动画不能单独证明去除了模板化。

这些是建议的后续验收方式；本侧会话没有对 DSH 启动、调用或界面兼容性作验证。

### 4.5 技能自身也需要验收

建议后续做小型对照，而不是一次挂载整套技能：

- **固定条件**：记录模型版本、工具、输入、预算、仓库提交及技能提交；能力不同的模型不要混作同一条件。
- **基线与留出**：同一任务比较不加技能与加单一技能；留出未用于调整规则的样本。重复任务时保存采样参数与失败样本。
- **分开评分**：事实/行为正确性、文体/宿主适配、任务完成、维护成本和执行成本分别报告；严重事实或行为回归不能由文风分抵消。
- **人工盲评配合验证**：隐藏候选来源以减小品牌偏好；代码运行相关检查，UI 使用真实渲染/交互，文档检查命令、链接和版本事实。
- **测触发边界**：摘要、翻译、引用、法律/科学限定和用户原文保留等任务，不应因出现某个词就自动改写。
- **记录退出条件**：有幻觉、删边界、误报或成本明显上升时，缩小触发范围或停用；不要无限追加规则自证有效。

## 5. 来源与版本记录

### 5.1 GitHub 固定提交与实际阅读路径

共整理 **15 个仓库**。这不是 15 份独立效果验证：其中有翻译、派生、复用和工具型项目。K1–K13 为 10 月 29 日取得的提交快照；K14–K15 为 10 月 30 日补充。固定提交用于定位本报告所读内容，不表示之后的默认分支没有更新。

| 编号 | 仓库 | 所查提交 SHA | 实际阅读的入口与证据 |
|---|---|---|---|
| [K1] | `blader/humanizer` | `0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0` | `SKILL.md`。 |
| [K2] | `op7418/Humanizer-zh` | `f4518a8eab97b8bfebc66a89d34320a89bef6930` | `SKILL.md`、`README.md`、`tests/README.md`。 |
| [K3] | `hardikpandya/stop-slop` | `8da1f030185bdfe8471220585162991eaeb970e9` | `SKILL.md`。 |
| [K4] | `stephenturner/skill-deslop` | `a906154bef375d9d49ed2ad7da13b2db16f0d3d2` | `SKILL.md`。 |
| [K5] | `brianlovin/agent-config` | `1a9819ebf3fee811150fc76cbe177ea4e5f747ff` | `skills/deslop/SKILL.md`、`skills/knip/SKILL.md`、`skills/rams/SKILL.md`。 |
| [K6] | `anthropics/claude-plugins-official` | `f8c5e7a1dcb71b10cb74586224b5401f3de5db28` | `plugins/code-simplifier/agents/code-simplifier.md`。 |
| [K7] | `getsentry/skills` | `d12f250460ffd961f549dbebf7eeb0cf4afd4c2e` | `skills/code-simplifier/SKILL.md`、`skills/find-bugs/SKILL.md`、`skills/blog-writing-guide/SKILL.md`。 |
| [K8] | `mattpocock/skills` | `a496f5513d4a4cf889bc48e189e579f4b0bdf6aa` | `skills/engineering/improve-codebase-architecture/SKILL.md`、`skills/engineering/tdd/SKILL.md`。 |
| [K9] | `tasteskill/tasteskill` | `37c8c376b92ebc02456f7c70776b514fddda88e1` | `skills/taste-skill/SKILL.md`、`skills/redesign-skill/SKILL.md`、`skills/output-skill/SKILL.md`、`research/laziness/README.md`、`research/laziness/findings/empirical-results.md`。 |
| [K10] | `benjaminstelzer/scoville-ui` | `fee6496cdfa421039065895ad984517878550f82` | `scoville-ui/SKILL.md`。 |
| [K11] | `hellozheat/no-more-slop` | `09e3279f47175aa6b4132b37aa38c91aa9e30d8c` | `SKILL.md`、`scripts/score.py`，只读。 |
| [K12] | `peteromallet/desloppify` | `3a7735d531a96b6a226bfbdc9fd662b14195f857` | `README.md`、`desloppify/data/global/SKILL.md`、`desloppify/engine/_scoring/policy/core.py`、`desloppify/base/scoring_constants.py`。 |
| [K13] | `millionco/deslop-js` | `aeeb44ad5855a89200c00e9b012519162ac0f2c3` | `README.md`、`packages/deslop-js/src/index.ts`。 |
| [K14] | `kjmagnan1s/anti-slop` | `4a3ec6da8c25087328b640b8c69ef151c47dbc1f` | `SKILL.md`、`evals/README.md`、`evals/reports/pr-2026-09-02-mannered-prose.md`。 |
| [K15] | `kimhons/humanize` | `6ea4a2aa4b1abc4d62ba9d9bf65a2d408cf57af9` | `SKILL.md`、`scripts/humanize_score.py`，只读。 |

### 5.2 论文原始来源

- [R1] **SlopCodeBench: Benchmarking How Coding Agents Degrade Under Iterative Requirements**。固定 arXiv v2，2026-05-07；区分功能、功能复用与整体结构。
- [R2] **Generative AI enhances individual creativity but reduces the collective diversity of novel content**。Science Advances，2024-07-12；DOI：`10.1126/sciadv.adn5290`。本轮通过 Crossref 的出版元数据及原始摘要核对，未宣称完成全文方法审读。
- [R3] **AI Suggestions Homogenize Writing Toward Western Styles and Diminish Cultural Nuances**。固定 arXiv v2，2025-03-12；原始页面注明 CHI 2025。
- [R4] **Identity distortion in AI writing: Political bias and homogenization**。固定 arXiv v3，2026-09-16；引用该版本摘要，不混用早期版本的样本数。
- [R5] **Benchmarking Linguistic Diversity of Large Language Models**。TACL 13，1447–1470，2025；DOI：`10.1162/tacl.a.47`。
- [R6] **GPT detectors are biased against non-native English writers**。固定 arXiv v3，2023-07-10；原始页面注明发表于 Patterns。检测偏差结论限定在论文所测条件。
- [R7] **People who frequently use ChatGPT for writing tasks are accurate and robust detectors of AI-generated text**。固定 arXiv v1，2025-01-26；只借用研究设置中的观察，不当作通用作者鉴定法。

### 5.3 问题单来源

- [I1] Humanizer #187：示例补造事实；已关闭，最后更新 2026-07-22。
- [I2] Humanizer #212：排序、同时发生等语义丢失；已关闭，最后更新 2026-09-06。
- [I3] Humanizer #306：源码示例改变事实；已关闭，最后更新 2026-09-29。
- [I4] deslop-js #15：Windows 路径分隔导致的依赖图误报；已关闭，最后更新 2026-05-28。
- [I5] deslop-js #42：React Native 平台变体误报；已关闭，最后更新 2026-06-20。
- [I6] Desloppify #759：扫描输出、历史和存储分数不一致；核查时开放，最后更新 2026-09-18。

### 5.4 证据等级、访问方式与未完成的验证

- **一手材料**：固定版本的技能正文、评分实现、维护者测试文档；论文原始页面与出版元数据。源码证明“实现了什么”，不直接证明“效果有多好”。
- **社区材料**：具体 issue 提供输入、症状或原因线索，按报告者证据处理；关闭状态不等于普遍有效，开放状态也不等于本项目必然触发。
- **作者自报**：Humanizer-zh 和 anti-slop 的小规模测试有参考价值；私有语料、单次运行、模型与采样覆盖的限制单独保留。
- **本轮实际操作**：内置搜索发现候选，GitHub CLI 经用户现有代理只读访问；读技能文本与脚本源码，没有执行研究对象。搜索标题与落地页面不一致、404 或无法追溯的宣传数字未作为已核实结果。
- **待另行验证**：模型与技能的效果对照、中文长文保真、UI 实际任务与暗色适配、静态分析器在本仓库的误报、代码清理后的回归。它们是后续实验建议，不是本轮已完成项。

[K1]: https://github.com/blader/humanizer/blob/0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0/SKILL.md
[K2]: https://github.com/op7418/Humanizer-zh/tree/f4518a8eab97b8bfebc66a89d34320a89bef6930
[K3]: https://github.com/hardikpandya/stop-slop/blob/8da1f030185bdfe8471220585162991eaeb970e9/SKILL.md
[K4]: https://github.com/stephenturner/skill-deslop/blob/a906154bef375d9d49ed2ad7da13b2db16f0d3d2/SKILL.md
[K5]: https://github.com/brianlovin/agent-config/tree/1a9819ebf3fee811150fc76cbe177ea4e5f747ff/skills
[K6]: https://github.com/anthropics/claude-plugins-official/blob/f8c5e7a1dcb71b10cb74586224b5401f3de5db28/plugins/code-simplifier/agents/code-simplifier.md
[K7]: https://github.com/getsentry/skills/tree/d12f250460ffd961f549dbebf7eeb0cf4afd4c2e/skills
[K8]: https://github.com/mattpocock/skills/tree/a496f5513d4a4cf889bc48e189e579f4b0bdf6aa/skills/engineering
[K9]: https://github.com/tasteskill/tasteskill/tree/37c8c376b92ebc02456f7c70776b514fddda88e1
[K10]: https://github.com/benjaminstelzer/scoville-ui/blob/fee6496cdfa421039065895ad984517878550f82/scoville-ui/SKILL.md
[K11]: https://github.com/hellozheat/no-more-slop/tree/09e3279f47175aa6b4132b37aa38c91aa9e30d8c
[K12]: https://github.com/peteromallet/desloppify/tree/3a7735d531a96b6a226bfbdc9fd662b14195f857
[K13]: https://github.com/millionco/deslop-js/tree/aeeb44ad5855a89200c00e9b012519162ac0f2c3
[K14]: https://github.com/kjmagnan1s/anti-slop/tree/4a3ec6da8c25087328b640b8c69ef151c47dbc1f
[K15]: https://github.com/kimhons/humanize/tree/6ea4a2aa4b1abc4d62ba9d9bf65a2d408cf57af9
[R1]: https://arxiv.org/abs/2603.24755v2
[R2]: https://doi.org/10.1126/sciadv.adn5290
[R3]: https://arxiv.org/abs/2409.11360v2
[R4]: https://arxiv.org/abs/2604.22503v3
[R5]: https://aclanthology.org/2025.tacl-1.69/
[R6]: https://arxiv.org/abs/2304.02819v3
[R7]: https://arxiv.org/abs/2501.15654v1
[I1]: https://github.com/blader/humanizer/issues/187
[I2]: https://github.com/blader/humanizer/issues/212
[I3]: https://github.com/blader/humanizer/issues/306
[I4]: https://github.com/millionco/deslop-js/issues/15
[I5]: https://github.com/millionco/deslop-js/issues/42
[I6]: https://github.com/peteromallet/desloppify/issues/759
