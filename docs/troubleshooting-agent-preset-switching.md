# DSH 新会话与 Agent 切换故障排查

## 现象

安装 Patchwork 后，DSH Web 界面可能出现以下现象：

- 点击“新建会话”后无法创建会话；
- 在会话输入框中切换 Agent 没有生效；
- API 返回 `agent-preset-invalid`，界面通常只表现为切换失败。

## 根因

旧版 Patchwork preset 直接复制了 DSH 的完整 `standard` preset。这样会把宿主已经提供的工具再次放进用户 preset，例如：

```text
pwsh
read
glob
job_output
skill
get_goal
exit_plan_mode
ask_user_question
todo_write
web_search
```

这些工具属于 DSH 宿主的共享注册表，不应该由 Patchwork preset 再注册一遍。当同一 DSH 进程先加载一个完整 preset，再创建或切换到另一个完整 preset 时，Cordis 会拒绝重复注册，并报错：

```text
tool "pwsh" is already registered
tool "read" is already registered
```

因此问题不在模型、API Key 或网络，而在 preset 的职责边界：用户 preset 不应复制宿主工具。

## 修复方案

Patchwork preset 已改为最小配置，只保留：

1. `@deepseek-ai/dsh-persona`：设置 Agent 身份；
2. `@deepseek-ai/dsh-agent-instructions`：设置指令读取上限。

Shell、文件系统、任务、Skills、计划、目标、子代理和网页工具继续由 DSH 宿主统一提供。Patchwork 的维护提示词和 Hook 仍由 profile bundle 中的 `@patchwork/coding-agent` 加载。

相关实现：

- `presets/patchwork/agent.cordis.yml`
- `scripts/gen-preset.mjs`

## 重新部署

从仓库根目录执行：

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web remove '@patchwork/coding-agent'
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.1.0.tgz"
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
Copy-Item presets/patchwork/preset.yml "$env:USERPROFILE/.dsh/.agent-presets/patchwork/preset.yml" -Force
```

然后完全退出正在运行的 DSH，再重新启动：

```powershell
dsh web --no-open
```

必须重启是因为旧进程的 Cordis 注册表已经保留了旧 preset，单纯刷新浏览器不会卸载这些注册。

## 验证

运行项目测试：

```powershell
node --test tests/*.test.mjs
```

应看到 11 项测试全部通过。重启后的 DSH 中，Patchwork 和 Standard 均可创建新会话，并可在同一进程内互相切换。

## 预防

DSH 升级或修改宿主 preset 后，先确认宿主工具的所有权，再生成用户 preset。用户 preset 只应声明自己的 persona、提示词或插件专属配置；不要把宿主已经注册的工具行复制进去。
