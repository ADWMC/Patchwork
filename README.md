# Patchwork

English version: [README.en.md](README.en.md)

## 项目简介

Patchwork 是一个面向 DeepSeek Harness 的代码编写与维护插件。
它采用 Agent + Hook：Agent 负责理解、实现和验证，Hook 负责可机械检查的维护警告。

## 核心行为

- 修改前先调查事实、调用方、配置和测试。
- 会改变实现或验收结果的歧义先询问用户，不凭猜测推进。
- 大功能先按职责/领域拆分，避免数千行单文件。
- 命名表达业务角色，拒绝 `final_new`、`debug3`、`CommonUtils` 等兜底命名。
- 修改后沿原路径验证，并只汇报实际证据。
- 代码、配置或行为变化完成后同步更新受影响文档和 README。
- Hook 发现结构或命名问题时提供专用提示词；同一会话同一问题每 30 轮最多提示一次。

## Agent preset

Patchwork 的完整工具面应在独立 profile 中运行，避免与 helmd 等已经注册
`pwsh/read/...` 的 preset 冲突。复制 `profiles/patchwork` 到 DSH profile 根目录后安装：

```powershell
Copy-Item -Recurse profiles/patchwork "$env:USERPROFILE/.dsh/profiles/patchwork" -Force
pnpm --dir "$env:USERPROFILE/.dsh/profiles/patchwork" install
pnpm --dir "$env:USERPROFILE/.dsh/profiles/patchwork" add "file:$PWD"
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
```

启动独立 profile：`dsh --profile patchwork --no-open`。不要在同一个 DSH 进程内同时挂载 helmd 和 Patchwork 的完整工具 preset。

安装插件后，将宿主 DSH 的 standard preset 派生为 Patchwork：

```powershell
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
Copy-Item presets/patchwork/preset.yml "$env:USERPROFILE/.dsh/.agent-presets/patchwork/preset.yml" -Force
```

然后在 DSH 的 Agent Preset 选择器中选择 `Patchwork`。该 preset 会暴露 DSH standard
的本地 shell、文件、搜索、任务和 Agent 工具，并可在同一进程内安全切换其它 Agent。

## Hook 检查

Hook 同时支持独立 stdin 调用和 DSH 原生 `tools/post-execute` 生命周期。
它接收包含 `cwd` 和 `files` 的 JSON，或从工具参数提取源码路径，返回
`warnings`/`additionalContexts`，不会阻断 Agent：

```powershell
'{"event":"PostToolUse","cwd":"C:\项目","files":[{"path":"C:\项目\debug_final.cpp"}]}' |
  node hooks/patchwork-hook.mjs
```

## 文档

- [工程代理指南 | Engineering agent guide](docs/engineering-agent-guide.md)
- [维护代码提示词 | Maintainable coding prompt](assets/prompts/maintainable-coding-agent-prompt.md)
- [Hook 基础 | Hook foundation](docs/hook-foundation.md)
- [Agent 基础 | Agent foundation](docs/agent-foundation.md)
- [Git 提交规范 | Git commit conventions](docs/git-commit-conventions.md)
- [Preset 与发布经验 | Preset and release lessons](docs/preset-and-release-lessons.md)
- [DeepSeek Harness 插件开发 | Plugin development](docs/deepseek-harness-plugin-development.md)

## Git 提交与推送

完成一个明确任务后提交一次；提交使用 Conventional Commits 格式。
推送必须由用户明确要求；“完成代码后关机/结束”不触发推送。

## 目标

Patchwork 的目标是让代码更容易理解、验证和继续演进，同时减少重复提示和无效 token。
