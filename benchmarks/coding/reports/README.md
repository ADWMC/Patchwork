# Coding benchmark reports

这里保存可审计的代码维护题集运行结果。报告必须说明题集版本、run id、模式和指标含义。

- `mode: oracle`：验证基线是否失败、参考修复是否通过公开与隐藏测试；可用于证明题集质量。
- `mode: agent`：只有真实 Patchwork Agent 在隔离 DSH 中运行后才可填写；必须同时记录模型、
  DSH 版本、隔离 `DSH_HOME`、工作区、隐藏测试输出、请求数、耗时和改动规模。

`oracleTaskQualityRate` 不等于 `agentTaskPassRate`。缺少真实 Agent 证据时，后者保持空值，
不能填成 0、100% 或从参考修复推算。
