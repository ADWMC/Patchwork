# ZCode / OpenClaude 提示词工程与编码体验调研

日期：2026-10-31。状态：源码调研与改进建议，尚未完成同题模型对照实验。

本文汇总本次侧会话对 ZCode、OpenClaude 的源码研究，包括系统提示词的内容、装配流程、设计取舍、技能与工具约束、代码和界面质量的关联，以及对 Patchwork 的建议。本文新增不代表其中建议已经实施。

补充：2026-11-01 新增 [ZCode 浏览器专项调研与融合方案](zcode-browser-research-2026-11-01.md)，覆盖实际 webview 入口、登录分区与命令所有权的差异、标签恢复、截图、虚拟剪贴板、录制和可信事实账本。本篇的提示词研究与专项互补，均不能代替同题运行对照。

后续补充：用户指定的 `asgeirtj/system_prompts_leaks` 已做[社区提示词样本研究](system-prompts-community-research-2026-11-01.md)，记录 12 份文件的定向阅读、固定提交及互相冲突的适用条件。它属于第三方汇编分析，不替代本文维护者源码依据；本轮没有修改运行规则或获得新的模型质量成绩。

## 1. 研究问题与证据边界

用户观察：Step 5 接入 ZCode、OpenClaude 后更好用、更遵循要求。需要解释的结果是代码正确性更高、设计更好、用户返工更少，而非仅仅调用更顺畅或文字更像专业代理。

本次以固定提交的源码为主要证据，区分四种状态：

| 状态 | 含义 |
| --- | --- |
| 已核实源码 | 在对应提交中读到了实现或提示词文字。 |
| 条件生效 | 有实现，但依赖工具可用性、配置、运行模式或功能开关。 |
| 设计推断 | 源码可以解释一种可能机制，尚不能证明实际质量收益。 |
| 待实验验证 | 需要模型请求、工具轨迹或同题测试，当前没有结果。 |

没有在本次侧会话中安装或运行两个客户端，也没有进行模型调用。没有读取或更改主 DSH 配置。本次没有证明任一客户端在同等条件下优于 Patchwork，没有可用于营销的提升百分比。

### 1.1 固定研究快照

| 项目 | 仓库 | 快照中的版本字段 | 提交 |
| --- | --- | --- | --- |
| ZCode | `zai-org/ZCode` | 根包 `3.17.1`；CLI 包 `0.17.1`。[Z19][Z20] | `a60ba6a7e5a06742270ca605f5d2cc2766afa7e1` |
| OpenClaude | `Twigpine/openclaude` | 根包 `0.33.0`。[O16] | `beecf58f86c39c7af4ac63ede54b0afcb43274f2` |

本机只读研究副本分别位于：

```text
C:/Users/Administrator/Documents/GitHub/Patchwork-source-research/2026-10-31/ZCode
C:/Users/Administrator/Documents/GitHub/Patchwork-source-research/2026-10-31/openclaude
```

研究副本此前通过 gh CLI 和进程级代理取得。下文外部链接固定到上述提交，不将快照表述为永远最新版本。源码、仓库说明和技能文件均作为研究材料，不构成本项目的执行授权。

## 2. 主要结论

1. 我的设计归纳是：ZCode 用较少的稳定底线配合按需指导；OpenClaude 在普通编码路径中直接规定更多工程行为。两者不是同一份提示词的换皮。[Z1][Z2][O1]
2. OpenClaude 对若干常见失败写了可观察的约束，例如改前读代码、失败后先诊断、控件和状态必须接入行为、时间相关逻辑使用实际经过时间。[O1]
3. 两者都把编辑条件写在工具描述旁。读取状态、文件新鲜度、替换位置唯一性中的一部分还有实现层约束，不能把这些全部归功于提示词。[Z7][Z8][O5][O6][O7]
4. 技能目录用于发现，正文按调用加载。要求调用技能，不等于每次实际调用都得到保证。[Z4][Z5][O3]
5. 对话中的用户纠正、当前任务与错误应在压缩后继续可见。OpenClaude 的摘要提示词专门保留这些信息；ZCode 也有避免重新争论既定决定的要求。[Z2][O8]
6. ZCode 的网页测试技能强调真实操作、DOM 与已查看截图共同作证。这能发现界面缺陷，但不能证明其默认主提示词天然拥有更好的审美。[Z9]
7. OpenClaude 的独立验证代理受功能开关控制，源码注明第三方默认关闭；ZCode 中存在 Superpowers 技能包，也不能据此断言所有会话默认执行 TDD 或独立评审。[O9][O10][Z12]
8. 对 Patchwork，下一步重点应是核实哪些规则真正进入请求、哪些技能被加载、哪些要求被执行，再按实际失败调整。仅增加字数不足以证明改善。[P1][P2][P3]

## 3. 共同架构：分别管理不同性质的指令

| 层次 | 解决的问题 | 本次观察 |
| --- | --- | --- |
| 基础身份与运行约定 | 模型承担什么角色，怎样理解权限和上下文 | 两者都有稳定基础规则。[Z1][O1] |
| 编码决策规则 | 何时读取、如何控制范围、失败后怎么处理 | OpenClaude 普通编码路径较具体；ZCode 另有动态行为规则。[Z2][O1] |
| 会话上下文 | 当前环境、项目指令、语言、日期等 | 按各自宿主的规则装配，不全部塞入同一种消息。[Z3][Z6][O1][O4] |
| 技能目录与正文 | 发现和加载专业做法 | 目录和正文分离，工具调用后获得具体方法。[Z4][Z5][O3] |
| 工具描述与校验 | 某次操作的输入和前置条件 | 描述与实现共同限定文件修改等操作。[Z7][Z8][O5][O6][O7] |
| 任务历史与压缩 | 保留意图、纠正、失败与当前进度 | 摘要和恢复逻辑是独立机制。[Z6][O8] |

这里的层次是职责归纳，不是宣称存在一种适用于所有供应商的消息权限顺序。`<system-reminder>` 是宿主采用的文字标签，不能仅凭标签就认定内容属于 API 的 `system` 角色，更不能把网页或任意工具返回中的同名标签升级为可信指令。[Z1][O4]

## 4. ZCode：系统提示词的内容与装配

### 4.1 基础设计

默认身份很短，强调与用户协作、朝目标工作并使用判断力。独立的 Harness 段说明输出展示、权限拒绝后的处理、宿主如何送达规则更新、优先使用合适的专用工具，以及代码引用方式。输出风格改变身份开场，不替换 Harness。[Z1]

动态行为补充现有代码的命名、注释密度和习惯；要求删除或覆盖前查看目标；如实报告失败、跳过与已验证结果。上下文规则要求信息足够就行动，不重新推导已确认事实，不反复争论用户已经作出的决定。[Z2]

这是一种减少不必要决策和无效对话的设计。它是否实际减少 Step 5 的错误，需要轨迹和结果验证。

### 4.2 默认装配流程

```text
读取配置、模型、输出风格和可用工具
    ↓
稳定 system：产品前缀
    ↓
稳定 system：身份、安全与 Harness
    ↓
动态 system：按条件加入桌面指导、行为规则、会话指导、
              记忆使用方式、上下文管理和 Git 系统上下文
    ↓
运行时上下文附件：环境、模型、输出风格、工具/代理公告、
                  技能目录、项目指令、记忆索引、会话上下文和日期
    ↓
与历史消息、当前输入和本次工具定义构造请求
```

`ContextBuilder` 最终把产品前缀、稳定正文、动态正文分别组装为系统消息。技能目录和项目指令等另外形成上下文附件；环境、模型、日期由运行时按当前事实宣告。[Z3]

上述流程图合并了构建期和运行期以便阅读，不代表每个节点都在每次请求中完整重复。

### 4.3 运行时补充与恢复

- 输入附件收集按固定顺序处理环境/模型/输出风格、工具搜索公告、代理目录和技能目录，各自仍有触发条件。[Z13]
- 请求前公告在压缩之后执行，检查项目指令、会话上下文和日期；通常通过历史去重，不重复注入整块内容。[Z6][Z13]
- 加载历史后，旧技能目录和项目指令公告按当前内容原位刷新或移除。运行中的项目指令与记忆索引采用启动快照；不能笼统宣称每轮重新读取磁盘。[Z6]
- 项目记忆使用规则与 `MEMORY.md` 索引是不同内容。不能把索引的存在当作所有记忆正文都已加载。[Z3][Z14]

### 4.4 不同分支不能混成一套默认行为

- 自定义系统提示词替换默认身份正文，并跳过默认动态系统段；环境、技能目录和项目上下文仍按各自条件处理。[Z3]
- 工作流角色和自定义系统提示词互斥，同时设置会报错。工作流角色会跳过部分面向主会话的指导。[Z3]
- 源码中有关广泛探索时委派代理以及 AskUserQuestion 的部分指导处于注释状态，不属于活跃默认提示词。[Z2]

因此，调整某段提示词前必须确认当前使用的是哪条分支，不能只比较仓库里文件的长度。

### 4.5 技能与工具旁的提示词

技能目录默认预算为 20,000 字符，单项描述上限 250 字符，超出预算后可退化为名称和路径。这是目录预算，不是整个上下文的 token 上限。[Z4]

Skill 工具描述要求：任务属于某个已列技能时先调用；正文加载后再遵循。普通技能加载有 100,000 字节正文上限，特殊工作流技能另有 200,000 字节上限；加载结果标记正文是否截断并提供资源基目录。这些数值同样不代表模型实际读取了全部内容。[Z5]

编辑工具要求先读文件、精确匹配缩进和文本、匹配位置唯一；写入工具区分新文件/完整替换与局部编辑，并检查读取状态和新鲜度。可执行校验比单纯的行为提醒更能拦住某类错误，但不等于语义正确性得到证明。[Z7][Z8]

## 5. OpenClaude：系统提示词的内容与装配

### 5.1 普通编码路径的设计

在普通路径中，系统提示词直接包含 Doing tasks 等工程规则：

- 将编码意图落实到工作区操作，理解当前目录的任务上下文。
- 未阅读相关代码前不提出修改；优先修改现有文件。
- 限定需求范围，避免顺手重构、额外配置、一次性抽象和假想需求。
- 失败后读取错误、检查假设，再做针对性修复；不盲目重试，也不在一次受挫后立即放弃。
- UI 元素、状态变量和参数必须接入实际行为；时间敏感逻辑依据真实经过时间。
- 工具可用时直接行动，独立调用可以并行，存在依赖的调用按顺序执行。

这些条目既限制实施不足，也限制过度设计。它们是明确的行为约束，但仍依赖模型遵守；并非每一条都有程序门禁。[O1]

### 5.2 默认装配流程

```text
读取配置、工具、技能目录、输出风格和环境
    ↓
稳定系统段：
  身份 → 系统运行约定 → Doing tasks（受输出风格控制）
  → 操作/授权 → 工具使用 → 沟通风格 → 输出效率
    ↓
缓存分界
    ↓
动态系统段：
  会话指导、记忆、条件模型指导、环境、语言、输出风格、
  MCP 指导、临时工作区和上下文处理规则等
    ↓
追加 systemContext
    ↓
把 userContext 和本次附加信息放入消息历史
    ↓
连同工具定义交给模型调用层
```

系统段顺序由 `getSystemPrompt()` 明确组装；`query.ts` 将系统上下文、用户上下文、消息与工具分别传给调用层。[O1][O4][O11]

### 5.3 动态内容不等于每轮重算

多数动态系统段通过注册表缓存到 `/clear` 或 `/compact`。易变段需要单独标记并说明原因；MCP 指导还有增量附件分支。稳定前缀和动态变化分开主要是上下文一致性与缓存工程，不是审美或代码正确性提升的直接证据。[O1][O2]

`appendSystemContext()` 追加的是系统上下文；`prependUserContext()` 构造的是带 `<system-reminder>` 的用户消息。技能目录也能通过元数据用户消息传入，不能把所有提醒统称为真正的系统消息。[O4][O12]

### 5.4 技能发现与正文加载

Skill 工具描述要求匹配任务后先调用，不能只提到技能却不实际调用。目录按可用上下文估算预算，默认上限参数为 8,000 字符，单项描述上限 250 字符；内置技能有优先保留策略，因此不能把配置预算描述为所有路径的严格总长度上限。[O3]

已调用技能在相关恢复路径中可以形成继续遵循的提醒。是否走到该路径仍取决于宿主状态，不应假定所有正文永远常驻。[O12]

### 5.5 工具约束与实际拦截

Write 的描述要求修改现有文件前读取，局部修改优先 Edit。Edit 要求精确替换、保留缩进、目标唯一。[O5][O6]

实现会检查文件是否已读、读取是否完整，以及读取后文件是否变化；唯一匹配也有校验。这能针对未读覆盖、过期内容写入和错位替换，但不能检测所有逻辑错误，也不能泛化为所有写入通道均受同一检查。[O7][O14][O15]

### 5.6 用户纠正与长会话

摘要提示词要求保留原始意图、重要文件和代码、错误与修复、用户反馈、待办与当前工作。用户曾要求改变做法的内容被专门强调。这为压缩后减少任务漂移提供了机制依据，但摘要仍由模型生成，可能遗漏或失真。[O8]

### 5.7 明确排除的默认能力误判

- `CLAUDE_CODE_SIMPLE` 会进入极简身份、目录和日期分支，不能与普通路径混谈。[O1]
- 输出风格可以关闭普通 Doing tasks 段，基础操作和工具等规则仍分别装配。[O1]
- 一些强化注释、完成验证、主动判断及如实报告规则受 `USER_TYPE === 'ant'` 控制，不能声称普通第三方 Step 5 会话必然获得这些内容。[O1]
- 独立对抗验证代理同时依赖 `VERIFICATION_AGENT` 与 `tengu_hive_evidence`，源码注明第三方默认关闭。[O9][O10]
- 源码中的内部模型调优注释不是本次实测结果，不将其数字转述为 Step 5 或 Patchwork 的性能证据。

## 6. 提示词设计：值得学习的取舍

本节是基于上述事实的设计归纳，不是上游维护者公开确认的统一设计宣言。

### 6.1 将质量目标拆成可观察的决策

| 目标 | 源码中更具体的做法 | 可检查的证据 |
| --- | --- | --- |
| 理解现有代码 | 改前读取、遵循周围风格 | 是否读到了调用方、实现和相关测试，而非只列文件名。 |
| 完整实现 | 新元素和状态必须接入行为 | 操作是否触发真实处理，状态是否产生可见结果。 |
| 控制范围 | 不为想象需求创建抽象、配置和文件 | diff 中的新增职责是否属于当前需求。 |
| 处理失败 | 先读错误、核假设、再修复 | 下一次操作是否依据前次错误改变。 |
| 减少重复沟通 | 不重开已定决定，保留纠正 | 后续行为是否继续满足最新有效要求。 |
| 准确交付 | 区分失败、跳过和已验证 | 报告与工具回执是否一致。 |

前五项分别可在普通编码指导、上下文规则和摘要中找到依据；最后一项在 ZCode 活跃行为规则中明确存在，OpenClaude 的部分强化版本有内部开关。[O1][Z2][O8]

### 6.2 同时限制过度设计和半成品

“最小正确改动”需要两个边界：满足当前需求，并避免引入不必要复杂度。若只强调少写代码，会诱导遗漏功能；若只强调主人翁和架构完整，会诱导扩大范围。OpenClaude 在同一组规则中同时限制这两端，值得借鉴。[O1]

### 6.3 稳定约定与可变偏好分开

输出风格、项目偏好、可用技能和运行权限不是同一类事物。ZCode 保持 Harness 独立于输出风格；两者都依据实际可用工具与配置生成指导。对 Patchwork，设计原则应是先明确每条规则的来源、作用域与生效条件，而不是仅在末尾追加更强硬措辞。[Z1][Z2][Z3][O1]

### 6.4 工具旁约束与实现校验互补

提示词说明何时使用工具和如何提供输入；实现检查可以客观判断的前置条件。对于文件新鲜度、替换匹配、路径与作用域等条件，工具层更适合承担可靠拦截。对于语义质量、需求完整性、审美和授权含义，不能假装一条工具检查已经全部解决。[Z7][Z8][O7]

### 6.5 不把特定模型补丁当作通用真理

上游存在模型与发布环境相关的措辞和开关。迁移到 Step 5 前，需要验证它是否改善当前模型、当前任务和当前宿主；不应复制内部条件段后就宣称继承了对应效果。[O1][O9]

## 7. 代码质量、设计质量与返工：分别看证据

### 7.1 对代码正确性的可能贡献

源码支持的候选机制是：改前获取事实、缩小无关变更、明确 UI/状态接线、按错误诊断、避免过期内容覆盖，以及压缩后继续保留用户纠正。这些机制各自针对某类失败，不构成对所有功能正确性的保证。[O1][O7][O8][Z2]

### 7.2 对界面质量的证据较窄

ZCode 的 Browser Use 官方插件默认启用相关技能与桥接，但宿主 MCP 注入仍是独立事项。不能把“插件默认启用”直接等同于模型已经调用并查看浏览器。[Z10]

`web-gui-tester` 要求真实操作、DOM 与视觉共同验证，明确截图必须实际查看；测试覆盖主流程、反馈、输入边界、布局和样式。它主要帮助发现功能和渲染问题。[Z9]

产品后续明确要求 ZCode 式“Agent 与用户共用一个可见浏览器”，这不等同于给模型增加一个无头浏览器工具，也不等同于打开 DSH 自带的用户浏览器页签。Patchwork 的实施边界与真实宿主验证另见[浏览器方案与验证](browser-integration-research-2026-11-01.md)。

回合结束时自动捕获的浏览器图像用于展示，源码明确不把它回灌模型上下文；模型视觉自检需要实际获得并查看图像的调用路径。[Z11]

在本次检查的默认主提示词中，没有足够证据证明其已完整解决参考选择、信息层级、构图、字体和真实内容取舍。更好的设计结果仍可能与具体技能、项目上下文、模型配置或更多迭代有关，当前没有完成归因。

### 7.3 对返工的定义

返工应指由于遗漏、错误、偏离要求或界面不可用造成的后续修正；用户主动改变需求不应全部计为失败。评测必须保留原始要求和变更时间，否则无法区分模型没做好与任务本身改变。

## 8. Patchwork 当前基础与差距判断

本节依据本工作区 2026-10-31 的未提交状态；不是某个已发布版本的描述。工作区已有其他任务的修改，不能把它们都归于本次文档整理。

- 技能注册器已经采用目录发现、正文按需加载，并在有参考目录时注册 `resourceBase`。不能再将现状概括为所有技能正文没有资源入口。[P1]
- `web-ui` 已区分小改动、新页与既有产品，要求读取宿主 tokens、主题、实际组件和画面；也明确把设计理由与验收说明留在会话，页面文字服务实际使用。[P2]
- `web-ui` 已要求目标尺寸截图、实际操作和分别报告源码/渲染/几何/交互证据。存在要求，不等于每次模型会遵守。[P2]
- `patchwork` 入口已有事实/推断区分、范围、纠正和证据等规则；运行时按 Patchwork 预设挂载相关能力。是否真正隔离，应以相应宿主测试和真实会话回执为准，本次没有重跑。[P3][P4]
- 当前可靠性审计已指出：正文长度不是质量指标，资源读取、技能路由和效果评测需要单独验证。本次建议接续该审计与既有融合执行记录，不另建一套互相竞争的规则。[P5][P6][P8]
- `assets/prompts/maintainable-coding-agent-prompt.md` 的存在本身不能证明其正被注入；不把历史文档措辞直接当作当前模型收到的指令。[P1][P4]

因此，当前最需要补齐的证据是：实际请求包含什么、技能是否加载、引用资源是否读取、纠正是否更新有效验收条件，以及最终结果是否经过真实检查。

## 9. 融合建议：待实施，不是已完成功能

### P0：先建立实际生效内容的可见性

目标是能回答一次失败发生在“没加载”“没遵守”“规则不合适”还是“工具/宿主异常”。

- 在 Patchwork 作用域内记录规则来源、版本、摘要或哈希、加载时机和是否截断。
- 区分技能目录、正文加载、参考资源读取与实际执行证据，不用单一“技能已启用”状态概括。
- 日志默认不保存密钥、完整私人提示词或不必要的原始上下文；需要详细诊断时采用明确开关和脱敏策略。
- 隔离验证普通 Agent、其他会话、恢复会话与切换后的能力撤销，不扩大到其他会话。

退出条件：能为一个指定任务重建脱敏的生效清单，同时证明其他会话没有获得 Patchwork 专属内容。仅有日志字段不算通过。

### P1：将总规则收敛为明确的决策契约

- 总规则保留范围、授权、事实来源和完成条件；具体领域方法放在匹配技能。
- 对每条规则说明触发条件、动作、例外与证据；优先改真实失败对应的条目。
- 检查描述、正文和参考资源是否冲突，避免目录承诺一种做法、正文要求另一种。
- 对用户纠正更新受影响要求和检查，不重新打开已确认且未被撤销的决定。
- 区分“未验证”与“失败”，不把注册或检查通过泛化为语义质量通过。

退出条件：正例、难负例和纠正用例中，没有明显误触发、冲突或无关扩张；真实任务另计效果。

### P2：把可客观判定的条件交给工具

- 优先复用宿主已有文件读取状态、编辑校验和作用域能力，不重复造一套旁路。
- 研究哪些检查适合放在工具层，哪些只能作为模型提示，避免承诺“统一拦截全部错误”。
- 对失败返回说明具体条件与下一步；不能以删检查、绕工具或制造成功回执解决失败。
- 不因引入检查而误拦正常使用；记录误报和回退路径。

退出条件：目标错误能够复现且被拦截，合法操作继续成功，其他 Agent 的行为不受影响。

### P3：将 UI 方法与真实画面建立联系

- 复用现有设计契约与验证矩阵，围绕目标用户、主任务、真实内容、宿主 tokens 和参考证据工作。[P9][P10]
- 对新页面记录具体视觉方向和关键取舍；对局部修改保持局部范围。
- 操作真实控件、查看实际截图，分别检查功能与视觉；自动截图落盘不等于模型已看图。
- 不把设计解释、特效清单或验收结果塞进交付页面。页面文字是否必要，以用户任务判断。
- 视觉判断有争议时保留图像与用户反馈，不把模型自评分当最终依据。

退出条件：目标尺寸与状态可重现；交互有真实证据；视觉由预先定义的标准及人工审查评价。

### P4：受控比较后再决定固化

提示词、技能和工具流程的调整先在隔离环境验证，再按产品约定确认生效。实验结果应能追溯任务、初始仓库、模型配置和规则版本；不自动将一次成功写成永久跨会话规则。

## 10. 建议的验证任务与指标

以下是拟议实验，不是已运行的测试题或成绩。

### 10.1 分开回答两个问题

| 问题 | 建议比较方式 | 可以得出的结论 |
| --- | --- | --- |
| 提示词改动是否有效 | 同一宿主、模型、工具和任务，只改变待评估指令；必要时分开技能和工具实现 | 较接近该改动的效果。 |
| 客户端整体体验是否不同 | 同题比较不同客户端，记录各自请求、配置、工具和交互 | 客户端整体差异，不能全部归因于系统提示词。 |

固定或完整披露模型标识与版本可见性、服务入口、上下文和输出预算、推理设置、工具权限、初始代码、依赖与会话状态。无法对齐的变量列为限制，不隐去。

### 10.2 任务集合

| 任务 | 主要观察 | 判定证据 |
| --- | --- | --- |
| 既有代码的真实 bug 修复 | 是否定位原因、控制范围、保护回归 | 原始失败复现、针对性检查与相关回归。 |
| 含异步状态的功能 | 是否把等待、成功、失败和重复操作接通 | 真实请求或受控接口、状态和用户操作记录。 |
| 嵌入宿主的 UI 页面 | 是否遵循现有组件、tokens、主题和布局 | 目标尺寸截图、主题切换和交互证据。 |
| 明确限制页面文案的可视化 | 是否避免添加解释性副标题等额外内容 | 页面可见文本与原始要求逐项核对。 |
| 用户中途纠正后继续 | 是否沿用新要求，撤销过期判断 | 要求版本、后续操作与产物。 |
| 长会话压缩后继续 | 是否保留纠正、未完成项和已验证结果 | 压缩前后有效要求与执行轨迹。 |
| 工具失败或缺失 | 是否依据错误调整，不伪造工具或证据 | 失败返回与后续选择。 |
| 切换 Agent 和并行会话 | 是否泄露专属技能、工具或规则 | 独立会话的目录、请求和行为检查。 |

### 10.3 结果报告

- 正确性：原始失败是否修复、需求项通过数量、相关回归与新增缺陷。
- 设计：功能、视觉和宿主一致性分开评分；保留可复查图像与人工评价依据。
- 返工：由错误或遗漏导致的修正轮次，区分用户新增需求。
- 过程：技能正文与资源读取、无效调用、重复失败、无关变更。
- 成本：总 token、调用次数、耗时和用户介入；不能仅比较单次回答长度。
- 声明准确性：完成报告是否与真实检查一致。

每组采用独立新会话并做多次重复，公布样本数、失败例与配置限制。模型自评只能辅助归类，不能作为唯一质量真值。先记录原始数据，再决定哪些结论可以对外表述。

### 10.4 已查到的 Step 5 接入差异：实验混杂因素

以下比较的是 ZCode 固定源码中的声明和本仓库一个特定隔离实验覆盖文件；不是两个客户端的真实运行抓包，也不是 Patchwork 的全部默认配置。

| 项目 | ZCode 固定快照中的 Step Plan / Step 5 | 本仓库 Earth 隔离实验覆盖文件 |
| --- | --- | --- |
| 模型标识 | `step-5-preview` | `step-5-preview` |
| 客户端协议配置 | `anthropic-messages` | `openai-completions` |
| 上下文声明 | `1000000` | `1000000` |
| 图像输入声明 | `supportsImage: true` | 该覆盖片段未单独声明，不据此判断最终有效能力 |
| 输出预算配置 | 模型规格声明最大 `64000`；主循环读取所声明上限 | `defaultMaxTokens` 与模型 `maxTokens` 均为 `8192` |
| 推理相关配置 | 提供 `low` / `medium` / `high`，映射为 `output_config.effort` | `reasoningEfforts: false` |

ZCode 配置依据为供应商模板与模型规格；本地覆盖文件仅用于那个实验。[Z16][Z17][P7]

这些差异可能改变工具调用、长输出完成度或有效请求内容，应作为对照实验的控制项；当前不能证明它们就是设计或正确性差异的原因。`reasoningEfforts: false` 只能说明客户端配置，不证明服务端内部推理被关闭。相同模型标识也不能保证不同协议和入口的最终服务行为完全一致。

ZCode 另有输出截断后的有界续写，最多追加三次。这用于处理截断，不代表完整任务必然成功，也不是审美提升的证据。[Z18]

## 11. 不能直接照搬的内容

- OpenClaude 的仓库不是 ZCode 分支。其 LICENSE 声明代码派生自 Claude Code，贡献者修改仅在可许可范围内以 MIT 提供，底层派生代码仍涉及 Anthropic 权利。这里仅记录仓库声明，不作授权结论，也不把整个仓库视为可自由复制的 MIT 代码。[O13]
- ZCode 根许可证为 Apache-2.0，具体组件或技能仍需检查各自声明。研究设计思想与逐字复制代码/正文应分开处理。[Z15]
- 内部功能开关、特定模型补丁、平台工具名、权限与生命周期约定不应原样嫁接到 Patchwork。[O1][O9][Z3]
- 完成检查、浏览器插件、截图文件和技能目录各自只能证明对应环节，不能互相替代，也不能证明用户体验已改善。

## 12. 待补证据与当前完成范围

已完成：固定两份源码快照，检查普通提示词、条件分支、技能加载、工具前置条件、上下文装配、纠正保留和界面检查要求，并汇总成本文。

待完成：捕获隔离环境中的实际生效请求；核对实际运行时 Step 5 的协议请求、输出预算与推理设置；在对齐条件下验证正确性、设计和返工差异。第 10.4 节记录的是静态配置证据，不能据此推导服务端行为。

本文没有实施第 9 节建议，没有运行父会话的模型测试，没有修改运行配置或提交仓库。

## 13. 证据索引

### ZCode：固定提交 `a60ba6a7e5a06742270ca605f5d2cc2766afa7e1`

- [Z1] 身份、安全与 Harness：`identity.ts`，重点 L9–L51。
- [Z2] 活跃行为、上下文指导与注释分支：`dynamic-sections.ts`，重点 L4–L70。
- [Z3] 默认/自定义/工作流分支、系统消息与附件装配：`builder.ts`，重点 L82–L329。
- [Z4] 技能目录预算与降级：`sections/skills.ts`，重点 L9–L57。
- [Z5] Skill 工具提示词、加载上限和正文包装：`tool/handlers/skill.ts`，重点 L17–L124。
- [Z6] 运行时公告、恢复与去重：`context-refresh.ts`，重点 L79–L113、L180–L286。
- [Z7] 编辑工具：`tool/handlers/edit.ts`，重点 L53–L65 及其校验实现。
- [Z8] 写入工具：`tool/handlers/write.ts`，重点 L37–L48 及其校验实现。
- [Z9] 网页测试技能：`web-gui-tester/SKILL.md`，重点 L6–L12、L68–L140。
- [Z10] Browser Use 默认启用范围：`official-plugin-definitions.ts`，重点 L183–L208。
- [Z11] 回合截图展示路径与不回灌说明：`browser-turn-screenshot.ts`，重点 L90–L110。
- [Z12] Superpowers 技能包；包存在不证明默认启用。
- [Z13] 主循环输入附件与请求前公告：`turn-loop.ts`，重点 L140–L178、L253–L280。
- [Z14] 项目指令与记忆索引：`request-user-context.ts`，重点 L37–L81。
- [Z15] 仓库根许可证。
- [Z16] StepFun 协议与模型声明：`config/provider/zcode-builtin.json`，重点 L585–L624、L7386–L7412。
- [Z17] 主循环采用模型声明的输出上限：`turn-model-step.ts`，重点 L171–L173。
- [Z18] 截断续写的次数边界：`turn-output-token-continuation.ts`，重点 L24–L43。
- [Z19] 根包版本字段。
- [Z20] CLI 包版本字段；不能与根包版本混为一谈。

### OpenClaude：固定提交 `beecf58f86c39c7af4ac63ede54b0afcb43274f2`

- [O1] 主提示词和条件装配：`constants/prompts.ts`，重点 L193–L310、L441–L573。
- [O2] 系统段缓存：`systemPromptSections.ts`，重点 L16–L65。
- [O3] Skill 目录预算与调用指导：`SkillTool/prompt.ts`，重点 L21–L63、L279–L301。
- [O4] 系统上下文和用户上下文：`utils/api.ts`，重点 L505 起。
- [O5] Write 工具描述：`FileWriteTool/prompt.ts`，重点 L6–L17。
- [O6] Edit 工具描述：`FileEditTool/prompt.ts`，重点 L4–L27。
- [O7] 文件读取/新鲜度/唯一性校验实现。
- [O8] 摘要保留意图、用户纠正和当前工作：`services/compact/prompt.ts`，重点 L31–L77。
- [O9] 独立验证提示词开关：`constants/prompts.ts`，重点 L387–L391。
- [O10] 验证代理注册开关：`builtInAgents.ts`，重点 L66–L70。
- [O11] 实际模型调用入口：`query.ts`，重点 L1046–L1048、L1563–L1574。
- [O12] 技能目录和已调用技能的消息转换：`utils/messages.ts`，重点 L2629–L2646、L2719–L2728。
- [O13] 仓库 LICENSE 中的权利与来源声明。
- [O14] Write 的读取状态与新鲜度校验：`FileWriteTool.ts`，重点 L198–L218。
- [O15] 编辑匹配的唯一性检查示例：`FileEditTool/utils.ts`，重点 L997–L1017。
- [O16] 根包版本与许可证字段。

### Patchwork：本工作区状态

- [P1] 技能注册与参考资源目录。
- [P2] 现有 UI 技能。
- [P3] 当前任务与技能导航。
- [P4] Patchwork 专属运行时挂载。
- [P5] 七个技能的可靠性评估。
- [P6] 既有技能融合方案。
- [P7] 特定 Earth 隔离实验覆盖配置；仅作为静态配置比较，不代表本次执行。
- [P8] 既有技能融合执行记录。
- [P9] UI 设计契约。
- [P10] UI 验证矩阵。

[Z1]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/context/sections/identity.ts#L9-L51
[Z2]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/context/dynamic-sections.ts#L4-L70
[Z3]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/context/builder.ts#L82-L329
[Z4]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/context/sections/skills.ts#L9-L57
[Z5]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/tool/handlers/skill.ts#L17-L124
[Z6]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/runtime/methods/context-refresh.ts#L180-L286
[Z7]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/tool/handlers/edit.ts#L53-L65
[Z8]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/tool/handlers/write.ts#L37-L48
[Z9]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/browser-use-plugin/skills/web-gui-tester/SKILL.md#L6-L140
[Z10]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/bootstrap/src/app/official-plugin-definitions.ts#L183-L208
[Z11]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/runtime/methods/browser-turn-screenshot.ts#L90-L110
[Z12]: https://github.com/zai-org/ZCode/tree/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/superpowers-plugin
[Z13]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/runtime/methods/turn-loop.ts#L140-L178
[Z14]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/context/sections/request-user-context.ts#L37-L81
[Z15]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/LICENSE
[Z16]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/config/provider/zcode-builtin.json#L585-L624
[Z17]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/runtime/methods/turn-model-step.ts#L171-L173
[Z18]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/core/src/runtime/methods/turn-output-token-continuation.ts#L24-L43
[Z19]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/package.json
[Z20]: https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/package.json
[O1]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/constants/prompts.ts#L193-L573
[O2]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/constants/systemPromptSections.ts#L16-L65
[O3]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/tools/SkillTool/prompt.ts#L21-L301
[O4]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/utils/api.ts#L505-L540
[O5]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/tools/FileWriteTool/prompt.ts#L6-L17
[O6]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/tools/FileEditTool/prompt.ts#L4-L27
[O7]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/tools/FileEditTool/FileEditTool.ts#L275-L307
[O8]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/services/compact/prompt.ts#L31-L77
[O9]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/constants/prompts.ts#L387-L391
[O10]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/tools/AgentTool/builtInAgents.ts#L66-L70
[O11]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/query.ts#L1550-L1574
[O12]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/utils/messages.ts#L2629-L2728
[O13]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/LICENSE
[O14]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/tools/FileWriteTool/FileWriteTool.ts#L198-L218
[O15]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/src/tools/FileEditTool/utils.ts#L997-L1017
[O16]: https://github.com/Twigpine/openclaude/blob/beecf58f86c39c7af4ac63ede54b0afcb43274f2/package.json
[P1]: ../src/skills/register.mjs
[P2]: ../assets/skills/web-ui/SKILL.md
[P3]: ../assets/skills/patchwork/SKILL.md
[P4]: ../src/runtime.mjs
[P5]: skill-reliability-audit-2026-10-31.md
[P6]: skills-fusion-plan-2026-10-31.md
[P7]: experiments/skills-2026-10-31/step5-earth.overlay.yml
[P8]: skills-fusion-execution-2026-10-31.md
[P9]: ../assets/skills/web-ui/references/design-contract.md
[P10]: ../assets/skills/web-ui/references/verification.md
