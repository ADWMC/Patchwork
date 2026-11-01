# Patchwork 功能验证基准调研

日期：2026-10-31（Asia/Shanghai）
状态：已固定第一版外部基准参考，并落地 Patchwork 专属隔离题集。

## 结论

Patchwork 的主验证集采用 **Terminal-Bench / Harbor 的任务形态**，而不是直接把某个
模型排行榜当成插件分数。Terminal-Bench 的任务由用户输入、隔离终端环境、测试脚本和
参考解组成，正好对应 Patchwork 需要验证的“真实工具调用、失败可见、边界拒绝和可复现
验收”。Patchwork 的适配器只复用这个形态，不复制 Harbor 或引入其运行时。

本次核查的是官方仓库在 2026-10-31 的公开说明：Terminal-Bench 原仓库仍将 Core
`0.1.1` 标为 beta leaderboard 数据集，约 100 道任务；README 同时引导新用户用 Harbor
运行 Terminal-Bench 2.0。Patchwork 因而只声明“参考任务形态”，不把本地 16 道题写成
Terminal-Bench 2.0 成绩。

外部能力基线补充两套：

| 基准 | 一手来源 | 许可证 | 适合验证 | 在 Patchwork 中的用法 |
|---|---|---|---|---|
| Terminal-Bench / Terminal-Bench 2.0 | [仓库](https://github.com/laude-institute/terminal-bench) · [文档](https://www.tbench.ai/docs) | Apache-2.0 | 终端 Agent 的端到端任务，包含测试脚本和 oracle | 主参考；用相同的 task/test/oracle 结构验证工具、隔离和 UI 证据 |
| SWE-bench Verified | [仓库](https://github.com/SWE-bench/SWE-bench) · [Verified 报告](https://openai.com/index/introducing-swe-bench-verified/) | MIT（仓库） | 真实 GitHub issue 到可测试 patch，Verified 是工程师确认可解的 500 题子集 | 只做代码维护能力的外部对照；不把通过率当作 Patchwork 机制收益 |
| LiveCodeBench | [仓库](https://github.com/LiveCodeBench/LiveCodeBench) | MIT（仓库） | 持续收集、时间切分、污染控制，覆盖生成、执行、自修复和测试预测 | 只做模型/提示变化的 held-out 对照；不适合测 scope、日志或 WebUI |

SWE-bench 官方 README 说明 Verified 是 500 道真实软件问题的工程师确认子集，并采用
Docker 可复现评测；LiveCodeBench 官方仓库提供按发布时间切分的 release 版本和
`pass@1`/`pass@5`，适合防止把旧题记忆误当成能力提升。两者都不替代 Patchwork 的
安全负测。

## 为什么主基准不是 SWE-bench

SWE-bench Verified 能证明一个 Agent 是否解决真实仓库 issue，但题目本身不能覆盖：

- Patchwork Agent 与 standard Agent 的工具目录隔离；
- 切换 preset 后旧工具引用失效；
- 记忆 proposal、确认、CAS、删除和重启恢复；
- 搜索无密钥 fallback、网页不可信标记、robots/SSRF 拒绝；
- 日志脱敏、原生 Session 持久化和 UI token；
- Incident → Candidate → Experiment → Approval → Rollback 的改进闭环。

因此外部基准只回答“代码任务能否完成”，Patchwork 专属题集回答“插件是否按合同工作”。

在此基础上，仓库新增 `benchmarks/coding/` 代码维护题集。它沿用 issue → 隔离工作区 →
公开/隐藏测试 → 参考修复的形状，用 8 道小而真实的维护缺陷覆盖重试、路径边界、脱敏、
排序、JSONL、CAS、任务状态和搜索去重。它用于生成 Patchwork 自己的代码维护营销数据，
不冒充 SWE-bench、Terminal-Bench 或 LiveCodeBench 的官方成绩；oracle 题集质量与真实
Agent 完成率在报告中分开存储。

## Patchwork 题集分层

`benchmarks/patchwork/` 中的题分成三组：

1. **public-marketing**：稳定、可复现、可公开展示用户价值的题。它们只使用本仓库和官方
   DSH 测试组合，不依赖模型随机性。
2. **hidden-regression**：覆盖容易回归的旧回执、并发 CAS、超时取消和上下文边界。题目
   可在 CI 中跑，但不把全部细节放到营销页面。
3. **security-negative**：专门证明“拒绝正确”。跨 scope、伪造 header、旧引用、错误 token、
   恶意网页指令和越界 URL 必须失败；失败被视为通过。

每道题都有 `task`（用户输入和限制）、`oracle`（机器验收）、`humanChecks`（人工/UX
验收）和 `marketing`（允许公开的说法）。题目不包含密钥、用户数据或主 DSH 路径。

## 运行纪律

- 每道题使用独立临时 `DSH_HOME`、结果目录和任务标识；不启动或改写主 DSH。
- 进程通过 `spawn` 的 argv 执行，题目不能包含 shell 字符串拼接。
- 任务只读现有测试和隔离脚本；不下载第三方题库到仓库，也不把外部题库的题面复制进
  AGPL 项目。
- `run-isolated.mjs` 输出每题的退出码、耗时、stdout/stderr 摘要、验收结果和隔离路径。
- 公开报告只展示通过率、拒绝正确率、scope 泄露率、旧引用误用率、失败证据保留率、
  引用支持率、取消/超时停止率和成本/延迟；不会把这些数字写成“模型更聪明”。

## 版本和可比性

首次公开报告必须同时记录：Patchwork commit、Node/DSH 版本、题集版本、宿主模型、
工作区快照、是否联网、每题预算和测试脚本版本。题集更新时增加版本号；旧报告不回写成
新题集结果。外部基准若使用官方 harness，保留其原始 run id 和数据版本；若只采用题目
形态，报告明确标记为“Patchwork contract benchmark”，不能冒充官方排行榜成绩。
