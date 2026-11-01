# Patchwork 升级方案 · 2026-10-29

> 实施索引（2026-10-30）：采用项、实际接线、隔离宿主验证与剩余边界见[统一融合执行方案](../2026-10-30-integration.md)。本文保留研究或历史审计的原始范围，不把建议与历史数字改写成当前能力。

## 本轮结论

Patchwork 继续作为 **DSH 插件**。本轮已经沿 DSH 源码实现原生右侧栏面板，并在独立 DSH_HOME、独立 agents 目录和临时工作区里，通过 StepFun 做真实模型及 write/edit 工具验证。旧独立 Web 页面已经退役。

本次追加隔离修复：安装只增加preset与Web桥接，只有选择Patchwork的会话才装载技能、Hook、评审和机制。最终144项测试全部通过，preset来源漂移已修；EV-02/OCC与依赖版本统一仍在升级路线中。验收跨至2026-10-30凌晨。

## 交付索引

- [源码调研与宿主契约](research.md)
- [问题审查、修复状态与验收](audit.md)
- [DSH 原生 UI：入口、token、暗色与数据通道](webui.md)
- [真实模型/工具、浏览器和测试记录](verification.md)
- [Agent能力、提示词、接口与会话隔离审计](isolation.md)

实现入口：src/client/index.jsx、PatchworkPanel.jsx、panel-styles.mjs、use-patchwork-state.mjs；服务端状态：src/ui/runtime-state.mjs。

## 源码与环境基线

| 项目 | 本轮采用的精确基线 |
|---|---|
| Patchwork | 0.2.0；原始 HEAD ef19dc7b1ad190b0281bdaa5f9a03fcf302cbac1 |
| SoL-Pi | NVlabs/SoL-Pi；219568034fa54ed121ede80961655e33dfb9d0e3；package 0.1.1 |
| DSH 源码/真实运行 | dsh-v0.2.1-rc.2；687f282e8625c6b8d11ff58211a90524be2e4317 |
| 旧依赖对照 | 0.2.0-rc.2；639ed015397290b3745d163aafe02ffee4aa3f84 |
| 本仓库依赖 | 主要包仍为0.2.0-rc.2，根 dsh-llm 解析0.1.7-rc.1；本轮没有批量迁移 |

上游 clone 位于仓库外的 C:/Users/Administrator/Documents/GitHub/Patchwork-upstream。未安装运行 SoL-Pi，也未从头构建整个 DSH；实际运行复用本机官方 DSH 0.2.1-rc.2 可执行文件，环境数据全部隔离。

## 已落地部分

1. 复用 sidebarRightTabs + keyed slots + 宿主 sessionId；直接使用原生 Button/Switch/SegmentedTabs 与 --dsw-* token，主题由 DSH 接管。
2. 用真实鉴权状态端点替代旧 DOM 计数读取；观察最终 tools/result，按会话记录命令、callId、退出码和原文。
3. 保存配置带 revision；同进程串行写、唯一临时文件、409 冲突保留草稿；加载/保存/草稿三态分开。
4. AF 补齐原生 shell description；依据 canonical exitCode/超时/取消判定；不把失败或未知状态算成功，不宣称测得请求收益。
5. 修复外观设置导致插件重载后的鉴权失配；凭证/有界证据进程内保留，route/index tap 归属 ctx.effect。
6. write 和 edit 均通过模型真实调用：成功 exit0、故意失败 exit7；保留原生 read-before-edit 防护。

7. root/runtime分离；真实preset权威检查、切走撤销工具遮蔽，状态/保存API拒绝standard；面板切走卸载快照与草稿。
8. 证据键改为session ID；preset改从固定0.2.1 fixture生成；补完整目录与真实scope隔离回归。实测发现并修复OP召回页再次打包。

最终全量测试144项：144通过、0失败、0跳过。早期135项中1项preset漂移失败已通过固定版本fixture解决；原生Cordis组合回归与完整DSH/StepFun正负向调用分别记录，详见验证记录与隔离审计。

## 升级路线

下列版本号仅为建议，不是已发布版本。按依赖完成每一阶段后再进入下一阶段，不同时追 next 与 alpha。

### A · 关闭剩余正确性问题（建议0.2.1）

- EV-01：session ID键与同cwd双会话回归已完成；继续补agent恢复等长生命周期矩阵。
- EV-02：明确现在是工具结果提示而非最终回答强门禁；证据关联实际命令、canonical退出状态和验证范围。
- OCC-01/02/03：只保留一层宿主维护锁；从 agent scope 解析能力；修正 tokens/request 单位、历史completed边界；成功后才清债计次。
- TEST-01：固定0.2.1 standard/preset来源已完成；后续统一dependency/peer/lock并保留跨目标兼容测试。
- CFG：损坏配置可见且不覆盖原文件；完善跨进程并发与配置层级。当前用户覆盖是 DSH_HOME 范围，不是 profile 范围。
- AF：补真实取消、目标变化、nested/PTC 和 shell background 专项；本轮成功/非零测试不代替所有边界。

退出条件：审查中的P1逐条有回归证据；完整测试全通过；OCC的 busy/no-op/cancel 不死锁或虚计；同目录双会话隔离。真实验证前维持 OCC 关闭。

### B · 统一宿主适配与配置（建议0.3.0）

候选精确目标为 DSH 0.2.1-rc.2；先通过隔离迁移验收，再同时更新 dependency/peer/lock/preset。

- 建 host-adapter，集中 tools、agent scope、tokenMeter、compaction、settings 的契约和能力探测。
- 从用户 JSON 过渡到宿主 settings namespace，明确 profile/agent 覆盖顺序、revision及来源；迁移前备份。
- 已用目标宿主standard生成Patchwork preset；后续版本继续逐行审查，验证标准模式不装载插件能力与Patchwork preset正向行为。
- 延续原生UI；当前切走即卸载草稿与快照。后续增加持久证据读取与有界分页；若引入订阅则具备重连和缺号恢复。
- 减少进程全局计数的业务解释；每项机制以实际决策事件说明执行/未执行原因。

退出条件：干净安装和精确宿主矩阵通过；双页面、双会话、外观切换/热重载、恢复、断线/重连与配置迁移有证据；主 DSH 保持未迁移，直到单独部署阶段。

### C · 策略对齐与收益实验

- OP：比较首次句柄与上游“两次完整发送后投影”的质量，确认原文可召回、session可重放。
- EPR：覆盖普通/融合shell、非零/取消、嵌套、伪造引用；压缩回执必须可逐字核对。
- OCC：结合真实 token 增长、请求视界、cache成本、冷却、窗口压力；先评估再执行，不重复调度宿主已有压缩。
- 做同任务/同模型/固定版本、机制独立开关和重复样本的A/B实验，记录正确率、provider usage、缓存、请求数和耗时。
- 只有观察到真实对照收益后再展示节省量；字节缩减、融合次数和估计tokens都不替代账单或正确性。

退出条件：给出质量不退化的对照报告、样本/失败明细和回滚开关，不用单次演示宣传收益。

## 迁移与回退

| 对象 | 迁移动作 | 回退条件与动作 |
|---|---|---|
| 依赖/preset | 整组精确锁定，备份旧lock与patch | agent创建/工具schema异常则整组恢复 |
| 配置 | 导出旧JSON，验证schema，显式指定目标scope | 冲突/损坏停止写入，保留原件并恢复备份 |
| 机制 | 独立flag，逐一开启、收集证据 | 单机制失败关闭该机制，不能阻断Agent |
| UI/状态 | 保持原生入口；先读取、再写入、再订阅 | 数据不一致禁止写入，保留草稿与最近快照 |
| 会话/证据 | 保留宿主原session，仅新增版本化索引 | 新reader失败回读原session，不删原文 |

## 当前限制

本轮未升级主 DSH，未发布、未commit/push。隔离实例保留在本机端口4321。API密钥仅通过该进程环境变量传入，没有写入仓库或overlay。真实运行证据、截图与详细边界均见验证记录。
