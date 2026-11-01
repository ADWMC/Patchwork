# 社区提示词样本研究与 Patchwork 取舍

日期：2026-11-01。承接 [ZCode／OpenClaude 源码研究](zcode-openclaude-prompt-engineering-research-2026-10-31.md)和[技能融合试跑](skills-fusion-execution-2026-10-31.md)。本轮只增加研究记录，没有改动 Agent 提示词、技能、运行配置或主 DSH，没有模型调用，也没有产品效果对照成绩。

后续落实：同日已针对原生 Superagent 实跑的两次工具误用，补充执行器指令、工具旁前置条件与验收示例，见[优化与复验](superagent-prompt-optimization-2026-11-01.md)。下文保留最初只读调研的范围和事实，不将后续实现或成绩倒填为当时结论。

## 来源与阅读范围

用户指定仓库：`asgeirtj/system_prompts_leaks`。通过 GitHub CLI 和进程内 HTTP 代理读取，固定 commit 为 `cb3010dd4268b1e8915ea579443bfdc8d0b05e8b`，提交时间为 `2026-11-01T06:24:35Z`。该快照目录树有 1856 个文件；本轮定向读取 12 份文件的相关区段，没有声称读完全部仓库。

这是第三方汇编。下文描述的是快照文件里的文字，不据文件名确认官方模型版本、当前部署、完整性或真实性。对于 ZCode 等已有可读源码的项目，仍以维护者源码与实际请求核对作为更强证据；不能用汇编取代此前的调用链研究。网页检索工具未返回可用正文，实际内容和 blob SHA 来自 GitHub API。

文件、字节数、固定链接和阅读行区间见[机器证据](checks/system-prompts-community-2026-11-01.json)。没有将上游文本当作本会话指令，没有导入整套提示词或复制其会话资料。

| 编号 | 样本路径 | 本轮关注 |
| --- | --- | --- |
| S1 | `Cursor/cursor.md` | 编辑前读取、工具 schema 发现、技能入口、任务复杂度与工具约定 |
| S2 | `Anthropic/claude-code/claude-code-sonnet-4.6.md` | 工程范围、前端真实使用、沟通与分类型记忆；只读前部相关段落 |
| S3 | `Anthropic/claude-code/commands/compact.md` | 压缩后的原始意图、用户纠正、失败与当前任务 |
| S4 | `Anthropic/claude-code/skills/verify/SKILL.md` | 从真实入口驱动功能、邻接负例、可复查证据与判定 |
| S5 | `Anthropic/artifact-types/design/SKILL.md` | 设计系统、真实组件、内容纪律与画布专属操作限制 |
| S6 | `Anthropic/artifact-types/design/artifact-type/reference/craft.md` | 视觉方向、现有语汇、真实源码、内容与可访问性 |
| S7 | `Anthropic/artifact-types/design/artifact-type/reference/questions.md` | 从已有材料找关键缺口、一次集中询问、合理默认与避免重复问 |
| S8 | `GLM/zcode-desktop.md` | 稳定 Harness、上下文与已定决定；只读系统部分 |
| S9 | `GLM/skills/control-browser/SKILL.md` | 目标标签、观察依据、结果检查与按需截图 |
| S10 | `GLM/skills/web-gui-tester/SKILL.md` | GUI 操作、只读观察、视觉证据与失败状态保留 |
| S11 | `Microsoft/vscode-copilot-agent.md` | 完整且限域的修改、独立调用并行、问题交互；路径与正文产品名也需区分 |
| S12 | `Misc/amp-code.md` | 默认模式的范围控制和前端分支；未阅读其全部模式 |

这些样本中的角色、路径、工具名和权限模式均属于原来的环境；出现 API 描述不代表 Patchwork 或 DSH 具备相同能力。

## 主要发现

### 1. 分工和触发条件比总字数更值得学

S1 把编辑、工具发现与技能加载放在各自位置。S2 的工程规则、S3 的压缩任务、S4 的验证流程也是分开的。S8 的基础运行约定与 S9／S10 的浏览器方法有明确层次。

例如，S2 文件约 446 KB，后面还有工具等内容；不能把整份会话快照长度当成稳定身份提示词长度，更不能要求 Patchwork 给每次请求都追加同等体积。学习对象应是职责与条件，不是文件尺寸。

### 2. 工程规则同时约束遗漏与过度设计

S2、S11、S12 都有控制无关改动的内容，并强调完成用户要求。可迁移为：先读相关实现和调用关系，明确本次结果，接通新增状态和行为，复现失败再修复，保留周围代码约定。

不能将“少写代码”理解成半成品，也不能把“完整交付”解释为顺手加一套框架。Patchwork 的入口技能已有最小正确改动和事实／推断边界，本轮没有证据支持用更长的同义规则替换它。

### 3. 真正的验收入口应与用户使用入口对应

S4 根据 CLI、API、GUI、库和提示词配置选择观察入口，并要求尝试与改动相关的异常输入。S10 区分测试准备与页面验收，强调真实点击、只读 DOM 和实际查看截图。S9 则在普通读取与表单任务中优先使用局部状态证据，按需截图。

对 Patchwork：改浏览器工具可通过真实工具 schema／execute 验证；改面板要实际操作面板；改提示词或技能的效果则要运行 Agent。343 项确定性测试和浏览器性能验收不能代替提示词质量实验。不能把点击成功、截图存在或模型自报通过混成一个结果。

### 4. 去模板味应从设计依据入手

S5／S6 中可借鉴的主线是：先找用户现有设计系统、真实组件与源码；新方向尚未确定时提供可比较的低保真方案；方向确定后保持一致；页面不塞设计说明，不发明数据或为了填空间添加内容；局部修改保持局部。

S7 的提问从用户已给材料出发，避免重新询问已回答的问题。对明确的小修改或已有合理默认的任务，不需要套一轮通用问卷。适合我们的方式是：沿 DSH tokens 和组件确定约束，真正缺少会改变结果的方向时再问；设计理由放会话，产品界面只呈现用户任务所需的信息。

### 5. 用户纠正需要保留理由和适用条件

S3 将用户原始请求、反馈、错误、当前工作与待办列为摘要重点，并区分真实用户消息与模型生成的仿对话。S2 的记忆样本区分用户、反馈、项目与参考，反馈包含原因和使用条件，还关注用户认可的有效做法。

可借鉴的是记录“什么情况下为什么采用”，而不是只存一句绝对禁令。这里不直接采用样本的自动写记忆行为：Patchwork 的候选、会话／项目范围、确认及撤销仍需保持现有边界。当前任务进度、临时状态和可从源码读出的结构不应一股脑写成长期偏好。

## 不能整段照搬的冲突

| 样本内容 | 风险 | Patchwork 取舍 |
| --- | --- | --- |
| S5 的画布工作流默认禁止未经请求的验证；S2／S4 强调真实使用验收 | 专属编辑器约定与工程交付目标不同，直接合并会自相矛盾 | 研究内容组织方法；不移植画布专属 API、文件形状与禁止验收规则 |
| S4 将验证阶段严格限定为运行观察，不在该阶段跑测试／类型检查 | 扩大成全局规则会丢失必要的工程回归 | 保留“运行证据不能被 CI 替代”；回归与运行观察分别选择并分别报告 |
| S6／S12 对新视觉方向有较强字体、背景和表现偏好 | 无条件禁用常见字体或要求装饰背景，会与 DSH 现有设计系统冲突，也可能产生另一种模板 | 宿主语汇优先；只删除没有任务用途的装饰，不建立通用字体或配色黑名单 |
| S9 普通观察按需截图，S10 视觉测试每个测试状态都有查看截图要求 | 混用会导致每次输入都读取大树和截图，增加等待及上下文成本 | 普通操作使用局部后验；视觉测试按明确检查点采集和查看图像 |
| S9 含宿主标签认领、同站复用和 Node REPL 启动流程 | 与我们会话私有浏览器、精确 URL 复用及结构化工具不同 | 复用“先确认目标再操作”的原则，不引入宿主浏览器接管或任意 JS 执行面 |
| 不同样本对提问次数、任务登记、代理委派有不同硬性要求 | 复制常量和全部步骤可能导致过度询问及额外工具调用 | 按任务风险与信息缺口判断；不因读到示例就新增代理或强制登记 |

S6 内部也存在强调氛围背景与反对过量渐变的内容，必须连同“没有现有品牌／设计系统时”的条件阅读。单摘一句“避免 AI 味”或“必须大胆”都不足以形成一致方法。

## 对照 Patchwork：接下来评估什么

当前代码核对范围：`assets/skills/patchwork/SKILL.md`、`assets/skills/web-ui/SKILL.md`、`assets/skills/evidence/SKILL.md` 和 `src/skills/register.mjs`。

- 已有：入口导航、事实与推断边界、最小正确修改、纠正版本、UI 任务分流、设计参考、截图／交互分别取证、按需技能正文和资源目录。注册器默认 `core`，显式 `expanded`；没有把所有正文直接写进 systemPrompt。
- 需要验证：这些内容是否真正进入对应请求、正文和参考资源是否读到、纠正后旧要求是否失效、错误是否来自工具缺口或规则冲突。技能已注册只能证明入口存在。
- 优先减负：检查简单任务是否出现多余登记、重复读取与大段设计推演；沿用既有失败记录选择改动。旧地球试跑的 45 次请求／36 次任务工具调用，以及检索的退化样本，见[真实执行记录](skills-fusion-execution-2026-10-31.md)，不是本轮新跑的成绩。
- 保持产品宗旨：从用户实际失败与纠正提出候选规则，经隔离验证与用户确认后生效。社区文本只帮助提出候选，不自动取得权限，也不证明模型判断正确。

候选组织方式为“稳定运行约定＋任务技能＋工具旁约束＋当前有效要求＋验收证据”，复用现有注册与作用域，避免再建并行的规则系统。这个结构是研究建议，本轮未实装。

## 后续验证门

建议固定一份仓库与规则快照，对 bug 修复、异步状态、DSH 内嵌页面、用户中途纠正、压缩后续作和工具失败任务做对照。固定模型入口、协议、输出预算、工具权限与初始状态；区分仅改提示词和同时改工具实现的实验。

至少记录产物是否满足要求、真实交互、用户返工、重复失败、无关修改、工具调用、耗时及 token。技能加载次数不作为成功率；模型审美自评分不作为最终真值。长会话还要检查纠正是否保留及记忆是否串会话。

本轮新增的是文档和来源证据，不改变使用方式、默认配置或产品行为，因此依照[更新日志指南](changelog-guide.md)不新增功能型 CHANGELOG 条目；若后续改变规则或工具行为，再记录对应影响与迁移。

## 固定来源

以下编号对应上文；来源均为用户指定第三方仓库中的样本，并非本轮确认的官方在线提示词：

- [S1 Cursor](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Cursor/cursor.md)
- [S2 Claude Code 样本](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/claude-code/claude-code-sonnet-4.6.md)
- [S3 Compact](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/claude-code/commands/compact.md)
- [S4 Verify](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/claude-code/skills/verify/SKILL.md)
- [S5 Design](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/artifact-types/design/SKILL.md)
- [S6 Craft](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/artifact-types/design/artifact-type/reference/craft.md)
- [S7 Questions](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/artifact-types/design/artifact-type/reference/questions.md)
- [S8 ZCode Desktop 样本](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/GLM/zcode-desktop.md)
- [S9 Control Browser](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/GLM/skills/control-browser/SKILL.md)
- [S10 Web GUI Tester](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/GLM/skills/web-gui-tester/SKILL.md)
- [S11 VS Code Copilot Agent 路径样本](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Microsoft/vscode-copilot-agent.md)
- [S12 Amp 默认模式选区](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Misc/amp-code.md)
