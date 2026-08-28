# Agent 基础

`src/index.mjs` 是 Patchwork 的第一个 DSH Agent 插件入口。

- 导出 `name = patchwork-agent`，供 Cordis 识别插件。
- 声明依赖 `systemPrompt`，将项目的[可维护代码代理提示词](../assets/prompts/maintainable-coding-agent-prompt.md)
  注册为一个系统提示词段落。
- 不修改 Harness 的 agent loop；Agent 行为由一次注册的完整提示词定义。
- Hook 不参与 Agent 提示词注入，避免重复上下文和额外 token；Hook 基础只保留
  独立的宿主安全与生命周期能力。

`src/maintenance-session.mjs` 提供 Agent 与 Hook 共用的最小流程边界：大型任务在
实现前需要研究记录，修改只能落在声明范围内，结束前需要至少一项通过的验证，
过长工具输出可以压缩。它只记录和校验事实，不替 Agent 做语义决策。

## 在 DSH 中挂载

通过本仓库的 `package.json` 和 `cordis.patch.yml` 安装后，DSH 会按 bundle
清单加载 `patchwork-agent`。源码调试也可以在 DeepSeek Harness 源码树中创建
临时 patch 文件，将路径替换为本仓库的绝对路径：

```yaml
- insert:
    - id: patchwork-agent
      name: 'C:/path/to/Patchwork/src/index.mjs'
```

然后启动：

```text
pnpm dsh web --patch ./patchwork.cordis.yml
```

插件加载后，`patchwork-agent` 一次注册的完整提示词会作为系统提示词段落参与
模型请求组装；Hook 不重复注入。

## 最小验证

```text
node --test tests/agent.test.mjs
```

测试使用最小的 `ctx.systemPrompt.section()` 替身，只验证插件注册契约和提示词来源。
