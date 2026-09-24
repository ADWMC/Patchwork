# Agent 基础

`src/index.mjs` 是 Patchwork 的第一个 DSH Agent 插件入口。

- 导出 `name = patchwork-agent`，供 Cordis 识别插件。
- 声明依赖 `skills`、`commands`、`tools`（**无 `systemPrompt`**）；读取
  `assets/skills/*/SKILL.md` 经 `ctx.skills.register` 注册七条技能，目录只带
  name + description，正文由宿主 `skill` 工具按需加载（见
  [协作技能架构](architecture-collaborator-skills.md)）。
- 声明依赖 `commands`，注册 `/patchwork-review` 斜杠命令（`src/review/review-command.mjs`）：
  站在用户立场评审代码的主入口。命令把[用户视角评审提示词](../assets/prompts/user-review-prompt.md)
  作为一条用户消息经 `agent.followup` 提交给 Agent 执行，支持可选的评审范围参数。
- 不修改 Harness 的 agent loop；Agent 行为由六条按需加载的技能与 Hook 短码约束，
  不占用系统提示词。
- Hook 不参与规则正文注入，避免重复上下文和额外 token；Hook 基础只保留
  独立的宿主安全与生命周期能力。

## 在 DSH 中挂载

包通过 `dsh.bundle` 声明 bundle patch（`cordis.patch.yml`），patch 在 profile
根插入 `patchwork-agent` 一行：

```yaml
- insert:
    - id: patchwork-agent
      name: '@patchwork/coding-agent'
```

`dsh plugin --profile <name> add @patchwork/coding-agent` 会安装依赖并把该
bundle 并入 profile 的层栈——插件（七条技能、`/patchwork-review` 命令、
结构与证据 Hook）随即对 profile 内所有 agent 注册生效，无需编辑任何 preset。命令插件注入的
`commands` 服务由每个 profile 的第一层 `@deepseek-ai/dsh-base` 提供。

`presets/patchwork.patch.yml` 是同一个 bundle 声明的 `patchwork` agent preset
（0.1.7-alpha.2 起 preset 只能这样声明，`$DSH_HOME/.agent-presets/` 已无读者）。
它由 `scripts/gen-preset.mjs` 逐字搬运宿主 standard 的行，只承载工具编排
（shell、文件、任务等），不再重复挂载插件本体；插件也可与 Helmd 等
其他 preset 共用。切换 preset 不卸载插件；从 profile 移除 bundle
（`dsh plugin --profile <name> remove`）才是卸载。

## 最小验证

```text
node --test
```

测试验证插件注册契约、`/patchwork-review` 命令契约、配置校验、结构警告的冷却与
工作区过滤，以及 bundle patch / preset / profile 三处的挂载声明一致性。
