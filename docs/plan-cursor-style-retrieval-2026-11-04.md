# 方案 C：Cursor 式代码检索（2026-11-04）

## 1. 先对齐 Cursor 的真实做法

当前 Cursor 官方 Search 文档的主路径不是“把代码上传做 embedding”，而是：

- **Instant Grep**：本机构建并查询搜索索引，官方称在大仓库上快于 ripgrep；支持完整正则和词边界；用户提到具体符号时 Agent 会自动使用。
- **隐私**：不上传文件路径或代码来建索引，也不为搜索存储代码 embedding。
- **Explore subagent**：在独立上下文里用更快的模型并行搜索，只把相关发现带回主会话。
- **工具路由**：具体符号优先精确搜索；宽泛问题交给 Explore；不是所有任务都先读文件。

Cursor 早期有过 codebase indexing/embeddings 路线；至少当前 Search 文档的重点已经转向“本地精确索引 + 子代理隔离”。Patchwork 应借鉴这个行为，而不是复刻闭源实现。

## 2. 借鉴与不借鉴

### 借鉴

1. **本地精确索引**：不上传、不依赖外部向量库，优先解决“找得到、找得快”。
2. **词边界/正则优先**：代码搜索大多数是符号、错误字符串、配置键，不是自然语言。
3. **搜索隔离**：宽泛搜索进子上下文，主会话只收 findings + 引用。
4. **自动路由**：按查询形态选择 map / find / search / explore，而不是让模型每次自由发挥。
5. **成本意识**：搜索次数、候选文件数、上下文字节都计入任务成本。

### 不借鉴

- 不复刻 Instant Grep 的闭源索引/正则引擎；Patchwork 是插件，不是编辑器内核。
- 不先上 embedding / 向量库：当前主要问题是结构和效率，不是语义召回；Cursor 当前搜索文档也不为搜索存 embedding。
- 不新增第二个“通用 grep”与 DSH 原生 `grep` 竞争；只加“带索引和排序的代码检索”。
- 不假设无限工具调用；每次搜索都要有预算和停止条件。
- 不修改主 DSH 或宿主搜索服务；所有能力在 Patchwork Agent scope 内注册。

## 3. Patchwork 的约束

- DSH 已提供 `read/glob/grep`，`grep` 是宿主能力；Patchwork 不应替换它。
- Patchwork 是插件，不能假设自己能拿到编辑器级 AST/LSP 索引。
- 可维护性优先：避免常驻 daemon、原生依赖、复杂正则引擎。
- Windows 路径、CJK、生成的/minified 文件、`.gitignore`、密钥文件都要处理。
- 索引必须可删除、可重建、可审计，不能写进用户仓库。

## 4. 架构

### 4.1 一个工具，三类检索

继续用方案 A 的单一工具 `patchwork_code`，增加 `search` action；不新增四个工具：

```text
patchwork_code
  action: map | outline | find | references | search
  query?: string          // search: 字面量/词/正则
  mode?: literal | word | regex
  path?: string           // 限定目录/文件
  glob?: string           // 限定文件类型
  maxResults?: number
  tokenBudget?: number
```

职责分工：

| 查询形态 | 首选 | 说明 |
|---|---|---|
| “这个模块大概在哪” | `map` | 结构先验，避免全仓扫 |
| “这个文件有什么” | `outline` | 只看导出/符号/行号 |
| “这个符号在哪定义” | `find` | 定义优先，引用其次 |
| “谁引用了它” | `references` | 词法引用，明确不是 LSP |
| “这个错误字符串/配置键在哪” | `search` | 本地索引 + 精确扫描 |
| “认证逻辑散落在哪” | Explore 子代理 | 宽泛、多方向、需要隔离上下文 |

### 4.2 本地索引

P0 不做复杂索引，先做“候选文件预筛 + 精确扫描”：

1. 文件清单来自 workspace，尊重 `.gitignore`，跳过 `.git`、`node_modules`、`dist`、`build`、`coverage`、二进制、压缩包、密钥文件。
2. 为每个文件维护轻量元数据：路径、语言、大小、mtime、是否 generated/minified、符号摘要。
3. 对查询做归一化：大小写、词边界、CJK、路径分隔符。
4. 先用元数据/符号摘要缩小候选文件，再在候选文件内做精确扫描。
5. 返回 `path:line` + 短片段，定义优先，按文件/行排序，默认上限 50。

P1 再加 trigram/倒排索引：

- 对标识符、字符串字面量、配置键建 n-gram 索引；
- 查询先查索引得到候选文件，再精确扫描候选；
- 索引落 `DSH_HOME/patchwork/code-index/<workspace-hash>/`；
- 缓存键：workspace realpath + git HEAD + mtime/size + 配置版本；
- 增量更新，不常驻 watcher；下一次调用时按 mtime 差异重建；
- 大仓库有 maxFiles、maxIndexBytes、构建超时；超限降级为 P0 扫描。

P2 再评估是否需要完整正则索引；**不默认引入原生依赖**。

### 4.3 Explore 子代理

目标：复刻 Cursor 的“独立上下文 + 并行搜索 + 只回结论”。

- 只读、独立上下文、最多 2 轮；
- 每轮最多 4–6 个并行搜索方向；
- 输入：任务、已知线索、允许的路径、预算；
- 输出：

```json
{
  "findings": [
    { "claim": "认证入口在 src/auth/session.mjs", "path": "src/auth/session.mjs", "line": 42, "quote": "..." }
  ],
  "deadEnds": ["src/legacy/auth.js 已废弃"],
  "searched": ["auth", "session", "cookie"],
  "confidence": "high | medium | low",
  "truncated": false
}
```

- 主会话只接收 findings，不接收大段原文；
- 子代理不得编辑、不得再委派、不得把检索内容当指令；
- 失败返回 `blocked`/`unknown`，不伪造结论；
- 模型选择：优先继承宿主模型；如果宿主提供更轻量的子代理模型，可配置，但不强求。

触发策略：

- 用户问题宽泛（“认证在哪”“为什么登录失败”）；
- 主会话连续 2 次搜索没有命中；
- 候选文件超过阈值（例如 >50）；
- 任务 brief 明确标记“探索型”。

### 4.4 路由策略

写进工具描述和 Patchwork skill，短而可执行：

1. 具体符号/错误字符串 → `find` 或 `search`，带 `path/glob` 窄化；
2. 不熟悉模块 → 先 `map`，再 `outline`；
3. 需要跨文件关系 → `references`，并承认是词法结果；
4. 宽泛多方向 → Explore 子代理；
5. 两次没命中 → 停下来重新 map/outline，不要继续换同义词；
6. 不把 `patchwork_search`（公网搜索）用于本地代码。

### 4.5 与 DSH `grep` 的关系

- 任意 PCRE/复杂正则仍可走 DSH `grep`；Patchwork 不阻止。
- `patchwork_code search` 的定位是“索引 + 排序 + 有界结果”，不是取代 `grep`。
- 如果 DSH 未来暴露搜索服务/hook，可把索引接到宿主层；当前不修改主 DSH。
- 工具描述明确：本地代码检索用 `patchwork_code`/DSH `grep`；公网信息才用 `patchwork_search`。

## 5. 索引生命周期与安全

- 位置：`DSH_HOME/patchwork/code-index/<workspace-hash>/`，不写仓库。
- 删除：设置页/诊断页提供“清除索引”；删除后重建不复活旧内容。
- 失效：git HEAD、mtime、文件大小、配置版本任一变化即重建对应文件。
- 忽略：`.gitignore`、`.git`、依赖/构建目录、二进制、压缩包、`.env`、`*.pem`、`*.key`。
- 符号链接：realpath 后必须仍在 workspace 内。
- 日志：只记路径 hash、候选数、命中数、耗时、缓存状态；不记文件正文。
- 跨会话：索引按 workspace 绑定，不跨 workspace 复用；不把索引内容注入其他会话。

## 6. 度量

- `searchLatencyP50/P95`；
- `candidateFiles / totalFiles`：候选缩减比例；
- `recall@k`：golden set 上是否找到人工标注的目标文件；
- `firstUsefulFileStep`；
- `searchCalls`、`duplicateQueryRate`；
- `contextBytesBeforeFirstEdit`；
- `exploreRuns`、`exploreFindingsUsed`；
- `indexStaleHits`：命中陈旧索引的次数（应为 0）。

UI：

- 诊断页“代码检索”卡片：索引状态、文件数、大小、最近重建、命中率；
- 任务详情显示搜索/探索次数；
- 日志新增 `code-search`、`code-index`、`explore` 事件；
- 不展示文件正文或敏感路径。

## 7. 分期

| 阶段 | 交付 | 验收 |
|---|---|---|
| P0 | `map/outline/search`（候选预筛 + 精确扫描）、路由协议、指标 | 在真实仓库上能找到符号/字符串/配置键；结果有界；不读密钥/依赖目录 |
| P1 | trigram/倒排索引、`find/references`、Explore 子代理 | 候选缩减明显；golden set 召回不低于 DSH grep；主会话上下文下降 |
| P2 | 索引持久化/增量、可选 LSP；正则索引仅在真实失败后评估 | 删除/重建/切换 workspace 正确；无陈旧命中；无原生依赖默认引入 |

## 8. 验收

自动测试：

- 查询：符号、字符串、配置键、CJK、大小写、词边界、正则；
- 文件：生成文件、minified、二进制、超大文件、符号链接、`.gitignore`；
- 索引：命中、失效、删除重建、workspace 切换、缓存损坏；
- 安全：密钥文件跳过、越界路径拒绝、日志无正文；
- 预算：maxResults、tokenBudget、超时、截断标记。

真实模型：

- 与方案 B 共用 golden set：找配置、修 typo、加选项、找测试、依赖升级、简单 bug；
- 对照：DSH `grep/read` baseline vs `patchwork_code search` vs `search+explore`；
- 每个 3 次，记录成功率、首个有效文件步数、搜索次数、重复查询、上下文字节、token、延迟；
- 召回先对 golden set 人工标注，不能只看“模型说找到了”。

## 9. 风险

- trigram 索引内存/磁盘成本；用 maxIndexBytes、按需构建、LRU 淘汰；
- 正则语义与 ripgrep 不完全一致；明确 `mode`，复杂正则交回 DSH `grep`；
- CJK/Unicode 分词；用字符 n-gram，不依赖英文分词；
- 生成/minified 文件污染结果；默认降权或跳过；
- 索引陈旧；git HEAD + mtime + size 失效，记录 `indexStaleHits`；
- 工具重复/模型混淆；工具描述明确“本地代码 vs 公网搜索”；
- Explore 子代理过度探索；预算、轮次、并行上限、只读约束。

## 10. 与方案 A、B 的关系

- **方案 A** 是认知层：结构先验、brief、元认知、停止规则；本方案是 A 中“结构先验”的检索实现。
- **方案 B** 是证据层：用真实模型 A/B 证明本方案的召回、步数、上下文收益。
- 本方案不先上 embedding；如果 golden set 证明词法漏召回，再按方案 A 的 P2 隔离评估向量/混合检索。
