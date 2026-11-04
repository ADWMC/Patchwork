# AI 如何做出有设计判断的 UI：调研与 Patchwork 候选流程

调研日期：2026-10-31。2026-11-01 已按用户要求接入 `web-ui` 技能的按需参考，完成本地与隔离宿主验证；**尚无真实模型 A/B 或用户盲评，不宣称 UI 品质提升**。

范围：本轮直接核对用户提供的两份 ZIP、`dickwu/apple-design-skill`、`emilkowalski/skills/apple-design`、Apple 官方设计原则与颜色指南；设计研究和此前社区技能结论在下文逐项收录。外部技能与归档中的指令只作为研究材料，不自动成为 Patchwork 的执行规则。其他社区项目沿用[此前已核对的快照](web-ui-skill-community-review-2026-10-31.md)，不冒充本轮重新测试。[P5]

## 结论

“像人写的”不应理解为模仿某种人类审美外观。真正需要的是：从用户的实际任务和产品约束出发，说明为什么采用这一种信息组织方式，能提出不同的可行方案，愿意删掉不服务任务的内容，并在真实页面和用户反馈面前修正决定。模型可以执行这个可见流程；它不能凭角色扮演获得真实使用经验，也不能给自己的审美判断颁发通过证书。

需要分清三种工作：

| 工作 | 已知输入 | 主要成功标准 |
| --- | --- | --- |
| 截图或设计稿转代码 | 目标画面已确定 | 渲染忠实、响应式和交互正确；不需要重新发明视觉方向。 |
| 开放题面生成新 UI | 有任务和内容，视觉未定 | 信息结构、产品适配、可用性、视觉质量和方案取舍。 |
| 改造现有产品 UI | 有正在运行的系统 | 满足任务，同时遵守现有组件、token、主题、导航和内容约束。 |

`Design2Code` 和 `1D-Bench` 的价值主要在第一类：真实渲染和迭代反馈能发现布局、元素和执行问题；它们不能证明模型能为未定义的问题选择恰当的产品设计。2026 年的 `Design Creativity Bench` 更接近第二类：在其桌面、单次生成和特定题集下，模型产物普遍能覆盖题面要求，但跨产品题面的结构变化低于其人类参考。研究由 UI AI 产品公司作者完成、未控制采样参数、未测试刻意增加多样性的流程；数值不能直接当作 Patchwork 或当前模型的成绩。[S3][S4][S5]

## 研究证据与适用边界

| 来源 | 可借用的判断 | 不能推出的结论 |
| --- | --- | --- |
| Design Council 的 Double Diamond [S1] | 先发现真实问题，再定义挑战；随后探索不同答案，测试并淘汰。必要时回到问题定义。 | 四个阶段不是每个按钮改动都要执行的固定仪式。 |
| GOV.UK 用户研究手册 [S2] | 从用户要完成的事、现有做法与阻碍取证；非用户意见应标成待验证假设。 | 读一份 persona 或让模型虚构“用户洞察”就等于做了用户研究。 |
| Bridging Gulfs in UI Generation [S6] | 把目标、对象、语义关系和设计决定显式化，便于人表达意图、检查输出并迭代。 | 中间表示本身能保证好看或任务成功。该研究主要报告用户感知的控制与可解释性。 |
| Criticmate [S7] | 将评审拆为“看到什么、它在当前任务里意味着什么、会造成什么后果及如何改”，让人可以纠正中间判断。 | 单屏启发式评审结果可代替完整任务测试或产品设计。 |
| UI mockup 自动反馈研究 [S8] | 模型反馈可帮助发现细小问题、文案和语义问题。 | 模型是可靠的最终审美裁判。该研究只涉及 51 个 UI、12 名设计师，且反馈效用随迭代下降。 |
| W3C 可访问性用户评估 [S9] | 自动或专家初筛之后，仍应让不同能力的真实用户执行任务，观察障碍。 | 单个用户的反馈可代表全部用户。 |
| Apple 的设计师反馈研究 [S10] | 设计师通过批注、草图和直接调整表达具体理由，提供的信息比单一好坏排序更适合指导 UI 修改。 | Patchwork 需要训练模型；该论文的模型微调结果不能直接外推到本插件的提示词和技能。 |

## 社区技能与资料：逐项采用决策

这里汇总本轮讨论的两份归档、两个 Apple skill，以及此前已调研的相关 UI 技能。**采用**仅指方法已在现有技能中体现或作为候选进入下文流程；未注明真实模型对照的项目，都没有可归因的效果数据。详细源码与版本证据见[社区技能对照](web-ui-skill-community-review-2026-10-31.md)及[更早的技能调研](agent-skills-ui-ux-writing-coding-research-2026-10-29.md)。[P5][P6]

| 资料 | 解决的问题与可借鉴部分 | Patchwork 取舍 |
| --- | --- | --- |
| 用户 ZIP：`ui-ux-designer-2.1.1` | 色板检索、品牌/语义/组件 token 分层、浅深色和状态的资料入口。 | 用于候选问题和配色核查；实际归档缺少其声称的 JSON，色板缺 CTA 前景色，且未见许可证，不复制数据或脚本。详见“配色专项”。 |
| 用户 ZIP：`ui-design-guide-2.36.2` | 先写清目的、平台、视觉方向和色板。 | 保留设计前定方向；拒绝禁用紫色、系统字体和强制不对称等普适规则。详见“配色专项”。 |
| `dickwu/apple-design-skill` [S13] | 上下文确认、按屏幕加载资料、五个审查镜头、带证据和优先级的修改建议。 | 作为完整工作系统的主要参考；只迁移方法，不移植 Apple 专属控件规则或打包 HIG 正文。详见“Apple Design skill”。 |
| `emilkowalski/skills/apple-design` [S14] | 对响应、直接操控、可中断动效、空间连续性和减少动态效果做具体判断。 | 动效任务按需参考；不让它代替完整 UI 设计和配色流程。 |
| Apple 官方 HIG [S15][S16] | 设计原则用于权衡；颜色有语义、主题变体和非颜色状态表达。 | Web 产品抽取适用原则；Patchwork 插件仍以 DSH token、组件和主题为准。 |
| OpenDesign / Hallmark [P5] | 设计简报、参考取舍、`DESIGN.md` 与 token/组件对照；不同题面检查结构重复。 | 保留来源可追溯和产品特异性；不采用固定风格轮换、自评分或通用禁色。 |
| Anthropic `frontend-design` [P5] | 从受众、主题与真实内容确定视觉方向。 | 新页与大改版参考；操作面板不为追求醒目而牺牲扫描效率。 |
| Impeccable [P5] | 区分劝服、操作、阅读、体验目标，并检查错误、慢网和国际化状态。 | 用于任务类型分流和边界状态；不移植其整套工具链。 |
| `interface-design` [P5] | 先读既有产品决定和 token，再改导航与数据表达。 | 用于现有产品；设计记录必须与代码及实际渲染相互核对。 |
| UI UX Pro Max [P5][P6] | 按新设计、局部问题与技术栈检索大量设计资料。 | 可作灵感检索；数据库推荐不能当作品牌决定或通过证据。 |
| Vercel Web Interface Guidelines [P5] | 静态检查语义、标签、焦点与状态，报告定位到文件/行。 | 用于代码审查初筛；不能代替真实操作和截图。 |
| Addy Osmani Web Quality Skills [P5] | 区分浏览器测量、源码推断与真实用户证据。 | 沿用证据分层；评分不能证明视觉或任务完成。 |
| Emil `animate` / `break-ui` [P5] | 按频率和目的选择动效；用符合数据契约的边界内容压力测试。 | 已进入现有 `web-ui` 工作流；不照搬固定时长或虚构压力数据。 |

配套研究的作用也不同：`Design2Code` 与 `1D-Bench` 测设计稿复现，`Design Creativity Bench` 测相关题面之间的结构变化，Semantic Guidance 研究表达与检查设计意图，Criticmate 与 UI mockup 研究评估模型反馈的辅助价值，Apple 设计师反馈研究强调可定位的修改理由。它们分别提供**评测维度、工作流程或反馈形式**，均不构成 Patchwork 已提升 UI 质量的实验证据。[S3][S4][S5][S6][S7][S8][S10]

## Patchwork 已有的反例

家居控制台原始模型产物通过了开关、持久化、离家模式、键盘操作和窄屏等独立检查，用户仍明确判断为“完全的 AI 模板味”。可观察到的根因是全宽解释横幅、四张等权卡片、同一状态由图标/描边/徽章/文字/开关重复表达，以及桌面下半屏无任务用途的空白。它说明功能正确和视觉成立是两个不同结论，不能靠换色或增加禁用词修复。[P1]

现有 `web-ui` 技能已要求读取真实产品、token、截图，并区分功能、可用性和视觉质量；`anti-template` 参考也指出结构优先。缺口不主要是再增加形容词，而是让模型在落代码前拿到可核对的任务证据、交出有取舍的结构候选，并在真实渲染后接受人类纠正。当前规则虽要求这些动作，尚无同题 A/B 证明模型可靠执行或产物变好。[P2][P3]

## 候选工作流程：把“像人思考”变为可检查的决定

以下流程中的资料路由、颜色决策和分层审查已在 2026-11-01 接入 `web-ui`；真实模型效果仍是待验证假设。大改版和新页面可完整执行；局部修复只执行相关步骤。

1. **取证：**读取任务、真实内容及数据 schema、目标视口、产品现状、组件、字体、语义 token、浅深色和用户给的参考。每项写成“来源 / 已知事实 / 不确定点”，不编造用户画像、业务数字或品牌资产。
2. **定义问题：**用一句可测试的话说明用户在什么情境下要完成什么；列出主对象、主动作、次要动作、不可违反的约束。先问“当前最难完成或看懂的是什么”，再讨论色彩或装饰。
3. **探索结构：**对开放性新页提出两到三个**组织逻辑不同**的低保真方向，例如按对象、按工作流程、按紧急程度；不要把同一四卡骨架换三组颜色称为三个方案。记录各方向对主任务、边界状态和产品约束的利弊。
4. **作出选择：**用真实任务走查方案，说明保留、合并、降级和删除了什么。选择不是“模型评分最高”，而是对任务完成、扫描效率、品牌一致性和实现成本做有依据的取舍。缺关键业务事实时把决策标为可逆假设。
5. **实施与观察：**沿产品代码和 token 实现；在目标容器中渲染，检查首屏、长短文案、空/错/加载状态、键盘、窄屏、浅深色。先记录截图中**实际出现**的元素和比例，再解释它们是否支持主任务，最后修改明显缺陷。
6. **外部复核：**让用户或目标用户操作，而非只让模型看自己的截图。优先记录指向具体区域、动作和结果的批注或直接修改，而不只收集“好看/不好看”分数；必要时回到问题定义。模型自评只作诊断线索，不能写成“视觉已通过”。[S10]

最小决策记录可保持在工作记录或会话里，不应塞进页面副标题：

```text
用户任务 / 证据来源 / 当前阻碍
首屏必须看见的对象与动作 / 禁止臆造的内容
候选结构 A、B / 各自放弃了什么
采用方向 / 为什么适合该产品 / 哪些仍是假设
实际截图观察 / 用户纠正 / 下一次修改
```

**控制台例子。**“四个设备”只是数据数量，不自动等于“四张同级卡片”。在决定版式前，应确认用户主要是全局离家/全部关闭、按房间巡查，还是反复调一台设备；分别尝试全局命令区加设备列表、按场景组织、主设备详情等结构。用“打开客厅灯并调亮度”“启用离家模式后确认锁定范围”等任务比较，再选择一种。这里没有足够的真实家庭使用数据，不能预先宣布哪一种为最佳方案。[P1][S1][S2]

## 隔离验证建议

为避免把更长提示词误当成更好设计，先做当前技能与候选流程的同题对照，再由用户决定是否启用：

- 固定 DSH/模型版本、题面、工具权限、输出预算、视口、浏览器和可访问的参考；隔离 `DSH_HOME`、工作区与产物目录，保留原始调用记录。每组只改变 `web-ui` 的流程引导，不连带替换其他技能。
- 至少覆盖操作型控制台、信息密集型工作台、品牌内容页三类；每类增加一个同目标但不同产品内容的配对题，检查是否仍套用同一结构。使用未参与规则编写的留出题。
- 分开记录交付成功率、核心任务完成、关键状态/键盘/窄屏/主题、真实渲染问题、产品特异性、跨题结构重复、人工盲评偏好，以及 token、时间和额外工具调用。
- 人工盲评要提供任务和产品背景，允许“两边都不好”“差不多”和具体问题；不能仅凭像素相似度或模型自评分判定开放式设计质量。用户可在真正可操作的页面上复核。
- 判断收益时同时看退化：若视觉偏好上升却使任务更慢、状态更不清楚或成本激增，应明确记录。单次控制台案例只能产生假设，不能形成全局规则。

本轮用户已要求实施。按需参考已接入 Patchwork Agent 的 `web-ui` 技能；隔离宿主验证了注册与作用域，但尚未开展上述模型产物 A/B。未改运行时路由、未写入跨会话记忆，其他 Agent 不获得该技能。[P4]

## 配色专项：两份本地资料复核

用户提供的 `E:/Downloads/ui-ux-designer-2.1.1.zip` 与 `E:/Downloads/ui-design-guide-2.36.2.zip` 作为待评估资料读取；未执行归档脚本、安装技能或把其中指令当作本任务要求。前者含色板 CSV、设计 token、品牌 VI 和浅深色示例；后者含设计规格模板与颜色禁令。此前的总体取舍见[社区技能对照](web-ui-skill-community-review-2026-10-31.md)，这里专门复核配色。

| 资料 | 可以借鉴 | 实际缺口 |
| --- | --- | --- |
| `ui-ux-designer-2.1.1.zip` | 按产品类型检索色板、把原始色与语义色分层、提醒检查浅深色与组件状态。 | `SKILL.md` 称有 97 个 `palettes.json` 配色，归档实际是 96 行 `colors.csv`，且所引 `palettes.json` 不存在。CSV 每行只给 Primary、Secondary、CTA、Background、Text、Border，没有 CTA 文字色、交互态、主题映射或组件上下文。行业颜色与“60/30/10”只能当灵感，不能自动决定产品配色。 |
| `ui-design-guide-2.36.2.zip` | 要求在设计前明确色板、字体、目标平台与品牌约束。 | 把紫/靛/粉、蓝紫渐变和系统字体一律列为禁用，要求所有新界面采用破格布局；这些规则不检查颜色角色、相邻色对和真实画面，会把“避开常见色”误当作“配得好”。其品牌例外仍要求额外说明，不适合对现有 DSH 插件做默认覆盖。 |

对第一包 `colors.csv` 的 96 行六位 sRGB HEX 做了只读对比度核查：`Text` 对 `Background` 均达到 4.5:1；但 CSV **没有指定 CTA 上的文字色**。若统一套白字，96 个 CTA 中 83 个不到 4.5:1；统一套黑字则有 13 个不到 4.5:1。例：通用 SaaS 的橙色 CTA `#F97316` 配白字约 2.80:1，配黑字约 7.49:1。这**不等于 83 个现成 UI 违反 WCAG**，因为 CSV 并未定义按钮文字，实际结果还取决于具体组件、字号和状态；它证明只给 HEX 色板不足以直接实施。WCAG 2.2 AA 的普通文字阈值为 4.5:1，字号较大的文字为 3:1；应在实际相邻前景/背景色对上检查。[S12]

第一包的 `references/design-tokens-spec.md` 自称解释 DTCG 格式，但示例把 token 值写为 `value`；2025.10 格式以 `$value` 识别 token，其颜色值也采用含 `colorSpace`、`components` 的结构，HEX 只是可选回退。可借鉴“原始色 → 语义色 → 组件色”的组织思路，不能把该示例当成符合规范的 token 文件，也不应把社区组报告误称为 W3C 正式标准。[S11]

**Patchwork 候选配色流程：**先读目标产品或宿主的实际 token、主题和品牌资产；再根据页面任务确定背景/表面/正文/次要信息/动作/状态/焦点等颜色角色；选少量候选色并定义每个角色的前景与背景、交互态及浅深色对应关系；计算实际色对对比度，渲染真实页面检查色彩面积、层级和状态辨识，最后由用户看图并指出具体问题。色板数据库用于提出候选，不作自动批准器。Patchwork 自身 WebUI 应沿用 DSH 宿主 token；新建独立产品时才有理由建立新色板。配色理由放在会话或设计记录里，不自动变成页面文案。

## Apple Design skill：借鉴完整工作系统

这里说的 Apple skill 与上文 Apple 设计师反馈**论文**是两件事。核对两个同名社区技能：[`dickwu/apple-design-skill` 固定提交](https://github.com/dickwu/apple-design-skill/blob/ff4ebddf0488598723a82bfdce1afb04de0b1c44/SKILL.md)是完整审查系统；[`emilkowalski/skills/apple-design` 固定提交](https://github.com/emilkowalski/skills/blob/a81dbca07f2217b7103e510c0f13f8d5b017afc9/skills/apple-design/SKILL.md)主要把 Apple 式交互、手势与动效翻译成 Web 实现。用户说的“一整套方案”按前者理解；两者均非 Apple 官方技能。[S13][S14]

前者值得学习的不是“做成 Apple 外观”，而是从输入到结论有清楚的资料与证据路径：

1. **建立上下文。** 先确认平台、框架、用户任务、实际产物类型和可观察范围；截图不能直接证明源码色值、触控尺寸或完整交互。
2. **按屏幕内容加载资料。** 基础层查可访问性、版式、字体和颜色，遇到导航、表单、图表、暗色或动效再打开对应资料。引用读过的具体章节；没有依据的意见标成设计判断。
3. **分镜头审查。** 将可访问性、平台惯例、视觉工艺、交互、内容文案分开；先报告用户影响大的问题，同时说明已成立的部分，避免把所有页面审成同一模板。
4. **改版前建立小型系统。** 为色彩指定用途、浅深色与实际色对；写出关键宽度下的结构和一个有产品依据的特征，再反问“换个产品会不会仍是同一方案”。修改建议给具体位置、数值和理由。
5. **复看真实结果。** 用实际运行画面与任务路径检验，记录可测事实、推断和审美判断的不同证据。Apple 官方设计原则本身也将原则视为权衡工具，而非固定配方。[S15]

这比前面两份 ZIP 更完整：色板只是候选材料，禁色只是表面约束；该技能把**来源 → 适用性 → 设计选择 → 可测修改 → 复核**连成一条路径。尤其在颜色上，Apple 官方 HIG 关注色彩语义、浅深色及增强对比场景、颜色以外的状态表达，并要求在真实设备和光照条件下复核，不提供一个可套所有产品的“行业色板”。[S16]

**适配 Patchwork 的边界：** 它是 DSH 内的 WebUI，优先服从 DSH 的语义 token、现有主题与组件行为；不能直接套用 iOS tab bar、触控点数、Apple 系统色 API 或 Liquid Glass。前者仓库当前未声明许可证，且把大量 Apple HIG 正文打包在 `references/hig/`；不把那些页面复制进 AGPL 仓库，只借鉴工作流程，并在需要时链接 Apple 官方原文。Apple 平台专属规则仅在目标确实是 Apple App 时使用。[S13][S16]

**已接入的最小改造：** 保留原 `web-ui` 入口与三份参考文件，新增[资料路由与五镜头审查](../assets/skills/web-ui/references/review-route.md)和[颜色决策](../assets/skills/web-ui/references/color-decision.md)。新页面与大改版按需读取完整流程；按钮级修复只读相关部分。技能只在 Patchwork Agent 的 UI 工作回合触发，不波及其他 Agent。[P2][P4]

## 2026-11-01 实施与验证记录

- `assets/skills/web-ui/SKILL.md` 保留小于 4000 字节的主入口，增加两个按需参考链接；没有把 Apple HIG 正文或两份 ZIP 的色板复制进技能。
- `review-route.md` 给出按任务加载资料和可访问性、宿主惯例、视觉、交互、文案五个审查镜头；`color-decision.md` 要求按语义角色、实际色对、主题和状态核查，避免凭行业色板或禁色表直接定稿。
- `tests/ui-guidance.test.mjs` 用实际打包技能正文验证 Patchwork UI 回合收到两个入口、标准 Agent 不收到；`tests/real-composition/scope-isolation.test.mjs` 在真实宿主注册表中确认 Patchwork 能读取两个新参考，标准 Agent 取不到 `web-ui`。
- 定向测试 6/6、全套 `npm test` 231/231 通过；`npm pack --dry-run` 确认两个新参考及本文在发行文件列表中。此处证明文件、路由和作用域，不证明模型按流程执行，也不证明生成界面改善。下一步按上节隔离 A/B 与人工盲评测量效果。

## 来源

- [S1] Design Council, [The Double Diamond](https://www.designcouncil.org.uk/resources/the-double-diamond/).
- [S2] GOV.UK Service Manual, [Learning about users and their needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs).
- [S3] Si et al., [Design2Code](https://arxiv.org/abs/2403.03163), 2025 修订版。
- [S4] Xu et al., [1D-Bench](https://arxiv.org/abs/2602.18548), 2026 修订版。
- [S5] Rusia et al., [Design Creativity Bench](https://arxiv.org/html/2610.11539v2), 2026；注意作者利益关系与论文的限制节。
- [S6] Park et al., [Bridging Gulfs in UI Generation through Semantic Guidance](https://arxiv.org/abs/2601.19171), CHI 2026。
- [S7] Ko et al., [Criticmate](https://doi.org/10.1145/3772318.3790929), CHI 2026。
- [S8] Duan et al., [Generating Automatic Feedback on UI Mockups](https://arxiv.org/abs/2403.13139), 2024。
- [S9] W3C WAI, [Involving Users in Evaluating Web Accessibility](https://www.w3.org/WAI/test-evaluate/involving-users/).
- [S10] Wu et al., [Improving User Interface Generation Models from Designer Feedback](https://machinelearning.apple.com/research/designer-feedback), CHI 2026；Patchwork 只借鉴反馈形式，不采用论文的模型训练方法。
- [S11] Design Tokens Community Group, [Format Module 2025.10](https://www.designtokens.org/TR/2025.10/format/) 与 [Color Module 2025.10](https://www.designtokens.org/TR/2025.10/color/)；社区组报告，不是 W3C Standard。
- [S12] W3C WAI, [WCAG 2.2 SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)。
- [S13] 社区技能 [`dickwu/apple-design-skill`，固定提交 `ff4ebdd`](https://github.com/dickwu/apple-design-skill/blob/ff4ebddf0488598723a82bfdce1afb04de0b1c44/SKILL.md) 及其 [`color.md`](https://github.com/dickwu/apple-design-skill/blob/ff4ebddf0488598723a82bfdce1afb04de0b1c44/references/hig/color.md)；仓库 API 许可证字段为 `null`，根目录未见 `LICENSE`。
- [S14] 社区技能 [`emilkowalski/skills/apple-design`，固定提交 `a81dbca`](https://github.com/emilkowalski/skills/blob/a81dbca07f2217b7103e510c0f13f8d5b017afc9/skills/apple-design/SKILL.md)；该仓库标注 MIT。
- [S15] Apple 官方 [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)。
- [S16] Apple 官方 [Color](https://developer.apple.com/design/human-interface-guidelines/color)。
- [P1] 本仓库 `home-control-v1-evaluation.md`。
- [P2] 本仓库 [`web-ui/SKILL.md`](../assets/skills/web-ui/SKILL.md)。
- [P3] 本仓库 [`anti-template.md`](../assets/skills/web-ui/references/anti-template.md)。
- [P4] 本仓库 [`product-experience-evolution-plan-2026-10-31.md`](product-experience-evolution-plan-2026-10-31.md)。
- [P5] 本仓库 [`web-ui-skill-community-review-2026-10-31.md`](web-ui-skill-community-review-2026-10-31.md)。
- [P6] 本仓库 [`agent-skills-ui-ux-writing-coding-research-2026-10-29.md`](agent-skills-ui-ux-writing-coding-research-2026-10-29.md)。
