# DSH 新会话与 Agent 切换故障排查

## 现象

- 新建会话或切换 Agent 失败；
- API 返回 `agent-preset-invalid`；
- 错误包含 `tool "pwsh" is already registered`、`tool "read" is already registered` 等。

## 根因

注册 Agent 工具的业务包同时由 profile 全局 bundle 和 Agent preset 加载。全局实例
先注册工具，之后 Standard、Patchwork 或 Helmd preset 在自己的 Agent 作用域挂载时，
同名工具发生冲突。

## 修复后的所有权

- DSH host：共享服务和平台实现；
- Agent preset：从本机 DSH Standard 派生标准工具，再加载 Patchwork 提示词和 Hook；
- Patchwork preset：按 session 作用域加载一次 `@patchwork/coding-agent`；
- Patchwork package bundle：空 patch，只保留依赖安装入口。

该边界消除了插件的宿主级重复加载。DSH `0.1.2-alpha.5` 的 scope 工具注册支持
多个完整 preset 并行挂载；Patchwork 保留 Standard 工具行，因此工具能力不削弱。
Patchwork 的提示词和 Hook 只在 Patchwork Agent 中生效。

## 重新部署

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web remove '@patchwork/coding-agent'
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.1.1.tgz"
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
