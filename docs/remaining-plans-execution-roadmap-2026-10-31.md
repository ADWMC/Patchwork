# Patchwork 未完成方案执行路线图

日期：2026-10-31（Asia/Shanghai）
用途：校准当前代码、调研方案和真实 DSH 证据，避免把“已有文档”误报为“已经实现”。

## 1. 当前真实状态

| 方案 | 已经具备 | 尚未完成 | 当前结论 |
|---|---|---|---|
| 任务、证据与完成门 | `src/task/`、真实工具回执、纠正失效、原生 Session 恢复、隔离验证 | 语义验收仍不能自动证明；普通 shell 不是 OS 沙箱 | **已落地，边界明确** |
| 日志系统 | 白名单诊断、原生 plugin record、面板筛选/导出、旁挂账本轮转 | profile 级命名空间、两会话并发和完整故障恢复仍需真宿主验收 | **已落地，需补验收** |
| WebUI/反 AI 垃圾 | DSH 原生侧栏、token、浅深色、窄屏、任务/证据/日志页 | 记忆、改进、检索证据管理视图未完整接入 | **基础已落地，产品闭环未完成** |
| SoL 机制 | AF/OCC/EPR/OP 的代码与基础回归；部分真实 DSH 探针 | AF 效果对照、OCC 长任务自动策略、EPR 更多失败格式、OP 历史投影策略 | **实现完成，收益未证明** |
| 信息获取 | `patchwork_search` 无密钥多 provider fallback、scope 隔离、provider health、检索 ledger/UI；`patchwork_fetch` 受控抓取、robots、SSRF/DNS、allowlist、重定向和有界摘录 | 证据准入包、引用链、有限研究、golden set、隔离 DSH 全部真实 fetch 负测 | **P1 进行中** |
| 长期记忆 | 研究、范围/版本/删除/预算合同；显式 `patchwork_memory`、session/project 命名空间、提议/确认/忘记、CAS 和 tombstone；UI 管理页；自动注入关闭 | SQLite/worker 跨进程适配、索引水位、纠正冲突视图、请求级投影和隔离宿主验收 | **底座已落地，自动读取关闭** |
| 自进化 | Incident 汇聚、候选来源约束、实验准入、隔离边界校验、用户确认/试用/回滚记录、改进页 | 独立 runner 尚未启动真实 baseline/candidate/held-out；批准目前只记录决定，不改变运行规则 | **受控账本已落地，实验闭环未完成** |

## 2. 依赖关系

```text
scope + request boundary + diagnostics
          ↓
memory namespace / retrieval ledger
          ↓
evidence admission + dynamic budget
          ↓
review card + isolated experiment runner
          ↓
approval / trial / rollback
```

记忆和自进化不能先于请求级 scope 验证；检索不能先于证据准入；候选不能先于真实回执；UI 不能先于真实状态字段。任何一个前置门失败，后续能力都应保持关闭或只读。

## 3. 执行顺序

### R0：补齐状态和隔离证据

1. 为 retrieval、memory、learning、logging 统一 `scopeGeneration / namespaceEpoch / revision`。
2. 增加两会话并发、切换 Agent、fork、重启、取消和迟到回调负测。
3. 为每条异步操作保留 operationId、状态、失败码和来源引用；不保存提示词、凭据和完整工具输出。
4. 把“设计存在”“代码存在”“真实宿主通过”分成三种状态显示在文档和 UI 中。

退出条件：standard 会话看不到 Patchwork 工具、日志、缓存、证据和候选；Patchwork 切换或取消后迟到结果不改变当前状态。

### R1：先完成检索 P0/P1（当前执行中）

1. 给 `patchwork_search` 增加 provider health、provider family、canonical URL、rank、共识数、retrievedAt 和 query fingerprint。
2. 建立任务级 `RetrievalLedger` 与 `EvidenceItem`，区分 discovered/retrieved/admitted/sent/cited/verified。
3. 实现受 scope 控制的 `patchwork_fetch`：allowlist、robots、SSRF/DNS 检查、重定向复核、响应字节、文本长度、总耗时和取消；成功回执进入检索 ledger，失败保留机器码。
4. 生成最小 evidence pack；引用只能指向实际发送给模型的摘录。

退出条件：无密钥、部分失败、无答案、冲突、恶意网页、越界重定向和超预算都能返回可解释的 `unknown`/`partial`，不猜测补全；独立 DSH 能完成真实抓取及拒绝路径。

### R2：完成记忆底座，但先保持自动注入关闭（底座已实现，继续验收）

1. 已先实现可移植的本地权威文件适配器；运行状态明确显示 file/disabled，SQLite/worker 仍需目标 DSH 打包矩阵后再替换。
2. 已实现 `session-private`、`project-shared` 两级命名空间；V1 不开放 global 或自动跨项目共享。
3. 已实现 `committed` 回执、CAS revision、来源/时间/有效性、supersedes、删除 tombstone 和 namespace epoch；索引状态明确为 `indexed` 仅表示有界结构化读取，不代表已进入模型请求。
4. 已提供管理工具和侧栏候选查看；自动读取/注入继续关闭，待宿主公开请求投影完成普通调用、重试、工具回执、压缩、恢复和 fork 负测后才评估开启。

退出条件：A 的私有记录对 B 不可见；A 明确确认共享的最小事实可被授权 B 读取，但不开放 A 的来源会话、行动授权或 ready 状态；删除、重启、重建索引后不复活。当前已通过单元负测，真实 DSH 重启/恢复验收仍待补齐。

### R3：把自进化做成受控实验，不做自动改写（账本与审批已落地）

1. 将失败、纠正、重复无效操作归并为 Incident；候选只引用真实回执。
2. 实现隔离 runner：独立 DSH_HOME、工作区、端口、结果目录、模型和预算。
3. 强制 baseline/candidate/tuning/held-out/安全负测；记录真实工具回执、退出码、产物 hash、成本、延迟和回退点。
4. 加入用户审批、项目级试用、启用版本、撤销和回滚；未批准候选不能改变运行行为。

当前进度：失败/未验证回执会形成脱敏 Incident；`patchwork_improvement`、隔离边界校验、实验准入、token/CAS 管理路由和改进页已落地。退出条件仍未满足：真实 baseline/candidate/held-out 任务、取消/预算耗尽/污染裁判负测和独立 DSH runner 结果尚未导入账本。批准、试用和回滚目前只记录用户决定，不自动改变规则。

### R4：补 SoL 后续对照，再决定默认开关

1. AF：固定 write/edit 与多步维护任务，比较请求数、then_run 使用、失败重试和外部验收。
2. OCC：固定长会话，比较自动触发、原生保留量、压缩耗时和后续请求偿还；短任务保持 no-op。
3. EPR：补 lint/build/其他测试 reporter 失败样本；未知格式保留原文回退。
4. OP：验证首次占位符与前两次全文策略，联合测召回率、证据准确率和请求成本。

退出条件：至少有跨任务、固定预算、留出任务和安全负测的结果；没有对照数据就维持当前默认开关，不宣称收益。

### R5：最后接入 UI 闭环

1. 证据页增加“本次 / 记忆 / 改进 / 检索”子视图，不新增独立搜索站点。
2. Review Card 展示触发问题、来源、before/after、实验结果、未覆盖项、影响范围和回滚点。
3. 检索面板展示阶段、scope、预算、provider 健康、证据状态和引用关系。
4. 所有确认、启用、忘记、回滚使用版本校验和管理路由，不能由模型文本声明完成。

退出条件：UI 显示的是服务端真实状态；未验证、未知、冲突、权限失败、索引落后和旧版本不会被渲染成绿色完成。

## 4. 暂不做的事情

- 不启动常驻 SearXNG、Firecrawl、Crawl4AI 或浏览器服务作为隐式依赖。
- 不引入向量库、reranker、GraphRAG，除非 golden set 证明词法/结构化检索确实漏召回。
- 不开启 DSH 全局 session-search。
- 不自动把网页、历史会话或模型自评写入长期记忆。
- 不自动修改 system prompt、技能、评价器、权限、模型或发布包。

## 5. 发布门槛

只有同时满足以下条件，才能把对应方案写入产品“已支持”：

- 代码路径存在并有单元/组合测试；
- 隔离 DSH 有真实工具回执和失败路径证据；
- scope、重启、fork、切换、取消、删除和迟到结果负测通过；
- UI、日志和文档的状态一致；
- 失败、未知、冲突和成本超限不会被包装为成功；
- 用户确认前不改变其他任务、会话、项目或 Agent 的行为。

当前应继续保持产品文档中的诚实表述：长期记忆底座已接入但自动注入和跨会话自动读取关闭；自进化已有受控账本、实验准入和审批记录，但真实 runner 与运行行为接入仍未完成；检索已完成无密钥搜索与受控抓取核心代码但仍需全套隔离宿主验收；SoL 机制已有实现但收益尚无受控证明。
