# DSH 新会话与 Agent 切换故障排查

## 现象

- 新建会话或切换 Agent 失败；
- API 返回 `agent-preset-invalid`；
- 错误包含 `tool "pwsh" is already registered`、`tool "read" is already registered` 等。

## 根因

注册 Agent 工具的业务包同时由 profile 全局 bundle 和 Agent preset 加载。全局实例
先注册工具，之后 Standard、Patchwork 或 Helmd preset 在自己的 Agent 作用域挂载时，
同名工具发生冲突。

## 当前所有权

- DSH host：共享服务和平台实现；
- Agent preset：承载宿主工具编排（shell、文件、任务等），Patchwork preset 追加
  `@patchwork/coding-agent/runtime`；
- Patchwork package bundle：`cordis.patch.yml` 在 profile 根插入一行
  `@patchwork/coding-agent`，只提供共享 Web 桥接，不在根注册模型行为。

该边界消除了插件的宿主级重复加载。DSH 的 scope 工具注册支持多个完整 preset
并行挂载；Patchwork 保留 Standard 工具行，因此工具能力不削弱。

早期“profile 根装载完整运行时”的修复已被隔离升级替代。当前生成器复制固定
standard fixture 再追加 runtime；测试验证只有 Patchwork 实际组合具有插件工具、
技能和命令，切走后连保留的旧工具引用也不能执行。请勿把 runtime 重复装到 profile 根。

0.1.7-alpha.2 起，preset 本身也必须由 bundle patch 声明：`package.json` 的
`dsh.bundle.patch` 现在列两个文件——`./cordis.patch.yml`（Web 桥接）与
`./presets/patchwork.patch.yml`（`@deepseek-ai/dsh-agent-preset` 声明行）。
`$DSH_HOME/.agent-presets/` 目录已不是激活入口。历史目录无需作为常规排障步骤删除。

## 重新部署

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web remove '@patchwork/coding-agent'
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.2.0.tgz"
```

改过宿主 standard 后重新生成声明文件（默认写回 `presets/patchwork.patch.yml`）：

```powershell
node scripts/gen-preset.mjs
```

安装前确认 profile 的宿主依赖与目标 DSH 版本兼容，不默认追逐 `alpha` 标签。
仓库依赖基线主要为 0.2.0-rc.2，真实验证宿主为 0.2.1-rc.2；这不代表整体依赖已迁移。

需要重启时，只操作明确识别的目标实例。开发验证使用独立 home/agents/work/端口，
不停止或修改主 DSH。运行中的 standing preset mount 不保证安全热替换。

## 验证

```powershell
node --test
dsh --profile web --no-open
```

通过 `agentPreset.select` 或界面依次切换 `standard → patchwork → helmd → standard`。
每次都应成功，且 Patchwork Hook 仅在 `patchwork` 会话中出现。

当前任务工具、纠正后验收与冷启动验证见[统一执行方案](upgrade/2026-10-30-integration.md)。
