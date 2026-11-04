# Patchwork 用户体验改进闭环方案

日期：2026-10-31（Asia/Shanghai）
状态：产品与工程方案，尚未实施本方案新增能力。
范围：Patchwork 插件及其隔离 DSH 实验环境。

## 1. 产品宗旨

Patchwork 的目标是让用户更容易、更放心地使用 DSH。它根据真实使用中的失败、重复纠正和无效操作，提出更好的运行规则、记忆策略、工具流程或界面提示；候选改动必须在隔离环境中验证，经过用户确认后才影响后续任务。

这里改进的是 **Agent 的使用体验和可靠性**，不是模型权重。

本方案不做模型训练、RL、Self-HPO、持续后台自我修改或 benchmark 排名优化。模型可以保持不变；Patchwork 只管理模型周围的上下文、工具、记忆、技能、验证和界面。

## 2. 重新评估当前状态

### 已具备的基础

| 能力 | 当前实现 | 对用户的意义 |
|---|---|---|
| 任务状态 | `src/task/` 的 revision、纠正、产物、验收和真实工具回执 | 失败不能直接显示为完成，纠正可使旧证据过期 |
| 运行时效率 | Action Fusion、ObservationPack、Evidence-Preserving Reducer、Online Context Compact | 减少重复派发、超长观察和无效上下文 |
| 作用域隔离 | Patchwork preset 才加载 Patchwork 工具、技能和机制 | 其他 Agent 不应获得 Patchwork 能力 |
| 日志 | 宿主原生记录加白名单诊断元数据 | 可以追溯机制状态，同时避免记录提示词、命令全文和凭据 |
| WebUI | 总览、机制、证据、日志、设置；候选只读展示 | 用户能看到当前任务和依据，但还不能审查并启用改进 |
| 隔离验证 | 独立 DSH_HOME、工作区、端口和结果目录 | 可以验证真实宿主而不碰主 DSH |

### 尚未具备的闭环

1. 失败和纠正还没有统一归类为可复用的用户体验问题。
2. 候选经验只能在当前任务中显示，没有跨任务的有范围存储、更新和撤销。
3. `src/quality/evolution.mjs` 只检查实验档案结构；它不能证明真实运行、收益或安全性。
4. 没有隔离 runner 自动重放候选，也没有用户确认、试用、回滚和逐项目启用。
5. WebUI 没有展示“发生了什么、建议改什么、证据是什么、影响哪些会话”。
6. 还没有把体验指标和机制指标分开。节省 token 不能代替少纠正、少越界和更快得到可用结果。

因此，当前产品是**可靠执行和观测底座**，不是完整的记忆或自进化产品。

## 3. 调研结论

这次调研只保留与用户体验改进直接相关的路线。

### 3.1 运行时和安全闭环

- [SoL-Pi](https://github.com/NVlabs/SoL-Pi)：作为运行时效率底座，继续使用四个机制和能力下限。
- [RRSI](https://github.com/google-research/rrsi)：用编辑预算、噪声门槛、成本规则、组件裁剪和 worktree 防止候选过拟合或无限扩张。
- [Harness²](https://github.com/google-research/harness2)：参考任务内 Propose–Probe–Compose，但只借鉴隔离试验和候选组合，不引入模型训练。
- [HarnessPro](https://github.com/pzs19/HarnessPro)：参考 Lite、Medium、Heavy 的性能—成本选择，不把单一分数当成产品目标。

### 3.2 记忆和用户控制

- [KARMA](https://arxiv.org/abs/2610.39884)：把知识拆成类型化模块，由轨迹证据和回归门决定保留、替换或回滚。
- [Noesis](https://github.com/SwarnimWalavalkar/noesis)：参考有界 notebook、历史可检索和用户可见的学习状态。
- [harness2-morphd](https://github.com/a742987/harness2-morphd)：参考本地优先、只建议不自动修改、快照、试用和撤销的产品流程。
- 本地的[记忆再调研](memory-deep-dive-2026-10-31.md)确认：检索候选、最终投影和实际请求总量必须分别计量；`queued`、`committed`、`indexed` 不能混成“已经记住”。

### 3.3 真实 DSH 证据和反例

- [DSH Harness Evolution](https://github.com/HuangShengZeBlueSky/dsh-harness-evolution)：最接近当前宿主的外部实验参考。它记录版本化插件、进化曲线和复现边界，也明确指出更复杂的循环不一定带来更好结果。
- [Elicitation or Expansion?](https://arxiv.org/abs/2610.27889)：提醒 pass@1 上升可能只是更好地调动已有能力，必须观察困难任务覆盖和多次尝试后的表现。
- [Masked Erosion](https://arxiv.org/abs/2610.38392)：提醒验收门可能悄悄删除冗余安全规则；安全深度必须单独做负测，不能只看任务成功率。

下列方向不进入 Patchwork 产品范围：Self-HPO、VibeTraining-Bench、模型权重训练、自动发布和无人值守的全局规则修改。

### 3.4 信息检索能力

当前 DSH 已经提供本地 `glob/grep/read`、网页 `web_search/web_fetch`，以及默认关闭的实验性历史会话搜索。Patchwork 复用这些能力，并在缺少 web provider 密钥时增加 `patchwork_search` 无密钥多 provider fallback（Bing、Brave、DuckDuckGo）；它只注册在 Patchwork Agent 作用域内。缺口仍是把检索范围、预算、来源信任、上下文投影和 UI 证据做成完整能力。详细调研见[信息检索调研与方案](information-retrieval-research-2026-10-31.md)。

检索必须与记忆分开：搜索结果只服务当前任务；只有经过 scope、来源、版本和用户确认的最小事实，才可能进入记忆候选。默认路由为 workspace → 已授权 project memory → 显式 session history → web → 必要的 fetch。网页和历史会话内容都是不可信数据，不能改变规则、权限或记忆。

采用成熟项目中最适合 Patchwork 的部分：Haystack 的显式检索管线、Qdrant Search Quality skill 的 golden set/held-out/置信区间、Open WebSearch 的能力状态与 untrusted 边界、Iterative Retrieval 的三轮收窄流程，以及 SearXNG 的多引擎隔离思路。向量、reranker、GraphRAG、第二套付费 web provider 和全局 session-search 组合包延后，直到真实漏召回或跨文档问题在隔离实验中证明必要。公共 HTML fallback 只解决无密钥可用性，不承诺稳定排序或完整抓取。

## 4. 用户体验闭环

```text
真实失败 / 用户纠正 / 重复无效操作
                ↓
       结构化问题记录 Incident
                ↓
      生成一个有范围的改进候选 Candidate
                ↓
  隔离 DSH：基线 → 候选 → 留出任务 → 安全负测
                ↓
       形成可阅读的 Review Card
                ↓
        用户批准、拒绝或稍后处理
                ↓
     项目级或会话级启用，带版本和回滚点
                ↓
       后续任务反馈、过期、撤销或替代
```

每一步都必须有明确状态。模型的自我评价只能作为候选说明，不能作为通过证据。

## 5. 四类可改进对象

### 5.1 运行规则

例如：某类任务在写入后应先运行固定检查；遇到特定失败应先读取某个入口；用户明确要求只读时禁止写入。

规则必须包含触发条件、作用范围、预期行为、反例和撤销条件。规则不能偷偷扩大权限，也不能以一条自然语言建议代替工具层检查。

### 5.2 记忆策略

记忆不是完整聊天副本，而是带来源、时间、范围和状态的最小事实或经验。

- `session`：只对当前会话有效。
- `project`：同项目、且当前会话显式开启时可读。
- `profile`：仅用户明确选择后可读，默认关闭。
- `global`：本产品阶段不自动生成。

每条记录必须区分来源、适用时间、确认状态、当前 revision、替代关系和删除状态。私有来源不可因共享一条事实而开放原会话、工具调用或授权链。

### 5.3 工具流程

例如：把重复的“读文件—改文件—跑检查”变成有回执的流程；失败后只重跑失败单元；用户取消后不继续提交后台动作。

工具流程必须在隔离 DSH 中验证真实工具回执、退出码、取消行为和作用域。普通 shell 不能被描述成强沙箱。

### 5.4 界面提示

UI 只呈现真实状态，不用提示词包装不确定性。可以改进：

- 首次使用时提示当前 Agent、项目、工作区和能力范围。
- 在失败后展示原因、影响范围和建议动作。
- 展示记忆来源、适用范围、最近更新时间和未采用原因。
- 展示候选改动的 before/after、证据、成本和回滚点。
- 在候选未验证、已验证、待批准、已启用、已撤销之间明确区分。

### 5.5 信息检索

检索视图作为任务证据的一部分，沿用 DSH 原生侧栏、token 和主题，不另起搜索站点。它显示当前范围（仅本地、项目、历史、web）、查询词、来源路径或 URL、版本/日期、信任级别、检索/采用/发送/引用/验证状态、被预算裁剪的条目、耗时和字符/token 估算。当前已落地的 `patchwork_search` 先提供 Bing/Brave/DuckDuckGo 的有界合并结果、成功/失败 provider 和耗时诊断；完整检索 ledger 与 UI 仍按后续阶段推进。

“引用来源”“仅查看”“加入记忆候选”必须是不同动作。加入记忆仍走 Candidate/Approval 流程；网页中的按钮、命令和提示文字只能显示为外部数据，不能被渲染成 Patchwork 操作。检索失败显示 unknown 或 partial，不显示泛化的“系统已经学会”。

## 6. 候选与证据模型

第一版不引入第二套任务状态机，复用现有 `src/task/` 的 revision 和验收引用。

### Incident

记录一次用户可感知的问题：

- `id`、`sessionIdHash`、`projectKey`、`agentPreset`
- `kind`：失败、纠正、重复、越界、上下文浪费、界面困惑
- `sourceReceiptIds`：真实工具或用户纠正的引用
- `scope`、`observedAt`、`privacyClass`
- `status`：observed、triaged、dismissed、converted

不保存完整提示词、命令全文、凭据或私人原文。

### Candidate

记录一个具体改进：

- 改进对象：rule、memory-policy、tool-flow 或 ui-copy
- 触发条件和适用范围
- 假设、反例、父版本和 rollback target
- 预期收益：少纠正、少重复调用、低 token、低延迟或更清晰的操作
- 风险：越权、记忆污染、误触发、额外询问、界面噪音
- `decision`：proposed、approved、rejected、superseded、revoked

### Experiment

实验必须同时记录：

- 固定模型、宿主版本、插件版本和环境身份。
- 基线与候选的任务集、留出集和预算。
- 真实工具回执、退出码、取消、文件版本和日志引用。
- 功能结果、用户体验指标、token/延迟和副作用。
- 安全负测：跨会话、切换 preset、重启、fork、压缩、恶意材料和未授权路径。

“结构合法”只能得到 `eligible-for-review`，不能得到 `approved`。

## 7. 用户界面方案

沿用 DSH 原生右侧栏、宿主 token、浅色/暗色和当前五个主 tab，不另起 Web 服务。

### 总览

增加一个“最近问题”摘要：发生了什么、是否已处理、是否有待审候选。没有问题时保持安静，不显示泛化的“AI 正在学习”。

### 证据 → 改进

每个候选显示一张 Review Card：

1. 触发问题和真实来源。
2. 建议改变的对象和范围。
3. before/after 或流程差异。
4. 隔离实验结果和未覆盖项。
5. 预计 token、延迟和询问次数变化。
6. 可能影响的会话范围。
7. **批准并启用、仅试用、拒绝、查看日志**。

批准按钮默认只对当前项目生效；跨项目和 profile 级启用必须单独选择。未验证候选没有“启用”按钮。

### 记忆

显示当前读取模式、候选来源、实际发送条目、被预算裁剪条目和权限范围。必须区分：

```text
检索到 ≠ 准许使用 ≠ 已发送 ≠ 用户采用 ≠ 行为成功
```

### 日志

增加改进生命周期筛选：incident、candidate、experiment、approval、rollback、memory-scope。日志只显示必要元数据和引用，敏感正文继续走脱敏策略。

## 8. 分阶段实施

### P0：体验问题和改进状态可见

交付：Incident schema、候选状态、来源引用、UI Review Card 只读页面、检索提示词、检索 ledger 字段、日志事件和 scope 负测。

退出条件：用户能回答“为什么出现这个候选、它来自哪次失败、现在有没有改变行为”；候选没有任何自动激活路径。

### P1：有范围的记忆底座

交付：本地 SQLite/worker 能力探针、session/project 作用域、来源和时间、纠正/替代/删除、`queued → committed → indexed` 回执、动态记忆预算；检索候选、最终投影和实际发送量分开计量。

退出条件：私有记录对其他会话不可见；明确共享的最小事实可被授权会话读取；关闭某会话的记忆不影响其他会话；删除后重启和重建索引不复活；窗口未知时不宣称硬 token 上限。

### P2：隔离改进实验

交付：独立 DSH runner、基线/候选/留出任务、真实工具回执、成本与 UX 指标、安全负测、实验 ledger；比较无检索、仅 workspace、workspace+project、workspace+web 四种路径。

退出条件：实验目录、DSH_HOME、端口、模型端点和结果目录均独立；主 DSH 请求数和进程操作为零；失败、取消、缺回执和污染档案均拒绝接纳。

### P3：用户确认后的有限启用

交付：批准、试用、撤销、替代、回滚；默认项目范围；启用版本在每次请求中可追溯。

退出条件：未批准候选不影响行为；回滚后旧候选不再注入；跨项目不会自动推广；新任务不会继承旧任务授权；停用 preset 后能力和后台任务一并撤销。

### P4：体验反馈闭环

交付：用户可标记“有帮助/没帮助/误触发”，系统把反馈和真实结果关联；只形成新候选，不直接修改生效版本。

退出条件：每个候选有采用率、重复失败率、回滚率、误触发率和维护成本；失败候选不会因为重复出现就自动升级为全局规则。

## 9. 产品验收指标

### 正向指标

- 同类任务的用户纠正次数下降。
- 重复失败和无效工具循环下降。
- 从首次请求到可用产物的时间下降。
- 记忆召回正确率和来源可解释性提高。
- token、延迟和后台等待保持在预算内。
- 用户能在 UI 中找到当前有效版本、证据和回滚入口。
- 关键文件/事实进入候选集的 Recall@k、正确入口排序的 MRR/NDCG 和引用支持率提高。
- 无答案、冲突和过期来源能被正确标为 unknown/partial，且不会把未授权历史带入当前任务。

### 硬性负指标

- 失败后显示可信完成。
- 私有记忆跨会话或跨项目泄露。
- 未批准候选改变其他会话。
- 删除内容在重启、重建或压缩后复活。
- 旧 revision 的回执授权新动作。
- 候选为了通过任务而删除安全规则。
- 用模型自评或静态档案冒充真实宿主验证。

每个指标都要按 session、project、preset 和模型路由分开报告；不压成一个“智能程度”分数。

## 10. 与现有源码的落点

优先复用现有模块：

| 位置 | 责任 |
|---|---|
| `src/task/` | 任务 revision、纠正、产物和验收引用 |
| `src/quality/evolution.mjs` | 扩展为实验档案准入，不直接负责批准 |
| `src/logging/` | 白名单生命周期事件、脱敏和宿主记录 |
| `src/scope.mjs` | Agent/preset 作用域和能力撤销 |
| `src/runtime.mjs` | 仅在 Patchwork preset 注册改进能力 |
| `src/client/WorkspacePanels.jsx` | 记忆、改进、审批和回滚的原生投影 |
| `src/client/LogPanel.jsx` | 改进生命周期和证据引用 |
| `src/task/`、`src/logging/`、`src/scope.mjs` | 记录检索 query、来源状态、预算、发送量和引用关系；对 workspace/project/session/web 做 Agent 级授权和撤销；不保存网页全文和提示词全文 |

新增模块建议放在 `src/improvement/`：

- `incident.mjs`：失败/纠正归类和脱敏引用。
- `candidate.mjs`：候选版本、范围和回滚关系。
- `experiment.mjs`：隔离实验档案和状态。
- `approval.mjs`：用户确认、试用、撤销和 CAS。
- `projection.mjs`：把实际发送、预算裁剪和启用状态投影给 UI。

这几个模块不创建新的 agent loop、不修改模型配置、不读取主 DSH 的会话正文。

## 11. 最终取舍

采用：

- SoL-Pi 的运行时效率机制。
- RRSI 的受限候选、成本门和反过拟合思路。
- KARMA 的类型化、可追溯、可回滚记忆更新。
- morphd/Noesis 的用户可见、可审查和可撤销体验。
- DSH Harness Evolution 的真实宿主验证纪律。
- DSH 原生 `glob/grep/read`、`web_search/web_fetch`，以及信息检索方案中的证据状态、预算、引用和 scope 规则。
- Haystack 的显式检索阶段、Qdrant skill 的 golden set 与 held-out 评测、Open WebSearch 的 untrusted 外部数据边界和 Iterative Retrieval 的有限收窄。

不采用：

- 模型权重训练和 RL。
- 自动修改全局 system prompt。
- 后台无限运行的自我改进。
- 没有用户确认的跨项目推广。
- 只有 benchmark 分数、没有用户体验和安全负测的接纳规则。
- 自动把检索结果写成长期记忆、无限 query expansion、embedding 相似度单独决定事实，以及直接开启 DSH 全局 session-search。

## 12. 旧文档如何融合

旧文档继续保留，因为它们记录了来源、原始证据、宿主事实和历史决策。它们不全部直接合并成一份长方案，是因为其中有不同日期、不同状态和已经被推翻的候选。融合原则是：**当前代码和真实宿主证据决定“现在有什么”；本文决定“产品下一步要解决什么”；旧文档提供“为什么这样决定”。**

| 旧文档 | 融合到本文的位置 | 当前使用方式 |
|---|---|---|
| [全文档融合执行方案](upgrade/2026-10-30-integration.md) | 当前能力、任务回执、隔离验证、实施边界 | 作为已有实现和真实验证的台账；其中的历史数字不自动变成新能力 |
| [记忆、自进化与产物质量融合方案](memory-evolution-design-2026-10-30.md) | 记忆范围、上下文预算、候选实验、阶段 P1–P4 | 作为技术底稿；本文把它收敛为面向用户的审批、试用和回滚流程 |
| [记忆系统再调研](memory-deep-dive-2026-10-31.md) | 5.2、6、8、P1 | 采用 `queued/committed/indexed`、读己之写、实际发送预算和删除后不复活；仍需实现和真宿主验证 |
| [DSH 会话审查解决方案](archive/removed-evidence.md#private-session-audit) 与[升级建议](archive/removed-evidence.md#private-session-audit) | Incident、纠正、验收、失败止损和产品指标 | 作为用户失败模式和回归用例来源，不把每条纠正复制成提示词 |
| [用户纠正专题](archive/removed-evidence.md#private-session-audit) 与[证据](archive/removed-evidence.md#private-session-audit) | 真实失败/纠正 → Incident | 只保留脱敏的失败机制、来源引用和验证要求，不复制私人原文 |
| [SoL-Pi 机制设计](solpi-mechanisms-design.md)、实验报告、[auto-research](../research/README.md)、[benchmark](../benchmark/README.md) | 运行时效率、实验和成本指标 | SoL-Pi 是运行时底座；研究和反事实度量不能直接证明用户体验收益 |
| [日志审查](logging-audit-2026-10-30.md) 与[日志文档](logging.md) | 改进生命周期日志和隐私边界 | 继续使用白名单元数据、引用和脱敏；不把日志当长期记忆正文 |
| [Skills/UI/UX 调研](agent-skills-ui-ux-writing-coding-research-2026-10-29.md)、[去 AI 垃圾调研](anti-slop-skills-research-2026-10-29.md) | UI Review Card、提示文案、事实和行为保真 | 作为验收标准，不作为常驻长提示词 |
| [信息检索调研与方案](information-retrieval-research-2026-10-31.md)、[独立检索提示词](../assets/prompts/retrieval-research-prompt.md) | 检索来源、DSH 工具契约、预算、引用、web 不可信边界和评测 | 已接入 `patchwork_search` 多 provider 无密钥 fallback；完整 ledger、引用 UI 和评测仍待后续阶段 |
| [DSH Skill 架构](architecture-collaborator-skills.md)、工程/产品指南 | 10. 源码落点和实现约束 | 继续遵守 DSH 原生技能、渐进披露、最小改动和真实路径验证 |
| [首轮升级方案](upgrade/2026-10-29/README.md) 及 `webui.md`、`verification.md`、`isolation.md` | WebUI、主题、隔离验证的历史依据 | 记录已经完成的旧阶段；当前 UI 状态以源码和最新验证为准 |
| [少 Token 编码插件 v2](design-token-efficient-coding-plugin.md) | SoL-Pi、上下文和证据候选的来源 | 保留早期候选；其中 systemPrompt 分段和未经对照的收益目标不采用 |

### 文档优先级

发生冲突时按以下顺序判断：

1. 当前源码、测试和真实隔离 DSH 回执。
2. 本文的产品范围和用户体验目标。
3. `upgrade/2026-10-30-integration.md` 的已实施台账。
4. 记忆、SoL-Pi、日志和会话审计的技术调研。
5. 10/29 及更早的历史方案和未验证候选。

因此，“使用旧文档”不是把所有旧建议同时打开，而是保留其证据并明确标出采用、延后、替代和排除关系。

## 13. 本轮结论

Patchwork 下一阶段的核心产品不是“让模型变强”，而是让用户在每次失败之后少走一步弯路，并且知道系统为什么改变、改变了什么、影响谁、如何撤销。

实施顺序固定为：

```text
可见问题 → 有范围候选 → 隔离真实验证 → 用户确认 → 项目级启用 → 反馈与回滚
```

现有[记忆、自进化与产物质量融合方案](memory-evolution-design-2026-10-30.md)保留为技术研究底稿；本文作为面向产品体验的主方案。新增能力在 P0–P2 完成前不应写入产品已支持列表，也不应更新为“已具备长期记忆或自动自进化”。
