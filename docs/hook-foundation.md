# Hook 基础

Patchwork 只将 [Ponytail](https://github.com/DietrichGebert/ponytail) 作为 Hook
设计参考，不直接复用其实现、命名或平台协议。

## 当前边界

Agent 的完整提示词由 `src/index.mjs` 一次注册，Hook 不负责 Agent 提示词注入、
重复提醒或维护阶段状态，避免增加 token 和运行复杂度。

未来如果需要 Hook，应只承载 Agent 之外的独立生命周期能力，并先以 DSH 原生
Cordis 事件契约为准实现。

当前已加入两项可复用基础：`src/hook-stdin.mjs` 提供带超时的 JSON Hook 运行器，
在 stdin 未关闭时返回并释放监听；`tests/hooks-windows.test.mjs` 验证真实入口可在
PowerShell 和 POSIX shell 中直接运行，且不会使用 bash 专属包装语法。

## 待实现的流程门

- **复用检索门**：大型功能在允许进入实现阶段前，要求先完成 GitHub、官方文档
  或现有依赖检索，并记录可复用或不采用的依据。
- **歧义确认门**：当需求缺少会改变实现结果的关键条件时，暂停实现并请求用户
  澄清；低风险歧义才允许使用安全默认值。

这两项是 Hook 的流程控制，不把完整规则重复写进系统提示词。Hook 不负责替代
Agent 做语义判断，而是校验 Agent 是否完成了相应的前置步骤。
