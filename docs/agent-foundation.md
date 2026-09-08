# Agent 基础

`src/index.mjs` 是 Patchwork 的第一个 DSH Agent 插件入口。

- 导出 `name = patchwork-agent`，供 Cordis 识别插件。
- 声明依赖 `systemPrompt`，将项目的[可维护代码代理提示词](../assets/prompts/maintainable-coding-agent-prompt.md)
  注册为一个系统提示词段落。
- 声明依赖 `commands`，注册 `/patchwork-review` 斜杠命令（`src/review-command.mjs`）：
  站在用户立场评审代码的主入口。命令把[用户视角评审提示词](../assets/prompts/user-review-prompt.md)
  作为一条用户消息经 `agent.followup` 提交给 Agent 执行，支持可选的评审范围参数。
- 不修改 Harness 的 agent loop；Agent 行为由一次注册的完整提示词定义。
- Hook 不参与 Agent 提示词注入，避免重复上下文和额外 token；Hook 基础只保留
  独立的宿主安全与生命周期能力。

`src/maintenance-session.mjs` 提供 Agent 与 Hook 共用的最小流程边界：大型任务在
实现前需要研究记录，修改只能落在声明范围内，结束前需要至少一项通过的验证，
过长工具输出可以压缩。它只记录和校验事实，不替 Agent 做语义决策。

## 在 DSH 中挂载

包通过 `dsh.bundle` 声明 bundle patch（`cordis.patch.yml`），patch 在 profile
根插入 `patchwork-agent` 一行：

```yaml
- insert:
    - id: patchwork-agent
      name: '@patchwork/coding-agent'
```

`dsh plugin --profile <name> add @patchwork/coding-agent` 会安装依赖并把该
bundle 并入 profile 的层栈——插件（维护提示词、`/patchwork-review` 命令、
结构 Hook）随即对 profile 内所有 agent 注册生效，无需编辑任何 preset。命令插件注入的
`commands` 服务由每个 profile 的第一层 `@deepseek-ai/dsh-base` 提供。

`scripts/gen-preset.mjs` 生成的 `patchwork` preset 只承载宿主工具编排
（shell、文件、任务等），不再重复挂载插件本体；插件也可与 Helmd 等
其他 preset 共用。切换 preset 不卸载插件；从 profile 移除 bundle
（`dsh plugin --profile <name> remove`）才是卸载。

## 最小验证

```text
node --test tests/agent.test.mjs tests/review-command.test.mjs tests/preset.test.mjs
```

测试验证插件注册契约、`/patchwork-review` 命令契约，以及 bundle patch / preset /
profile 三处的挂载声明一致性。
