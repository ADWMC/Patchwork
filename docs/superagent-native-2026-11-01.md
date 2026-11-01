# DSH 内部 Superagent 接入

> 本文保留当时的实现与验证范围。后续受限策略实际应用/回滚、人工复核、记忆事务及当前验收见[2026-11-01 闭环指南](closure-2026-11-01.md)，旧实验结论不因后续修复自动升级。

日期：2026-11-01。范围：Patchwork 所在的 DSH 内部主控、任务队列、原生执行器会话、事件唤醒与恢复。没有 GitHub／飞书 Source、Webhook、外部投递或独立后台服务。

## 接入决策

- 当前 Patchwork 会话担任主控，模型用结构化工具拆分、提交和调整任务；不再另开一个重复分析用户请求的路由模型。
- 使用 DSH 的本地 spawn provider 建立执行器，继承宿主模型及权限，不设置 danger-full-access；执行器继续加载 Patchwork 和 SoL。
- 主控队列及输入写入主控的原生 Session。执行器身份与一次尝试分开记录；先保存派发意图，再调用原生执行服务。
- 子任务正常结束不等于验收通过；结构化报告、真实任务验收和人工决定分开。unknown／blocked 不启动后续依赖。
- 完成、提问、受阻和失败才唤醒主控。结果只返回创建它的 DSH 主控会话，不接受任意会话地址。
- 切换模式、取消和卸载会撤销派发代次并停止本模块拥有的执行器；不会停止其他会话或普通 subagent。
- 重启后恢复队列和任务事实；不把不确定的派发自动重放成新副作用。通过主控恢复操作核对原生子会话后继续。

## 同类项目调研

本次通过 GitHub CLI 和进程级代理读取固定 commit 的源码，不以 README 或 star 代替实现。源文件及 SHA256 在 `artifacts/research/superagent-community/manifest.json`；三个社区项目共读取 15 份文件（含许可），研究快照不进入发行包，没有安装其运行时或复制实现代码。

| 项目 / 固定 commit | 实际读取 | 采用 | 不采用 / 限制 |
| --- | --- | --- | --- |
| [DSH Superagent prototype](https://github.com/deepseek-ai/dsh-superagent-prototype/tree/6337fc823ce20251c8de8085948165c81aaa701e) / `6337fc8` | 既有快照的 `docs/000-philosophy.md`、`001-domain.md`、`003-execution.md`、`src/app/sessions.ts`、`src/executor/dsh.ts` | Ticket 与 turn 分离；槽位；问题和结果唤醒；持久派发意图、代次撤销 | 不接 GitHub/飞书 Source，不自动设置 danger-full-access，不引入 Router 服务；研究原型不直接当生产插件装入 |
| [OpenHands SDK](https://github.com/OpenHands/software-agent-sdk/tree/98849457621881ae2414719b82b8bc1cf535b4ab) / `9884945` | `tools/delegate/{definition,impl}.py`、`sdk/conversation/state.py` | child 独立会话；有界数量；父会话持久化与确认策略继承 | 上游使用 Python threads 阻塞等待；`_run_until_finished` 无 confirmation handler 时继续 run，不能代替 DSH 人工许可，不移植此默认继续路径 |
| [OpenCode](https://github.com/anomalyco/opencode/tree/69269e4ebe309a08919b3c9be7948b9fd699c3a4) / `69269e4` | `session/background.ts`、`execution/restart.ts`、`subagent-job.ts`、`subagent-completion.ts`、`tool/plugin/subagent.ts`、`permission.ts` | 直接父会话校验；所属主控通知；按代次去重；持久恢复计数，避免重启循环 | restart 明确是 at-least-once，不能声称崩溃后副作用 exactly-once。本插件暂停不确定派发、显式 retry，不引入其服务器、Effect runtime 或数据库 |
| [LangGraph](https://github.com/langchain-ai/langgraph/tree/e5c961d7fbe7ca6fdd4c94c84d90511372514d55) / `e5c961d` | `pregel/_loop.py`、`checkpoint/base/__init__.py`、`types.py` 的 interrupt | 稳定会话身份、先保存再派发；中断值与恢复值分开；checkpoint 等待所属写入持久化 | interrupt 恢复会从 node 起点重执行，不能当作无副作用续作。不添加 Python、图运行时或第二套 checkpointer |

三个新项目在所读 commit 均为 MIT；Patchwork 保持 AGPL-3.0-only。本次仅借鉴机制和记录来源，研究源码不打包。

## 实际接口

`patchwork_superagent` 只在 Patchwork preset 注册，当前根会话担任主控；不是新聊天模式或外部服务。简单问题不强制拆分。

- **提交**：inspect 取得 revision，submit 传 jobs 和 baseRevision。job 有稳定 id、title、prompt、mode:read|write、可选 dependencies/timeoutMs。最多 24 项、并发 1–4（默认 2）、每项最多 3 次、总尝试最多 48；单次 1–900 秒，默认 300 秒。
- **派发**：原生 `subagents.startActivation(provider:'spawn',delivery:'caller')`，预留 child id、先保存主控 Session 并 flush，再启动执行器。不指定新权限、模型或 preset，继承父 composition 和已有 SoL。执行器不能提交队列、嵌套委派或任意会话消息。
- **范围**：同工作区本模块写任务串行，read 可并发。read 在真实分发前拒绝 shell/edit/write/未知工具，允许实际 artifact 结构检查；write 沿主控 phase、澄清状态、references、工作区与宿主许可。有只读 references 或非实施阶段时禁止执行器 shell。任意 shell 仍不是 OS 沙箱。
- **验收**：report ready 只是主张。必须原生 turn completed、最终 task ready、understanding stated、真实持久化、至少一项必需 command/artifact 通过、全部必需要求 passed、登记产物未变化，才 job done。semantic unknown/waiting/blocked/failed 和普通模型文字都不放行依赖。
- **纠正**：input 带 job id、文本和当前 revision，先撤销在途代次并停止所属执行器，再保留 job 身份分配新 child；已运行的下游证据置 blocked，须审查后 retry。retry 显式、有界，不无限自动重试。pause/resume/cancel 管理队列，reconcile 只列本队列直接子会话。
- **恢复**：原生 checkpoint，不另建数据库。重启恢复 paused；starting/running 变 blocked，历史 done 变 review，防止离线文件变更后旧通过放行。inspect/reconcile 原始 child 与当前产物后再明确 retry/resume；不自动重放命令，损坏记录不退回空白可执行状态。

`/patchwork-superagent` 在当前 DSH 会话查看队列。已有状态 API 增加只读 superagent 投影，不含 prompt 或纠正原文；没有新增图形队列编辑器，控制走结构化工具和会话命令。

```json
{"action":"submit","baseRevision":0,"concurrency":2,"jobs":[
  {"id":"inspect","title":"核对实现","mode":"read","prompt":"读取现有实现，登记实际 artifact 结构检查，结束前 report。"},
  {"id":"fix","title":"实施修复","mode":"write","dependencies":["inspect"],"prompt":"沿授权范围修复、执行真实验收，结束前 report。"}
]}
```

示例 revision 0 只用于初始队列；之后先 inspect，不猜 revision。

## 与 SoL、记忆、自进化的关系

- SoL 管各执行会话的工具和上下文成本；Superagent 管任务生命周期和调度。继承 preset 获得 AF/OP/EPR/OCC，不另装 SoL，不把完整子历史塞回主控。
- 执行器允许原有 obs_recall/update_plan 与有界 patchwork_search/fetch，避免 OP 归档后无法召回或 OCC 无法登记计划。搜索仍走原有受控检索；“只在 DSH”限制任务来源、主控和结果渠道，不关闭已授权的检索请求。浏览器授权、共享记忆和改进确认不会凭委派自动继承。
- 主控只收到有界结果通知（2,000/4,000 字符摘要及验收指针）；压缩后 inspect 机器队列，不以 OP 摘要或自由文本授予权限。
- prompt、结果、最多 8 条纠正属于本会话原生记录，checkpoint 限 256 KiB；不会自动写共享记忆或运行规则。失败和纠正可另走现有 improvement 候选、隔离实验和用户决定，不训练模型、不自动提权。
- 新输入暂停活动队列，重新确认当前任务理解后继续。切换 preset、销毁 Agent、卸载即撤销代次，只停止本模块直接 children，不停止其他普通 subagent 或同目录会话。

## 验证与边界

- 确定性测试覆盖依赖、读并发、写锁、假完成拒绝、纠正失效、flush 取消竞态、存储失败停止、preset 撤销、其他会话隔离、恢复校验及保留旧工具引用。
- 真模型测试使用独立临时 DSH_HOME、官方 CLI、原生 Session/subagent 服务和 Step 5；不复制或修改主 DSH。完整提示词、模型日志、会话记录留 TEMP，仓库仅保存脱敏摘要。
- 首次原生调用发现 activation result 返回时 child Session 已关闭；最终 task flush 已移至 agent/turn-stopping，关闭后不再重复 flush，必须以重跑记录判断通过，不能由 mock 推断。
- 接纳后的 checkpoint 失败必须先 abort/dispose 所属 child，再释放 binding/写锁；停止失败隔离保留，不能把仍在运行的执行器降成“不受管普通会话”。最终 smoke 另注入这一故障，检查 native child 实际释放。
- 不提供跨崩溃副作用 exactly-once；恢复优先暂停核对。写锁只协调同 Node 进程、本模块、同规范化工作区，不约束用户 shell、其他进程或普通会话，不能声称全局锁或沙箱。
- 当前只根主控，纠正会撤销整个本队列在途代次；没有跨进程调度器、外部来源、远程执行节点或无限后台服务。
- 实测与源码指纹见 `docs/checks/superagent-native-2026-11-01.json`。这是机制 smoke，不是成功率/速度/token 收益 benchmark；旧 handoff 实测和历史失败不覆盖。

## 本轮验收结果

该阶段最终实跑：官方 DSH `0.2.1-rc.2` + `step-5-preview`，独立临时工作区及 DSH_HOME；配置窗口 1,000,000、最大输出 16,384，不代表消耗了 1M 上下文。该次验收时源码和 driver 指纹与启动前记录一致；后续执行器指令调整与新代码复验另见[优化记录](superagent-prompt-optimization-2026-11-01.md)，不将这里的指纹用于证明后续版本。

| 检查 | 结果 |
| --- | --- |
| 两项原生读取执行器并发、完成后放行依赖修复 | 3/3 正式任务 done，各 1 次尝试；实际文件加法断言通过 |
| 接纳后的 running-checkpoint 故障注入 | 第四个隔离执行器被 abort/dispose，原生 Agent 已释放，未留下活动 assignment |
| 原生 checkpoint 读取恢复 | paused；历史 done 要求 review，不确定尝试 blocked，没有自动重放 |
| 其他会话 | 真宿主工具目录保持不变；真实 registry 的标准模式、保留旧引用和 shell 负测通过 |
| 全仓回归 | 376/376，0 failed，0 skipped；其中 Superagent 确定性测试 19 项 |
| 分发 dry-run | 必需文件齐全，无浏览器依赖/内核、调研快照、私有日志或已提供的模型密钥 |

最终 smoke 共 38 次模型请求、约 192 秒，包含额外故障探针；有 2 次工具错误，均在最终任务完成前纠正，原始失败未抹去。此数据不用于宣传速度或成功率提升。checkpoint 验收使用真实 Session 的恢复读取，并非独立进程 kill/restart 的端到端演练；后者不计为已验证。
