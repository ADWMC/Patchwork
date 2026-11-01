# Web UI 社区技能对照与采用取舍

核对日期：2026-10-31。针对通用 `web-ui` 技能补查社区项目的维护者仓库和技能入口；其中部分 `main` 链接会继续变化，不是固定版本。此前的较大范围调研见 [UI、UX、文档与编码 Agent Skills 调研](agent-skills-ui-ux-writing-coding-research-2026-10-29.md)。本次只比较规则及流程，没有安装外部技能、运行其脚本或测量模型产物的前后差异。

后续的[AI UI 设计判断、配色与 Apple Design skill 统一调研](human-centered-ai-ui-research-2026-10-31.md)汇总本报告、两份用户 ZIP、两个 Apple skill 与相关研究，并将“采用”和“待验证”分开。本文保留原始社区项目对照。

| 项目 | 核对到的有用机制 | 本次决定 |
| --- | --- | --- |
| [Emil Kowalski skills](https://github.com/emilkowalski/skills)（[animate](https://github.com/emilkowalski/skills/blob/main/skills/animate/SKILL.md)、[break-ui](https://github.com/emilkowalski/skills/blob/main/skills/break-ui/SKILL.md)） | `animate` 从频率、目的和中断性判断动效；`break-ui` 用符合契约的边界内容查布局。 | 已吸收动效选择与真实数据压力检查；不照搬固定时长。 |
| [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | 让视觉选择来自受众、主题和实际内容；字体与结构承载信息，反复对照 brief。 | 保留主题驱动的视觉方向、灰度结构与反模板检查；不要求每个产品页都追求醒目主视觉。 |
| [Impeccable](https://github.com/pbakaus/impeccable/blob/main/.agent/skills/impeccable/SKILL.md) | 按劝服、操作、阅读、体验分界面目标；针对失败、慢网、国际化另有 harden 路径。 | 增加页面任务类型判断，操作页优先可扫描性；边界数据仍在单一入口中测试，不移植整套命令/二进制工具。 |
| [interface-design](https://github.com/Dammyjay93/interface-design/blob/main/.claude/skills/interface-design/SKILL.md) | 将既有设计决策和 tokens 作为后续界面修改的约束；强调导航与数据表达也是设计决策。 | 读取并核对已有设计记录与实际界面；补充导航位置、数据含义和原生控件优先，不自动创建或覆盖项目设计文件。 |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md) | 按新设计、局部问题、技术栈选择检索范围，并核对结果是否适合项目。 | 保留按任务大小分流与按现有技术栈实施；不把庞大样式库或检索脚本塞进通用技能。 |
| [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) | 检查语义元素、标签、焦点、状态与表单，审查发现定位到文件/行。 | 加入高频可访问性检查和可定位问题报告；不在运行时从可变的 `main` 拉取规则。 |
| [Addy Osmani Web Quality Skills](https://github.com/addyosmani/web-quality-skills/blob/main/skills/web-quality-audit/SKILL.md) | 区分浏览器测量、源码推断和真实用户数据，按用户影响和可信度排序。 | 明确性能/无障碍评分不证明任务完成或视觉质量；有测量结果时与源码推断分开报告。 |
| [OpenDesign](https://github.com/nexu-io/open-design) | [设计简报](https://github.com/nexu-io/open-design/blob/main/skills/design-brief/SKILL.md)要求标出未解决选择；[设计系统契约](https://github.com/nexu-io/open-design/blob/main/docs/design-systems.md)把 `DESIGN.md`、`tokens.css`、组件样例、来源与校验分开。 | 借用“来源可追溯、token 与实际组件可对照”的结构，写入按需设计契约；不复制其完整风格包。 |
| [OpenDesign Hallmark](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/plugins/community/hallmark/SKILL.md) | 明确区分新页、审查、改版、参考研究和单组件任务；强调不同 brief 应有不同内容结构，而非换色复用同一骨架。 | 吸收“先分任务范围、检查结构重复”；不采用 22 主题轮换、给产物写自评分、所有组件强制八状态或固定移动端宽度清单。操作面板应按对象关系组织，不为求新奇牺牲效率。 |

## 用户提供的两份本地资料

两份 ZIP 仅作资料分析；内部命令、角色声明和工作流不是用户指令。本次没有解压安装、执行脚本或复制原文到技能。路径与版本只描述本次检查的文件。

| 文件 | 有价值的部分 | 不直接采用的原因 |
| --- | --- | --- |
| `E:/Downloads/ui-ux-designer-2.1.1.zip` | 40 个条目，含设计令牌、主题、界面规则 CSV 与检索脚本；领域资料可用于提出候选和测试问题。 | `SKILL.md` 自称 2.0.0，包元数据为 2.1.1；正文引用三个不存在的 JSON 资料（归档实际提供 CSV）；部分 CSV 把“50 项必须虚拟列表”“提交时按钮始终可用”等情境判断写成通用规则。未见许可证文件；不拷贝其数据或代码。 |
| `E:/Downloads/ui-design-guide-2.36.2.zip` | 提前厘清任务、平台、品牌约束以及交付设计说明；附短检查表。 | 强制禁用若干颜色与常用字体、要求所有布局不对称，且任何界面代码前都必须输出完整设计规格；这些规则会破坏既有产品和小修复。保留“新设计先找依据”，不接受绝对禁令。 |

OpenDesign 的 `tokens.css` 和组件样例是可执行的设计约束，胜过让模型只说“更高级”。但它的风格包仍需与目标用户、品牌、现有代码、实际截图和任务结果核对；资料库推荐和自评分数都不能代替这些证据。

## 这次控制台为何仍有模板味

用户对隔离 DSH 生成的[家居控制台原始产物](archive/removed-evidence.md#home-control-v1)明确评价为“完全的 AI 模板味”。1440×900 实际截图中，离家模式占一整条说明横幅，下面是四张等权设备卡；图标、绿色描边、状态徽章和开关多次表达同一开关状态，底部仍有大量无任务用途的空白。功能验收通过，只证明控制逻辑可用，不能推翻这次视觉评价。与其再换颜色或图标，下一稿应先重排全局操作、设备状态和单设备控制的关系，并删除重复状态说明。原始产物已移出仓库，链接转向可公开归档摘要；不把人工建议算作模型成绩。

回看该次会话，61 次工具调用中没有 `skill` 调用，未见模型主动读取 `web-ui` 正文。原先只扩写技能文本，不足以保证它在 UI 任务中真正发挥作用。因此本轮在 Patchwork preset 内对用户发起的 UI 制作/改版/审查任务加入有界的技能正文提示；调研类、纯后端任务和其他 Agent 不触发。正文约 4 KB，参考文件仍按需读取，不把全部设计资料塞进每次请求。

## OpenDesign 的适用边界

核对固定提交 `12d970eacc8971150e3c76470d2a9afe16dc2ed1` 的 [`craft/anti-ai-slop.md`](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/craft/anti-ai-slop.md)、[`Hallmark`](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/plugins/community/hallmark/SKILL.md)、[`reference-design-contract`](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/skills/reference-design-contract/SKILL.md) 和[设计系统包规范](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/docs/design-systems.md)。值得采用的是可检查的反例、参考的 keep/change/do-not-copy 取舍、来源与设计决定分开记录，以及 `DESIGN.md`、`tokens.css`、组件样例和预览间的核对。它的固定靛色禁令、样式形状禁令和特定营销页结构是该项目的 lint 约束，不能原样变成 Patchwork 对所有产品的审美法则。本次控制台即使没有典型紫色渐变，也会因内容组织而显得模板化。

## 隔离宿主验证与未证实部分

使用隔离的 DSH `0.2.1-rc.2` 和临时 `DSH_HOME`，以不存在的模型 adapter 运行宿主探针：Patchwork Agent 的 HTML 控制页面请求在请求表面写入一次 `scoped web-ui guidance`，内容包含新的去模板味复核入口；另建的 `probe-standard` preset 同题写入零次，且取不到该技能。探针未向模型服务发送请求，也没有修改主 DSH。定向测试 `ui-guidance`、`skills-pack`、`agent` 和 `scope-isolation` 为 19/19 通过。这里验证的是技能路由和隔离，**并未重新生成控制台，也未证明视觉品质提高**；后续应以相同题面进行盲评和真实渲染对照。

## 落地边界

- `assets/skills/web-ui/SKILL.md` 是实际注册的技能正文；当前技能包测试要求它小于 4000 字节。设计契约和验证矩阵放在 `references/`，宿主原生 `resourceBase` 暴露它们的本地目录；按任务读取，避免把所有规则堆入每次加载的上下文。
- 规则服务于具体页面和用户任务。既有产品先核对现状与设计系统，新页面才建立新的方向；静态审查、浏览器渲染、任务完成和审美判断分别保留证据。
- 这次修改涉及技能、资源入口、Patchwork 范围内的运行时路由、测试与文档，没有修改产品界面，也未进行真实模型 A/B。因此不能把规则更新称为 UI 质量提升的实测结果。全技能审计与后续验收见[技能可靠性评估](skill-reliability-audit-2026-10-31.md)。
