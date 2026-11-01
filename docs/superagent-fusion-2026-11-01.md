# DSH Superagent 原型评估与原生融合

本页保留第一阶段交接/幂等输入的研究与实测。随后补齐的 DSH 内部主控队列、原生执行器、社区对照和新验收，见[主控接入记录](superagent-native-2026-11-01.md)；不要把本页早期范围当成当前全部功能。

日期：2026-11-01。状态：第一阶段原生适配已实现；模型实验与完整验证结果见文末，不据此宣称模型质量收益。

## 固定来源

- 项目：<https://github.com/deepseek-ai/dsh-superagent-prototype>
- 快照：`6337fc823ce20251c8de8085948165c81aaa701e`，2026-10-31。
- 上游明确标注为研究原型，不是官方产品或生产就绪承诺；公开版与内部实现及文章描述有差异。
- 本地参考副本：`artifacts/research/dsh-superagent-prototype-6337fc8`，不作为插件依赖或发行内容。
- 上游 MIT；本轮按机制启发独立实现，没有将上游实现复制入 Patchwork，项目自身许可仍为 AGPL-3.0-only。

主要选读入口（均固定到上述 commit，不声称逐文件完整安全审计）：

- [授权领域](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)、[执行模型](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md)、[架构](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md)。
- [准入策略](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/policy.ts)、[工单](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/tickets.ts)、[投递](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/delivery.ts)、[效果队列](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/effects.ts)。
- [DSH 执行器](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/executor/dsh.ts)、[工作提示词](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/prompts/work.md)、[部署校验](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/deployment.ts)。

## 初步结论

适合融合的是可追踪的任务边界、上下文与授权分离、幂等输入和恢复时重新检查当前状态。直接安装整套原型会引入 GitHub／飞书监听、主路由会话、独立数据库和另一套执行器；这与 Patchwork 当前交互式编码入口不是同一部署目标。

上游依赖 DSH `0.2.1-alpha.2` 系列；本地插件的开发依赖是 `0.2.0-rc.2`，已有隔离 `0.2.1-rc.2` 记录。不能仅凭包名宣称二进制兼容。适配以本地真实 Session、preset、工具事件与压缩服务契约为准，不覆盖主 DSH 配置。

## 本轮实施边界

1. 复用现有 `patchwork_task` 和原生 Session 记录，避免新增同义工单系统。
2. 区分用户输入与工具／外部上下文；上下文不能产生新授权。
3. 提供有界恢复交接，保留纠正、剩余验收和证据指针；恢复不能复活过期验收。
4. 与 SoL 的压缩和观测机制共用任务边界，检查取消、纠正和模式切换中的竞态。
5. 在隔离 DSH 组合内验证，再记录已实现范围、使用方式、更新日志和未验证项。

外部来源监听、自动创建 PR／发消息、默认后台自治和跨会话共享不属于本轮自动启用内容。它们需要独立部署和真实来源身份边界，不能由消息正文或模型声明授予。

## 好不好用：适用场景与实测限制

原型面向一个 GitHub 仓库的团队机器人，主要链路是 Source → Trigger → Eval → 带 Mandate 的 Ticket → Assignment → Executor → Channel。它的核心价值是把“谁要求、允许做什么、谁正在处理、结果送回哪里”从模型自由文本中拿出来管理。

值得采用的机制：

- `src/core/tickets.ts` 将工单与执行会话分离，接单、续作、重试和结束有独立状态。不能把 Agent 停止生成当作任务已完成。
- `src/policy.ts` 把确定性准入与模型研判分开；`observe` 可以记录候选而不启动工作。这与我们从失败和纠正产生候选、隔离验证后确认的宗旨一致，但它本身不是自进化训练算法。
- `src/app/delivery.ts` 使用稳定投递标识，检查原生日志和待处理 inbox，避免重启重发；来源标记属于生产者，不伪装成用户。
- `src/app/effects.ts` 与 `src/app/outbox.ts` 保存待执行副作用、发送回执及代次，避免迟到结果覆盖替换后的工作；适合以后单独开发外部来源模式。
- `prompts/work.md` 要求回到原始请求和实际仓库检查，不让路由标题代替要求；不把无关信息变成新任务。

不能直接照搬的部分：

| 项目 | 源码／实测情况 | Patchwork 决定 |
| --- | --- | --- |
| Windows | `src/deployment.ts` 的必填 stateDir 只接受 `/` 开头；worker 启动探针调用 `env`，服务脚本与测试依赖 Unix Shell | 使用现有 `dshHomePath`、原生 Session 和 pwsh；不接入该启动脚本 |
| 权限 | `src/app/sessions.ts` 的 ensure 会选择 `danger-full-access` | 不移植该行为；不更改现有宿主权限配置 |
| 状态存储 | 另有 SQLite、事务、来源游标、效果队列和发送回执 | 交互式模式沿用 Session；只有独立外部来源模式才需要完整领域存储 |
| 模型成本 | 主路由／研判与执行器各有模型职责；还有来源轮询和恢复流程 | 第一阶段不新增路由模型、轮询进程或辅助摘要调用 |
| 消息与交付 | 自动回复 GitHub／飞书、自动跟踪 PR 对机器人有用 | 不隐式获得外发、push、PR 或跨会话能力；未来单独设计明确来源授权 |
| 设计默认 | 主会话安静工作、只在需要人工行动时发消息 | 本地交互式会话仍保留必要进度；不复制机器人专属“完全静默”要求 |

在 Windows / Node `24.21.0` / pnpm `11.7.0` 中，对固定原型执行 `pnpm --ignore-workspace install --ignore-scripts --frozen-lockfile`，随后运行完整 `vitest run`：**1197 项中 1156 通过、41 失败，另有 17 个未捕获错误；59 个测试文件中 51 通过、8 失败**。安装禁用生命周期脚本，没有启动 GitHub／飞书来源或生产服务。

失败涉及 Windows 路径、Unix 命令／脚本、Git 配置换行／路径表达、文件权限和文档一致性测试；不把它们全部归为核心算法错误，也不能当作本机可直接部署。尤其 `/^\//` 的路径限制是读到且被测试触发的实际配置不兼容。上游全套测试输出在 `artifacts/research/superagent-upstream-tests.log`。该结果是本机复现，不是跨平台产品评级或真实模型任务成功率。

## 已实现的原生适配

### 1. 一个任务入口、一个真实状态

复用 `patchwork_task`，新增只读 `action: handoff`，不再引入第二套 Ticket 工具。交接从原生任务状态生成，包含任务 id／revision、当前要求及覆盖项、最后纠正、剩余验收、产物版本／路径、证据指针与只读参考。它是恢复上下文，不是 Mandate 权限票据；定义和纠正仍是模型陈述，实际权限仍由宿主及既有任务检查决定。

handoff JSON 最多 8,000 UTF-16 单元，优先保留未完成要求；以完整条目截断，返回各类 omitted 数量和 `patchwork_task inspect` 指针，不截断 JSON、不悄悄把未覆盖项当完成。它不包含输入去重账本、网页原文或长期记忆正文，也不附带另一个完整任务对象。

```json
{ "action": "handoff" }
```

此操作不需要 baseRevision，不修改任务。修改依然通过 inspect 得到最新 revision，再调用 define／correct 等既有操作；验收仍绑定真实宿主回执。

真实模型验证还发现既有 `correct` 的接口缺陷：schema 允许省略 title／phase，reducer 实际却要求两者重填，缺少 title 只报 `invalid bounded label`，模型反复缩短验收标签仍无法纠正。现已允许已有任务继承省略的 title／phase／instance，明确传入的错误值仍拒绝，revision 冲突仍阻塞。省略阶段不会自动允许源文件编辑，省略 instance 不再丢掉已登记的实例约束；define 仍须明确给出标题与阶段。

### 2. 压缩后恢复要求，未提交尝试不算已投递

原实现使用 JS WeakMap 记住曾经生成的简短摘要；摘要没有具体要求，且“生成过”不代表宿主接受了该步骤。现在检查 `session.deriveMessages()` 的有效历史和本次待提交消息：相同交接已存在则不重复；旧交接被 native compaction 移走、步骤未提交或恢复后缺失时重新补入。

冷启动依然走原生 Session 检查点；分支不继承旧会话完成／实例权限。交接不自动启动 Agent、打开浏览器或执行命令。投影会增加有界上下文开销，是否改善长任务完成率需另做同条件实验，不能仅以包含了更多要求为证。

8,000 是每份 JSON 快照的上限，不是整个会话的 token 上限。任务 revision／验收变化会产生新的投影，旧投影仍受宿主上下文管理；该实现不承诺长任务总上下文恒定，后续需测每步投影累计成本，再决定是否使用宿主支持的可替换上下文节点。

### 3. 输入重投有界幂等

最近 128 个 `(message id, source kind)` 的 SHA256 随原生任务检查点保存。窗口内相同输入重投不会再次递增 revision、失效证据或追加重复检查点；旧检查点缺少该字段仍可恢复，损坏字段按已有降级规则阻塞。

这不是任意历史长度的 exactly-once 保证：超出窗口、没有稳定 id、尚未持久化即崩溃或新的 id 都可能再次处理。相比上游全日志投递检查，当前选择保留有界状态；这些指纹不进入模型／UI 的 task 投影。非用户 producer 仍只记录为 producer；`source.kind=user` 也不被解释成密码学身份或额外授权。

## 与四个 SoL 机制如何融合

| 机制 | 本轮接法 | 验证与边界 |
| --- | --- | --- |
| Action Fusion | 复用已有任务 revision 检查，写入与 then_run 之间发生纠正时跳过后续命令 | 既有真实工具组合回归保留；本轮不改融合策略，不声称额外节省 |
| ObservationPack | native handoff 是操作上下文，显式 handoff 结果不替换为观测句柄；普通大结果仍内容寻址、分页召回 | 增加中文多字节交接反例，防止 UTF-16 有界文本因 bytes 阈值再次被打包 |
| Evidence-Preserving Reducer | 仍只处理匹配的 shell 诊断；任务状态、handoff、来源授权不送入 reducer | 不根据压缩收据自动授权、完成语义验收或推广候选记忆；原文失败回退保留 |
| Online Context Compact | 完成边界绑定当前 Session 对象、任务 id 和 revision；压缩前、压缩后均复核，续跑携带当前 handoff | 用户输入／模式选择／销毁撤销边界并取消 in-flight 维护；即便 compactor 忽略取消也不续跑旧任务 |

OCC 继续使用 scoped compaction 服务和宿主维护锁，不套第二层 runMaintenance。已取消、被替代、持久化失败、等待澄清、已 ready 或版本变化的任务不会由旧边界自动续跑。压缩已实际发生但任务随后改变时，计量仍记录压缩，续跑单独拒绝。默认保持 AF 开、OP／EPR／OCC 关；短任务不为了使用机制而强行压缩。

## 后续融合执行路线

| 阶段 | 内容 | 进入下一阶段的条件 |
| --- | --- | --- |
| A，本轮 | 单会话原生交接、重复输入、纠正／取消与 SoL 边界 | 工程回归、真实 DSH 接线与隔离模型 smoke；不等同质量 A/B |
| B，待实施 | 独立可选后台模式：有持久效果队列的任务派发、每任务工作区、并发与预算上限 | 先完成取消／崩溃重启／重复派发／工作区冲突回归，禁止影响普通会话 |
| C，待实施 | GitHub 只读来源和 observe 候选，可信来源元数据与正文分离 | 默认不启动工作、不回复、不发 PR；用离线事件及真实只读来源双验收 |
| D，待实施 | 显式来源授权后的自主执行与外发 outbox | 接收方、动作、仓库、幂等键、撤销和不确定发送结果都有确定性边界；不是模型自评即可放开 |

本轮没有把 B–D 冒充为已实现，也没有重建独立浏览器包。长期记忆和改进候选继续使用现有范围、人工确认与回滚链路；Superagent 的 observe 可以为该链路提供候选入口，不能绕过它。

进入 B 前还应做真实可用性对照：相同仓库与模型、固定输出预算，覆盖短修复、长任务纠正、压缩后恢复和用户取消；同时记录独立验收、工具错误、请求数、耗时及上下文成本。第一轮 smoke 中简单修复也出现多次工具格式重试，说明“有完整状态机”不等于使用顺畅。本轮已补充 baseRevision 与各类验收参数的描述，但其收益尚未通过同条件 A/B 验证。

## 验证记录

第一轮定向回归：58/58；第一轮全仓回归：355/355。补充中文 OP 交接反例、去重账本投影隔离与纠正字段继承回归后，全仓（包括独立浏览器包）**357/357 通过，0 skip**。原生 DSH 工具组合还实际派发 handoff，验证它保留真实命令回执且不改 revision；切换到 standard 后，之前获取的 handoff 工具也拒绝执行。这些是确定性工程验证，不是模型完成率。

真实模型 smoke 使用全新临时 DSH_HOME、独立工作区和官方 DSH `0.2.1-rc.2`，Step 5 Preview，配置 contextWindow 为 1M；四机制仅在实验 preset 中开启。已核实隔离 profile 解析到本工作树的 `src/runtime.mjs`，没有用旧安装副本代替本轮代码。实验任务是修复加法、保持另一导出、native 压缩后接受有限数字校验纠正，再由 runner 独立检查实际文件。首次准备暴露 headless 默认缺少 agentPresets 注册表，未发起模型请求；修正实验 overlay 显式挂载原生注册表后进行以下三次运行：

| 临时 run 后缀 | 每请求输出预算 | Agent 请求事件数／耗时 | 文件独立断言 | 任务与工具结果 |
| --- | --- | --- | --- | --- |
| `ITcfK0` | 8192 | 20／247.5 秒 | 加法、mul 通过；参数校验失败 | 第一轮完成，纠正轮 max-tokens，整体未通过 |
| `ZGI6uw` | 16384 | 49／540.5 秒 | 三类均通过 | 20 个工具错误；17 次 correct 均失败，模型改用 define 重建任务，任务身份改变；不能算原任务的纠正流程通过 |
| `9PaNOB`，纠正接口修复后 | 16384 | 22／179.2 秒 | 加法、mul、两参数的非法值检查均通过 | 0 工具错误；1 次 correct 成功，任务身份保留；两项 semantic 仍为 unknown，整体闭环未通过 |

请求数口径是 `agent/request` 事件，不包含可能独立发生的 provider 摘要调用，不能当成总 API 调用数。三次使用同一用户任务，但预算、代码版本与模型选择的验收类型不同，不是受控 A/B；不能把 49 → 22 或耗时差换算成优化百分比。

最后一次原生上下文计量从 20,297 变为 13,228，重复压缩后为 13,205；压缩后重新投影了 7 条当前任务交接。取消 probe 返回预期 AbortError。**压缩由实验 driver 显式调用，不是 OCC 经济策略自主触发**；启用四机制不代表本次每个机制都实际触发，不证明自动 OCC、AF、OP 或 EPR 的成本收益。模型没有显式调用新增 handoff action，而是读取自动交接后调用 inspect；显式 action 的真实原生分发验证来自前述组合测试，不能把它冒称为本次模型调用。

最后一次还暴露重要限制：模型给两个 semantic 要求提交 supported，并最终声称“无失败、未知或未覆盖项”，而原生任务仍显示 **partial，两个 semantic 要求 unknown**。系统没有因模型自评将它们提升为 passed，这是预期的保守边界；但模型的交付措辞仍不可靠。runner 因 taskReady=false 返回失败，不能仅用 DSH 正常退出、文件断言通过或模型末句认定完整交付。因此本轮结论是“文件修复、任务纠正和恢复接线可用，真实任务闭环仍有未通过项”，不启用后台自治或据此宣传完整成功率。

白名单机器记录：`docs/checks/superagent-fusion-2026-11-01.json`，包含三次尝试、未通过项、原始证据哈希和最后一次启动时的相关源码哈希。私有原始会话未复制进仓库。后续应优先让完成投递由原生任务与验收状态决定，不能由模型的完成声明直接触发；语义未知项需单独审查，再进入 B 阶段。

没有修改主 DSH 的配置、模型路由或安装状态，没有提交、推送或外发。修改已同步 README、技能恢复说明、SoL 设计和 CHANGELOG；新增文档与验证摘要随主包分发，不分发上游源码副本、node_modules、临时会话或凭据。

工程回归命令：

```powershell
node --test "tests/*.test.mjs" "tests/real-composition/*.test.mjs" "packages/browser/tests/*.test.mjs"
node scripts/check-browser-release.mjs
```

真实模型实验入口为 `docs/experiments/2026-11-01-superagent/run-isolated.mjs`。它依赖 Windows 上已安装的官方 DSH，以及 `SUPERAGENT_PROFILE_MODULES` 指向的既有隔离 headless profile 依赖；`PATCHWORK_STEPFUN_KEY` 只通过进程环境提供。脚本创建全新临时 home／workspace，不自动配置主 profile。原始模型记录保留在实验临时目录，发行只附白名单摘要；本次验证不能代替目标版本的安装测试或完整生产部署验收。
