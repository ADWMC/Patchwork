# Patchwork 日志系统审查与升级边界

> 实施索引（2026-10-30）：采用项、实际接线、隔离宿主验证与剩余边界见[统一融合执行方案](upgrade/2026-10-30-integration.md)。本文保留研究或历史审计的原始范围，不把建议与历史数字改写成当前能力。

> **历史快照，已实施后续升级。** 本文描述 2026-10-30 升级前的现状与探针，
> 原始探针结果保留不改。统一原生诊断、会话授权、元数据导出、预览脱敏与兼容
> JSONL 轮转现已接入并完成隔离验证；当前行为及剩余边界见 [日志文档](logging.md)。
> 下文“未接入”“尚未迁移”均指审计时状态，不代表升级后的实现。

日期：2026-10-30。范围：当前仓库日志、证据归档、面板缓存，以及本机 DSH 0.2.1-rc.2 的原生 Session 扩展接口。此轮为现状审查与原生接口探针，**未接入新的运行时日志系统**，未动主 DSH、未调用额外模型、未提交。

## 当前有哪些记录

以下路径均相对当前 `DSH_HOME/patchwork/`；会话目录来自宿主真实 session ID。

| 层 | 当前实现 | 实际边界 |
|---|---|---|
| OP | `observation-pack/<sessionId>/ledger.jsonl`，记录 placeholder/recall、callId、句柄、字节和分页偏移；`objects/` 保存原文 | 有归档和召回账本，缺统一级别/事件版本、所有跳过原因和轮转 |
| EPR | `evidence-preserving-reducer/<sessionId>/journal.jsonl`，记录 applied/fallback、原因、command、source hash、reducer 路由/耗时/usage；`objects/` 保存原文 | 当前最完整的机制决策记录，但没有通用 callId/rootCallId；原始 command、动态错误文本缺统一脱敏 |
| OCC | `patchwork-online-context-compact/<sessionId>/state.json`，保存计划、计数、债务及最近决策；原生 compaction 另有宿主事件 | 原子保存的是可恢复状态，不是追加式审计；覆盖后无法仅凭 state 还原历次判断，多处异常被静默吸收 |
| AF | 独立插件层仅进程计数和 console.warn；实际 write/edit、then_run 的结果在宿主工具事件中 | 不是完全没有可追踪记录，但没有独立机制决策流；计数重启即丢，不能当审计历史 |
| Web 证据 | 当前会话最多 100 条、每条最多 16,000 字符，最多缓存 64 个会话；保存 command、path 和工具结果文本 | 有 token + 实际 Patchwork composition 授权、切走清除；属于本进程证据缓存，不能称为持久日志系统，也没有通用脱敏 |
| 警告 | AF、OP、skills 使用 console.warn；OCC/EPR 多处 catch 静默 | 没统一使用宿主 ctx.logger，也没统一错误编号、级别、限流和关联字段 |

代码依据：

- `src/mechanisms/observation-pack/{index,ledger}.mjs`
- `src/mechanisms/evidence-preserving-reducer/{index,journal,candidate,config}.mjs`
- `src/mechanisms/online-context-compact/{lifecycle,state}.mjs`
- `src/mechanisms/action-fusion/index.mjs`
- `src/ui/{runtime-state,mechanism-stats}.mjs`
- `src/util/content-archive.mjs`、`src/scope.mjs`

## 优先问题

1. **日志元数据与原文证据没有统一隐私边界。** EPR 的疑似密钥检测只检查候选 body，不能覆盖 command、所有异常或 Web 缓存。OP 保存逐字原文；它本来就可能包含用户工具输出中的秘密。现有仓库凭据精确扫描零命中不代表运行时日志已全面脱敏。
2. **OCC 历史与错误可观测性不足。** 最近状态无法解释一串边界为何推迟、压缩为何失败或何时发生 no-op；静默 catch 虽能保护主任务，却不利于排障。
3. **跨机制缺少关联。** OP 有 callId、Web 有 rootCallId，EPR journal 和 OCC 状态未采用统一链路；对照任务需要人工拼多个目录。
4. **没有统一保留策略。** 侧挂 JSONL 与 objects 无大小/时长上限；Web 虽有条数限制，磁盘归档仍可能持续增长。自动清理必须先考虑活跃句柄、引用关系与证据保真。
5. **应用隔离不等于文件系统权限隔离。** 已有 API/tool 授权不应被撤掉；按会话分目录本身不能阻止同一 OS 用户或获得相应文件读取权限的其他工具直接读取文件。`0o600/0o700` 也不等于 Windows 独立 ACL。

## 新确认：DSH 已有原生插件记录

本机宿主实际安装包导出 `appendPluginRecord` 与 `pluginRecordOf`。它允许 `plugin:patchwork/...` 记录，不需要给稳定的 SessionEventMap 随意增加自定义事件，也不进入模型上下文。

只在独立内存 Session 做探针，结果见 `docs/checks/logging-native-records.json`，脚本为 `docs/checks/logging-native-records.mjs`：

- 写入 `plugin:patchwork/audit` 成功，事件 `ignorable=true`。
- 前后 `deriveMessages()` 完全一致。
- 通过 session snapshot 重建后能读回原样数据。
- 没有创建或修改主 DSH 会话。此探针不冒充磁盘重启、Web 导出或多会话授权端到端验收。

源码依据为上游固定 revision `687f282e8625c6b8d11ff58211a90524be2e4317`：

- `packages/core/session/src/index.ts` 的 `appendPluginRecord`、`pluginRecordOf` 和 `#appendRecord`。
- `packages/core/session/src/types.ts` 的 `PluginRecordType`、`PluginRecordMap`。
- `packages/core/session/tests/plugin-records.spec.ts` 的不可见于 surface、恢复、fork 测试。
- `packages/session-query/session-log-export/src/archive.ts` 的原生日志序列化；export 包说明未知事件载荷保留，但不会自动收集未知载荷引用的附件。
- 宿主运行警告使用 `ctx.logger`，例如 `packages/core/agent-loop/src/index.ts`。

因此，早期“只能旁挂文件”的理由不适用于当前宿主。**现有旁挂文件仍在使用，尚未迁移**；不能因为新接口存在就声称插件已经接好。

## 建议实现顺序

### P0：先确定数据边界

- 诊断默认只写白名单元数据：schemaVersion、mechanism、event、level、reasonCode、callId/rootCallId、源 hash、字节数、耗时、已报告 usage、明确标记的测量/估计数值。session 关联由真实宿主对象确定。
- 不默认复制 system prompt、用户消息、完整命令/参数、工具原文、HTTP headers 或任意 error.message。错误保存固定类别/编号；必要的可读错误经过脱敏与长度限制。
- 原文归档继续作为证据存储处理，不能为了“日志脱敏”悄悄修改原文、破坏逐字召回与 hash 校验。其访问、保留和导出策略应单独定义；默认诊断导出不捎带全部 objects。

### P1：统一记录到宿主、只服务 Patchwork

- 在 Patchwork preset 的 runtime 中接统一记录入口；根 profile 不注册全局内容采集器。
- 对每次异步完成后的落笔重新验证真实 composition；standard、切走后的旧工具引用、其他会话不能写入或读取该会话的插件日志。
- 机制决策使用 native `plugin:patchwork/...`，运行警告使用脱敏后的 `ctx.logger`。原生 Session 记录可沿宿主持久化/导出路径走，不再新建一份全局重复流水。
- AF 记录融合结果与跳过原因；OP 记录 pack/recall；EPR 记录候选决策、路由和辅助调用开销；OCC 记录经济判定、原生保留策略、压缩 start/success/noop/failure 和是否续跑。
- 避免每次非 shell 工具都写一条 EPR `not-a-shell-tool`；高频无关跳过用计数或可选 debug，防止观测本身制造 IO 噪声。
- 日志失败不能改变机制决策、触发压缩或遮蔽原始工具结果；不能为了日志新增模型请求。避免监听自身事件造成递归。

### P2：查看、导出与维护

- 复用 DSH 面板现有样式和暗色 token，提供当前会话的级别/机制/调用筛选；不把所有会话日志拼成全局列表。
- 导出前确认当前会话授权；原生导出包含插件元数据不等于自动包含 OP/EPR 侧挂证据。
- 侧挂旧 journal/ledger 的迁移与清理需要版本和保留策略，先保护活跃句柄，不能用粗暴定时删除替代设计；原生 Session 日志遵循宿主生命周期。

## 下一轮必须验收

- 两个同目录会话并行、standard 不产生日志、切走后异步回调不得落笔、切回按真实 composition 恢复。
- 用合成秘密值验证命令、header、异常、工具输出不会出现在诊断元数据或安全导出中；原文证据保真另测。
- native plugin record 不改变派生 messages、工具 schema、token meter 或模型请求数；不要用一次探针替代全部链路验证。
- 串联 AF rootCallId、OP 句柄、EPR source hash、OCC decision，能够复盘一条真实失败任务。
- 日志存储失败、重复事件、异常大载荷、重载/恢复和导出权限失败不影响主任务；旧归档仍能逐字找回。
