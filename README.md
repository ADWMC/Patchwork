# Patchwork

English version: [README.en.md](README.en.md)

## 项目简介

Patchwork 是一个面向 DeepSeek Harness 的代码编写与维护插件。
它采用 Agent + Hook：Agent 负责理解、实现和验证，Hook 负责可机械检查的维护警告。

## SoL-Pi 机制复刻状态

Patchwork 正在复刻 [SoL-Pi](https://github.com/NVlabs/SoL-Pi) 的四个运行时机制。
开关都是 Cordis 配置项；**actionFusion 默认开启**（它不改变模型可见内容，装上即省
token），其余三个默认关闭：

| 机制 | 配置键 | 状态 |
|---|---|---|
| Action Fusion | `actionFusion` | 已实现并真实宿主验证 |
| ObservationPack | `observationPack` | 已实现并真实宿主验证 |
| Evidence-Preserving Reducer | `evidencePreservingReducer` | 已实现并真实宿主验证 |
| Online Context Compact | `onlineContextCompact` | 已实现并真实宿主验证 |

actionFusion 缺省即启用且加载正常；其余机制按需开启后加载亦不再报错。各机制的
验证边界见 [SoL-Pi 机制复刻设计](docs/solpi-mechanisms-design.md)。目标契约为
DSH 0.1.5-rc.2。

## 核心行为

- 修改前先调查事实、调用方、配置和测试。
- 会改变实现或验收结果的歧义先询问用户，不凭猜测推进。
- 大功能先按职责/领域拆分，避免数千行单文件。
- 命名表达业务角色，拒绝 `final_new`、`debug3`、`CommonUtils` 等兜底命名。
- 修改后沿原路径验证，并只汇报实际证据。
- 代码、配置或行为变化完成后同步更新受影响文档和 README。
- Hook 发现结构或命名问题时提供专用提示词；同一会话同一问题每 30 轮最多提示一次。
- `/patchwork-review` 命令：站在用户立场评审代码——走用户路径找 bug 与体验缺陷，兼顾商业化边界。

## Agent preset

Patchwork 以 DSH bundle 插件注册：安装即对 profile 内所有 agent 生效。

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.1.2.tgz"
```

安装后插件注册 `/patchwork-review` 命令与维护 Hook；`scripts/gen-preset.mjs` 生成的
`patchwork` preset 只提供工具编排（shell、文件、任务等），用于让启用该 preset
的 Agent 拥有完整工具面。插件与 Helmd 等 preset 可共用同一个 profile。

## /patchwork-review 命令

站在用户立场评审代码的主入口：

```text
/patchwork-review [评审范围]
```

Agent 会以目标用户身份走一遍首次价值路径，从用户会犯的错里找 bug，把体验差
当缺陷对待，并检查商业化边界（免费核心完整性、付费边界、安装摩擦）。可当场
修复的最小修复直接实施并沿用户路径验证，其余按已知问题/待决策项汇报。

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
- [SoL-Pi 机制复刻设计 | SoL-Pi mechanisms design](docs/solpi-mechanisms-design.md)
- [维护代码提示词 | Maintainable coding prompt](assets/prompts/maintainable-coding-agent-prompt.md)
- [Hook 基础 | Hook foundation](docs/hook-foundation.md)
- [Agent 基础 | Agent foundation](docs/agent-foundation.md)
- [Git 提交规范 | Git commit conventions](docs/git-commit-conventions.md)
- [Preset 与发布经验 | Preset and release lessons](docs/preset-and-release-lessons.md)
- [DeepSeek Harness 插件开发 | Plugin development](docs/deepseek-harness-plugin-development.md)
- [产品工程指南 | Product engineering guide](docs/product-engineering-guide.md)

## Git 提交与推送

完成一个明确任务后提交一次；提交使用 Conventional Commits 格式。
推送必须由用户明确要求；“完成代码后关机/结束”不触发推送。

## 目标

Patchwork 的目标是让代码更容易理解、验证和继续演进，同时减少重复提示和无效 token。
