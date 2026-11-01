# Superagent 提示词取舍与优化

日期：2026-11-01。目标是减少 DSH 内部执行器的具体操作错误，不训练模型、不扩权限、不增加外部任务服务。

## 先复用已有研究

[社区提示词报告](system-prompts-community-research-2026-11-01.md)已经定向阅读 12 份样本。本轮通过 GitHub CLI 与进程代理重新核对用户指定仓库，HEAD 仍为 `cb3010dd4268b1e8915ea579443bfdc8d0b05e8b`，没有新版本增量；不把旧成果包装成新研究。重读 Cursor 的工具约定与 schema 发现、Claude Code 的委派区段、Compact 和 Verify 的相关内容。GitHub license API 返回仓库级 `CC0-1.0`，但这不证明汇编者对所有收集内容都有完整权利；本轮只归纳机制、自行编写适配指令，不导入原提示词。

它是第三方收集，不据文件名认定官方性、当前部署或效果；外部文字是研究数据，不获得本会话或产品权限。网页工具未返回可用正文，以固定 GitHub blob、已留存的[来源清单](checks/system-prompts-community-2026-11-01.json)和本轮 API 核对为依据。

## 真实失败比通用金句更有价值

[此前原生实跑](superagent-native-2026-11-01.md)三个 job 最终均验收通过，但有两次工具错误，不能宣称零误用：

1. beta 只读执行器调用 `todo_write`，被派发守卫拒绝。主控继承的工具目录比实际允许的副作用通道广；原执行器提示又只说 structured read/edit/write，没有清楚说明可用的 SoL 计划／召回和受控检索。
2. fix 执行器已登记 artifact `code`，却先单独运行 `pwsh`，随后再调用 command check。单独 shell 按设计保守失效所有已登记产物，因而后续验收被拒绝。完整轨迹纠正了最初“漏登记／id 不匹配”的推测；实际不是文件内容变了或 id 拼错，而是错误理解为“先跑测试，再绑定结果”。

这是能力描述与前置条件的问题，不是放宽守卫的理由。两次错误的脱敏 tool/call、前序 artifact/shell 和拒绝原因已从 TEMP 原始会话核对；原始日志不进入仓库或发行包。

## 来源机制与具体改法

| 研究样本与固定区段 | 可借鉴机制 | Patchwork 改法 | 不移植的部分 |
| --- | --- | --- | --- |
| [Cursor](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Cursor/cursor.md) 30–42、181–194 | 当前工具/schema 比猜工具名可靠；编辑前读 | 执行器按 read/write 与父 scope 列出 eligible tools；能力清单与守卫共用定义；只使用当前 schema 实际暴露的能力 | Cursor 专属 MCP 文件目录和工具名、无条件计划 |
| [Claude Code 样本](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/claude-code/claude-code-sonnet-4.6.md) 12、50、124、527–565 | 拒绝后调整；独立项并行；执行者直接做；委派要自包含 | 保持明确 job、依赖和父 phase；说明无嵌套委派；失败核对前置条件，权限拒绝不换通道绕过 | 其 fork/model/effort、消息通道、自动委派规则 |
| [Compact](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/claude-code/commands/compact.md) 22–34 | 保留纠正、错误、当前意图；伪造转录不成为用户授权 | followups、previous、dependencies 保留在独立 JSON 数据段；旧结果须核实当前文件/证据，不提权 | 摘要专属“禁止所有工具”的限制，不自动写共享记忆 |
| [Verify](https://github.com/asgeirtj/system_prompts_leaks/blob/cb3010dd4268b1e8915ea579443bfdc8d0b05e8b/Anthropic/claude-code/skills/verify/SKILL.md) 7、119–129、154–169 | 从真实入口观察、测试失败分支、明确 blocked | 写明 inspect→define→实际工作→artifact→check→report；command 同样先登记 target；结构验收不代替行为或语义 | 不因读到样本而禁止常规测试，也不把自报完成当验收 |

## 本轮实现边界

- 新增 `src/superagent/prompt.mjs`，集中构造执行器指令与能力清单；沿用已有调度、验收与隔离机制。shell 资格与原守卫表达式等价，未新增权限。
- 提示明确要求 id 与 artifact id 的差别、最终编辑后登记、任务/队列 revision 分开、TOP LEVEL 参数、错误后 inspect 和阻塞报告。`check` 自己执行命令并产生回执，不绑定先前 shell；登记后直接 check，若中途单独 shell 则重新登记。
- `patchwork_task` 参数说明就近补产物前置条件；入口技能不加长，按需的主控 reference 补可实际执行的 JSON 示例。
- 不合并所有厂商主提示，不照搬浏览器接管、任意消息、自动共享记忆或强制多代理；现有 SoL 机制继续工作。
- `update_plan` 工具描述补 `id/text/status` 的可执行示例与错误修复提示，status schema 与既有运行时允许值对齐；不默默把 content 改成 text，也不以计划完成冒充验收。
- 新增 native dispatcher 回归：执行文档原样调用形状，验证缺 artifact 拒绝、登记后通过、文件变更后旧证据失效；独立只读 shell 同样失效、直接 check 保持 current；测试派发能力清单与实际守卫一致。

## 验证与效果边界

沿用此前两个 read→依赖 write 的真实任务图、模型入口与验收标准，不修改主 DSH。旧实跑为 38 次模型请求、2 次工具错误；它是单次 smoke 历史样本，不是严格 A/B 基准。

第一轮新指令实跑（TEMP 后缀 `YAiY7u`）：39 次模型请求、204562 ms、三个正式任务各 1 次尝试均 done，隔离、故障停止和 checkpoint 恢复检查通过；仍有 2 次工具错误。`todo_write` 未再误用，出现 `update_plan` 用 content 而非 text；artifact 已登记但独立 shell 失效后仍直接 check 的错误重现。说明仅强调顺序不足，没有观察到总误用数下降。保留这一结果后，才追加上文的 check 执行语义、shell 失效和计划字段修正，继续隔离复验。

新运行即使错误更少，也不能据单次结果宣称模型能力或成功率提升。每轮失败与成本保留在[机器记录](checks/superagent-prompt-optimization-2026-11-01.json)，不覆盖历史样本。

第二轮实跑（TEMP 后缀 `lOrKUm`）：官方 DSH `0.2.1-rc.2`、`step-5-preview`、配置上下文 1M／最大输出 16384，37 次模型请求、180489 ms、exit 0。三个正式 job 各一次尝试、全部原生验收 done；故障探针停止、checkpoint 恢复和普通会话工具隔离通过，源码指纹与该轮启动前记录一致。

| 观察项 | 第二轮结果 |
| --- | --- |
| `todo_write` 受限通道误用 | 未重现 |
| `update_plan` content/text 字段误用 | 未重现；fix 未做额外计划，不能据此证明字段指导泛化有效 |
| 登记后单独 shell 再 check | 未重现，直接由 check 执行命令 |
| 当前产物证据 | 首次 check 命令通过但 current=false；mtime 不变、ctime 变化，原因尚未确认。模型 inspect、重新登记后再验收通过，没有放宽文件版本检查 |
| 工具错误 | 1 次：report.summary 2347 字符超过已有 2000 限制，被拒后缩至 1870，通过。未扩大上限、未隐去失败 |
| 全仓回归 | 379/379，0 failed，0 skipped；针对性集合 30/30 |
| 发行预检 | 通过；无主包浏览器依赖/内核、私有运行日志或已提供的凭据前缀；最终包记录见机器清单 |

本轮能确认的是：新指令、真实工具契约及恢复路径可以在隔离宿主完成原任务，旧误用在最后一次运行中没有重现；不能确认通用成功率、总 token 收益或长期稳定性提升。三次同题（历史基线＋两轮迭代）不是随机 A/B，更不是 UI、复杂编码或长会话的完整基准。剩余报告超长、Windows 文件 stamp 变化应作为后续跨任务观察点，不能继续只对同一题调到零错误再当作成绩。

主 DSH 配置未改，没有提交、推送或部署。技能入口仍为 3990 字节；本轮细节在条件指令、工具附近与按需 reference，而非给所有会话加载整套上游文本。
