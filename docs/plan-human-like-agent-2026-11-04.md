# 方案 A：人类式认知脚手架（2026-11-04）

## 1. 目标

让 Patchwork 在“人一眼能找到、AI 却反复搜索”的任务上更接近人类专家的工作方式，但不模拟意识、情绪或人类偏见。

目标不是让模型“更聪明”，而是补齐人类一直在用的外部认知工具：

- 结构先验：知道东西通常在哪；
- 选择性注意：知道什么不用看；
- 外部记忆：不靠上下文硬记；
- 元认知：知道自己不会、知道何时该问；
- 满足化：知道什么时候够了；
- 工具 affordance：工具像 IDE 一样可用；
- 社会分工：探索交给子代理，目标和授权留给人。

衡量标准不是“回答更像人”，而是：

- 首个有效文件出现的步数下降；
- `read/glob/grep` 次数和重复查询下降；
- 完成同等任务的总 token/时间下降；
- 成功率不下降，false-ready 不增加；
- 未验证项和残余风险被明确报告。

## 2. 现有基础与缺口

已有：

- `patchwork_task`：任务、阶段、纠正、artifact、check、assessment、handoff；
- `patchwork_memory`：会话/项目记忆、提议/确认/忘记；
- `patchwork_improvement`：事故、候选、隔离实验、回滚；
- ObservationPack：超大结果归档；
- ActionFusion：write/edit + shell 融合；
- OnlineContextCompact：计划步边界压缩；
- Superagent：只读/读写执行器队列。

缺口：

- 没有当前仓库的结构先验；
- `grep` 是文本行匹配，不是符号/引用理解；
- 搜索发生在主上下文，ObservationPack 只减体积、不减调用；
- 没有探索预算、重复查询检测和停止条件；
- 没有校准的“不知道”状态；
- 没有探索成本指标；
- 只读 superagent 任务的行为会随提示波动（见真实模型审计 D/I）。

## 3. 设计原则

1. **外置认知，不改模型内部**：能放到工具、状态、索引里的，不塞进 system prompt。
2. **先地图，后搜索**：不熟悉的仓库先 `map`，再 `outline`，再 `grep`，最后才读整文件。
3. **渐进披露**：默认只给 `file:line` + 短片段；整文件读取是显式选择。
4. **单一工具、多个动作**：不新增四个工具，避免 schema 膨胀。
5. **软约束优先**：探索守卫先提示、不硬拦；硬限制只放在权限和预算层。
6. **证据优先于自评**：完成状态由 check/artifact/独立 verifier 决定，不由模型自述决定。
7. **不先上向量库**：当前主要矛盾是结构和效率，不是语义召回。

## 4. 架构

### 4.1 结构先验：`patchwork_code`

新增一个 Patchwork Agent scoped 工具，四个 action：

```text
patchwork_code
  action: map | outline | find | references
  path?: string
  query?: string
  symbol?: string
  tokenBudget?: number   // map 专用，默认 2000，最大 8000
  maxFiles?: number
  includeTests?: boolean
```

#### `map`

输出有 token 预算的仓库地图：

- 入口文件、顶层目录、模块边界；
- 每个文件的语言、行数、导出符号/类/函数；
- 测试文件与源文件的对应关系（可推断时）；
- 按引用关系排序的“先看这里”；
- 截断标记和缓存状态。

不输出完整文件内容，不输出密钥文件内容。

#### `outline`

单文件结构：

- imports/exports；
- 函数、类、接口、类型、常量；
- 行号与简短签名；
- 关联测试（可推断时）。

#### `find`

按符号/词边界查找定义：

- 定义优先，引用其次；
- 返回 `path:line` + 短片段；
- 默认上限 50 条，分页/截断标记；
- 支持大小写敏感和正则，但默认字面量。

#### `references`

词法引用检索：

- 明确标注 `lexical: true`，不冒充 LSP；
- 用于“改这里会动谁”的第一层影响分析；
- 结果有界、去重、按定义/引用分组。

#### 缓存与安全

- 缓存放 `DSH_HOME/patchwork/code-index/<workspace-hash>/`，不写用户仓库。
- 缓存键：workspace realpath + git HEAD + 文件 mtime/size + 配置版本。
- 默认跳过：`.git`、`node_modules`、`dist`、`build`、`coverage`、二进制、压缩包、`.env`、`*.pem`、`*.key`。
- 符号链接必须 realpath 后仍在 workspace 内。
- 不把文件内容写日志；只记录路径 hash、符号数、缓存状态。
- 大仓库有 `maxFiles`、单文件大小、总耗时上限；超限返回截断地图，不阻塞任务。

#### 实现策略

- P0 用纯 Node 正则/轻量扫描，覆盖 JS/TS/MJS、Python、Go、Rust；其他语言回退到文件级 outline。
- 不引入 tree-sitter 原生依赖；如果 P1 证明解析精度是瓶颈，再隔离评估。
- 解析失败不抛出任务级错误，返回 `confidence: low` 和文件级信息。

### 4.2 任务简报：把“人类的工作记忆”外置

扩展 `patchwork_task`，在 `define` 时接受可选 `brief`：

```json
{
  "goal": "修复 sum(2,3) 返回 -1 的问题",
  "successCriteria": ["npm test 通过", "sum.mjs 只改一行"],
  "unknowns": ["是否还有隐藏调用方", "是否需要更新 README"],
  "assumptions": ["当前测试是唯一验收入口"],
  "budget": { "maxSteps": 12, "maxSearchCalls": 6, "maxTokens": 60000 }
}
```

规则：

- 小型只读回答可跳过 brief；
- 多步修改、用户纠正、跨模块任务必须写 brief；
- brief 存入 task state，handoff/压缩后仍可读；
- UI 的任务详情显示 brief、预算和当前消耗；
- 不把 brief 当作授权，只当作范围与停止条件。

### 4.3 探索协议与软守卫

#### 协议（写进 patchwork skill、工具描述、superagent read prompt）

1. 不熟悉的仓库先 `patchwork_code map`；
2. 用 `glob` 窄化目录，再用 `grep`，不要全仓 grep；
3. 用 `outline` 看结构，只读匹配片段；
4. 连续两次没命中，停下来重新 map/outline，不要继续换同义词；
5. 不为了回答 Patchwork 自身工具行为去搜插件源码，先看错误里的 `next`/`inspect` 指引；
6. 到预算就报告“未完成 + 卡点”，不无限试。

#### 软守卫

在 `tools/post-execute` 或 task hook 中统计：

- `read`、`glob`、`grep`、`patchwork_code` 调用次数；
- 归一化参数后的重复查询；
- 无编辑/无 check 的连续探索步数；
- 当前任务预算消耗。

触发条件示例：

- 连续 8 次探索且无 mutation/check；
- 同一 `grep`/`glob` 参数重复 2 次；
- 预算剩余低于 20%。

动作：注入**一次**有界提示，例如：

> 已连续探索 N 步，未产生编辑或验收。优先调用 `patchwork_code map/outline`，缩小到具体文件；不要重复同一查询。

只提示，不硬拦；记录 `exploration-hint` 日志；同一任务最多提示 2 次，避免噪音。

### 4.4 元认知门禁

在现有 check/assessment 之上补三件事：

1. **unknown 显式化**：交付前必须列出未验证项；不能用“应该没问题”代替。
2. **independent verifier**：高风险任务由只读子代理或独立 review 检查证据，不让执行者自评。
3. **false-ready 防护**：所有 required requirement 必须 passed；semantic requirement 未评估时保持 `unknown`，不得为了 ready 降级。

建议新增 `patchwork_task assess` 的明确状态：

```json
{
  "action": "assess",
  "id": "semantic-constraint",
  "status": "supported | unknown | conflict",
  "reason": "...",
  "evidenceIds": ["..."]
}
```

任务最终报告固定包含：

- 已验：哪些 requirement、哪些 receipt；
- 未验：哪些 semantic/行为/环境项；
- 残余风险：最可能出问题的 1–3 点；
- 下一步：需要用户决定或补充证据的事项。

### 4.5 Explore 子代理

目标：把宽泛搜索从主上下文隔离出去，类似 Cursor 的 Explore subagent。

P1 先做薄层，不新建队列：

- 复用 DSH `subagent` 或 superagent `read` 模式；
- 只读、独立上下文、最多 2 轮、每轮最多 6 个并行搜索；
- 返回结构化结果：

```json
{
  "findings": [{ "claim": "...", "path": "src/x.mjs", "line": 42, "quote": "..." }],
  "deadEnds": ["..."],
  "confidence": "high | medium | low",
  "searched": ["..."],
  "truncated": false
}
```

- 主会话只接收 findings + 引用，不接收大段原文；
- 子代理不得编辑、不得再委派、不得把检索内容当指令；
- 失败返回 `blocked`/`unknown`，不伪造结论。

如果薄层稳定，再评估是否加 `patchwork_explore` 工具或 superagent `mode: explore`。

### 4.6 度量与 UI

新增诊断指标：

- `firstUsefulFileStep`：首个被后续编辑/引用命中的文件出现在第几步；
- `readCalls`、`globCalls`、`grepCalls`、`mapCalls`；
- `duplicateQueryRate`；
- `mapHitRate`：map 推荐文件被实际使用的比例；
- `bytesRead`、`tokensBeforeFirstEdit`；
- `falseReady`：标记 ready 但后续检查失败/人工否决的比例；
- `humanInterventions`。

展示：

- 诊断页新增“探索成本”卡片；
- 任务详情显示 brief、预算、探索次数；
- 日志新增 `exploration` 机制和 `map/outline/find/references/hint` 事件；
- 不展示文件内容或敏感路径。

## 5. 数据流

```text
用户请求
  → 任务 brief（目标/成功标准/未知/预算）
  → patchwork_code map（结构先验）
  → outline / glob / grep（选择性注意）
  → 只读片段 + 证据
  → 最小修改
  → check + assess（元认知）
  → 未验项/残余风险
  → 完成或 blocked
```

## 6. 分期

| 阶段 | 交付 | 验收 |
|---|---|---|
| P0 | `patchwork_code map/outline`、缓存、ignore/安全、任务 brief、探索指标 | 单测覆盖解析/忽略/缓存/越界；真实仓库 map 可用；UI 显示指标 |
| P0.5 | 探索协议、软守卫、日志 allowlist | 重复查询能被识别并提示；不阻断合法探索 |
| P1 | `find/references`、explore 薄层、元认知门禁 | 真实模型只读任务步数下降；unknown 不被吞；false-ready 不增加 |
| P2 | 可选 LSP/tree-sitter；可选 embeddding 实验 | 只有 golden set 证明词法漏召回才启用 |

## 7. 验收

自动测试：

- 解析：JS/TS/MJS、Python、Go、Rust + 未知语言回退；
- 忽略：`.gitignore`、node_modules、二进制、密钥文件、符号链接逃逸；
- 缓存：命中、失效、workspace 切换、删除重建；
- 预算：token 上限、maxFiles、超大文件、截断标记；
- scope：标准 preset 不可见、跨会话不可见、Patchwork Agent 可用；
- 守卫：重复查询、连续探索、预算临界；提示只出现一次/两次。

真实模型：

- 12–20 个“人很容易”的任务集：找配置、修 typo、加选项、找测试、依赖升级、UI 文案、简单 bug；
- baseline vs `map` vs `map+explore`，每个 3 次；
- 记录成功率、首个有效文件步数、read/grep/glob、重复查询、token、时间、false-ready；
- 先在 baseline 上定阈值，不预先承诺百分比；没有稳定收益就不进入默认配置。

## 8. 风险与非目标

风险：

- 正则解析误报/漏报；用 `confidence` 和文件级回退缓解；
- 缓存陈旧；用 git HEAD + mtime + 配置版本失效；
- 大仓库构建慢；用 maxFiles/超时/截断；
- 工具 schema 膨胀；只加一个工具，描述保持短；
- 模型忽略提示；用工具默认值和软守卫，不靠长篇 prompt；
- 索引泄露敏感路径；默认跳过密钥/敏感文件，日志只记 hash。

非目标：

- 不模拟意识、情绪、人格；
- 不把完整 repo map 每轮注入 system prompt；
- 不先上 embedding/向量库；
- 不用模型自评代替 check/verifier；
- 不为“像人”而增加多代理表演。

## 9. 与方案 B 的关系

方案 A 是产品能力，方案 B 是验证闭环。A 的收益必须由 B 的真实模型报告证明；B 的场景矩阵应包含 A 的 baseline/map/explore 对照。没有 B，A 容易变成“看起来更聪明”的 prompt 改动。
