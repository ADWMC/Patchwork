# SoL 机制真实任务实验

> 实施索引（2026-10-30）：采用项、实际接线、隔离宿主验证与剩余边界见[统一融合执行方案](../../upgrade/2026-10-30-integration.md)。本文保留研究或历史审计的原始范围，不把建议与历史数字改写成当前能力。

日期：2026-10-30。状态：四类真实任务已执行，代码修复与最终回归已完成。

完整结论、失败样本、上游源码依据与后续优先级见 [实验报告](report.md)。逐次请求、工具、usage 与验收结果见 [results-summary.json](results-summary.json)。证据复核见 [evidence-summary.json](evidence-summary.json)。

## 目标与约束

在独立 DSH_HOME、agents 和任务工作区中，通过官方 DSH 和同一个 StepFun 模型运行任务。主 DSH 与已有会话不改动。每次实验保留输入、实际工具调用、模型 usage、额外 reducer 调用、退出码与任务验收；不用融合次数推算费用节省。

已运行的任务来自本仓库实际待办：

1. 修复 OCC 首次提交历史 completed 被误计为新完成边界，增加回归测试。比较 AF 关闭/开启的同一任务。
2. 分析真实失败测试日志。全量 pilot 受环境影响后，改用同一固定副本的两文件定向测试，比较原文、模型 reducer 与本地结构化 reducer。非零退出必须保留。
3. 分阶段代码审查后，由实验 driver 显式调用 native compaction，验证取消、成功、重复失败和压缩后回归；另用空会话验证 native no-op。这不等于 OCC 自动经济策略已测得收益。
4. 盘点真实 src/tests 文件及 SHA256，验证 OP 首尾摘录能否直接回答总数与末两文件哈希。

任务副本固定在实验开始时的工作区快照，避免 A/B 之间源码变化。单次对照只作方向性诊断，不作为统计显著的成本收益结论。优先修复正确性与重复开销，再评估策略参数。

## 调研基线

SoL-Pi 本地与远端 HEAD 均为 `219568034fa54ed121ede80961655e33dfb9d0e3`（2026-10-30核对）。DSH 源码基线为 `dsh-v0.2.1-rc.2`，实际依赖兼容性按各实验单独记录。

## 复核

原始事件、归档和独立任务副本保存在本机临时实验目录，不进入发布包。没有凭据写入本目录。默认临时目录为 `$env:TEMP\patchwork-sol-bench-20261030`。

```powershell
$env:SOL_LAB = "$env:TEMP\patchwork-sol-bench-20261030"
node docs/experiments/2026-10-30-solpi/summarize.mjs
node docs/experiments/2026-10-30-solpi/verify-evidence.mjs
node --test
node scripts/build-client.mjs --check
git diff --check
```

`dsh-runner.mjs` 是官方 CLI 中加载的实验 driver，显式组合 Patchwork preset，使用真实 agent、LLM、工具和 session。它不是宿主的默认 headless runner，也不是合成 agent。原始实验已结束，复核脚本不调用模型。重新运行模型任务须另建独立 DSH_HOME，并通过进程环境提供凭据；不能直接复用主 DSH。
