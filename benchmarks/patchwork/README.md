# Patchwork Contract Benchmark

这是一套验证 Patchwork 插件“是否按合同工作”的题集。题目形态参考
[Terminal-Bench](https://github.com/laude-institute/terminal-bench) 的 task/test/oracle，
但题目、脚本和分数都属于 Patchwork，不是官方 Terminal-Bench leaderboard 结果。

## 运行

在仓库根目录执行：

```powershell
node benchmarks/patchwork/run-isolated.mjs
node benchmarks/patchwork/run-isolated.mjs --suite=public-marketing
node benchmarks/patchwork/run-isolated.mjs --task=real-dsh-composition --json
```

每道题都会拿到独立临时 `DSH_HOME` 和结果目录。命令通过 argv 启动，不经过 shell；
默认不会修改仓库和主 DSH。`--keep` 只在排查失败时保留临时题目目录。

## 题集

| 套件 | 题数 | 用途 |
|---|---:|---|
| `public-marketing` | 8 | 可复现的用户价值演示 |
| `hidden-regression` | 4 | 不适合针对题目优化的回归覆盖 |
| `security-negative` | 4 | 以正确拒绝为通过的安全负测 |

机器验收会检查退出码、测试跳过、超时和输出约束；每题还附有人工/UX 验收项。公开
报告建议只发布整套结果、题集版本、DSH/Node 版本和隔离条件，不发布“模型能力提升”的
推断。

## 推荐营销指标

- **Contract pass rate**：通过的确定性宿主合同题 / 执行题总数；
- **Scope leakage rate**：未授权 Agent 看到或执行 Patchwork 能力的次数 / scope 检查次数；
- **Stale reference misuse rate**：旧引用被接受的次数 / 旧引用尝试次数；
- **Failure evidence retention**：失败后仍可回查来源、状态和原因的比例；
- **Security refusal rate**：SSRF、错误 token、伪造 scope、旧 revision 等预期拒绝的正确率；
- **Real host smoke**：官方 DSH 组合中的真实宿主题是否全通过。

这些指标说明插件的可验证性、隔离性、可回滚性和失败可见性。模型解题能力要另跑
SWE-bench Verified、LiveCodeBench 或官方 Terminal-Bench，并保留原始 run id。

对外发布时可直接使用 [营销文案与边界](marketing-copy.md)，其中的事实都对应公开题集
的机器验收结果，并列出了不能从题集推断的宣传语。
