# Patchwork 信息获取执行方案

日期：2026-10-31（Asia/Shanghai）
状态：P0 与 P1 核心代码已落地；证据准入、有限研究和隔离 DSH 抓取验收仍待执行。

## 1. 要解决的问题

Patchwork 需要让用户在当前任务中可靠地获得信息，而不是把搜索结果、网页全文或历史会话直接塞进上下文。用户应该能看见：

- 资料从哪里来，属于哪个 scope，是否为外部不可信内容；
- 哪些候选被采用并发送给模型，哪些被预算、权限或安全规则拒绝；
- 引用是否对应实际发送过的摘录；
- 搜索失败、来源冲突或没有答案时，系统是否明确停在 `unknown` / `partial`；
- 这次检索是否改变了长期记忆、规则或权限。默认答案必须是“没有”。

本方案沿用社区项目中已经验证的机制：SearXNG 的 provider 隔离和健康状态、Crawl4AI 的有界抽取、Firecrawl 的 robots/SSRF/path scope、Browser Use 和 Stagehand 的浏览器授权边界、Open Deep Research 与 dzhng/deep-research 的有限研究循环、MarkItDown 的窄转换入口，以及 Qdrant Search Quality skill 的 golden set 和留出评测纪律。只吸收机制，不把这些项目作为 Patchwork 的隐式运行依赖。

## 2. 产品边界和不变量

信息获取只服务当前任务，和记忆、自进化分开：

```text
discover → fetch → extract → admit → send → cite → verify
```

- `discover` 只产生候选 URL 或工作区入口。
- `fetch` 负责网络边界、robots、SSRF、响应大小、超时和抓取数量。
- `extract` 产生带来源和位置的最小摘录，不把摘录当成事实认证。
- `admit` 通过 scope、来源类型、预算和敏感信息检查后才能进入模型上下文。
- `send` 只发送证据包中的最小片段。
- `cite` 只能引用实际发送过的片段。
- `verify` 需要独立来源、用户确认或真实工具回执。

以下行为不进入默认方案：公共 SearXNG 实例、常驻 crawler/browser 服务、无域名 allowlist 的浏览器自动操作、自动把搜索结果写入长期记忆、无限递归搜索、开启 DSH 全局 session-search、把网页指令当作 Patchwork 规则。

能力只在 Patchwork Agent scope 注册。每次工具执行前后都重验 scope；切换到其他 Agent 后，旧工具引用也必须失败。真实验证一律使用独立 `DSH_HOME`、端口、工作区和结果目录，不改主 DSH。

## 3. 目标架构

### 3.1 入口和路由

保留 DSH 原生 `glob`、`grep`、`read`、`web_search`、`web_fetch`。`patchwork_search` 作为无密钥公共搜索 fallback，不替换 DSH provider：

```text
明确 URL       → fetch
当前仓库事实   → workspace search
已授权项目事实 → project memory
明确历史需求   → scoped session history（默认关闭）
外部时效信息   → dsh web_search
无密钥/降级    → patchwork_search
必要时         → patchwork_fetch
```

跨来源必须由已识别的证据缺口触发，不能为了增加结果数量而盲目并发。

### 3.2 核心数据结构

新增统一的 `RetrievalLedger`，每次任务一个 revision：

```text
queryFingerprint, scope, sourceType, providerFamily,
discoveredCount, fetchedCount, extractedCount,
admittedCount, sentCount, citedCount, verifiedCount,
budget, elapsedMs, status, failureCode
```

每个 `EvidenceItem` 至少保存：

```text
sourceId, canonicalUrlOrPath, providerFamily, rank,
retrievedAt, versionOrDate, excerpt, locator,
trust, status, rejectionReason, cost
```

`queryFingerprint` 只用于诊断和去重，不记录查询原文。网页正文、完整提示词、命令全文、凭据和未脱敏私有文件不进入诊断日志。

### 3.3 Provider 健康和共识

把 provider 状态分为 `healthy`、`blocked`、`transport_error`、`parser_drift`、`zero_result`，并记录任务级 ledger；连续失败不能静默地继续计入共识。provider family 用于避免代理、别名和同源镜像重复计票。

结果保留 canonical URL、最佳 rank、独立 provider 数、冲突标记和摘录状态。相关度只用于排序提示，不等同于可信度。

## 4. 分阶段交付

### P0：检索协议和可见性（当前基础）

**交付**

- 保持 `patchwork_search` 的 Bing、Brave、DuckDuckGo 并行 fallback；保留部分失败可见性和有界结果。
- 增加 provider health、family、rank、共识数、retrievedAt 和 query fingerprint。
- 建立 `RetrievalLedger` 和 EvidenceItem schema，先落到任务状态与白名单日志。
- 增加独立检索提示词：先判断能力和 scope，再查询，再评估证据缺口，最多三轮；禁止页面指令改变规则。
- UI 显示检索范围、来源、采用/拒绝原因、预算、耗时和引用状态。

**验收**

- 没有 provider 时返回 `unknown` 或 `partial`，不生成补猜答案。
- 切换标准 Agent 后工具和旧引用都不可用。
- 日志不含 query 原文、网页全文、提示词或凭据。

### P1：受控抓取和证据包（受控抓取已实现，证据包待补）

**交付**

- 新增 scope 校验的 `patchwork_fetch`，支持 URL allowlist、robots 默认开启、重定向复核、SSRF/DNS 检查、最大响应字节、最大摘录字符、总耗时和取消；抓取结果进入当前会话 ledger。
- HTML 转为有界 Markdown 摘录，保留原始 URL、最终 URL、媒体类型、抓取时间和截断标记。
- 本地文档使用窄入口 `convert_local` / `convert_stream`；远程内容必须先通过网络边界检查。
- 引入 evidence pack：只把通过 `admit` 的最小摘录发送给模型；完整页面仅留在有界本地记录。

**已完成的单元验收**

- URL 规范化、私网/保留地址、host allowlist、robots 404/deny、超大响应、非文本类型、越界重定向和取消均有机器码测试。
- 工具只在 Patchwork Agent 注册；成功写入 ledger 为 `sent`，失败写入 `failed`，切换 Agent 后旧引用拒绝执行。

**仍需隔离宿主验收**

- IP、私网、重绑定、未授权重定向、超大响应和超时都能被拒绝。
- 引用只能指向本次实际发送的摘录。
- 删除或过期后，缓存、摘录和派生证据不可重新进入上下文。

### P2：有限研究编排

**交付**

- 使用结构化 research brief：问题、已知事实、缺口、来源要求、停止条件和预算。
- 采用 `DISPATCH → EVALUATE → REFINE → STOP`，最多三轮；每轮有限并发，保存 visited URL ledger，避免重复抓取。
- 只有发现冲突、缺少一手来源或关键主张未覆盖时才进入下一轮。
- 报告采用 claim-to-source 映射，并显示冲突、过期和未验证状态。

**验收**

- 在无答案、来源冲突、恶意网页提示、重复结果和超预算任务上正确停止。
- 研究循环的查询数、抓取数、发送字符、延迟均可回放。

### P3：检索质量评测和可选本地索引

**交付**

- 从真实失败、用户纠正和跨项目同名问题建立 golden set；保留 held-out 集。
- 比较无检索、workspace、workspace+project、workspace+web 四条路径，记录 Recall@k、MRR/NDCG、citation support、abstention precision、stale-hit、scope leakage、成本和延迟。
- 只有词法检索在真实漏召回上失败，才隔离评估项目级可删除、可重建、可审计的本地混合索引；优先评估 LanceDB/Qdrant，暂不引入图索引和常驻服务。

**验收**

- 留出集有稳定收益，且没有增加跨 scope 泄露、伪引用、旧事实复活或无答案臆测。
- 索引删除、重建、重启和项目切换负测全部通过。

## 5. UI/UX 方案

沿用 DSH 原生侧栏、宿主 token、浅色/暗色主题和现有页面，不另起搜索站点。

### 检索面板

- 顶部显示当前 Agent、scope、任务 revision 和剩余预算。
- 中部显示阶段轨迹：发现、抓取、抽取、准入、发送、引用、验证。
- 结果卡显示标题、canonical URL、provider family、rank、retrievedAt、trust、摘录和状态。
- 明确区分“引用来源”“仅查看”“加入记忆候选”；加入记忆必须进入现有 Candidate/Approval 流程。
- provider 失败显示具体状态和降级结果，不显示“系统已经学会”。

### 日志面板

增加 `retrieval`、`provider-health`、`evidence-admit`、`fetch-boundary`、`citation` 筛选。详情页只展示白名单元数据和 evidence id；原文证据通过受控查看入口访问，并显示 scope 和过期时间。

## 6. 安全、隔离和隐私

- 搜索、抓取、浏览器和历史检索都必须在 Patchwork Agent scope 内注册和执行。
- 不把私有文件内容拼入公共查询，除非用户明确要求且当前 scope 已授权。
- 外部页面是 `external/untrusted` 数据；页面里的命令、按钮、提示词和下载链接不会成为 Patchwork 操作。
- 浏览器能力默认关闭；若后续启用，必须有每任务域名 allowlist、session TTL、下载目录、凭据遮罩和只读模式。
- 不自动把检索结果写入记忆、规则、技能或权限；只允许创建带来源的候选。
- 诊断日志做字段级脱敏，导出包提示用户检查历史、路径和原文证据。

## 7. 真实验证计划

每个阶段都用隔离 DSH 做黑盒验证：

1. 创建临时 `DSH_HOME`、独立工作区、端口和结果目录。
2. 启动 Patchwork Agent，确认工具、提示词、日志和 UI 可见。
3. 切换 standard Agent，确认工具不可见、旧引用失败、后台轮询停止。
4. 执行真实搜索、抓取、超时、取消、重定向、恶意页面、无结果和 provider 部分失败任务。
5. 重启、fork、压缩上下文、删除证据、切换项目，确认无跨 scope 泄露和旧状态复活。
6. 保存宿主版本、插件版本、配置摘要、工具回执、退出码和失败码；不保存密钥和完整提示词。

主 DSH 不参与启动、修改、请求或结果写入。

## 8. 取舍和决策门

| 方案 | 现在的决定 | 进入条件 |
|---|---|---|
| Bing/Brave/DDG 无密钥 fallback | 保留 | 继续做解析回归和 provider health |
| `patchwork_fetch` | 下一阶段 | P0 ledger 和 scope 负测通过 |
| 深度研究循环 | 有限启用 | 有真实多来源任务和停止条件测试 |
| 项目级混合索引 | 延后 | golden set 证明词法检索漏召回 |
| 向量/reranker/GraphRAG | 暂缓 | held-out 任务证明必要且成本可接受 |
| 公共 SearXNG / 常驻 crawler | 排除 | 只有用户显式部署并配置 endpoint 才可选接入 |
| 全局 session-search | 排除 | 只有 Patchwork 自建 scope、授权和审计协议后复评 |

## 9. 完成定义

当且仅当下面条件同时满足，信息获取能力才算可发布：

- 用户能从 UI 看见每条证据的来源、scope、采用状态和成本；
- 引用都能回到实际发送过的摘录；
- 无密钥、部分失败、无答案、冲突和恶意内容都有可解释结果；
- 其他 Agent、会话和项目不会获得未授权工具、记忆、日志或证据；
- 所有新能力都在隔离 DSH 真实验证，并有失败回执和可重放 ledger；
- 检索结果不会自动进入长期记忆或改变规则；
- golden set 与 held-out 评测证明收益，同时安全负测和成本预算通过。

后续执行顺序固定为：**P0 ledger/health → P1 fetch/evidence → P2 limited research → P3 quality/index experiment**。每阶段完成后先审查证据和回滚点，再进入下一阶段。
