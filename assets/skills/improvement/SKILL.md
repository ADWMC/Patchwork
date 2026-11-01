---
name: improvement
description: 用户要求根据真实失败或纠正改进 Patchwork 规则、记忆策略、工具流程或界面提示时加载；普通修 bug 或随口偏好不触发。
---

# 受控改进

先找到实际失败、纠正或未验证回执；没有来源就只能提出调查问题，不能宣称“学会了”。`patchwork_improvement` 可用时，按 incident → propose → experiment 记录来源、适用触发、候选动作和回退点。将规则、记忆策略、工具流程、UI 提示分开，不把个人偏好写成通用规则。

`propose` 必须使用真实 incident id，可执行候选另需 typed `patch`（version=1）：`rule/verifyBeforeDelivery=true`、`memory-policy/recallLimit=1..5`、`tool-flow/requireCrossCheck=true`、`ui-copy/reviewDetail=compact|full`。其他自由文本只是提议，不作为可执行代码。范围只支持当前会话，项目共享应用尚未开放。

`experiment` 只传 candidateId 与当前 expectedRevision；由内置 runner 启动两个隔离 Node 进程运行固定调优/留出契约，保留版本、来源、SHA256 和证据文件。不要传入自行编写的 baseline/candidate 成绩；伪造来源、跨会话证据、被改动文件及重启前未重新签发的实验均不可准入。契约通过只说明受限策略能执行且边界正确，不能证明模型回答更好。模型收益实验另需固定模型、宿主、工具、任务及预算，读[实验准入](references/experiment.md)。

`trial`、`approve`、`rollback` 需宿主确认通道里的用户确认和当前 revision。前两者成功后 `applied:true` 才表示本会话受限策略已生效；`rollback` 实际撤销此候选并恢复此前策略。切换 Agent 或卸载立即撤销，重启后不自动继承应用。用户可在“证据 → 改进”查看来源、差异、退化、副作用及证据，再确认或回滚；未确认不能以模型文本自行批准。
