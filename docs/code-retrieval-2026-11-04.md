# 本地代码检索与探索成本（2026-11-04）

本轮把“模型反复翻源码树”的问题落成一个只读代码检索工具、一个任务简报字段、一个只读 explore 模式，以及一套真实模型审计证据。实现以可维护性为先：不引入向量库、不引入原生解析依赖、不修改主 DSH。

## 1. `patchwork_code`

单一工具，五个动作：

| 动作 | 用途 | 主要边界 |
|---|---|---|
| `map` | 仓库地图：入口、模块、文件、符号、测试分布 | 默认 2000 token 预算，最大 8000；超限截断 |
| `outline` | 单文件符号、导入、测试/生成标记 | 只读索引，不返回整文件 |
| `find` | 符号定义，定义优先 | 结果有界，默认 30 条 |
| `references` | 词法引用，明确不是 LSP | 结果有界，标注 `lexical: true` |
| `search` | 字面量、词边界、正则检索 | 默认 30 条，单文件最多 5 条匹配 |
| `graph-status` | 读取工作区配置和启动状态 | 不建索引 |
| `graph-enable` | 创建/更新 `.patchwork/config.json`，启用工作区代码图 | 只写配置，不建索引 |
| `graph-start` | 按工作区配置建索引并标记为已启动 | 模型显式调用；默认关闭 |
| `graph-stop` | 停止当前进程内的代码图会话 | 删除索引缓存需另做 |
| `callers` / `callees` | 词法调用者 / 被调用者 | 近似结果，标注 `lexical: true` |
| `impact` | 反向调用影响面，默认深度 2 | 最多 4 层、80 个节点 |
| `affected` | 通过 import 边找受影响测试 | 不是测试覆盖率证明 |

## 2. 工作区配置文件

代码图默认关闭；模型必须先显式启用，再由模型启动：

```json
{
  "schemaVersion": 1,
  "codeGraph": {
    "enabled": true,
    "maxFiles": 4000,
    "maxFileBytes": 524288,
    "tokenBudget": 2000,
    "exclude": ["generated/**"]
  }
}
```

路径：`<workspace>/.patchwork/config.json`。

- 文件不存在：代码图关闭，普通 `map/outline/find/search` 仍可用。
- `graph-enable`：创建/合并配置并置 `enabled: true`，不建索引。
- `graph-start`：读取配置、建索引并标记当前进程已启动；未启用时返回 `CODE_GRAPH_DISABLED`。
- `callers/callees/impact/affected`：未启动时返回 `CODE_GRAPH_NOT_STARTED`。
- `exclude` 只影响当前工作区；索引仍放在 `DSH_HOME`，不写 `.patchwork` 缓存。
- 配置由模型显式写入，但不是权限授予；`patchwork_code` 仍然是只读代码检索。

这个实现是 Patchwork 原生轻量代码图：**不依赖 CodeGraph 的 256MB 平台包、MCP 服务、文件 watcher 或遥测**。调用图和影响面是词法近似，不是 CodeGraph 的完整 Rust 解析器；如果后续真实任务证明需要动态分派/跨语言桥接，再评估可选 CodeGraph adapter，而不是把它塞进主包。

安全与生命周期：

- 只读取 `agent.session.header.cwd` 指向的工作区；绝对路径必须 realpath 后仍在工作区内。
- 跳过 `.git`、`node_modules`、`dist`、`build`、`coverage`、二进制/压缩包、`.env`、`*.pem`、`*.key` 等。
- 索引缓存在 `DSH_HOME/patchwork/code-index/<workspace-hash>/`，不写用户仓库；按 git HEAD、文件 mtime/size 复用，`refresh:true` 强制重建。
- 日志只记录动作、耗时、结果数量；不记录文件正文或查询原文。
- 超过 `maxFiles` 或解析失败时返回截断/低置信地图，不阻塞任务。

## 3. 任务简报

`patchwork_task define` 支持可选 `brief`：

```json
{
  "goal": "修复 sum(2,3) 返回 -1",
  "successCriteria": ["npm test 通过"],
  "unknowns": ["是否还有隐藏调用方"],
  "assumptions": ["当前测试是唯一验收入口"],
  "budget": { "maxSteps": 12, "maxSearchCalls": 6, "maxTokens": 60000 }
}
```

brief 随任务 checkpoint/handoff 保存，在任务页显示；它不是授权，也不替代 artifact/check。单次只读回答可以跳过。

## 4. 探索软守卫

运行时统计 `read/grep/glob/patchwork_code` 调用、重复查询和读入字节。连续 8 次探索且没有编辑时，下一次 `agent/pre-step` 注入一次有界提示：

> 已连续进行多次源码探索且尚无编辑或验收。先用 `patchwork_code map/outline` 缩小范围；不要重复同一 grep/glob；到预算就报告卡点。

只提示一次，不硬拦；日志记录 `exploration-hint`，不记录查询正文。

## 5. Explore 只读子代理

`patchwork_superagent` 的 job `mode` 新增 `explore`：

- 只允许读取/代码检索，禁止 shell、编辑和命令验收；
- 不要求登记 `patchwork_task`，避免简单查找被 task 流程放大；
- 要求返回 `findings[{claim,path,line,quote}]`、`deadEnds`、`searched`、`confidence`；
- 主控仍使用原生 Session 隔离，子会话的报告不是最终验收。

## 6. 真实模型证据

2026-11-04 的隔离 DSH + StepFun `step-5-preview` 调用结论如下；原始报告不再随仓库上传：

- `code-map-2e17`：`map → find → references → search` 全部成功，0 工具错误；模型报告 `sum.mjs:1` 定义、`sum.test.mjs:3/6` 引用，未用 shell/公网搜索。
- `code-pre-fix-4ef7`：修复前同一类调用出现 5 次 `not lossless JSON`，保留为失败样本；修复后上述会话通过。
- `memory-scope-87d4`：`MEMORY_PROJECT_SCOPE_REQUIRED` 后带 `includeProject:true` 成功读取。
- `task-check-db31`：较旧 `patchwork` profile 上 brief/artifact 结构检查通过、未使用独立 shell；命令 check 被 Windows Job runner 基础设施错误阻塞，任务标记 `blocked`。同一代码在全新 `regression` profile 的 `task-check-pass-5448` 通过：brief + artifact + `npm test` 实际输出 1 pass / 0 fail，任务 `ready`。
- `native-graph-2a85`：模型按需 `graph-status → graph-start → callers/callees/impact/affected` 全部成功；`addChain` 调用链为 `runChain → addChain → helper`，`chain.test.mjs` 被识别为受影响测试；`.patchwork/config.json` 已创建。修复前的 `native-graph-pre-fix-1477` 保留 schema 错误样本。
- 旧会话 A–D/I/regression/6b6e/b7f9/c87/final/rc5 已在本地迁移；其中 A 的独立 shell、B 的旧 scope 行为、c87 的 runner 失败均保留为本地失败/历史证据，不入库。

本地离线校验：

```bash
node scripts/verify-real-model-audit.mjs /path/to/external-audit-dir
```

校验 manifest schema、文件哈希、session id、断言和 `mainDshTouched:false`；不调用模型。

## 7. 配置与 UI

设置新增 3 项（共 26 项）：

- `codeEnabled`：启用/关闭本地代码检索；
- `codeMaxFiles`：索引文件上限，100–20000；
- `codeTokenBudget`：地图默认 token 预算，400–8000。

诊断/能力页新增“本地代码检索”和“探索成本”卡片；代码卡片显示工作区配置路径、启用/启动状态、地图/检索/调用影响/图启动计数。任务页显示 brief。所有计数是进程内动作，不代表召回率、正确率或 token 收益。

日志新增 `code` 机制，`graph-status/enable/start/stop`、`callers/callees/impact/affected`、`map/outline/find/references/search` 均记录 start/success/failure；日志面板的机制筛选显示“代码检索”，原因码有中文说明。日志只记录动作、耗时和结果数量，不记录文件正文、查询原文或工作区绝对路径。

## 8. 边界

- 词法 `references` 不是 LSP；跨文件类型推断、重命名和语义引用仍需人工或后续 LSP 实验。
- `affected` 支持相对 import 和 `tsconfig.json`/`jsconfig.json` 的 `paths` 别名；包名导入、条件 `exports` 仍可能漏。
- `callers`/`callees`/`impact` 返回 `targets` 和 `ambiguous`；同名符号跨文件时先看目标，不能把合并结果当语义唯一。
- 当前不引入 tree-sitter/embedding；若真实任务集证明词法漏召回，再按[人类式认知方案](plan-human-like-agent-2026-11-04.md) P2 隔离评估。
- `map/search` 的文件 token 使用 Bloom 预筛；查询有英文标识符时只扫描可能命中的文件，无 token 或正则查询才回退全量扫描。
- 索引缓存是性能优化，不是权威源；删除缓存后重建不得复活已删除文件内容。
- 真实模型报告是单次运行证据，不是普遍正确性声明。
