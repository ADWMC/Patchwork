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

0.1.7-alpha.2 起，preset 本身也必须由 bundle patch 声明：`package.json` 的
`dsh.bundle.patch` 现在列两个文件——`./cordis.patch.yml`（插件本体）与
`./presets/patchwork.patch.yml`（`@deepseek-ai/dsh-agent-preset` 声明行）。
`$DSH_HOME/.agent-presets/` 目录已经没有读者了，装好新 bundle 后要删掉旧的
`.agent-presets/patchwork/`，否则界面上看不到的是「preset 消失」而不是「没装对」。

## 重新部署

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web remove '@patchwork/coding-agent'
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.2.0.tgz"
Remove-Item -Recurse -Force "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
```

改过宿主 standard 后重新生成声明文件（默认写回 `presets/patchwork.patch.yml`）：

```powershell
node scripts/gen-preset.mjs
```

profile 的 bundle 版本要跟宿主同走廊（`@deepseek-ai/dsh-base`、
`@deepseek-ai/dsh-web-app` 都取 `alpha` tag），否则 `dsh-agent-preset` 这类
宿主包在 profile 的解析树里根本不存在。

完全退出旧 DSH 进程后重启。运行中的 standing preset mount 不保证安全热替换。

## 验证

```powershell
node --test
dsh --profile web --no-open
```

通过 `agentPreset.select` 或界面依次切换 `standard → patchwork → helmd → standard`。
每次都应成功，且 Patchwork Hook 仅在 `patchwork` 会话中出现。
