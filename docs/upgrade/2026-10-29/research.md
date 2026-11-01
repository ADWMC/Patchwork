# 源码调研与迁移契约

调研日期：2026-10-29。依据为固定提交、本仓库源码与真实宿主组合 probe；提案不代表已实现。源码放在仓库外，未向 Patchwork 加入上游依赖或生成产物。

## 项目定位

Patchwork 是 DSH 插件：服务端入口 src/index.mjs；维护 hook 位于 src/hook、src/quality、src/structure；四机制在 src/mechanisms；React 面板在 src/client，经 esbuild 输出 lib/client.js；bundle/preset 决定宿主工具编排。它不是独立 Web 应用。

七个按需 skill 属于行为层，维护 hook 属于机械检查层，SoL-Pi 四机制属于工具与上下文策略层。“配置开启”不能代表已注册、已执行或产生了收益。

## 来源与版本

| 来源 | 固定版本 | 本地路径 |
|---|---|---|
| [NVlabs/SoL-Pi](https://github.com/NVlabs/SoL-Pi) | 219568034fa54ed121ede80961655e33dfb9d0e3；package 0.1.1 | C:/Users/Administrator/Documents/GitHub/Patchwork-upstream/SoL-Pi |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | dsh-v0.2.1-rc.2 → 687f282e8625c6b8d11ff58211a90524be2e4317 | C:/Users/Administrator/Documents/GitHub/Patchwork-upstream/deepseek-harness |
| DSH 旧目标对照 | dsh-v0.2.0-rc.2 → 639ed015397290b3745d163aafe02ffee4aa3f84 | 同一 clone，git show 对照 |
| DSH 拉取时默认分支 | f3803c96974ad4a94195fb97e5c637e9c2a3afe3；0.2.2-alpha.2 | 不是本方案适配基线 |

DSH clone 当前 detached 于 0.2.1-rc.2。本机全局 DSH 也为 0.2.1-rc.2。2026-10-29 npm 通道查询：latest=0.2.1-rc.2、next=0.2.1-rc.5、alpha=0.2.2-alpha.2。没有取得 dsh-v0.2.1-rc.5 Git tag，因此不声称已审查 next 精确发布源码。通道名不是兼容性保证。

本轮未安装/运行 SoL-Pi，未构建整个 DSH。除源码和真实宿主包组合 probe 外，已使用官方 DSH 0.2.1-rc.2 web 标准模式，在独立 DSH_HOME/agents/workspace 中加载本仓库插件，并通过 StepFun 进行真实模型与工具调用；精确范围见 [验证记录](verification.md)。

## 四机制对照

### Action Fusion（AF）

- **上游：** 合并 write/edit 与后续校验，保护变更对象，保留 mutation/命令结果；仅真实成功、非嵌套程序调用计 avoided roundtrip。
- **基线：** agent scoped shadow、mutation guard、then_run 已有；真实 pwsh 因缺 description 拒绝跟进（AF-01）。旧 savedRequests 缺乏真实请求对照。本轮已补 description、保留 canonical exitCode，区分成功/失败/未知，移除该收益式计数；write/edit 的真实成功与预期失败均有回执。
- **建议：** 先补 shell adapter、工作目录与取消契约；UI 统计融合成功/失败/跳过，实际请求或成本收益交给受控实验。
- **策略差异：** 上游四机制均 opt-in；Patchwork AF 默认开是自身产品策略，不直接判为 bug。

[固定源码：AF](https://github.com/NVlabs/SoL-Pi/tree/219568034fa54ed121ede80961655e33dfb9d0e3/src/sol-pi/extensions/action-fusion)。Patchwork 对照：src/mechanisms/action-fusion/index.mjs:76-100。

### Observation Pack（OP）

- **上游：** 阈值 10KiB，eligible 输出前两次 provider request 完整发送（FULL_SENDS=2），之后只改 context 投影；原 session 输出保留；逐字节 recall，排除 reducer receipt。
- **当前：** 工具后处理即生成句柄，与“先完整看两次再投影”时机不同。
- **建议：** 版本化策略，先验证首次推理质量、召回与 session 重放；分开原始字节/投影字节/召回字节，不能无 tokenizer 或 provider usage 就换算 token 节省。

[固定源码：OP](https://github.com/NVlabs/SoL-Pi/tree/219568034fa54ed121ede80961655e33dfb9d0e3/src/sol-pi/extensions/observation-pack)。Patchwork 对照：src/mechanisms/observation-pack。

### Evidence-Preserving Reducer（EPR）

- **上游：** 识别普通 shell 与 write/edit.then_run；核对 canonical exit 和显示状态；排除嵌套程序调用；receipt 引用从真实输出逐字校验。
- **当前：** 有候选、receipt 与投影框架；融合结果覆盖与宿主结束状态仍需补齐。
- **建议：** 统一 EvidenceRecord，覆盖普通/fused shell、失败、取消和伪造引用；UI 可查看 command、exit、callId、原文与 receipt。输出缩短不等于证据正确。

[固定源码：EPR](https://github.com/NVlabs/SoL-Pi/tree/219568034fa54ed121ede80961655e33dfb9d0e3/src/sol-pi/extensions/evidence-preserving-reducer)。Patchwork 对照：src/mechanisms/evidence-preserving-reducer。

### Online Context Compact（OCC）

- **上游：** 必须 prior 存在且从非完成变 completed；初次 completed 只算历史。使用上下文增长、剩余请求视界、cache 成本与债务；两次 provider request 冷却，窗口压力可覆盖；区分 no-op、取消、拒绝与失败。
- **当前：** 框架已有，但请求间隔误作 tokens/request、初始完成误计、null 结果也清债计次，且外套宿主维护锁。
- **建议：** Patchwork 负责“何时建议”，DSH 负责独占维护；状态区分 eligible/scheduled/running/succeeded/noop/cancelled/failed/deferred。真实成功与计量后才结算。

[固定源码：OCC](https://github.com/NVlabs/SoL-Pi/tree/219568034fa54ed121ede80961655e33dfb9d0e3/src/sol-pi/extensions/online-context-compact)。Patchwork 对照：src/mechanisms/online-context-compact。

## DSH 宿主契约

以下以 0.2.1-rc.2 为主，维护锁及 tokenMeter 同时对照 0.2.0-rc.2。

| 领域 | 已确认源码 | 升级影响 |
|---|---|---|
| 侧栏 | sidebarRightTabs.register + keyed body/title slots；会话级 dock/expand/float | 保留现有插件面板接入，不复制 frame |
| 配置 | settings-controller describe/update/replace、expectedRevision、redaction | 注册正式 namespace；settings 不会自动反映运行能力 |
| 通信 | remotes 提供宿主通信基础 | 自定义 Patchwork snapshot/订阅与权限，不能声称已有同名 API |
| WebServer | register/tapIndex 返回 disposer | 通过 ctx.effect 管理；全局 Set 不等于生命周期 |
| 计量 | tokenMeter.measure(session).totalTokens 存在 | 问题是 scope 与单位，不是字段不存在；未知不冒充 0 |
| 窗口 | session.requestContext().contextWindow 存在 | 传真实窗口；未知则保守 deferred |
| 压缩 | compaction-basic.compactNow 内部 runMaintenance，可返回 null | 外层不再拿锁；null=no-op，不算成功 |
| 作用域 | standard 将 compaction 放 isolate realm | 通过 agent.ctx 适配；root 可见性需完整 preset 验证 |
| pwsh | description 必填非空，command 必填 | then_run 不能仅传 command |

固定源码入口：
- [sidebar-right](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/ui-sidebar-right/src/client)
- [settings-controller](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/api/settings-controller/src/index.ts)
- [compaction-basic](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/compaction/compaction-basic/src/index.ts#L383)
- [tool-pwsh](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/shell/tool-pwsh/src/index.ts#L390)
- [standard preset](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/bundle/web-app/presets/standard.patch.yml)

## 推荐模块边界

DSH services → host-adapter → mechanism runtime / config service → session event & evidence store → authenticated snapshot/subscription → usePatchworkSession → overview / mechanisms / evidence / settings。

机制产出事实事件，不直接写 UI 标签；UI 不从计数推断已激活。desired、effective、draft 分离，配置按 profile、事件按 session 隔离。

## 评价边界

research/ 是外部评价组织框架，benchmark/ 是既有轨迹反事实估算，不能称已完成自动 A/B 循环。真实评价须固定任务、模型、起始工作区、宿主与参数；分 baseline/单机制/组合；同时报告 provider usage、延迟、正确性和失败样本；价格需明确日期、币种与 cache usage。保留原始证据和重放命令；没有实测不承诺收益百分比。
