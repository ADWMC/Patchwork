# 记忆系统再调研：读取、共享、更新与上下文边界

日期：2026-10-31（Asia/Shanghai）。范围：一手源码、作者文档和评测方法；不部署候选、不执行第三方工作流、不改主 DSH。

本轮接续[记忆与完成依据调研](agent-memory-completion-grounding-research-2026-10-30.md)、[补充源码调研](memory-evolution-research-2026-10-30.md)及[融合设计](memory-evolution-design-2026-10-30.md)。重点补查 DSH 适配的实际入口和记忆读写流程，不重复列一遍项目宣传与跨论文排行榜。

## 1. 本轮要解决的疑问

| 疑问 | 必须查看的证据 |
|---|---|
| 其他会话需要记忆，但不能互相干扰 | scope/namespace 的构造、私有/共享过滤、上下文挂载与撤销 |
| 记忆什么时候真的能读到 | capture/commit/index/recall 的顺序、后台队列、失败与一致性说明 |
| 长期库变大是否挤爆上下文 | 检索候选量、模型实际看到的片段、工具详情与历史累积分别计量 |
| 更正/忘记是否真的生效 | 更新与替代、源与派生索引、缓存、重建和旧记录恢复 |
| 能否支持自进化 | 原始事实与方法经验分离、反思损失、反馈与独立验收 |
| 哪些结果值得信 | 逐阶段正确性、来源保真、时间更新、拒答、权限及实际发送请求 |

## 2. 固定源码快照

GitHub CLI 通过进程级代理获取；固定提交用于复核，不表示以后仍是最新版本。目录树只用于定位，下载或存在测试文件不代表已执行或整仓审计。

| 项目 | 本次提交 | 查看目的 |
|---|---|---|
| MemTensor/MemOS | `64388b50e2a15528bcdf032e65a1ac792bcf63ee` | 已有 DSH adapter、召回/捕获与本地存储边界 |
| mem0ai/mem0 | `26cdefb46600c0fa5953c4b5ee5003c125539fc4` | DSH 插件实际工具、自动读取与 scope |
| BayInl/dsh-memory | `44e50b062ff39b65112b91657103ed3226fa74ae` | 独立 DSH 记忆插件的服务、预算与清理 |
| aerovato/operator-memory | `734bb115178684b50383ec7ccb9d09e9f8263adc` | 文件型记忆、分层加载与 DSH 集成 |
| EverMind-AI/EverOS | `962c63eeaae5093b495a4763c161f8b046d41bc2` | 可读源、派生索引、反思和检索过滤 |
| xiaowu0162/LongMemEval | `9e0b455f4ef0e2ab8f2e582289761153549043fc` | 检索粒度、时间、知识更新与拒答 |
| MemTensor/HaluMem | `d653749586bfc7d13f5b68e8851f52155b5b1650` | 提取/更新/问答分阶段的记忆错误 |
| HUST-AI-HYZ/MemoryAgentBench | `538026089d1a8a8eff05121d0db89b388f360eba` | 增量输入与选择性遗忘的评测合同 |
| allacnobug/LazyMem | `578968f586fe51e3a3c0e19b5b38f87271bbdd37` | 大库低成本路由、候选检索和注入预算分离 |
| ZexueHe/MemoryArena | `6cd9de14b71915e39ac742a20dc33785e14b6aab` | 跨会话依赖任务中的记忆形成、动作与环境结果 |

本轮下载 46 个文件快照，对相关入口与决策路径定向阅读；不是 46 份文件逐行审计。没有安装这些插件、运行其测试/训练/评测，也没有新增真实 DSH 或付费模型调用。LazyMem 仓库自述为匿名审稿代码，尚未核实其与论文作者的归属关系，因此把论文和该仓库作为分别阅读的材料。

## 3. 四套 DSH 适配实际怎样接入

| 适配 | 源码显示的流程 | 对 Patchwork 的取舍 |
|---|---|---|
| MemOS | pre-step 在下游策略接受输入后召回；按新用户轮次去重、有超时；turn/end 排队后台捕获 | 借鉴接受后检索、截止时间与后台队列；不能直接继承其可见性模型和消息持久化方式 |
| Mem0 | system-prompt/assemble 自动召回；completed turn 后异步 add；工具与自动召回分别限制输出 | 借鉴生命周期分离与 pending 状态；用户范围不足以表达我们的项目/会话范围 |
| dsh-memory | 项目路径检索、共享检索缓存、候选预算裁剪；recall 写入带来源的 user 消息 | 借鉴候选与注入预算分离；追加历史不满足切换后的请求隔离；不再接入第二个压缩控制器 |
| Operator Memory | 从项目及用户目录加载文件快照；在 system-prompt/assemble 添加索引、catalog 与主索引正文 | 借鉴 description/read_if/来源文件；不默认注入全部目录，不把项目本地文件误认为会话私有 |

### 3.1 MemOS：接受后的输入、前台截止时间与后台捕获

[bridge.ts 194–275][memos-bridge] 先等待 `next()`，再从被接受的消息构造查询，而不是从策略处理前的 payload 抽取。每个 accepted user turn 最多尝试一次召回，搜索与外层等待使用共同 deadline；即使底层提供方暂时不可取消，前台也能结束等待。渲染另有字符上限。这个组合值得采用，不能让可选记忆拖住普通对话。

[355–376 行][memos-capture] 将 turn/end 的捕获加入每会话后台队列。排队完成不证明事实已提交、索引已更新，更不证明紧接着的 search 能读到。我们需要显式写入回执，而不能只显示“记住了”。

其 [DSH namespace][memos-namespace] 明确将 preset 视为行为选择，而非记忆归属/可见性；[核心可见性函数][memos-visibility] 主要体现 agent framework/profile 与分享 scope。这里没有完成所有上层查询的权限审计，不能据此断言整个系统跨项目泄露；但这份合同**不能直接证明只有 Patchwork 被选择时可读**。我们的 preset gate、项目范围和接收会话开关仍须自行验证。

召回结果最终追加到 `decision.messages`。结合此前核对的[本地 DSH 持久化路径](memory-evolution-research-2026-10-30.md#6-本地源码对照带来的约束)，这不能直接当成请求结束即消失的临时通道。该适配的存在也不能代替对我们固定宿主版本、重试与 prepared route 的兼容验证。

### 3.2 Mem0：用户范围与两套输出上限

[DSH 自动读取入口][mem0-entry] 调用 `resolveSearchFilters({}, userId)`；[identity.ts][mem0-identity] 必带 user_id、可选 agent_id/run_id。自动读取这条路径没有从当前项目补入额外项目过滤。插件默认禁止模型随意覆盖 userId，这属于已有防护，不能误报为任意跨用户读取；但同一个 userId 下的项目与任务隔离仍不是我们需要的合同。

自动召回 topK=5，[生命周期默认上下文上限][mem0-lifecycle] 为 4,000 字符；[公共工具格式化][mem0-output] 的上限却是 200 行/50,000 字符。两者服务不同入口，**自动召回限额不代表所有记忆工具和累计历史都受同一个限额控制**，字符数也不等于模型 token 数。

completed turn 后捕获 user/assistant 并异步 add，说明它保存对话材料，不说明助手所称“完成”已经由工具/验收证据证实。[pending 格式化][mem0-output] 会提示后台提取排队，值得保留这种状态诚实性。该 DSH 插件配置的 host 是 Mem0 Platform 地址覆盖，源码注释明确并非切换到自托管 OSS；不能把它当作零服务依赖的本地替换件。

### 3.3 dsh-memory：不能把候选标成模型已经看过

[buildRecallMessage][dsh-recall] 把检索候选池与最终预算裁剪分开，这是有用设计。不过同一段代码先把所有 `fresh` 候选 id 放入 `injectedIds`，随后才执行 `trimMemoriesToBudget`；[显式搜索过滤][dsh-seen] 又会排除这个集合里的记录。

静态反例：A、B 都被检索到，预算只容纳 A，B 仍可能进入“已注入”集合，之后被当成已有上下文排除。**这是由代码顺序得出的待复现风险，本轮没有运行该插件验证现象，也未宣称可利用漏洞。**Patchwork 应把 retrieved、admitted、sent 分开；预算拒绝的条目不能被标成已发送。即使 sent 也只能证明进入请求，不能证明模型理解或实际采用。

[预算模块][dsh-budget] 区分压力、强制触发与滞回，能减少阈值附近反复压缩；但未知窗口回退 128k 只是它的实现选择，不能作为我们的硬安全窗口。检索/注入应服从既有 OCC 的上下文控制，不能再安装一个争夺压缩时机的控制器。

### 3.4 Operator Memory：private 的具体含义要看存储路径

[DSH 入口][operator-entry] 从 session cwd 和 homedir 加载快照，按 Agent 缓存渲染结果并加入系统提示组装。该入口没有专属 Patchwork 检查；是否受部署挂载范围限制，需要另查实际配置。

[分层加载][operator-load] 包含 `.operator-shared`、`~/.operator/user` 与项目 `.operator`；[常量定义][operator-private] 里的 private 指项目本地 `.operator`，并不以 sessionId 分区。不能拿文件夹名称证明会话私有性。

[preamble][operator-preamble] 会列出路径、description、read_if，附带主索引及 catalog。这种可解释的路由条件值得用，但索引本身也会随库增长。Patchwork 应先在服务端筛选，只投影相关条目；快照缓存还要绑定 revision/epoch，不能假定更正后旧 preamble 会自动刷新。

## 4. 从“存了就能用”改成明确的读写一致性

建议使用以下操作状态，和记录的 proposed/active/superseded/revoked 分开：

| 写入状态 | 可以向用户承诺什么 | 不能声称什么 |
|---|---|---|
| queued | 请求已接受，等待提取/校验 | 已记住、其他会话现在可读 |
| committed | 权威记录及 revision 已事务提交 | 所有派生搜索索引均已追上 |
| indexed | 指定索引已覆盖该 revision | 所有会话一定会采用；权限自动扩大 |
| failed/cancelled | 本操作失败/取消，可查状态或重试 | 静默当成功或无限后台重试 |

最小回执包含 operationId、recordId、revision、状态与当前可见性。用户明确添加/纠正的结构化事实走直接事务，不能等待模型从整段聊天再次提取才生效；语义确认/共享资格和存储提交分别校验。SQLite 结构化查询与词法索引尽可能同事务，未来向量索引允许异步，但必须带索引水位。

**读己之写：**持有写入回执的会话可按 id/revision 在权威层读取已提交记录；若派生索引落后，检索返回 pending/index-lag 状态，或在授权范围内有界查询权威层。排队中的聊天提取不能假扮已提交事实；当前任务内明确纠正直接作用于 task，无须依赖异步记忆“想起来”。

超时、无相关证据、尚待索引与无权限在服务端分开记录，对用户只暴露其有权获知的状态；不能通过“另一个会话存在该条但无权读”的报错泄露私有条目。范围或权限检查失败时拒绝读取；可选检索服务失败时让原任务继续，并保留不可用状态，不伪装成已查全库且没有证据。

删除/切换/取消会递增 generation 或 epoch。后台任务在开始和提交时都复核，迟到的提取结果不能重建已撤销内容。队列采用有界容量和有限重试，载荷优先保存受控引用，不为调试复制整段提示词或工具输出。

## 5. 时间与纠正：后写入的内容不一定更新

现有 `verifiedAt/expiresAt/revision` 还不够回答“当时是什么”。建议增加：

- `observedAt`：来源事件或文件快照的观察时间；另留 `ingestedAt` 记录系统接收时间。事实适用时间单列，不与接收时间混用。
- `validFrom/validUntil`：事实适用时间区间；未知允许为空，不能补造日期。相对时间依来源时区与时间解析，保留原始引用及解析依据。
- `supersedes`：确认的事实修订关系；与删除/撤销分开。

例如 10 月 20 日使用 npm，25 日实际迁移 pnpm，30 日又导入一份旧文档。最新导入不能覆盖当前命令。问“现在怎么测试”使用当前有效证据；问“20 日当时怎么测试”才在相同权限范围内读取保留的历史版本，并明确历史用途，不能拿旧命令指导当前执行。

默认查询排除 superseded；历史查询可在指定 asOf 与用途下读取保留版本。revoked、已忘记正文、来源权限失效的内容**不因历史查询重新开放**。同一事实若有互相矛盾的来源，先标 conflict，结合有效时间与当前文件复核，不能机械地 last-write-wins。

## 6. 记忆读取要分开三种量

1. **库内候选量**决定能否找到证据。候选应按范围、类型、条件、词法/实体匹配筛选；最终最多投影 5 条不等于只准检索 5 条。候选池仍需时间、条数和计算预算，不无限扫描。
2. **最终投影量**决定模型看到什么。优先保留必要事实、条件、时间与来源；多跳问题必须检查证据覆盖，不能截断后假装完整。无证据时说明缺口。
3. **实际请求总量**包含自动投影、get/history、工具回执、重复来源及协议开销。派发前统一复核，跨轮替换，不累计追加。

LazyMem [论文](https://arxiv.org/abs/2607.22690)讨论查询时路由；本轮另读的[匿名仓库说明][lazy-readme]与 [QA 构造器][lazy-qa]体现混合检索、相邻上下文、KEEP/DROP、去重和按时间组装。它提示我们保留可追溯源、区分“没找着”和“压缩丢失”；不意味着 Patchwork 已获得其作者报告的成本或分数，也不需要 V1 引入其训练/模型栈。

原方案 800 tokens/2% 继续作为**待校准的保守初始上限**，没有研究证明它是通用最优值。对多证据任务要记录 coverage 与被预算舍弃的原因，在离线对照中调整政策；运行中不能悄悄放大限额。未知实际窗口或 tokenizer 时只给估算状态，不宣称硬 token 保证。

V1 仍以结构化/词法检索起步。中文短词、路径/符号、别名及同义表达分别建小型留出集；当证据显示词法遗漏成为瓶颈，再比较向量/混合检索的净收益，包含索引成本、更新时间与延迟。不存在仅凭项目名便证明必须上向量库的依据。

## 7. 遗忘与反思：源和派生物都要处理

EverOS [反思文档][everos-reflect] 将 Markdown 作为权威源、SQLite/向量/BM25 作为派生层；合并后旧片段 soft-archive，默认检索排除 deprecated。文档同时承认合并有损、相似聚类不保证单一主题，当前没有撤销单次合并的一键 endpoint。

这支持两个决定：

- **可追溯不等于永远保留正文。**归档/隐藏、纠正、撤销与忘记是不同操作；“搜不到”不能证明已删除。权威源、全文/向量索引、缓存、排队任务及备份分别说明处理范围。删除后重建索引，不能把源文件中的旧正文重新导入。
- **反思不能循环覆盖唯一依据。**原子事实有来源和独立版本，摘要是派生视图；反复摘要会损失条件、否定和时间。自进化候选引用真实 case、原方法和环境结果，不能把模型写的一段经验当成通过验证的程序规则。

保留 source reference 不代表所有读者可打开源会话。项目共享一条核验过的事实时，可提供经过授权的最小证据说明；私有来源正文仍按独立权限读取。物理保留策略还要说明 WAL/备份与已导出副本的边界。

## 8. 评测怎样覆盖真实问题

| 一手材料 | 本轮确认的评测边界 | Patchwork 应借鉴 |
|---|---|---|
| [LongMemEval][long-readme] / [论文](https://arxiv.org/abs/2410.10813) | 区分信息提取、多会话、时间、更新、拒答；[检索汇总脚本][long-metrics]排除了 `_abs` 题，再统计 session/turn recall 与 nDCG | 拒答另测；oracle 证据与真实检索分开，定位 reader 错误；检索分不冒充完成率 |
| [HaluMem][halu-readme] / [论文](https://arxiv.org/abs/2511.03506) | [评价器][halu-eval]分别处理提取、更新、问答，部分依赖模型判定 | 每阶段标注错误；judge 有异常/unknown、费用与人工抽查，不能自动等于客观真值 |
| [MemoryAgentBench][mab-readme] / [论文](https://arxiv.org/abs/2507.05257) | README 定义检索、测试时学习、长程理解和选择性遗忘；未审计全部 evaluator | 增量更新与选择性遗忘另测；任务遗忘分不能证明 WAL/备份中的物理删除 |
| [MemoryArena][arena-readme] / [论文](https://arxiv.org/abs/2602.16313) | 多会话互相依赖的 agent 任务；[基础接口][arena-agent]把 task/action/observation/可选 reward 纳入经验构造 | 测试记忆形成→调用→动作→环境结果；它不是 Patchwork 编码任务基准，需另建真实 DSH 编码留出集 |

不能把各项目不同数据、模型、上下文和 judge 的百分比拼成统一排名。本轮未复跑这些评测，也不据此声称我们优于某个系统。

在原方案 A（无新记忆）/B（项目事实）/C（已审经验）对照外，增加下列固定案例；大规模真实运行仍按原预算与隔离策略执行：

| 案例 | 输入/触发 | 必须观察的结果 |
|---|---|---|
| 写入立即读 | 排队提取后立即 search；直接确认后 get | queued/committed/indexed 分明；get 不读错 revision，不能将 pending 说成不存在 |
| 写入期间撤销 | 提取/索引尚未完成便删除或切走 | 迟到结果被拒，取消只影响对应会话/操作 |
| 候选裁剪 | 相关候选超过投影额度，B 被裁掉 | B 留在“检索到但未发送”；后续有预算时仍可选；sent 不等于 adopted |
| 预算绕过 | 连续 search/get/history、翻页、重试与 100 步 | 实际请求总记忆符合预算，旧工具正文不累积；与请求投影门槛联测 |
| 事实时间 | 旧事实→更正→延迟导入旧材料，分别问现在/过去 | 当前事实不被旧导入覆盖；历史有时间标记；删除正文永不历史复活 |
| 删除后重建 | 忘记后重启、重建 FTS/向量、恢复旧 checkpoint | 被删内容不可重新出现；相关备份状态如实报告 |
| 提取/检索/阅读 | 人工核对源事实，再给 oracle 与检索视图 | 把未提取、更新错、没召回、裁剪丢失、读错和行动失败分开归因 |
| 中文与无关任务 | 短词、路径、同义表达；另加无关新任务 | 检查遗漏；无关事实不注入，干净任务保持 no-op |
| 正向共享与私有来源 | A 共享原子事实，B 开 project；再切 B off | B 可用事实但不能读 A 私有来源；关闭 B 不影响 A/C；其他 Agent 仍无能力 |
| 持久提示注入 | 源/导入/工具材料要求升级规则或跨项目调用 | 不自动确认、共享、提权或启用经验；服务端权限独立于模型判断 |
| 真任务结果 | 新会话用记忆定位入口并修改插件、真实执行验收 | 当前文件与工具回执支持结果；答对入口名称不等于任务成功 |

日志只记录阶段、耗时、id/revision、采用/拒绝原因、计量与状态。调试观察优先使用无敏感意义的标记；不为了评测把真实历史全文追加进普通日志。

## 9. 对原方案的最终调整

继续选择**Patchwork 自己的薄范围层 + SQLite 权威记录 + 原生历史引用 + 有界请求视图**。现成 DSH 插件提供了可借鉴的生命周期设计，但没有一套已经证明满足我们的 preset、会话私有/项目共享、当前宿主与上下文撤销合同；不整包安装后再补隔离。

本次写回[融合设计](memory-evolution-design-2026-10-30.md)的增量：

1. P0 仍先验证宿主请求投影、真实范围与计量；自动读取不绕过此门槛。
2. P1 增加操作状态/回执、读己之写、事实有效时间、历史查询与索引水位；删除后重建列为验收项。
3. P2 分开库内候选和最终投影，记录 retrieved/admitted/sent，统一自动/工具/历史预算；报告提取、更新、检索、裁剪与 reader 错误。
4. P3 自进化仍以真实 action/observation/验收构建候选和留出；反思只是候选来源，问答高分或来源中“已完成”不能直接激活经验。

这些是方案收敛，尚未新增数据库、工具或后台学习功能。本轮只校验研究文档与引用，不把历史测试、作者分数或静态分析写成新真实调用结果。

[memos-bridge]: https://github.com/MemTensor/MemOS/blob/64388b50e2a15528bcdf032e65a1ac792bcf63ee/apps/memos-local-plugin/adapters/deepseek-harness/bridge.ts#L194-L275
[memos-capture]: https://github.com/MemTensor/MemOS/blob/64388b50e2a15528bcdf032e65a1ac792bcf63ee/apps/memos-local-plugin/adapters/deepseek-harness/bridge.ts#L355-L376
[memos-namespace]: https://github.com/MemTensor/MemOS/blob/64388b50e2a15528bcdf032e65a1ac792bcf63ee/apps/memos-local-plugin/adapters/deepseek-harness/namespace.ts#L4-L15
[memos-visibility]: https://github.com/MemTensor/MemOS/blob/64388b50e2a15528bcdf032e65a1ac792bcf63ee/apps/memos-local-plugin/core/runtime/namespace.ts#L101-L164
[mem0-entry]: https://github.com/mem0ai/mem0/blob/26cdefb46600c0fa5953c4b5ee5003c125539fc4/integrations/deepseek-plugin/src/index.ts#L129-L195
[mem0-identity]: https://github.com/mem0ai/mem0/blob/26cdefb46600c0fa5953c4b5ee5003c125539fc4/integrations/agent-plugin-core/typescript/src/identity.ts#L9-L27
[mem0-lifecycle]: https://github.com/mem0ai/mem0/blob/26cdefb46600c0fa5953c4b5ee5003c125539fc4/integrations/agent-plugin-core/typescript/src/lifecycle.ts#L5-L6
[mem0-output]: https://github.com/mem0ai/mem0/blob/26cdefb46600c0fa5953c4b5ee5003c125539fc4/integrations/agent-plugin-core/typescript/src/formatting.ts#L8-L43
[dsh-recall]: https://github.com/BayInl/dsh-memory/blob/44e50b062ff39b65112b91657103ed3226fa74ae/lib/service.js#L994-L1037
[dsh-seen]: https://github.com/BayInl/dsh-memory/blob/44e50b062ff39b65112b91657103ed3226fa74ae/lib/service.js#L629-L635
[dsh-budget]: https://github.com/BayInl/dsh-memory/blob/44e50b062ff39b65112b91657103ed3226fa74ae/lib/budgets.js#L12-L29
[operator-entry]: https://github.com/aerovato/operator-memory/blob/734bb115178684b50383ec7ccb9d09e9f8263adc/packages/deepseek/src/index.ts#L16-L38
[operator-load]: https://github.com/aerovato/operator-memory/blob/734bb115178684b50383ec7ccb9d09e9f8263adc/packages/core/src/memory/load.ts#L41-L64
[operator-private]: https://github.com/aerovato/operator-memory/blob/734bb115178684b50383ec7ccb9d09e9f8263adc/packages/core/src/memory/project.ts#L18-L19
[operator-preamble]: https://github.com/aerovato/operator-memory/blob/734bb115178684b50383ec7ccb9d09e9f8263adc/packages/core/src/preamble.ts#L178-L237
[lazy-readme]: https://github.com/allacnobug/LazyMem/blob/578968f586fe51e3a3c0e19b5b38f87271bbdd37/README.md
[lazy-qa]: https://github.com/allacnobug/LazyMem/blob/578968f586fe51e3a3c0e19b5b38f87271bbdd37/evaluation/build_qa_prompts.py#L113-L166
[everos-reflect]: https://github.com/EverMind-AI/EverOS/blob/962c63eeaae5093b495a4763c161f8b046d41bc2/docs/reflection.md#L147-L325
[long-readme]: https://github.com/xiaowu0162/LongMemEval/blob/9e0b455f4ef0e2ab8f2e582289761153549043fc/README.md
[long-metrics]: https://github.com/xiaowu0162/LongMemEval/blob/9e0b455f4ef0e2ab8f2e582289761153549043fc/src/evaluation/print_retrieval_metrics.py#L10-L40
[halu-readme]: https://github.com/MemTensor/HaluMem/blob/d653749586bfc7d13f5b68e8851f52155b5b1650/README.md
[halu-eval]: https://github.com/MemTensor/HaluMem/blob/d653749586bfc7d13f5b68e8851f52155b5b1650/eval/evaluation.py
[mab-readme]: https://github.com/HUST-AI-HYZ/MemoryAgentBench/blob/538026089d1a8a8eff05121d0db89b388f360eba/README.md
[arena-readme]: https://github.com/ZexueHe/MemoryArena/blob/6cd9de14b71915e39ac742a20dc33785e14b6aab/README.md
[arena-agent]: https://github.com/ZexueHe/MemoryArena/blob/6cd9de14b71915e39ac742a20dc33785e14b6aab/agent/base.py#L24-L65
