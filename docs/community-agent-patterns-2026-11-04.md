# 社区项目对照

> 维护者决策备忘，不随插件包分发，也不作为模型-facing skill。当前可执行规则在 `assets/skills/*/references/`。

用 `gh search repos` / `gh api` 查看了社区项目与官方资料。这里只记录可借用的机制，不复制实现或提示词。

| 项目 | 机制 | 可借用 | 不照搬 |
|---|---|---|---|
| [AGENTS.md](https://github.com/agentsmd/agents.md) | 给 agent 的 README；项目命令、测试、PR 约定；嵌套目录更近的优先 | 项目指令有固定位置；只写可验证命令；不把技能正文塞进去 | 不自动生成/覆盖；项目规则不授予权限 |
| [Anthropic · context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | 最小高信号 token；合适高度；渐进披露；文件系统 just-in-time | 入口只放行为契约，细节按需加载；避免把全部规则塞进 prompt | 不把“最小”误解为越短越好；仍需足够行为信号 |
| [Microsoft skills](https://github.com/microsoft/skills) | 大量 skill、AGENTS.md 模板、eval/test harness | skill 要有评测，不只写文档；安装/选择可组合 | 不批量导入 175 个 skill；不以数量代替路由质量 |
| [Google DESIGN.md](https://github.com/google-labs-code/design.md) | 机器可读 token + 人读理由 + lint/diff | 设计契约与产物分离；对比度/token 检查 | 不把品牌包整套复制；小改动不新建 DESIGN.md |
| [obra/superpowers](https://github.com/obra/superpowers)（DSH 移植：[superpowers-dsh](https://github.com/LayneChai/superpowers-dsh)） | brainstorming、writing-plans、TDD、verification-before-completion、requesting/receiving review、parallel agents | 验证门禁、计划的任务粒度、TDD 的红-绿-重构、评审请求/接收分离 | 不是所有任务都强制先访谈；文档/配置/生成代码不硬套“必须先写失败测试” |
| [github/spec-kit](https://github.com/github/spec-kit) | constitution → specify → plan → tasks → implement → converge；bug assess/fix/test；idea assessment | spec 作为事实源、先澄清再计划、converge 循环、独立子系统拆 spec | 不引入整套命令/扩展/工作流；小任务不强制全流程 |
| [SWE-agent/mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) | 极简循环、线性历史、独立 subprocess 动作 | 先选最简单控制流；轨迹可调试；动作独立便于沙箱 | 不采用“只有 bash”而放弃结构化工具；Patchwork 仍优先 write/edit/read/grep |
| [OpenHands ACI](https://github.com/OpenHands/openhands-aci) | 编辑器 + linter + 工具接口 | 编辑后 lint、工具 affordance、错误可操作 | 不照搬 Python 专用 linter |
| [Aider](https://github.com/Aider-AI/aider) | tree-sitter + PageRank repo map、token 预算 | 结构先验、按 token 裁剪、先地图后读文件 | 不把原生解析依赖塞进主包 |
| [CodeGraph](https://github.com/colbymchenry/codegraph) | 预索引代码图、单一 explore、自动同步 | 按需代码图、单一入口、影响面 | 不引入 256MB 平台包、watcher、遥测；注意其“吞吐降 token 但残留上下文升高”的自述 |
| [MemGPT/Letta](https://github.com/letta-ai/letta)、[deja-vu](https://github.com/vshulcz/deja-vu) | 分层记忆、会话归档、recall hooks、决策生命周期/陈旧标记、凭据脱敏 | scope/版本/时效/删除/脱敏；失败前先查历史 | 不自动注入、不默认上传、不把历史当指令 |
| [llama.vscode](https://github.com/ggml-org/llama.vscode)（2026-11-05 复查） | 搜索三源顺序回退（DDG lite → DDG html → **Bing RSS**，带 referer）；RAG 两阶段检索：LLM 提关键词 → **BM25 粗排**（k1=1.5、b=0.75）→ embedding 余弦精排，无 embedding 服务降级 BM25 top-K；定行数 chunk + 超长回退截断 + 全局 chunk 上限；chunk 头自带 `File Name/From line/To line`；已发送 chunk 按 hash 去重 | Bing RSS provider（已落地，见 CHANGELOG 未发布节）；BM25 粗排给 `patchwork_code` 加排序 chunk 检索（已落地：`chunks` 动作 + `src/code/bm25.mjs`，纯本地无模型调用）；chunk 头定位格式；已入上下文的 chunk 按 hash 去重 | 不引入 embedding 服务器依赖；不用 LLM 提关键词（多一次模型调用，违背 code 工具确定性设计）；不抄 FIM 补全的 ring buffer（补全向，agent 不需要）；并行合并 vs 顺序回退是不同哲学，暂不改动（但记录：顺序回退在代理环境更稳） |
| [MDX-Tom/magpie-dsh-websearch](https://github.com/MDX-Tom/magpie-dsh-websearch)（2026-11-06 复查） | Magpie 网关中间件：修复 DSH 原生 `web_search` 经 Anthropic 兼容网关时只渲染空链接的问题——`dsh-web-search-deepseek` 要求文本块带 `citations[].cited_text`，Magpie 丢弃之。`onResponse` 钩子从模型总结合成 `url_citation`（首源全文≤4000 字符，其余≤120 字符摘要），协议门控（仅 anthropic）、绝不抛出、内存有界 | 记录的**协议事实**：DSH 原生搜索依赖 citations[]，网关剥离子即静默降级为空链接——这是我们免密钥检索的第三个论据（前两个：provider 地域封锁、可用性漂移）；`patchwork_search` 直接返回带摘要的 sources，不经过 citation 协议，从结构上避开该故障 | 不借网关中间件架构（我们在 DSH 插件层，不是网关层）；不借“首源全文+其余摘要”的引用整形——我们的证据模型是一 quote 一 claim，更严；moejs 运行时约束不适用 |
| [cft0808/edict](https://github.com/cft0808/edict)（2026-11-05 复查） | 三省六部多 Agent 编排（基于 OpenClaw）：9 状态严格递进状态机（不可越级）；**停滞检测**（`stallThresholdSec` 600s 无进展判定）+ **升级阶梯**（escalationLevel 0→1→2，停滞任务先升门下省复审、再升尚书省）；有界重试（retryCount 记原因，终态/Blocked 拒绝重试）；rollbackCount 回滚计数；stop/resume 靠 `_prev_state`；**御批模式**：AI 审核后插入人工准奏门禁（`AwaitingImperial`，超时策略 remind/auto_approve/block + 通知渠道）；奏折式 flow log 每事件一条人读记录；Agent 心跳+活跃度 | **停滞检测 + 升级阶梯**给 Superagent 队列：排队/执行任务超时无进展时标记并升级（复核→派发），比单纯有界重试多一层可观测性；`_prev_state` resume 模式；flow log 的人读事件格式（诊断视图可参照） | 不照搬“阶段由服务端强制递进”——Patchwork 的阶段是 Agent 陈述、以证据回执为真门禁（设计差异，见 README 使用边界）；御批门禁不作默认（与自主流冲突），如做必须 opt-in + 超时策略；不引入朝堂议政式 persona 群聊（产品形态差异）；不引入随机事件骰子 |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)（2026-11-05 深读） | “lazy senior dev”规则集 + 20 平台分发。完整图谱六件：①**代码库助手地图**——SessionStart hook 用 `git ls-files` + 各语言正则列出顶层函数/类/导出，2000 字符预算、3 秒 fail-open、共享目录（util/lib/service）优先排序，让“先用现有 helper”零搜索成本可执行；②**级别过滤单一来源**——SKILL.md 是唯一源，hook 按 lite/full/ultra 过滤模式相关行；③**`shortcut:` 注释约定**——`shortcut: <limit>, <when to upgrade>` 让有意妥协可被机器回收（ponytail-debt 汇总成债务账本）；④**行为门三层测试金字塔**——grader 探针检查器单测（无 API key，证明评分器能分辨行为有无）→ promptfoo `behavior.yaml` 评测 → 39 任务×5 轮 agentic 基准（含 18 项隐藏检查）；⑤**SubagentStart 注入**——父会话上下文到不了子 agent，用 hook 把同款规则集注入每个 subagent（可选 regex matcher 按 agent_type 过滤）；⑥**带诚实边界的基准**——LOC ▼53%/token ▼45%/成本 ▼26%/时间 ▼41%，该写测试处通过率 68%→98%，Agent 自写测试抓住 66% 注入 bug（无技能 46%），明令禁止把基准数字说成单仓库节省。band 复用率度量有严谨过滤：通用名（main/get/set/handle…）不计复用，测试/vendored 排除 | **`shortcut:` 注释约定 + 债务账本技能**（最高优先：代码锚定的妥协登记，比 standards 里任务内 candidate 更耐久）；**行为门第一层**（grader 探针单测——Patchwork 有 13 个技能却无技能行为测试，机制有单测、技能行为没有，这是最大结构缺口；评分器单测零成本零密钥）；**SessionStart 助手地图**（让“先 map”从按需变自动，3s/64KB/2000char fail-open 是质量基线；需先确认 DSH 插件可挂会话启动 seam，并处理与 OCC 压缩的相互作用——地图可能被摘要掉，需可再注入或标记抗压）；复用率度量的过滤规则（通用名排除，抄 band/metrics.ts）；subagent matcher 正则（Superagent 执行器提示词可按 agent 类型裁剪） | 不借“lazy senior dev”人设——Patchwork 的身份是证据链与验收，不是极简 code（使命不同，混人设两头不讨好）；不借 band/Board 可视化（Claude Code 专属形态，面太大）；不追 20 平台分发（DSH-only 是既定架构）；其规则主体与 Patchwork 现有技能约七成重叠（2026-11-05 评估），只取增量 |

## 共同模式

1. **先理解再执行**：spec/brainstorm/plan 不是仪式，是减少返工。
2. **验证先于声明**：完成声明必须有新回执。
3. **最小控制流**：能不编排就不编排；复杂编排只在可分解时使用。
4. **工具为模型设计**：清晰错误、有界输出、编辑后检查。
5. **记忆要可治理**：来源、范围、版本、过期、删除、脱敏。
6. **社区资料不是审计**：README/benchmark 是项目方声明，采用前核代码、许可证、版本和真实任务。

## 对本仓库的取舍

- 保留 `patchwork_task` + `check` 的证据链，不把 Superpowers 的“铁律”变成硬门禁。
- 借 Spec Kit 的 spec/converge 思路，落到 `brief` 和纠正，不引入命令套件。
- 借 mini-SWE-agent 的“最小循环”，避免为每个动作加编排。
- 借 ACI 的“编辑后 lint”，但不新增语言专用依赖。
- 借 CodeGraph 的按需图，不引入其平台包。
- 借 deja-vu 的“先查历史”，但不自动注入会话。
- 借 llama.vscode 的 Bing RSS 检索（已落地）与 BM25 粗排思路（`patchwork_code` 后续候选），不引入 embedding 依赖与 LLM 提关键词。
- 借 edict 的停滞检测 + 升级阶梯（已落地：`superagentStallMs` 阈值 + review/blocked 两级升级 + 父会话通知）与 `_prev_state` resume 思路（restoreSuperagent 已有对等恢复），不照搬服务端强制阶段递进与御批门禁（默认关闭，如做必须 opt-in）。
- 借 ponytail 的 `shortcut:` 注释约定 + 债务账本（已落地：约定 + hook 顺手注入 + debt 技能）与任务锚定地图（已落地为 `taskMap` 机制：define 锚定、可再注入、执行器携带；比 ponytail 的正则会话地图更贴任务）及行为门第一层（已落地：22 探针 + 覆盖门 + 契约层），不借 lazy senior dev 人设。
