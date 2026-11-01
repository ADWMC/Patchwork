# Patchwork 0.2.0 审查与本轮修复状态

2026-10-29。P1为发布前应关闭的主要正确性问题，P2为局部可靠性/能力缺口。初始基线为 ef19dc7b1ad190b0281bdaa5f9a03fcf302cbac1；旧行号不适用于改写后的面板。

## 状态总表

| ID | 级别 | 本轮结论 | 当前证据/下一步 |
|---|---|---|---|
| UI-01 | P1 | 已修：旧 collect(readInjected) 统计失真 | 改用鉴权 state；真实工具回执与上下文测量在 DSH 面板更新 |
| UI-02 | P1 | 已修：旧 DOM 覆盖保存响应造成开关回退 | desired/loaded/draft分开；真实保存、页面刷新及409草稿保留 |
| UI-03 | P1 | 已修：进程快照冒充会话实时计数 | 会话tools/result store + 明示2秒轮询；隔离修复进一步移除进程计数UI与API输出 |
| AF-01 | P1 | 已修：pwsh 缺 description，跟进命令被宿主拒绝 | 真实DSH0.2.1+StepFun的write/edit+then_run exit0/7均采集 |
| AF-02 | P2 | 已修主要计数语义 | canonical非零/超时/取消不算成功；successfulRootFusions不冒充请求收益 |
| CFG-02 | P1 | 已修同进程并发丢字段 | 串行写、唯一临时文件、revision；并发回归和双页面真实409 |
| LIFE-01 | P2 | 已修本轮复现路径 | route/tap纳入effect；进程凭证/有界证据跨热重载稳定；主题切换后连接和证据保留 |
| EV-01 | P1 | 已修会话键隔离 | 只用session.header.id；缺ID不共享；同cwd双会话与无ID回归通过 |
| EV-02 | P1 | **未修** | post-execute-hook检查工具文本而非assistant最终回答；近期shell不关联验收范围 |
| OCC-01 | P1 | **未修** | 外层runMaintenance与宿主compactNow内部维护锁可能重入 |
| OCC-02 | P1 | **未修** | 请求间隔被当作tokens/request；null/no-op前可能清债计次 |
| OCC-03 | P1 | **未修，基线探针已复现** | 初次historical completed被视作新完成边界 |
| SCOPE-01 | P1 | 已修能力泄漏；OCC专项仍待验 | root仅Web桥接；runtime仅Patchwork preset，目录+执行双重检查；见isolation.md |
| TEST-01 | P1 | 已修preset来源漂移 | 固定0.2.1 standard fixture并校验来源，最终144/144通过；dependency整体迁移未做 |
| OP-01 | P2 | 已修召回页再次打包 | obs_recall投影直接通过；回归与真实模型两页召回均通过 |
| CFG-03 | P2 | **未修** | home覆盖跨profile；损坏JSON静默回退；多进程共享home尚无锁 |

“已修”仅覆盖表列路径，不代表完整版本迁移或所有机制已经生产就绪。原生read-before-edit仍生效，真实edit首次未读时被宿主拒绝，读取后才成功融合。

## 初始六项复现与处置

1. UI-01：注入 savedRequests=8，旧面板仍显示没有省请求；原因是向collect传函数而非结果。新UI不再用该计数表达收益。
2. UI-02：保存OP=true返回成功后旧DOM优先级更高，开关回false；新配置通道以保存响应和revision推进。
3. EV-01：同cwd的A成功shell曾使B获得证据；隔离修复已将sessionKey改为真实session ID，并增加回归。
4. OCC-03：previous=[]首次completed返回newlyCompleted；本轮未改该调度策略，隔离验证关闭OCC。
5. CFG-02：并发写同.tmp且先读后合并，两次fulfilled仍可能丢一个字段；新串行化+revision回归覆盖同进程路径。
6. AF-01：真实0.2.0工具组合显示 missing required property description；已改成功回归，并额外通过完整DSH0.2.1真实模型验证。

旧audit-probes依赖已退役Panel，已随独立原型移到临时归档，不再作为当前可运行检查。当前回归在 tests/{runtime-state,user-config,action-fusion,ui-stats}.test.mjs；真实包组合检查为 checks/host-probes.mjs。

## 实测追加发现：主题重载导致403

沿DSH外观设置切换浅/深色时，插件重新加载；旧页面凭证与新注册handler失配，面板实际出现HTTP403并保留最近快照。修复采用进程内web-runtime保存凭证/有界证据、effect管理route/tap，避免每次重载旋转页面凭证或累积旧注入。之后再次宿主主题切换，面板保持连接、证据不丢、metadata仅一份。不是仅靠CSS截图判断主题适配。

## 关键风险的源码依据

| 领域 | 位置 | 影响与验收 |
|---|---|---|
| 证据隔离 | src/quality/evidence-gate.mjs | 已改稳定sessionId，缺ID不共享；证据语义EV-02仍待修 |
| 证据语义 | src/hook/post-execute-hook.mjs | 只是工具文本提示；接最终回答阶段或准确限制能力声明 |
| OCC锁与结算 | src/mechanisms/online-context-compact/lifecycle.mjs；DSH compaction-basic | 去重锁，no-op/cancel不清债，真实忙锁不死锁 |
| 完成边界 | src/mechanisms/online-context-compact/plan.mjs | prior存在且从非完成到完成才记新边界 |
| 版本测试 | tests/preset.test.mjs；package.json | 使用精确host fixture/依赖，不能随机器全局版本漂移 |
| 配置scope | src/config/user-config.mjs | DSH_HOME用户覆盖；正式迁移需profile namespace及多进程并发 |

## 发布门槛与验证边界

- 早期“标准模式+全局插件”仅作历史功能证据；最终隔离验收使用Patchwork preset正向与standard负向，见[隔离审计](isolation.md)。
- SoL-Pi四机制策略差异不是自动认定bug；AF默认开、OP首次句柄应作为产品策略评估。
- 成功/失败融合次数是执行记录，未做对照实验，不声明实际节省请求或成本。
- 原生UI、数据/配置、AF、会话隔离与固定preset已落地；EV-02/OCC和依赖统一仍须按 [升级方案](README.md) 实施。
- 精确命令、退出码、调用ID、截图及未验证范围见 [验证记录](verification.md)。
