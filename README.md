# Patchwork

English version: [README.en.md](README.en.md)

## 项目简介

Patchwork 是一个面向 DeepSeek Harness 的代码编写与维护插件。
它采用 Agent + Hook：Agent 负责理解、实现和验证，Hook 负责可机械检查的维护警告。

## 核心行为

- 修改前先调查事实、调用方、配置和测试。
- 大功能先按职责/领域拆分，避免数千行单文件。
- 命名表达业务角色，拒绝 `final_new`、`debug3`、`CommonUtils` 等兜底命名。
- 修改后沿原路径验证，并只汇报实际证据。
- Hook 发现结构或命名问题时提供专用提示词；同一会话同一问题每 30 轮最多提示一次。

## Agent preset

安装插件后，将宿主 DSH 的 standard preset 派生为 Patchwork：

```powershell
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
Copy-Item presets/patchwork/preset.yml "$env:USERPROFILE/.dsh/.agent-presets/patchwork/preset.yml" -Force
```

然后在 DSH 的 Agent Preset 选择器中选择 `Patchwork`。DSH 升级后重新运行生成命令，
它会保留宿主工具行，只更新 Patchwork persona。

## Hook 检查

Hook 接收包含 `cwd` 和 `files` 的 JSON，返回 `warnings`，不会阻断 Agent：

```powershell
'{"event":"PostToolUse","cwd":"C:\项目","files":[{"path":"C:\项目\debug_final.cpp"}]}' |
  node hooks/patchwork-hook.mjs
```

## 文档

- [工程代理指南 | Engineering agent guide](docs/engineering-agent-guide.md)
- [维护代码提示词 | Maintainable coding prompt](docs/maintainable-coding-agent-prompt.md)
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
