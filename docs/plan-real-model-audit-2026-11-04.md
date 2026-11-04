# 方案 B：真实模型调用审计闭环（2026-11-04）

## 1. 目标

让每一次真实模型调用都有**可复查、可复现、可归档**的报告，不再把结论只留在聊天或临时目录。

具体目标：

- 每个场景有唯一 `runId`、session ID、prompt hash、模型、DSH 版本、git HEAD、隔离信息；
- 每个结论有原始事件/工具调用/回执/截图支撑；
- 通过/失败/部分通过/未运行四种状态明确，不用“看起来通过”代替；
- 修复后用真实模型复验，而不是只跑单测；
- 主 DSH 全程不被修改、停止或写入；
- 报告可离线校验，不需要重新调用模型。

## 2. 当前缺口

来自 [真实模型审计报告](real-model-audit-2026-11-04.md)：

- A–J、`final`/`rc5`、`regression` 只有临时目录里的 JSONL dump、audit txt 和截图；
- 仓库只有 2026-11-01 的 `docs/checks/*`，不是本轮证据；
- `improvement-real.json` 明确 `modelRequests: 0`，不能算真实模型报告；
- B 会话的记忆 scope 缺陷已修，但没有修复后的真实模型复验；
- D/I 同一只读任务出现两种行为，样本不足；
- E–H/J 只有截图，没有文本/JSON 结论；
- 本轮 431 tests、UI 19 checks、rc.5 冷启动 0 disabled 只出现在聊天，没有仓库 JSON。

## 3. 设计

### 3.1 目录布局

```text
docs/checks/real-model/
  2026-11-04/
    index.json
    <run-id>/
      manifest.json
      prompt.md            # 脱敏或仅保留 hash
      events.jsonl         # 归一化事件，不含密钥
      tool-calls.json      # 工具名、参数 hash、结果状态
      result.json          # 断言结果、状态、失败原因
      report.md            # 人读报告
      screenshots/
      session.sha256       # 原始 session 文件 hash，不提交原件
```

原则：

- 仓库**不存**真实模型原始/脱敏证据；报告目录放在仓库外的隔离目录，仓库只保留生成器与校验器。
- prompt 可能含用户隐私：默认只存 `prompt.sha256` + 脱敏文本；需要完整 prompt 时由用户显式批准。
- 截图如含敏感信息，先裁剪/遮罩再存入本地证据目录。

### 3.2 manifest schema

```json
{
  "schemaVersion": 1,
  "runId": "2026-11-04T01-00-00Z_task-check",
  "scenario": "task-check",
  "status": "passed | failed | partial | skipped",
  "startedAt": "2026-11-04T01:00:00Z",
  "endedAt": "2026-11-04T01:02:30Z",
  "gitHead": "9b606d1...",
  "packageVersion": "0.2.1-rc.5",
  "dshVersion": "0.2.1-rc.5",
  "model": { "provider": "stepfun", "id": "step-5-preview" },
  "preset": "patchwork",
  "isolation": {
    "dshHomeHash": "...",
    "workspaceHash": "...",
    "port": 4327,
    "mainDshTouched": false,
    "mainDshBeforeHash": "...",
    "mainDshAfterHash": "..."
  },
  "prompt": { "path": "prompt.md", "sha256": "..." },
  "session": { "id": "session-...", "rawSha256": "...", "eventCount": 105 },
  "assertions": [
    { "id": "check-output-present", "status": "passed", "detail": "..." },
    { "id": "no-standalone-shell", "status": "passed", "detail": "..." }
  ],
  "artifacts": [
    { "path": "report.md", "sha256": "..." },
    { "path": "screenshots/after.png", "sha256": "..." }
  ],
  "redactions": ["api-key", "absolute-user-path"],
  "limitations": ["single run; model nondeterminism"]
}
```

### 3.3 scenario schema

```json
{
  "id": "memory-project-scope",
  "title": "project-shared inspect requires explicit scope",
  "prompt": "propose 一条 project-shared 记忆，然后 inspect 不带 includeProject，再带 includeProject",
  "setup": { "fixture": "empty-workspace", "seed": ["README.md"] },
  "expect": {
    "tools": ["patchwork_memory"],
    "forbidden": ["pwsh"],
    "assertions": [
      "propose.status == committed",
      "inspect.failureCode == MEMORY_PROJECT_SCOPE_REQUIRED",
      "inspectIncludeProject.record != null"
    ]
  },
  "timeoutMs": 180000,
  "runs": 3
}
```

断言分层：

- **硬断言**：工具调用存在/不存在、状态码、receipt 通过、无独立 shell、无越权；
- **软断言**：模型是否先 map、是否重复查询、步数/ token 阈值——用于效率报告，不单独判失败；
- **禁止项**：改主 DSH、读取密钥、越权访问、自动接纳 review、绕过权限。

### 3.4 runner

新增 `scripts/real-model-audit.mjs`，手动运行，不进入普通 CI：

```bash
node scripts/real-model-audit.mjs \
  --scenario memory-project-scope \
  --runs 3 \
  --model step-5-preview
```

职责：

1. 校验主 DSH 未被触碰：记录主 `DSH_HOME`、进程/端口、关键文件 hash；结束后复核。
2. 创建唯一隔离目录：`DSH_HOME`、workspace、results、端口、chromium profile。
3. 通过现有 `tests/real-composition` harness 或真实 CLI 启动 Patchwork preset。
4. 用 Playwright/headless 驱动真实 UI 与模型；不支持时至少走真实会话 API。
5. 收集 session `*.jsonl.zstd`，用现有 multiframe 解压脚本归一化。
6. 执行硬断言；软断言写入趋势数据。
7. 生成 `manifest.json`、`events.jsonl`、`tool-calls.json`、`result.json`、`report.md`、截图。
8. 清理进程和临时目录；保留原始 session hash。

安全：

- API key 只从进程环境读取，不写入命令行、manifest、日志、截图；
- prompt/输出先过秘密扫描；命中则脱敏或拒绝入库；
- 任何 `mainDshTouched: true` 直接 fail，不生成“通过”报告；
- 网络失败、超时、模型 429 诚实标记 `failed/partial`，不重试到“绿”。

### 3.5 report generator

`report.md` 固定结构：

1. 场景与目标；
2. 环境（DSH/模型/preset/git/隔离）；
3. prompt（脱敏）；
4. 实际工具调用序列；
5. 断言结果（passed/failed/partial）；
6. 关键证据（receipt id、hash、截图）；
7. 偏差与局限（模型波动、单次运行、网络）；
8. 结论：只写证据支持的结论。

`index.json` 汇总：

```json
{
  "date": "2026-11-04",
  "runs": [
    { "runId": "...", "scenario": "task-check", "status": "passed", "report": "..." },
    { "runId": "...", "scenario": "memory-project-scope", "status": "partial", "report": "..." }
  ],
  "coverage": {
    "task": "passed",
    "memory": "partial",
    "superagent": "failed",
    "ui": "not-run"
  }
}
```

`not-run` 必须显示，不能用空白代替。

### 3.6 离线 verifier

新增 `scripts/verify-real-model-audit.mjs`，不调用模型：

- manifest schema 校验；
- 文件 hash 与 manifest 一致；
- session ID 与事件一致；
- 断言状态与 result 一致；
- 无密钥/敏感字段；
- `mainDshTouched` 必须为 false；
- `prompt.md` 与 `prompt.sha256` 一致；
- 每个 `passed` 至少有一个证据引用；
- `partial/failed/skipped` 必须有原因。

命令：

```bash
node scripts/verify-real-model-audit.mjs /path/to/external-audit-dir
```

只在本地对仓库外证据目录做离线检查，不进入 CI，也不消耗模型额度。

## 4. 场景矩阵

| 场景 | 目的 | 关键断言 | 运行次数 |
|---|---|---|---|
| `smoke-ok` | 启动、preset、模型、UI | 模型返回 OK；无工具调用；无错误 | 1 |
| `task-check-output` | 任务 check 输出与 artifact 有效性 | check 返回 output；无 check 后独立 shell；artifact current | 3 |
| `memory-project-scope` | project-shared 可见性 | 无 includeProject 返回 `MEMORY_PROJECT_SCOPE_REQUIRED`；带 includeProject 可读 | 3 |
| `superagent-read` | 只读任务是否过度验收 | read + report；不强制 task/语义验收；状态 ready 或 review 有理由 | 3 |
| `fetch-evidence` | 公开抓取与引用 | fetch 成功；evidence cite committed；无 SSRF/robots 绕过 | 1 |
| `ui-panels` | 面板完整性 | 六个 tab、动态子页、空状态、错误状态、无 console error | 每个 viewport 1 |
| `fresh-profile` | rc.5 全新 profile 冷启动 | 0 disabled、0 pending、工具目录完整 | 1 |
| `skill-load` | 技能路由 | 模型按任务加载正确技能；标准 preset 不可见 | 2 |

## 5. 缺口关闭顺序

1. **迁移现有原始证据**：A–J、final/rc5、regression 在仓库外目录生成 manifest/report（不重跑），不写入 Git。
2. **B 的真实模型复验**：修复 `MEMORY_PROJECT_SCOPE_REQUIRED` 后，跑 `memory-project-scope` 3 次。
3. **D/I 重复实验**：同一只读 README 任务 3 次，统计 task 登记率、report 状态、步数。
4. **E–H/J 文本化**：补 tab/控件/console error/布局断言；没有文本的截图不算报告。
5. **c87 失败归档**：记录 Windows Job runner 失败、根因、fresh profile 修复证据；不要只留失败会话。
6. **本轮 closure**：当前测试数、UI 验收、rc.5 冷启动、主 DSH 未触碰，写在仓库外 closure 目录，不上传 Git。
7. **聚合索引**：`index.json` 明确 `passed/partial/failed/not-run`；没有跑的场景必须写 `not-run`。

## 6. 分期

| 阶段 | 交付 | 验收 |
|---|---|---|
| P0 | manifest/scenario schema、report generator、离线 verifier、迁移 A–J | 本地 `node scripts/verify-real-model-audit.mjs <目录>` 通过；每个 run 有报告；无密钥 |
| P1 | runner、task-check、memory-scope、superagent-read 三个场景 | 3 次运行有稳定结论；B 修复后真实模型通过或明确 partial |
| P2 | UI 面板、fresh-profile、skill-load、完整矩阵 | 覆盖矩阵无空白；partial/failed 有原因；可重复 |
| P3 | 可选 CI 离线校验、趋势报表 | 不消耗模型额度；历史报告可比较 |

## 7. 验收

- 每个真实模型调用有 `runId`、session ID、manifest、report、证据 hash；
- `passed` 不靠模型自述，必须有工具回执/断言/截图；
- `partial` 和 `failed` 不被隐藏；
- B 修复后有真实模型复验；
- D/I 有重复样本，能区分模型波动和产品缺陷；
- E–H/J 有文本/JSON，不只是截图；
- 主 DSH `mainDshTouched: false`；
- 报告里没有 API key、cookie、私有 prompt 正文；
- 离线 verifier 可独立复跑。

## 8. 风险与边界

风险：

- 模型非确定性：用多次运行和软/硬断言分离；
- API 成本：手动运行、按场景预算、只跑必要矩阵；
- UI 自动化不稳定：优先走真实会话事件，UI 只做面板验收；
- 临时目录被清理：报告和 hash 入库，原始 session 不依赖长期 Temp；
- session 格式变化：归一化层做版本适配，失败时保留原始证据；
- prompt 隐私：默认脱敏，完整 prompt 需显式批准。

边界：

- 这不是模型能力排行榜；
- 不承诺“所有场景永远通过”；
- 不把单次真实调用当成统计结论；
- 不把 `modelRequests: 0` 的工具测试算作真实模型报告；
- 不为了报告好看而重试到通过。

## 9. 与方案 A 的关系

方案 A 的 `map/explore/guard` 必须通过方案 B 的 `baseline/map/explore` 对照场景验证。B 不通过，A 不进入默认配置；A 没有收益，B 也不需要扩展场景矩阵。
