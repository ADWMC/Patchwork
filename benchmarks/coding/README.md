# Patchwork Coding Task Benchmark

这是 Patchwork 的代码维护题集，营销主数据来自真实代码任务，而不是只测插件路由。
题目形态参考 SWE-bench Verified 与 Terminal-Bench：每题包含用户 issue、可修改工作区、
隐藏验收测试和参考修复。

## 两种结果必须分开

`oracle` 模式只验证题目质量：基线应失败，参考修复应通过所有公开和隐藏测试。它可以
证明题目可复现，不能证明模型完成率。

`agent` 模式才计入营销成绩：真实 Patchwork Agent 在独立临时工作区中读取 issue、修改
代码、执行测试，runner 只根据隐藏验收和实际 diff 评分。模型没有完成或越界修改，都计
为失败并保留证据。

## 运行题目质量验证

```powershell
node benchmarks/coding/run-isolated.mjs --mode=oracle
```

默认运行 8 道任务，每题独立临时目录。报告记录基线失败、参考修复通过、改动文件数、
改动行数和测试耗时；不会写入主 DSH 或仓库。要把一次质量验证保存为可审计的仓库报告：

```powershell
node benchmarks/coding/run-isolated.mjs `
  --mode=oracle `
  --run-id=coding-oracle-2026-10-31 `
  --output=benchmarks/coding/reports/2026-10-31-oracle-quality.json
```

报告中的 `oracleTaskQualityRate` 只说明题目能区分有 bug 的基线和参考修复；
`agentTaskPassRate` 在没有真实 Agent run 时保持为空。使用 `--keep` 才会保留临时证据目录，
避免把开发机临时路径写入默认报告。

## 公开营销指标

真实 Agent 运行后，建议发布：

- `agentTaskPassRate`：隐藏测试通过的任务数 / 执行任务数；
- `publicTestPassRate`：公开测试通过率；
- `scopeLeakageRate`：越过当前工作区或调用未授权能力的次数 / 尝试次数；
- `unnecessaryChangeRate`：修改验收范围外文件的任务比例；
- `regressionRate`：修复后原有测试被破坏的任务比例；
- `medianTimeMs`、`medianRequests`、`medianChangedLines`：中位数成本和改动规模。

没有真实 Agent run id、模型、DSH 版本和完整隐藏验收日志时，不得把 oracle 结果写成
“Patchwork 解决了 8/8 代码问题”。对外文案模板见 [营销文案](marketing-copy.md)。

当前仓库内的 [oracle 质量报告](reports/2026-10-31-oracle-quality.json) 可以公开为题集
质量数据；它与 [Patchwork Contract Benchmark 报告](../patchwork/reports/2026-10-31-contract-summary.json)
共同说明题集和插件合同的可复现性。模型完成率仍需单独的隔离 Agent run，不能从这两份
确定性报告推导。

## 接入真实 DSH Agent

runner 不内置模型凭据，也不会读取或复制主 DSH。通过 `--driver` 注入一个本地 DSH 驱动，
驱动必须导出以下函数，并在传入的临时目录中完成一次真实任务：

```js
export async function runTask({ task, issuePath, workspace, dshHome, resultsDir, runId, env }) {
  // 启动隔离 DSH，选择 Patchwork preset，让 Agent 读取 issuePath 并修改 workspace。
  return { status: 'completed', model: 'configured-model', dshVersion: '0.2.x', requestCount: 0, runId }
}
```

运行方式：

```powershell
node benchmarks/coding/run-isolated.mjs `
  --mode=agent `
  --driver=C:/path/to/isolated-dsh-driver.mjs `
  --run-id=coding-agent-YYYY-MM-DD `
  --output=benchmarks/coding/reports/YYYY-MM-DD-agent.json
```

Agent 分数同时要求隐藏测试通过和只修改 `allowedPaths`；越界改动计入
`scopeLeakageRate`。driver 返回值只写入经过白名单过滤的模型、DSH 版本、请求数、耗时、
状态和 run id，凭据、提示词和完整工具原文不会进入报告。
