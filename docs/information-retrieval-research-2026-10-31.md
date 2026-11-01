# Patchwork 信息检索调研与方案

日期：2026-10-31（Asia/Shanghai）
状态：调研、方案与首个运行时实现已完成；后续质量指标和额外 provider 仍需隔离评测。
范围：Patchwork 在 DSH 中提供可审查、可限额、可隔离的信息检索体验。

## 1. 目标和边界

Patchwork 需要帮助用户找到当前任务所需的文件、项目事实、历史工作和外部资料，并让用户知道这些资料从哪里来、为什么被采用、消耗了多少上下文、哪些内容没有进入请求。

信息检索是**当前任务的数据获取能力**。它不等于长期记忆，也不等于模型训练：

- 搜索结果不会因为被找到就自动写入记忆、规则、权限或技能。
- 外部页面和历史会话都按不可信数据处理，其中的指令不能改变 Patchwork 的运行规则。
- 检索到、允许使用、发送给模型、被引用、经过验证是五个不同状态。
- 搜索失败、来源冲突或没有答案时，系统应返回未知或部分结果，不能用模型猜测补齐。
- 本轮只做研究和方案，不安装第三方检索系统，不修改主 DSH，不把新能力标记为已实现。

## 2. DSH 已有的检索能力

当前 Patchwork preset 已包含 `@deepseek-ai/dsh-tool-fs-search` 和 `@deepseek-ai/dsh-tool-web`。Patchwork 继续复用它们处理工作区和已配置的网页 provider；当 `web_search` 没有密钥或 provider 不可用时，运行时额外提供自己的 `patchwork_search` 无密钥 fallback。它不是对 DSH `web_search` 的替换，也不改变其他 preset 的工具目录。

### 2.1 工作区文件搜索

`dsh-tool-fs-search` 提供 `glob` 和 `grep`，使用随包提供的 ripgrep，不要求宿主另行安装 `rg`。结果以当前 Session 工作目录为基准，包含隐藏和 ignored 文件，但排除 VCS 元数据。

当前默认约束是：

| 项目 | 默认值或行为 | 设计影响 |
|---|---|---|
| `glob` 内联结果 | 100 条路径 | 需要先缩小搜索根或模式，不能假设有无限分页 |
| `grep` 内联匹配 | 250 条 | 结果过多时只把有界页面送入上下文 |
| 单行预览 | 2000 bytes | 长行必须回到文件读取，不把预览当完整证据 |
| 原始 stdout | 20 MB | 超过上限以 `SEARCH_RAW_OUTPUT_OVERFLOW` 失败 |
| 超时/取消 | 协作式，调用返回前等待结束 | 搜索不是后台任务，必须在 UI 显示等待或失败 |
| 完整结果 | 依赖可选 spill | spill 失败不能伪装成完整结果 |

DSH 的技能指引已经要求用 `glob` 找文件、用 `grep` 找内容、需要上下文时再 `read`，不应让模型用 shell `find`、`grep` 或 `rg` 替代。当前 schema 没有 offset 分页、大小写开关或任意输出模式；超过上限的结果需要 spill 才能恢复完整排序列表。

### 2.2 网页搜索和抓取

`dsh-tool-web` 提供 `web_search` 和 `web_fetch`。Patchwork preset 开启了抓取，并将 `searchTimeoutMs` 设为 60000；包默认值为：每次最多 4 个查询、8 个来源、搜索超时 30000ms、抓取输出上限 200000 字符。

`web_search` 会先对完全相同的 query 去重，再并发执行不同 query，按排名轮询合并并按 URL 去重。任何 query 失败都会让整个批次失败。`web_fetch` 把 HTML 转为 Markdown，过滤 active/hidden HTML，并在截断时明确标记。

### 2.2.1 Patchwork 原生无密钥搜索

`patchwork_search` 是 Patchwork runtime 注册的独立工具，默认开启，只在当前组合确认为
`patchwork` preset 时可见和可执行。它并行请求 Bing、Brave Search 和 DuckDuckGo 的公共
HTML 页面，不读取 DSH `web_search` 的 provider 配置，也不需要 DeepSeek 搜索密钥；结果按
provider rank 轮询合并、按 URL 去重，最多返回 12 条。每次响应还带成功/失败 provider，便于
用户知道结果是否来自部分降级。

工具执行前后都会重新校验 Patchwork scope；切换到 standard 后，已持有的旧引用也会失败。
诊断日志只写 provider、状态、耗时和错误码等白名单元数据，不写 query 原文、网页全文或凭据。
网络请求优先使用宿主 fetch；检测到 HTTP(S) 代理时使用固定参数的 `curl` 子进程，参数通过
argv 传递且不经过 shell，以适配本地代理环境。配置项为 `nativeSearch`、
`nativeSearchProviders`、`nativeSearchMaxResults` 和 `nativeSearchTimeoutMs`。

合并排序使用可解释的轻量规则：provider rank 分、查询词在标题/摘要中的覆盖率、以及同一
URL 被多个 provider 返回时的共识加分；若有命中查询词的候选，会过滤完全无关的候选。它不是
训练出的 reranker，也不宣称相关性评分等于事实可信度。

这些公共 HTML 入口不是稳定 API；部署时应遵守各 provider 的 robots、服务条款和限流要求。
Patchwork 不绕过验证码、不注入用户凭据，也不把任意公共 SearXNG 实例作为隐式代理。

### 2.2.2 无密钥 provider 调研结果

以下是 2026-10-31 对同一查询 `DeepSeek Harness` 的实时抽样，不代表 provider 的长期 SLA：

| Provider | 当前抽样 | 结论 |
|---|---|---|
| Bing HTML | 返回完整结果，链接可从 `bing.com/ck/a` 解包 | 纳入默认聚合；页面结构可能变化，需保留解析回归 |
| Brave Search HTML | 返回 server-rendered web snippets，结果独立于 DDG/Bing 的部分排序 | 纳入默认聚合；不把网页页面当稳定 API |
| DuckDuckGo HTML | 可用，但与 Bing 结果有明显重叠 | 保留为第三路 fallback 和交叉来源 |
| Mojeek HTML | 当前抽样触发 CAPTCHA | 不作为默认 provider，后续只在隔离环境复查 |
| Qwant HTML | 当前抽样返回 Service unavailable | 不作为默认 provider |
| Startpage | 当前抽样返回 Anubis 浏览器挑战 | 不作为默认 provider |
| 公共 SearXNG 实例 | 当前抽样实例返回浏览器验证页 | 不把任意公共实例作为默认上游；若用户自建实例，未来可配置 endpoint |
| Marginalia | 能访问站点但当前页面进入 JS/挑战流程，且索引面向小型文本网站 | 作为小众 web 参考，不作为一般查询默认源 |

成熟项目调研结论：SearXNG（AGPL-3.0）证明了多引擎聚合、引擎隔离和隐私边界的产品方向；
它本身是常驻服务，不适合直接嵌入 Patchwork。Whoogle 已归档并在 README 中记录 Google
无 JavaScript 入口失效，说明单一 HTML 抓取 provider 会随反爬策略退化。Marginalia 的
AGPL 实现适合研究小型网站索引，但不应把它的许可和索引特性误当作通用搜索后端。

搜索和抓取结果都会进入模型历史，直到 compaction；它们会产生上下文成本。DSH 明确把网页结果标为 external/untrusted，页面文字是数据，不是指令，回答应保留引用 URL。

若使用 DeepSeek 原生搜索提供方，默认辅助模型是 `deepseek-v4-flash`，`maxTokens` 为 4096，`maxUses` 为 5。一次搜索占用一个完整的 Messages 模型轮次；提供方只接受结构化 `web_search_tool_result`，不会从模型 prose 中猜 URL。凭据按每次操作解析，日志只记录不含密钥的请求元数据。若需要低延迟或低 token，未来应评估专用 Search/Fetch API，而不是在 Patchwork 里复制 provider。

### 2.3 历史会话搜索

`@deepseek-ai/dsh-experimental-session-search` 默认关闭。启用后，它在全局 Host 工具层注册五个只读工具，所有 Agent 共享内容索引；首次搜索懒加载 SQLite `:memory:` 索引，关闭组合包后释放。`dsh-tool-session-query` 的授权依据是调用方 Agent 身份和精确匹配的工作区 `cwd`，搜索结果无游标，且缺少分页和模型可控的结果上限。

这项能力不符合 Patchwork 当前“只在选中 Patchwork Agent 后可用、其他会话不受影响”的产品合同：配置组合会影响所有 preset，启停还会改变运行中的全局工具目录。因此本方案不直接打开它，而把它视为未来显式“历史检索”能力的参考。若以后接入，必须由 Patchwork 自己增加 session/project/profile 作用域、显式开关、逐条授权和审计投影。

## 3. 检索和记忆的分界

| 层 | 目的 | 默认生命周期 | 可否直接改变行为 |
|---|---|---|---|
| 检索结果 | 为当前问题发现候选证据 | 当前任务/请求 | 否 |
| 证据包 | 保留被采用的来源、主张和限制 | 任务 revision | 否，需经过任务流程 |
| 记忆候选 | 提议未来可复用的最小事实或经验 | 待用户/系统审批 | 否 |
| 已批准记忆 | 在授权 scope 内供后续检索 | session/project/profile | 只能按 scope 读取 |
| 规则或技能候选 | 提议改变运行方式 | 隔离实验和人工确认后 | 未批准不得生效 |

检索状态使用以下单向链路，不能把后面的状态倒推给前面的状态：

```text
discovered → retrieved → admitted → sent → cited → verified
                         ↘ rejected / expired / redacted
```

`retrieved` 只表示工具返回；`admitted` 表示通过 scope、来源和预算筛选；`sent` 表示实际进入模型请求；`cited` 表示回答明确关联来源；`verified` 表示有独立检查或用户确认。搜索结果永远不会因为 `retrieved` 自动变成记忆。

## 4. 成熟项目和实现取舍

### 4.1 框架和产品

| 项目 | 一手资料中确认的机制 | Patchwork 决策 |
|---|---|---|
| [Haystack](https://github.com/deepset-ai/haystack) | 用显式 pipeline 组合检索、路由、过滤、排序、生成、评估和 Agent；支持 lifecycle hooks、token/tool-call 监控，并有 `SkillToolset` 的渐进技能发现。 | **采用结构思想**：把 query plan、retriever、reranker、evidence pack 和 budget 做成可观测阶段；不引入 Python pipeline 或第二套 Agent loop。 |
| [LlamaIndex](https://github.com/run-llama/llama_index) | 提供数据连接器、索引、query engine、retriever 和 response synthesis 的分层抽象。 | **参考分层**：区分索引、检索和回答；不把其存储或 query engine 带入 DSH。 |
| [LangChain / LangGraph](https://github.com/langchain-ai/langchain) | 将模型、向量库、retriever、工具和可控工作流拆成组件，并强调 trace、调试和评估。 | **参考可控工作流**：检索阶段应可重放、可中止、可显示；不复用其生态依赖。 |
| [RAGFlow](https://github.com/infiniflow/ragflow) | 产品化的文档解析、模板化切分、知识编译、Agentic RAG、引用和 Web UI。 | **参考用户可见的知识处理和引用**；当前不在 DSH 内置第二个知识库或文档解析服务。 |
| [Microsoft GraphRAG](https://github.com/microsoft/graphrag) | 用图抽取和社区摘要处理跨文档、全局叙事问题；README 明确项目处于 maintenance mode，索引成本较高。 | **延后**：只有词法/混合检索无法回答跨文档关系问题时，才在隔离实验评估图索引。 |
| [R2R](https://github.com/SciPhi-AI/R2R) | REST API、混合搜索、知识图谱、文档管理和带引用的 Deep Research API。 | **参考 API/引用边界**；不在 Patchwork 旁边启动第二套常驻服务器。 |
| [LightRAG](https://github.com/HKUDS/LightRAG) | 图和向量的双层检索、reranker、文档删除、引用、RAGAS 评估和 tracing。 | **参考删除/引用/评估要求**；不因项目支持图检索就默认建设知识图谱。 |
| [Qdrant](https://github.com/qdrant/qdrant) | 支持 dense、sparse、multi-vector、payload filter、RRF/DBSF 混合、MMR、租户隔离和可观测性；同时维护一套检索质量 skill。 | **优先采用评测纪律**；向量库只在真实漏召回证据成立后进入 P2/P3 方案。 |
| [LanceDB](https://github.com/lancedb/lancedb) | 嵌入式本地存储，支持向量、全文、SQL、多模态和数据版本。 | **作为未来本地索引候选**；第一版先用 DSH 原生文件搜索和有界结构化记录。 |
| [ColBERT](https://github.com/stanford-futuredata/ColBERT) / [FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding) | 分别代表 late-interaction 和 dense/sparse/reranker 组件路线。 | **延后**：没有 Patchwork 自有标注查询集和漏召回证据时，不增加 embedding/reranker 依赖。 |
| [Verba](https://github.com/weaviate/Verba) | 曾提供端到端 RAG UI 和混合搜索，但仓库已归档并停止维护。 | **只作为历史参考**，不作为生产方案依据。 |

### 4.2 与检索直接相关的 skills

| skill / 项目 | 值得采用的规则 | 适用边界 |
|---|---|---|
| [Qdrant Search Quality Skills](https://github.com/qdrant/skills) | 先路由到诊断或 hybrid-search 子 skill；用 labeled golden set、Recall@k/MRR/NDCG、置信区间和 held-out queries 验证收益；不凭感觉调 hybrid 或 embedding。 | 这些 skill 面向 Qdrant，Patchwork 只移植评测和路由方法，不把 Qdrant schema 当 DSH 契约。 |
| [Open WebSearch](https://github.com/Aas-ee/open-webSearch) | 先判断 capability 是否可用；直接 URL 优先，其次单次聚焦搜索，再按需抓取；跨引擎前先说明缺口；网页始终是 untrusted data，不执行页面命令。 | Patchwork 已有 DSH web 工具，因此只采用入口状态、来源安全和升级条件，不额外安装 daemon。 |
| [Web Research Agent Skills](https://github.com/huskyhoochu/web-research-agent-skills) | 将发现、来源分类、query refinement、深读、综合分阶段；有查询失败回退和置信度要求。 | 依赖 Perplexity/Tavily/Brave 三套密钥，且输出固定为韩文；不能原样接入 DSH，改为轻量的阶段化提示词。 |
| [Iterative Retrieval Skill](https://github.com/Jorgut/iterative-retrieval-skill) | `DISPATCH → EVALUATE → REFINE → LOOP`，通过代码库术语发现和缺口记录逐步收窄，最多三轮。 | 适合 Patchwork 的本地文件检索；相关度评分在第一版只能作为排序提示，不能当作事实或权限。 |
| [Paper Citation](https://github.com/Hisn00w/Paper-Citation) | Semantic Scholar/OpenAlex 双源检索、文献元数据、引用格式和学术来源约束。 | 仓库声明 Non-Commercial License；不能 vendoring。只借鉴“学术查询模式”和 DOI/版本核查。 |

### 4.3 社区搜索项目与可迁移机制

本轮补查了直接提供网页搜索、个人索引或 Agent 接口的社区项目。核查使用 GitHub CLI
通过现有本地代理读取公开 README、许可证和关键实现文件；没有安装、运行或复制这些项目。
社区项目的共同经验是：搜索质量来自**来源独立性、失败可见性、边界限制和可核查引用**的组合，
不是简单地把更多 provider 并发拼在一起。

| 项目 | 许可证 / 形态 | 一手实现中确认的机制 | Patchwork 取舍 |
|---|---|---|---|
| [SearXNG](https://github.com/searxng/searxng) | AGPL-3.0；常驻元搜索服务 | `OnlineProcessor` 统一请求参数、超时、重定向和异常处理；每个 engine 有独立 adapter，失败可被挂起并进入 metrics。 | **采用接口思想**：为 `patchwork_search` 增加 provider 状态、分类错误和可观测健康度；不把 SearXNG 服务或其 engine 代码嵌入插件。 |
| [SearchWala](https://github.com/SandeepAi369/SearchWala) | Apache-2.0；Rust 元搜索 + 深读 | 用 index family 折叠代理/别名后做 RRF；再做 BM25+、抽取置信度、时间衰减和 MMR；health registry 区分 blocked、transport error、zero-result selector rot，并在样本足够后自动 quarantine；深读器对 hydration/shadow DOM 有有界提取，引用会回查到模型实际看到的文本。 | **最强的排序和质量参考**：先采用 family/共识计数、zero-result 监控、引用支持率和 bounded fetch；不引入其 Rust 服务、stealth TLS 或第二套 LLM loop。 |
| [Websurfx](https://github.com/neon-mmd/websurfx) | AGPL-3.0；Rust 自托管元搜索 UI | `SearchEngine` trait 统一上游 adapter；单次上游响应限制 2 MiB；查询限制 512 字符；用户选择的 engine 会与服务器启用列表求交；支持内存/Redis cache。 | **采用边界**：给 provider 请求加响应体上限、查询长度上限和配置求交；缓存只在明确 scope 和隐私策略后再做，不启动独立服务。 |
| [Hister](https://github.com/asciimoo/hister) | AGPL-3.0；本地个人/团队全文索引 | 只索引用户保存的网页和文件，支持全文、字段过滤、可选 semantic search、浏览器/终端/MCP，并按用户分开文档和结果。 | **采用 scope 模型**：未来 workspace/project 索引必须绑定明确 owner 和路径；当前继续使用 DSH `glob/grep/read`，不引入常驻 crawler/indexer。 |
| [vgrep](https://github.com/CortexLM/vgrep) | Apache-2.0；本地代码语义搜索 | 规范化搜索根目录后生成 query embedding；按 chunk 检索，再按文件去重，返回 preview 和起止行；索引使用文件 hash、增量更新和 git ignore。 | **作为 P2 实验参考**：若真实失败显示词法检索漏召回，再做项目级、路径隔离的 semantic candidate；保留精确行号和删除重建测试，暂不默认加载 embedding 模型。 |
| [lilbee](https://github.com/tobocop2/lilbee) | MIT；本地 AI + 文件/网页检索 + MCP | 检索结果带文件行引用；memory 记录有 owner/shared 标记，recall 与管理列表使用不同 predicate；自动抽取受总开关控制，未命中时允许明确说找不到。 | **采用记忆边界**：检索结果、记忆候选和已批准记忆分层；默认不自动写记忆，跨 agent 共享必须显式标记；不引入其模型运行时和 LanceDB。 |
| [LibreX](https://github.com/hnhx/librex) | AGPL-3.0；无 JavaScript 隐私前端 | 按 general/image/video/torrent/tor 分类，默认不保存日志和缓存，直接代理上游 HTML。 | **只借鉴隐私默认值和分类入口**；单一上游、无健康状态和无引用治理，不作为 Patchwork 聚合实现。 |
| [searxng-mcp](https://github.com/tisDDM/searxng-mcp) | MIT；MCP 适配器 | 可配置自建实例，也可随机选择公共实例；返回 `unresponsive_engines`，但 README 已标明项目 deprecated，公共实例常见 429。 | **排除随机公共实例**：它会把用户查询泄露给未知第三方，且不可控、不可审计；若未来支持 SearXNG，只接受用户明确配置的自有 endpoint。 |
| [YaCy](https://github.com/yacy/yacy_search_server) | GitHub 元数据为 `NOASSERTION`；P2P crawler/index server | 自建爬虫、持久索引和分布式节点，适合完整搜索服务而非一次性检索工具。 | **排除当前范围**：需要常驻进程、索引生命周期和额外运维；许可证元数据也不足以支持直接依赖。 |

从这些项目提炼出的 Patchwork 最小落地集如下：

1. **Provider health**：为每个 provider 记录 attempts、HTTP success、blocked、transport error、zero parsed results、平均结果数和 verdict；连续空结果只标记 parser drift，不把“无命中”误报为 provider 正常。
2. **Consensus metadata**：结果保留 canonical URL、provider family、最佳 rank、独立 provider 数和冲突标记；代理/别名不重复计票，避免伪共识。
3. **Citation card**：每条结果带 `source_id`、URL、provider、rank、retrievedAt、snippet/excerpt、trust 和 `status`；回答引用只能指向已发送给模型的 excerpt，不能只引用搜索页标题。
4. **Bounded fetch**：限制 query 长度、响应字节、抓取数量、总耗时和发送字符；对重定向重新做 SSRF/scope 检查，页面内容始终按 external/untrusted data 处理。
5. **Scoped local index（P2）**：只有真实 golden set 证明 `glob/grep` 漏召回时，才在项目 scope 内增加可删除、可重建、可审计的 semantic index；session history 和公共 SearXNG 都不默认打开。

### 4.4 信息获取、浏览和内容转换项目

这组项目解决的是“如何取得和整理信息”，而不是“如何把结果排得更靠前”。它们覆盖静态
抓取、JS 浏览器、深度研究编排、网页转 Markdown 和结构化抽取。它们的共同风险是：
抓取会扩大网络、浏览器会携带登录态、LLM 抽取会把未经核验的页面内容变成看似结构化的事实。
Patchwork 因此只采用边界和证据协议，不直接启动第二个 crawler 或 browser agent。

| 项目 | 许可证 / 形态 | 一手实现中确认的机制 | Patchwork 取舍 |
|---|---|---|---|
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Apache-2.0；本地/服务化网页 crawler | 输出 raw/fit Markdown；支持 CSS/XPath/LLM schema extraction、topic/regex/sentence chunking、BFS/DFS/best-first/adaptive crawl、session、cache、proxy 和取消；配置层会限制不可信 timeout，提供 robots 开关和资源上限。 | **优先参考**：给未来 `patchwork_fetch` 采用 fit Markdown、query-aware 抽取、可取消的两阶段抓取和响应预算；robots 在 Patchwork 默认开启，浏览器和深爬只在隔离任务显式启用。 |
| [Firecrawl](https://github.com/firecrawl/firecrawl) | AGPL-3.0；自托管/云端 scrape、crawl、map、search | robots.txt 有缓存和显式判定；crawl scope 限制初始路径及其子路径；SSRF 防护会解析所有地址、拒绝非 unicast，并用 pinned DNS 避免二次解析绕过；多引擎、缓存、任务状态和批量 crawl 都是服务级能力。 | **采用安全边界**：复制 robots、path scope、DNS pinning、redirect 复核和任务取消原则；不把其 AGPL 服务或云 endpoint 作为隐式依赖。 |
| [Browser Use](https://github.com/browser-use/browser-use) | MIT；LLM browser agent + MCP | `SecurityWatchdog` 在导航前、重定向后和新 tab 创建时检查 allowlist；可阻止 IP、prohibited domain 和未授权跳转；输入检测会把疑似邮箱/凭据从结果中隐去；MCP 会追踪并清理过期 session；DOM extractor 生成 Markdown/结构化内容。 | **只做显式浏览器采集**：工具必须有 per-task allowed domains、session TTL、下载路径和凭据遮罩；不让模型自由浏览、不把浏览历史写入长期记忆，也不默认启用远程 telemetry。 |
| [Stagehand](https://github.com/browserbase/stagehand) | MIT；浏览器 SDK / 云浏览器 | 把浏览拆成 `observe → act → extract`；`observe` 先返回真实 selector，示例明确避免把密码交给模型；`extract` 返回 schema 校验数据；支持本地持久 user-data-dir、缓存和 MCP；也提供 search/fetch，但云端 Browserbase 会携带托管会话。 | **采用动作分层**：Patchwork 只考虑 `observe` 和只读 `extract`；`act`、登录态和云浏览器必须单独授权并显示目标域名，不能作为普通检索 fallback。 |
| [Open Deep Research](https://github.com/langchain-ai/open_deep_research) | MIT；LangGraph 深研编排，仓库已归档 | 先判断是否需要澄清，再生成结构化 research brief；supervisor 分派并发 researcher，设置最大并发、迭代、tool-call 和模型 token；每轮搜索后压缩 notes，最终报告要求 inline citations 和 Sources。 | **采用编排纪律**：把澄清、研究 brief、query plan、证据压缩和停止条件放进 Patchwork 的检索提示词；仓库已归档，只作设计参考，不引入其 LangGraph loop。 |
| [dzhng/deep-research](https://github.com/dzhng/deep-research) | MIT；轻量 TypeScript 深研示例 | 每轮由模型生成多个独立 SERP query；用 `p-limit` 控制并发；Firecrawl 返回 Markdown 后抽取 learnings 和 follow-up questions；breadth/ depth 递归下降，`visitedUrls` 去重，最终报告附 Sources。 | **采用有限递归**：保留 breadth/depth、visited URL ledger 和 follow-up 缺口；必须补上 source excerpt、claim mapping 和冲突标记，因为示例主要附 URL，引用支持不足。 |
| [MarkItDown](https://github.com/microsoft/markitdown) | MIT；文件/URI 转 Markdown，带插件和 MCP 包 | 通过 converter registry 支持 PDF、Office、HTML、RSS、图片、音频等；同时提供 `convert_local`、`convert_response`、`convert_stream` 等窄入口；安全文档明确要求限制路径、URI scheme 和网络目标，避免把不可信输入直接交给 `convert`。 | **优先用于文档获取**：对本地文件使用 `convert_local/stream`，远程 URL 先由 Patchwork 做 allowlist、SSRF 和大小检查；保留原始 URI、媒体类型和转换器版本，不能把 Markdown 当成已验证事实。 |
| [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai) | MIT；LLM graph scraper | 提供单页 `SmartScraperGraph`、多页 `SearchGraph`、multi graph 并发抽取；可接本地模型或云 API；README 说明开源库和托管 API 分开，并有匿名 telemetry opt-out。 | **延后为 schema extraction 实验**：只有来源已 admitted 后才允许结构化抽取；必须记录模型、schema、输入 URL 和成本，默认关闭 telemetry 和自动执行脚本。 |

信息获取链路据此拆成四个明确阶段：

```text
discover → fetch → extract → admit
```

`discover` 只得到候选 URL；`fetch` 受域名、robots、SSRF、响应体和超时限制；`extract` 只产生带
原始 URL、时间、转换器和摘录位置的候选内容；`admit` 才允许内容进入模型上下文。浏览器动作、
登录态、下载文件和结构化 LLM 抽取都不能跳过这条链路。

结论是：Patchwork 需要的是**检索协议和证据治理**，不是把成熟项目的整套 RAG 产品搬进插件。第一版以词法搜索和 DSH 原生 web 能力为主；混合向量、图索引和深研 Agent 只有在真实失败数据证明必要时才进入隔离实验。

## 5. 研究和评测依据

以下路线用于定义评测问题，不代表 Patchwork 已复现论文数字：

- [BM25](https://dl.acm.org/doi/10.1561/1500000019)：词法检索仍适合精确标识符、路径、配置键和代码符号。
- [DPR](https://arxiv.org/abs/2004.04906)：dense retrieval 可补足词面不同但语义相近的查询；需要模型、语料和负例匹配。
- [ColBERT](https://arxiv.org/abs/2004.12832)：late interaction 代表更细粒度的候选匹配，代价是索引和推理复杂度。
- [Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)：可把多个排名合并为 hybrid baseline；必须在真实标注集上验证。
- [HyDE](https://arxiv.org/abs/2212.10496)：用假设文档辅助 dense 检索；会引入额外生成和错误扩展，第一版不默认启用。
- [Self-RAG](https://arxiv.org/abs/2310.11511)：包含训练得到的 reflection tokens，不能用几句提示词宣称复现。
- [CRAG](https://arxiv.org/abs/2401.15884)：先评估检索质量，再决定保留、修正或扩展搜索；Patchwork 采用其“检索后验收”思想，但不引入训练模型。
- [LongMemEval](https://arxiv.org/abs/2410.10813) 和 [MemoryAgentBench](https://arxiv.org/abs/2507.05257)：分别提醒测试时间推理、知识更新、拒答、长程理解和选择性遗忘，不能只报总体命中率。
- [Ragas](https://docs.ragas.io/)：可评估 context precision、recall 和 faithfulness；faithfulness 只说明回答是否得到给定上下文支持，不自动证明来源真实。

Patchwork 的最小评测集应来自真实任务失败和用户纠正，并额外加入以下负例：无答案、旧事实已更正、来源相互冲突、跨项目同名文件、删除后的内容、恶意网页提示、没有授权的历史会话和超预算结果。

## 6. Patchwork 检索架构

### 6.1 四类来源

1. **workspace**：当前 Session 工作目录中的 `glob`、`grep`、`read`。
2. **project memory**：用户明确启用且带 project scope 的最小事实或经验。
3. **session history**：仅在显式授权、作用域匹配、Patchwork Agent 可见时使用；默认关闭。
4. **web**：DSH `web_search`、必要时 `web_fetch`，所有结果均为 external/untrusted。

### 6.2 路由顺序

默认从便宜、局部、可审查的来源开始：

```text
任务和已有证据
  → workspace
  → 已授权 project memory
  → 显式 session history
  → web_search
  → 必要的 web_fetch
  → 证据包和回答
```

如果用户明确给出 URL，直接 fetch；如果问题是当前仓库的实现事实，先 workspace；只有需要时效、外部比较或用户明确要求调研时才进入 web。跨来源不是为了“多搜几个”，而是为了解决已识别的证据缺口。

### 6.3 单次检索预算

这是第一版的产品预算，不是 DSH 工具硬上限：

| 来源 | 默认预算 | 停止条件 |
|---|---|---|
| workspace | 最多 3 轮 `glob/grep`，每轮只补一个缺口 | 找到目标入口和相关上下文，或连续一轮无新术语 |
| project memory | 1 次候选检索 + 必要的 1 次精确读取 | 已有事实足够，或 scope/版本不匹配 |
| session history | 1 次 `session_search`，命中后最多 1 次事件读取 | 需要精确前序证据时才继续 |
| web | 最多 2 个聚焦 query 批次、4 个 fetch | 已有足够的一手来源，或连续结果只重复已有主张 |
| 交叉核对 | 高风险结论至少 2 个独立来源 | 来源冲突则标记 conflict，不强行合并 |

预算、耗时、候选数量和发送字符数必须记录在检索 ledger。没有新增证据时停止，不以“再搜一次”替代判断。

### 6.4 证据包和上下文投影

检索模块输出结构化证据包，而不是把搜索结果全文直接拼进提示词：

```text
claim: 要支持的具体主张
source: workspace path / memory id / session event / URL
version_or_date: 版本、提交或发布时间
excerpt: 支持主张的最小片段
scope: session / project / profile / public-web
trust: local / user-confirmed / external-untrusted
status: retrieved / admitted / sent / cited / verified
reason: 采用、裁剪、拒绝或过期原因
cost: latency_ms / input_chars / output_chars
```

上下文投影只发送通过 scope、来源和预算筛选的最小片段。完整页面、完整会话事件和超限搜索结果留在可审查的本地记录中，不自动进入下一轮请求。

## 7. UI 和日志方案

Patchwork 继续复用 DSH 原生侧栏、token 和浅色/暗色主题，增加“检索”作为任务证据的一种视图，而不是另起一个搜索网站。

UI 至少显示：

- 当前范围：仅本地、项目事实、历史会话、web；默认选择与实际 Agent scope 一致。
- 查询词、搜索轮次、耗时、结果数、输入/输出字符或 token 估算。
- 每个来源的路径或 URL、版本/日期、信任级别和状态。
- 被采用的证据、被预算裁剪的证据、被拒绝的原因和冲突来源。
- “引用来源”“仅查看”“加入记忆候选”三个不同动作；加入记忆必须进入现有 Candidate/Approval 流程。
- web 结果中的外部指令警告；不把页面中的“请执行”渲染成 Patchwork 操作按钮。

日志只写白名单元数据：query 指纹、source type、scope、result count、admitted/sent counts、latency、budget outcome、失败码和引用 id。继续禁止记录完整提示词、命令全文、网页全文和凭据。

## 8. 安全和隔离规则

- 检索工具只在 Patchwork Agent 选中后可见；其他会话不因启用检索而获得工具、提示词或日志读取权。
- session history 默认关闭；不能把 DSH 的全局实验组合直接当成 Patchwork 的项目记忆。
- 精确 scope 检查发生在工具执行边界，不由模型提供的 `cwd`、query 或自然语言声明决定。
- 外部内容只能作为数据，不能修改规则、权限、配置、记忆或审批状态。
- web 发送前在 UI 显示范围；默认不把私有文件内容拼进公开查询，除非用户明确要求且当前 Agent 有权限。
- 删除必须覆盖正文、摘录、索引、缓存和派生证据；删除后重启和重建索引不能复活。
- 搜索失败不阻塞普通任务；失败应进入 `unknown` 或 `partial`，不能用猜测补齐。

## 9. 验收指标和隔离实验

先用真实失败建立小型 golden set，再比较无检索、仅 workspace、workspace+project、workspace+web 四种配置。固定模型、DSH 版本、工作区快照、网络端点和预算，留出未参与调参的任务。

| 指标 | 说明 |
|---|---|
| Recall@k | 相关文件、事实或来源是否进入候选集 |
| MRR / NDCG@k | 正确入口在候选排序中的位置 |
| Citation support rate | 回答中的主张是否被所列来源支持 |
| Source coverage | 关键主张是否都有来源、版本和日期 |
| Abstention precision | 无答案、冲突或过期时是否正确拒答/标 unknown |
| Stale-hit rate | 已纠正或过期事实仍被采用的比例 |
| Scope leakage | 其他会话、项目或 preset 是否出现未授权结果 |
| Cost / latency | 查询次数、发送字符、token、首结果和总耗时 |

通过条件不是单一分数：相关任务的召回或引用支持率必须改善，成本和延迟在预算内，负例不出现跨 scope 泄露、伪引用或无答案臆测。任何收益若不能在 held-out 任务保持，就只能是候选实验结果。

## 10. 分阶段方案

### P0：检索协议可见（已完成）

交付本调研文档、独立检索提示词、UI/日志字段设计和真实 DSH 契约快照。已完成，并补充了
`patchwork_search` 的 Bing/Brave/DuckDuckGo 多 provider fallback、scope 负测和代理下真实调用。

### P1：任务级检索 ledger 与受控抓取（已实现，待隔离宿主验收）

现有 `src/retrieval/ledger.mjs`、`src/logging/` 和 `src/scope.mjs` 已记录搜索/抓取的 provider、结果状态、耗时和失败码，并提供
Agent 级 scope 隔离；`patchwork_fetch` 已增加 robots、host allowlist、SSRF/DNS、重定向复核、响应大小和摘录上限。
当前仍缺完整 evidence admit/send/citation 链，需在隔离 DSH 中补做真实抓取、拒绝和取消负测。

### P2：隔离真实验证（搜索首轮完成，抓取待执行）

首轮已在独立 DSH_HOME 和真实 Cordis 组合中验证工具目录隔离，并在代理下完成真实多 provider
查询；抓取需继续加入公开 URL、robots 拒绝、越界重定向、超时、取消、跨会话和删除后重建负测。
主 DSH 的请求数和进程操作必须为零。

### P3：用户确认后的有限启用

只有用户批准的检索范围和预算才可对当前项目生效；session history 仍默认关闭。若需要向量、reranker、GraphRAG 或第二 provider，必须先有失败证据、隔离实验和回滚点。

## 11. 采用、延后和排除

**采用：** DSH 原生 `glob/grep/read`、`web_search/web_fetch`；Patchwork `patchwork_search` 的
Bing/Brave/DuckDuckGo 无密钥聚合 fallback；来源和 scope 账本；独立检索提示词；三轮以内的迭代本地检索；URL/路径/版本引用；
Qdrant skill 的 golden set、held-out 和置信区间纪律；Open WebSearch 的 untrusted/能力状态规则；
社区项目验证过的 provider health、robots/path scope、SSRF/DNS pinning、bounded Markdown、研究 brief、
visited URL ledger 和窄转换入口。

**延后：** 项目级全文/向量索引、reranker、HyDE、图检索、自动 query expansion、跨会话搜索 UI、第二套付费 web provider；
headless browser、深爬、LLM schema extraction 和多轮 deep-research loop 必须先有真实失败证据、任务级授权和隔离预算；
公共 HTML provider 仍可能被限流或改版，不能替代有 SLA 的搜索 API。

**排除：** 自动把搜索结果写入长期记忆；只用 embedding 相似度决定事实；把网页提示注入成规则；用模型自评单独批准引用；
无限搜索/爬取循环；随机公共 SearXNG 实例；无 allowlist 的浏览器导航；把登录态、下载文件或网页脚本作为普通检索输入；
直接开启 DSH 全局 session-search 组合包。

## 12. 来源和核查记录

本轮通过 GitHub CLI（使用现有本地代理）只读核查了成熟项目、skill 的 README/SKILL、仓库元数据和固定文件路径；没有安装或执行这些第三方项目。

为便于复查，本轮读取的默认分支提交快照如下；后续实施前仍需重新核对：

| 仓库 | 分支提交 |
|---|---|
| `deepset-ai/haystack` | `8e38c633190ee43b80c136b335f8c9d6c79cc5d6` |
| `run-llama/llama_index` | `619d74664e8404612038bc15a1a40c686037277c` |
| `langchain-ai/langchain` | `5b0aeb7637fc415eb408dc31523609272bbb38e1` |
| `infiniflow/ragflow` | `94369fc289e61be2f7e43bd0c65862269207d9c4` |
| `microsoft/graphrag` | `c600ff80b77b9b62c47d539a3ac9569e95d8949b` |
| `qdrant/skills` | `15793b641b7bc85d2e7dc59be1b796381ce715ba` |
| `qdrant/qdrant` | `222b2e44ab1c3f17e8246396ead6558e45041df7` |
| `lancedb/lancedb` | `29691719faa0da3f5a790d6f24add039874ef79f` |
| `SciPhi-AI/R2R` | `9c5a94d151f90876bd7eb860f300a8fd662dc481` |
| `HKUDS/LightRAG` | `aaebfe1bb8d55deb6a4304d357a3bf4c92fcd40a` |
| `searxng/searxng` | `ffa88e3ba3ade64185d5754c839cdf5a80708c4a` |
| `benbusby/whoogle-search` | `0543f86528678ab60a20b3049483975add6b6e40` |
| `MarginaliaSearch/MarginaliaSearch` | `1327d0c548f17924c781eb2a0f388ed1b300d48d` |
| `Aas-ee/open-webSearch` | `fb11fd94df736819a0d2765bf7645224f98b2c6b` |
| `Jorgut/iterative-retrieval-skill` | `2e01a319fc9198741bbf85763e74f25ef666a27d` |
| `huskyhoochu/web-research-agent-skills` | `bb0783597cef6ea54ee175042c8f2027c9a27dfb` |
| `Hisn00w/Paper-Citation` | `73bec8715ff0d4024155a99bb17b4b255fce661a` |
| `stanford-futuredata/ColBERT` | `cc4f3dc91c0b45d2d08c251d9d95178285c65f1c` |
| `FlagOpen/FlagEmbedding` | `897baa67c0ffddbfccf4e6776ff55310d67809d4` |
| `SandeepAi369/SearchWala` | `a95e6c8432fe1d749371d8a0a308720181b80be5` |
| `CortexLM/vgrep` | `cb9689d1d375b46ff285756fddfbf434eff5a05f` |
| `neon-mmd/websurfx` | `5448456bd2e92f166c463632815e113dcfe07b17` |
| `hnhx/librex` | `b5a9f12df91cb8ded541df291da58ce2f104fe62` |
| `asciimoo/hister` | `a1f7cfcf9d62e9549eff0189d8d60ab434c8ae9c` |
| `tobocop2/lilbee` | `431911df4ada0c0e33f5144c76b7cac406d3113d` |
| `tisDDM/searxng-mcp` | `83584989fd3df63ee51a842ef1f4562d9c528dd9` |
| `yacy/yacy_search_server` | `b50b76bd552a851f737b98683f20d8b861e137ae` |
| `unclecode/crawl4ai` | `888299fb5f0b82181897dc0e61bfb4b036f0aea5` |
| `firecrawl/firecrawl` | `1b83b35821a10064691790ef8e9543c644c247ac` |
| `browser-use/browser-use` | `b49a68e4060acb226da8f784194fef301c53a6d7` |
| `langchain-ai/open_deep_research` | `1b7d2e80db9faa586165c60e09096dbbfd483a64` |
| `dzhng/deep-research` | `1f8f3e285bbc23e80b98a66a64effab9069f3ad4` |
| `microsoft/markitdown` | `7482c092d9c0074a89803c9fdb63a969e7fe17fc` |
| `ScrapeGraphAI/Scrapegraph-ai` | `194055e203afce41ed4e70365dbc416bad756115` |
| `browserbase/stagehand` | `b7a4b899079f198a0ee78a6dcb62ad02f545cf49` |

DSH 本地契约来自当前安装的 `dsh-v0.2.1-rc.2` 依赖目录：

- `@deepseek-ai/dsh-tool-fs-search/README.zh.md`
- `@deepseek-ai/dsh-tool-web/README.zh.md`
- `@deepseek-ai/dsh-tool-session-query/README.zh.md`
- `@deepseek-ai/dsh-experimental-session-search/README.zh.md`
- `@deepseek-ai/dsh-session-query-sqlite/README.zh.md`
- `@deepseek-ai/dsh-web-search-deepseek/README.zh.md` 与 `lib/types/provider.d.ts`

本轮实现后的隔离验证：在临时 `DSH_HOME` 和真实 Cordis 组合中，Patchwork Agent 的工具目录
包含 `patchwork_search`，standard Agent 不包含；通过本地 HTTP 代理调用 Bing、Brave 和
DuckDuckGo 时，`DeepSeek Harness` 查询在没有 DeepSeek 搜索密钥的情况下返回了真实标题、URL
和 snippet。
切换离开 Patchwork 后，保留的工具引用按 scope 校验失败。验证只使用临时宿主和当前仓库，
没有改动主 DSH。

第三方来源链接见本文各节；仓库默认分支会移动，后续实施前应固定 commit 并重新核查版本、许可和当前行为。

本轮 provider 入口与项目资料：

- [Bing HTML search](https://www.bing.com/search)、[Brave Search](https://search.brave.com/search) 和 [DuckDuckGo HTML](https://html.duckduckgo.com/html/)：同一查询的实时可用性抽样。
- [SearXNG](https://github.com/searxng/searxng)：AGPL-3.0，多引擎聚合和隐私边界参考。
- [Whoogle Search](https://github.com/benbusby/whoogle-search)：MIT，仓库已归档，README 记录 Google 无 JavaScript 抓取入口失效。
- [Marginalia Search](https://github.com/MarginaliaSearch/MarginaliaSearch)：AGPL 为主，面向小型文本网站的索引参考。
- [SearchWala](https://github.com/SandeepAi369/SearchWala)：Apache-2.0，family-aware RRF、BM25+、MMR、provider health、bounded deep reader 和 citation check 参考。
- [vgrep](https://github.com/CortexLM/vgrep)：Apache-2.0，路径隔离的本地 embedding 索引、增量 hash 和行号引用参考。
- [Websurfx](https://github.com/neon-mmd/websurfx)：AGPL-3.0，Rust provider trait、响应体上限、配置求交和缓存参考。
- [Hister](https://github.com/asciimoo/hister)：AGPL-3.0，本地全文/语义索引、多用户 scope 和 MCP 入口参考。
- [lilbee](https://github.com/tobocop2/lilbee)：MIT，本地优先、精确行引用和 owner/shared memory scope 参考。
- [LibreX](https://github.com/hnhx/librex)：AGPL-3.0，无 JavaScript、无日志/缓存的隐私前端参考。
- [searxng-mcp](https://github.com/tisDDM/searxng-mcp)：MIT，但已 deprecated；随机公共实例和 429 风险是排除依据。
- [YaCy](https://github.com/yacy/yacy_search_server)：P2P/常驻索引服务，GitHub 元数据为 `NOASSERTION`，不纳入插件依赖。
- [Crawl4AI](https://github.com/unclecode/crawl4ai)：Apache-2.0，LLM-ready Markdown、深爬、缓存、robots 和资源边界参考。
- [Firecrawl](https://github.com/firecrawl/firecrawl)：AGPL-3.0，robots、crawl scope、SSRF/DNS pinning 和任务化抓取参考。
- [Browser Use](https://github.com/browser-use/browser-use)：MIT，浏览器域名 allowlist、重定向拦截、敏感输入遮罩和 session 清理参考。
- [Stagehand](https://github.com/browserbase/stagehand)：MIT，observe/act/extract 分层、schema 抽取和本地/云浏览器边界参考。
- [Open Deep Research](https://github.com/langchain-ai/open_deep_research)：MIT，但仓库已归档；澄清、研究 brief、并发/迭代预算和引用编排参考。
- [dzhng/deep-research](https://github.com/dzhng/deep-research)：MIT，breadth/depth、follow-up query、visited URL 和并发限制参考。
- [MarkItDown](https://github.com/microsoft/markitdown)：MIT，窄转换入口、插件化文档解析和不可信输入安全边界参考。
- [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai)：MIT，schema extraction、SearchGraph 和并发抽取参考。
