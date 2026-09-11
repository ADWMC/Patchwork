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
- Agent preset：承载宿主工具编排（shell、文件、任务等），不重复挂载插件本体；
- Patchwork package bundle：`cordis.patch.yml` 在 profile 根插入一行
  `@patchwork/coding-agent`，安装即对 profile 内所有 agent 生效。

该边界消除了插件的宿主级重复加载。DSH 的 scope 工具注册支持多个完整 preset
并行挂载；Patchwork 保留 Standard 工具行，因此工具能力不削弱。

本次修复当时采用的边界是「preset 按 session 作用域加载插件、bundle patch 置空」；
后续改为由 bundle patch 注册，preset 因此不再承载插件本体。`scripts/gen-preset.mjs`
生成的 preset 只保留宿主工具行，`tests/preset.test.mjs` 断言它不含
`@patchwork/coding-agent`。切换 preset 不卸载插件；从 profile 移除 bundle 才卸载。

## 重新部署

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web remove '@patchwork/coding-agent'
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.1.2.tgz"
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
Copy-Item presets/patchwork/preset.yml "$env:USERPROFILE/.dsh/.agent-presets/patchwork/preset.yml" -Force
```

完全退出旧 DSH 进程后重启。运行中的 standing preset mount 不保证安全热替换。

## 验证

```powershell
node --test
dsh --profile web --no-open
```

通过 `agentPreset.select` 或界面依次切换 `standard → patchwork → helmd → standard`。
每次都应成功，且 Patchwork Hook 仅在 `patchwork` 会话中出现。
