# Agent 基础

当前实现以 `src/runtime.mjs` 为 Agent 运行时入口，`src/index.mjs` 只提供 profile 级 Web 桥接。依据与验证见[全文档融合执行方案](upgrade/2026-10-30-integration.md)。

## 挂载与隔离

安装 bundle 提供 Patchwork preset 和原生侧栏入口；只有真实组合为 `patchwork` 的会话加载运行时。standard、PTC 或其他 preset 不加载 Patchwork 技能、任务工具、Hook 和机制。不能用 header、cwd 或保留旧工具引用获得能力。

运行时依赖 `skills`、`commands`、`tools`、`agentPresets`，不注册 systemPrompt 段。七条技能经 `ctx.skills.register` 渐进披露；profile 桥接不注册模型侧能力。preset 从固定 standard fixture 生成，再追加 runtime；不要在 profile 根重复挂载 runtime。

## 执行闭环

- `src/task/state.mjs` 管任务版本、纠正、依赖失效、验收聚合与任务内候选经验。
- `store.mjs` 复用宿主原生 `plugin:patchwork/task` 记录；恢复、模型短投影与 UI 展示是独立路径，损坏恢复阻塞而非推导全权限。
- `lifecycle.mjs` 注册 `patchwork_task` 与 `/patchwork-task`，观察 inbox 来源类型并在 pre-step 发送有界任务投影。来源类型不等于人类授权，不能保证第一句展示顺序。
- `action-check.mjs` 在 pre-execute 做路径解析，原生同步 guard 复查实际参数与 revision；解析 junction 和不存在文件的父路径。已知结构化工具受检查，任意 shell 不是强沙箱。
- `acceptance.mjs` 通过宿主真实派发取得进程退出状态；缺退出码、失败、取消、过期与覆盖不足不计通过。文件结构检查不等于事实/语义正确。
- AF 在排队前与写入后核对 revision；OCC 保留原 idle/维护锁语义，压缩续跑带当前任务短投影。

`/patchwork-review` 提交命令派生的评审消息，producer 为 `patchwork-command`；不得把它伪装成原始人类授权。结构/证据 Hook 只提示相关问题，不冒称可以否决 assistant 最终回复。

## 配置与验证

部署默认值放 preset 的 `patchwork-runtime` 行；可编辑用户覆盖仍以 DSH_HOME 为作用域。`taskPolicyMode` 默认 structured，可设 strict 拒绝不支持的效果通道；严格模式也不提供 OS 沙箱或任意代码权限证明。

```text
node --test
node scripts/build-client.mjs
node scripts/build-client.mjs --check
```

本机真实宿主验证必须使用独立 home、agents、工作区和端口；主实例不可达时也不回退、停止或重启主 DSH。测试证据和未覆盖能力记录在统一执行方案中，不将组合 fixture 冒充真实模型调用。
