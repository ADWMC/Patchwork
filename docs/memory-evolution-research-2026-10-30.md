# 记忆、自进化与产物质量：补充源码调研

日期：2026-10-30。配套交付：[融合设计方案](memory-evolution-design-2026-10-30.md)。本文记录本轮实际查看的依据、采用部分与不采用部分，不是安装或执行清单。

后续：[2026-10-31 记忆再调研](memory-deep-dive-2026-10-31.md)补查四套 DSH 适配、写入可见性、时间版本与分阶段/真实任务评测；相应合同已写回融合设计，尚未实施。

## 1. 方法与证据边界

本轮先读既有调研、实现与验证记录，再对 7 个项目通过 `gh api` 获取仓库元数据、固定提交树和 13 份定向文件。GitHub CLI 仅在其进程环境使用本机代理 `http://127.0.0.1:7897`，不修改系统代理。下列提交是本次快照，不代表以后仍是最新版本。

远程文件只作为材料阅读：没有加载第三方技能、执行仓库脚本、安装依赖或验证它们的效果。较长源码为定向阅读接口和决策路径，未逐行审计整个项目。GitHub API 的 license 字段不能代替完整的代码复用许可核查；本轮不复制第三方实现。

结果分成三类：**源码显示了什么**、**对 Patchwork 的设计建议**、**后续必须实测什么**。项目自报的 benchmark、confidence 或 README 宣传不等于 Patchwork 获得了收益。

## 2. 先融合仓库已有研究

| 既有材料 | 本轮沿用的内容 | 避免重复或误用 |
|---|---|---|
| [记忆与完成依据](agent-memory-completion-grounding-research-2026-10-30.md) | 事件/事实/任务/经验分开；来源、纠正、遗忘、恢复与验收关联 | 外部仓库快照不等于本地运行效果；“文档支持”“事实可信”“行为完成”分别评估 |
| [自进化研究](ai-self-evolution-research-2026-10-29.md) | 失败来源、单一候选、同条件对照、留出、接纳/淘汰/回退 | 优先优化 agent 方法；候选生成与真正收益分开，不先上权重训练 |
| [UI/UX、写作与代码技能](agent-skills-ui-ux-writing-coding-research-2026-10-29.md) | 宿主入口/token/theme；技能触发/执行/结果；不同产物有不同验收 | 不把完整技能集合常驻全局；不把项目设计都套成一个模板 |
| [去模板化技能](anti-slop-skills-research-2026-10-29.md) | 保留否定、范围、时序、归因；代码安全与行为保真；正常内容允许 no-op | 不用词表、删行数或 AI 检测分数作为质量代理 |
| [会话审计方案](archive/removed-evidence.md#private-session-audit) | 用户纠正改变当前对象、范围和阶段；“看资料/设计”不自动授权实施 | 单次任务限制不升级为所有项目的永久偏好 |
| [既有融合报告](upgrade/2026-10-30-integration.md)与[SoL 实验](experiments/2026-10-30-solpi/report.md) | 任务回执、隔离 preset、原生侧栏、OCC/EPR/OP 的现有边界 | 历史测试及真实调用属于原轮次；没有受控 A/B 不能声称性能或自进化收益 |
| [更新日志指南](changelog-guide.md) | 使用文档、发布说明和验证报告分别维护 | 方案不冒充新增功能；有实际用户行为变化的实施阶段再同步产品日志 |

## 3. 记忆系统：接口与证据模型

### 3.1 LangMem：范围在调用侧解析，不让模型自己选租户

快照：`langchain-ai/langmem@ae6f15fb76603fa2c86ad05f1ecb4a110fa8060b`。

本轮获取并查看：

- [README](https://github.com/langchain-ai/langmem/blob/ae6f15fb76603fa2c86ad05f1ecb4a110fa8060b/README.md)：库的定位和 store 集成方式。
- [动态 namespace 指南](https://github.com/langchain-ai/langmem/blob/ae6f15fb76603fa2c86ad05f1ecb4a110fa8060b/docs/docs/guides/dynamically_configure_namespaces.md)：运行时 namespace 模板与用户/Agent 分区示例。
- [knowledge/tools.py](https://github.com/langchain-ai/langmem/blob/ae6f15fb76603fa2c86ad05f1ecb4a110fa8060b/src/langmem/knowledge/tools.py)：重点为 `create_manage_memory_tool`（25 起）、create/update/delete 分支（约 280–340）和 `create_search_memory_tool`（362 起）。

源码将记忆管理与范围内搜索分开，编辑/删除关联已有记录 id；namespace 从运行配置解析。示例中的 InMemoryStore 并不提供跨进程持久化。

**采用：**服务端 namespace、记录 id、管理与搜索接口分离。**不照搬：**Python/LangGraph 运行时或仅在内存中“记住”。Patchwork 需把真实 preset、profile、project 解析放到工具之外，并额外处理撤销、并发版本及重启。

### 3.2 Hindsight：原始材料与派生知识分开，派生结果有新鲜度

快照：`vectorize-io/hindsight@1da02ab63ca6e1144583402533a82f1214f89611`。

本轮获取并定向查看：

- [README](https://github.com/vectorize-io/hindsight/blob/1da02ab63ca6e1144583402533a82f1214f89611/README.md)：retain/recall/reflect 与服务形态。
- [observations](https://github.com/vectorize-io/hindsight/blob/1da02ab63ca6e1144583402533a82f1214f89611/skills/hindsight-docs/references/developer/observations.md#L1-L51)：重点为前 51 行的 consolidation、来源、历史与 stale 规则，后续只查相关段落。
- [memory banks](https://github.com/vectorize-io/hindsight/blob/1da02ab63ca6e1144583402533a82f1214f89611/skills/hindsight-docs/references/developer/api/memory-banks.md#L15-L28)：重点为缺失 bank 与创建行为，不声称审计了整份 API 文档。

文档描述：保留新事实后，在相同 tag scope 内异步整理 observations；派生知识关联具体证据、引文与历史，新事实尚未整理时需识别 stale 并回查原始事实。读取不存在的 bank 返回 404，不能把不存在/故障当作空结果。

**采用：**来源与派生关系、纠正链、新鲜度、missing/unavailable/empty 的区分。**不照搬：**V1 为了记忆就部署外部服务或复杂数据库；也不把 proof count 当成事实正确率。Patchwork 先引用原生事件和内容 hash，删除时使派生项失效。

## 4. 自进化：候选必须经独立执行与逐例评价

### 4.1 pi-autoresearch：可借检查档案，不能搬主目录清理循环

快照：`davebcn87/pi-autoresearch@04b8a50dac7efe80ffc91648bd00ed9b022e24c2`。

本轮获取并定向查看 [extensions/pi-autoresearch/index.ts](https://github.com/davebcn87/pi-autoresearch/blob/04b8a50dac7efe80ffc91648bd00ed9b022e24c2/extensions/pi-autoresearch/index.ts)：结果状态约 82/245 行、maxIterations 约 467–487、正确性检查约 2000/2232、keep/回退约 2400–2445。

源码区分 keep/discard/crash/checks_failed；正确性检查失败不能 keep；maxIterations 是可选配置。keep 路径会创建提交，回退路径含 git checkout 与 git clean 操作，并非天然适合用户已有 dirty 工作树。

**采用：**失败不接纳、每次实验有记录、明确 keep/discard 原因。**排除：**直接运行该循环、在当前仓库自动提交或清理，以及缺省无明确预算的持续运行。Patchwork 单独做受限实验目录、总预算、固定裁判与回退指针。

### 4.2 GEPA：评价器决定学习方向，保留逐例轨迹

快照：`gepa-ai/gepa@02ea4152ff6e512484cb5298046bfe967aea4735`。

本轮获取并定向查看：

- [core/adapter.py](https://github.com/gepa-ai/gepa/blob/02ea4152ff6e512484cb5298046bfe967aea4735/src/gepa/core/adapter.py)：`EvaluationBatch`（16 起）的 outputs/scores/trajectories 与可选 objective_scores，`GEPAAdapter`（101 起）、evaluate（163 起）及反馈接口。
- [writing_evaluators](https://github.com/gepa-ai/gepa/blob/02ea4152ff6e512484cb5298046bfe967aea4735/.claude/skills/gepa-optimize-anything/references/writing_evaluators.md)：评价分数与反馈会塑造优化结果，训练/验证/测试需分开。

**采用：**将真实 DSH 执行封装为 evaluator，记录每例轨迹和不同目标；保留调优、留出及反例。**暂缓：**把整个 Python 优化器设为插件必需依赖；先完成一个有界候选闭环，再按收益决定是否加适配。文本相似度和单一综合分不适合作为代码、事实保真或交互正确性的终局裁判。

### 4.3 ECC：原子经验可借鉴，自动全局推广不适合本项目

快照：`affaan-m/ECC@b38be6a7f6350964d59328b52f0624e1d1d552d1`。

本轮获取并定向查看：

- [continuous-learning-v2/SKILL.md](https://github.com/affaan-m/ECC/blob/b38be6a7f6350964d59328b52f0624e1d1d552d1/skills/continuous-learning-v2/SKILL.md)：instinct、项目/全局范围、审阅与演化流程；仅作材料，不加载执行。
- [instinct-cli.py](https://github.com/affaan-m/ECC/blob/b38be6a7f6350964d59328b52f0624e1d1d552d1/skills/continuous-learning-v2/scripts/instinct-cli.py)：常量约 127–133、导入 889–898、聚类 1308 起、推广 1594 起。

经验拆成较小条目，并设项目/全局作用域与 confidence 等信号。当前 CLI 的项目导入路径在未识别项目时会改成 global；推广也会使用跨项目出现及 confidence 条件。

**采用：**原子条目、明确触发、项目内审阅与版本管理。**排除：**未识别项目自动回退 global，以及高 confidence/重复出现即获得跨项目效力。Patchwork 必须未知范围拒绝、跨项目明确关联、正确性由真实证据决定。

## 5. UI/UX 与表达保真：方法融入验收，不导入整套人格

### 5.1 interface-design：先看产品和宿主合同

快照：`Dammyjay93/interface-design@2f9be3206855bcb2d1d0af262c8bae25cba6658d`。

本轮获取并定向查看 [.claude/skills/interface-design/SKILL.md](https://github.com/Dammyjay93/interface-design/blob/2f9be3206855bcb2d1d0af262c8bae25cba6658d/.claude/skills/interface-design/SKILL.md)，重点为产品任务、宿主主题约束（约 84–87）、复用既有设计系统（约 186）与审查步骤。

**采用：**用户任务决定结构；读宿主合同、主题变量与已有控件，设计要适应内容。**不照搬：**强行换字体、另造 token 命名或任何适用于独立站的视觉偏好。Patchwork 本身嵌在 DSH，继续用公开 sidebar slot、原生控件与现有 tokens；为其他仓库做界面则用对方系统。

### 5.2 Humanizer-zh：去空话不能改变事实和作者立场

快照：`op7418/Humanizer-zh@f4518a8eab97b8bfebc66a89d34320a89bef6930`。

本轮获取并查看 [SKILL.md](https://github.com/op7418/Humanizer-zh/blob/f4518a8eab97b8bfebc66a89d34320a89bef6930/SKILL.md)，重点为前 56 行的材料边界、事实保留、声音与执行流程，并抽查后续正反例。

**采用：**待编辑内容是数据；数字、否定、条件、范围、时序、归因和完成状态需保真；不补虚构经历，正常段落允许不改。**排除：**批量禁词、靠 AI 检测器宣称质量或照搬示例事实。Patchwork 对改写做前后事实表与人工清晰度评阅，对代码和 UI 分别做行为与宿主验证。

## 6. 本地源码对照带来的约束

### 6.1 DSH：profile 可取真实启动事实，但 pre-step 不是临时上下文

本地上游 checkout 的实际 HEAD 为 `deepseek-ai/deepseek-harness@687f282e8625c6b8d11ff58211a90524be2e4317`。重点查看：

- [profile-context.ts](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/boot/app-boot/src/profile-context.ts)：`ProfileContext` 的 name/dir/home/patchPath 与 Context 服务声明。注释明确它属于由 dsh 启动的 profile，不是所有嵌入式环境都保证存在。
- [profile.ts](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/boot/app-boot/src/profile.ts)：profile 目录与 bundle/patch 组合，不把显示名当数据身份。
- [agent.ts 425–442](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent-loop/src/agent.ts#L425-L442)：pre-step 普通消息 append 为 user/message，并进入 Session surface。
- [agent.ts 615 起](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent-loop/src/agent.ts#L615-L694)：请求从会话 surface 派生，消息/边界会冻结；流式调用可能走 prepared route。
- [runtime-context.ts](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent-loop/src/runtime-context.ts)：运行时 context 也有持久投影，不能因命名为 context 就认作临时、不可恢复的数据。

结论：现有 composition 隔离可以作为能力边界，但不能证明已注入记忆不会残留历史。当前尚未证明一个覆盖所有调用路径的公开请求视图扩展合同。因此方案把实际请求 canary 负测放在 P0；做不到就保持自动投影关闭并提出上游扩展，不能私改主 DSH 或偷偷改全局请求。

### 6.2 Patchwork：复用已有权威，不能把结构 lint 当真实实验

- [runtime](../src/runtime.mjs) 与 [scope](../src/scope.mjs)：preset 挂载和真实 composedPreset 检查，继续复用。
- [task lifecycle](../src/task/lifecycle.mjs)、[state](../src/task/state.mjs)、[store](../src/task/store.mjs)：任务版本、有限 checkpoint、候选与真实回执已经存在；不要另建任务数据库作为第二权威。任务语义判断仍为 unknown，登记 ready 不证明全部语义正确。
- [evolution](../src/quality/evolution.mjs)：只验证传入档案结构；当前要求两组 passedCases 覆盖所有案例，适于无回归结构准入，不能表达缺陷修复基线的真实失败。v2 应分 repair/optimization，而非伪造基线通过。
- [user config](../src/config/user-config.mjs)：当前是 home 级覆盖，不应误作 project 命名空间。
- [client entry](../src/client/index.jsx)、[panel](../src/client/PatchworkPanel.jsx)、[styles](../src/client/panel-styles.mjs)：原生 slot、主题 tokens 与五页签是继续扩展的入口；不新开独立管理站。

### 6.3 Node / SQLite：选型有前置兼容条件

核对 [Node 官方 v22.13.0 SQLite 文档](https://github.com/nodejs/node/blob/v22.13.0/doc/api/sqlite.md)（本轮 `gh api` 返回文件 blob `270b8e8d8b750725942d655d6ba0dfbe9018623f`）：模块始于 v22.5.0，该版本文档的稳定性为 Active development；`DatabaseSync` 为同步接口。当前包的 `node >=22` 声明不足以证明所有目标运行时都可直接使用同一实现。

本轮在当前开发 Node v24.21.0 上只执行了 `:memory:` 能力探针，未创建产品数据库或连接 DSH：

| 探针 | 结果 | 能证明什么 |
|---|---|---|
| sqlite_version | 3.53.4 | 仅当前开发进程可用版本 |
| FTS5 trigram，正文“用户纠正之后只读调研文档”，查询“纠正之后” | 1 条 | 该中文长查询在当前进程匹配 |
| 同一索引查询“纠”或“纠正” | 各 0 条 | 不能把 trigram MATCH 当作完整中文短词检索 |

建议将 SQLite 适配器、worker、目标运行时和短词策略一起验收；失败明确停用记忆，不能隐式退回易失存储。探针不构成数据库并发、迁移、删除或 DSH 打包兼容测试。

## 7. 收敛后的选择

**先做项目内有来源的事实记忆，再做隔离实验闭环。**先验证范围、请求投影、纠正删除和原生 UI；随后加入可审阅的程序经验与真实留出对照。UI/UX、写作和代码质量在任务级共同验收，记忆保存约束和证据，学习器优化具体方法。

本轮没有为任何候选运行 baseline/candidate，也没有新增真实 DSH 调用。源码阅读只能支持设计取舍，不能支持 token、延迟、审美或完成率收益结论。完整实施顺序和退出条件见[方案第 12 节](memory-evolution-design-2026-10-30.md#12-分阶段执行顺序)。
