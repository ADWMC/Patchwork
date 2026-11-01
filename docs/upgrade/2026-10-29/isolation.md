# Patchwork Agent 能力隔离审计

检查时间：2026-10-29 至 2026-10-30，Asia/Shanghai。目标是阻止插件能力自动进入其他 Agent 或会话；仅使用本机隔离 DSH，未改动主 DSH。

## 根因与修复

原 profile 根插件同时注册七个技能、评审命令、工具 Hook 和四机制。安装后，其他 preset 会继承根注册；AF 还在 agent.ctx 注册 write/edit 遮蔽，切换 preset 后不能仅靠旧 standing scope 的销毁撤回。

现在拆分为两个入口：

- `src/index.mjs`：profile 只安装原生面板与 HTTP 桥接，不注册模型行为。
- `src/runtime.mjs`：仅由 `patchwork` preset 挂载，注册技能、`/patchwork-review`、Hook、机制和证据收集。
- `src/scope.mjs`：使用宿主 `agentPresets.composedPreset(agent.ctx)` 判断真实组合；未知状态拒绝。header、cwd、显示名或前端布尔值均不能授权。

没有导入另一个物理版本的 dsh-scope 来解释宿主私有 scope；判断由运行中的宿主 registry 完成。

| 边界 | 当前处理 |
|---|---|
| 工具与技能目录 | 使用 DSH 原生 scoped registries；其他 preset 不见 Patchwork 技能、obs_recall、update_plan 和 review 命令 |
| write/edit 遮蔽 | 仅作用于真实 Patchwork Agent；切走、销毁及 runtime 释放时撤销；切回重建 |
| 保留的旧引用 | fused write/edit、obs_recall、update_plan、review 在执行时重新检查组合；等待后也检查关键变更入口 |
| Hook 与额外模型请求 | standard/未知 Agent 原样放行，不查 reducer 服务、不归档、不注入 Patchwork notice、不触发压缩续跑 |
| 状态与保存 API | page credential + live sessionId + 真实当前 preset；切走后即使凭证有效也返回403；异步 body/排队写/替换文件前复核 |
| 全局 HTML | 只注入路径、页面凭证及时间，不携带配置、技能正文、工具回执或进程计数 |
| 面板 | 只有当前会话 projection 的 agentPreset=patchwork 才挂载功能；切走卸载快照、草稿和保存状态 |
| 证据与冷却 | 只用 session.header.id，缺ID不共享默认桶；同cwd不同会话不共享 evidence |

原生右栏入口由宿主静态 guide 注册，其他 Agent 中仍可看到入口，但打开只有锁定说明，没有机制、证据和设置操作。此入口本身不向模型注册能力。

## 自动检查

最终 `node --test --test-reporter=spec`：**144项，144通过，0失败，0跳过**。

新增/强化覆盖：完整工具与技能目录、原生 Cordis scope、切走撤销/切回恢复、保留旧引用拒绝、伪造 header/cwd、无session ID、同目录双会话、无额外模型服务访问、合法token的standard请求403、读取body期间切换、排队写入前失权。

`node scripts/build-client.mjs --check`：31307字节bundle与源码一致。`checks/host-probes.mjs`：真实0.2.0工具包配 synthetic Agent 的 write+then_run exit0。完整0.2.1运行证据另列，不把 synthetic 测试冒充真实模型调用。

preset生成器固定读取 `tests/fixtures/dsh-v0.2.1-rc.2.standard.patch.yml`，来源 commit `687f282e8625c6b8d11ff58211a90524be2e4317`，SHA256 `0d398d2a6872a73a106cb3bd19303ecccf1637e1fcad4d0bf9d8a72d2c2c68f5`。逐字保留宿主行后追加runtime，不再跟随机器全局npm漂移。主要dependency仍为0.2.0，不能据此宣称依赖整体迁移完成。

## 真实 DSH 与模型验收

隔离目录：`C:/Users/Administrator/AppData/Local/Temp/patchwork-dsh-isolated-20261029`，独立home/agents/workspace/store，监听127.0.0.1:4321。官方DSH 0.2.1-rc.2，StepFun `step-3.5-flash`，经DSH输入框发送并实际调用工具。

| 验收 | 实际结果 |
|---|---|
| standard初始/切走 | 无七个Patchwork技能、review、obs_recall、then_run；state/config均403 |
| Patchwork选中 | 七技能与review可见；then_run可用；state200；非法配置键400证明通过权限层后被schema拒绝，没有保存 |
| standard真实pwsh | exit0，完整返回到STANDARD_LINE_0800；没有obs句柄或Patchwork提示；没有该session归档目录 |
| Patchwork真实skill/write | 加载patchwork正文；write严格内容PATCHWORK_SCOPE_OK；nested pwsh输出FUSION_SCOPE_OK，exit0；本机逐字核对文件 |
| Patchwork长输出 | 800行被归档为obs_136f59b685cd8f95bcd8dcec，canonical exit0；仅该Patchwork session拥有OP归档 |
| 修复后真实召回 | 00:09重新调用offset0和15200，正文分别覆盖1–400与401–800行；拼回30400字节，与归档逐字节相同；没有再次打包 |
| 跨会话切页 | Patchwork证据不进入standard；standard面板锁定，标准shell结果仍正常 |
| Patchwork运行后standard继续执行 | 00:12原standard会话再次pwsh，输出STANDARD_STILL_ISOLATED，exit0；恢复后原生subagent也重新出现，仍无Patchwork schema |
| 草稿切换往返 | 00:17–00:18空白会话把ratio由12.5改为17.5但不保存；切standard立即锁定；切回后显示12.5、保存禁用，草稿未保留 |

正向session：`session-224d3045-6b8b-43b0-842e-91531d5c560c`。负向session：`session-4510da35-eeb6-411b-9a29-d994476bf53a`。

真实验收额外发现：15KB召回页会超过OP的10KB打包门槛，被再次换成新句柄，模型初次误报召回成功。现明确跳过obs_recall自己的投影打包，补回归并重新真实调用。初次模型答复和截图仅作历史记录，召回通过以修复后的原生tool/result正文为准。

### 提示词与请求证据

从宿主zstd会话日志逐frame解码，核对真正的 `request/header`、`system/message`、skill-catalog来源user消息及tool/result：

- standard的request/header无obs_recall、无then_run；skill-catalog只有宿主的diagnose-windows-sandbox-acl；system中没有Patchwork指令或短码，没有来源为patchwork的notice。
- Patchwork的目录包含七技能，正文只有调用skill后出现；system本身仍没有Patchwork正文。维护notice只出现在正向会话。
- 运行环境消息中临时目录名包含patchwork，只是cwd，不能当作提示词泄漏。

早期临时探针错误地把agent/request的路由配置当最终请求，产生空tools/false标记。这些字段已从保存快照移除并注明无效，改用上述宿主原生日志；没有把它们当provider wire capture。

本机证据在lab/evidence：`scope-*.json`、`session-*-native-request-summary.json`、`scope-standard-after-real.png`、`scope-patchwork-recall-fixed.png`、`scope-draft-reset.png`。临时scope-probe只用于实验，已从隔离overlay移除并仅重启隔离实例，最终访问原路径404；不在仓库或发布包内。

## 宿主差异与边界

同一空白会话 standard→Patchwork→standard 后，原生subagent曾从工具目录消失，31→30。对照同一宿主的 standard→minimal→standard：31工具完整恢复；standard→PTC→standard：**同样仅subagent消失**，过程中未选择Patchwork。记录在scope-native-control-before/after与scope-native-ptc-control-after.json。

这说明该现象不是Patchwork专属工具的泄漏；根因仍需DSH原生subagent异步recompose专项定位。未修改上游依赖去掩盖，不能承诺同一空白会话所有原生工具往返完全一致。独立standard会话目录、执行和接口隔离正常；已开始的会话由DSH禁止再切换preset。

隔离是宿主插件能力与自动上下文的边界，不是把同一操作系统用户可读的公开技能源码变成秘密。历史对话原文不会被删除。配置仍是DSH_HOME内的Patchwork用户覆盖，OCC/EPR仍有独立正确性待办并在真实验收中关闭；本轮没有证明成本收益或全面并发/恢复矩阵。

没有修改主DSH，未commit、push或发布。密钥仅通过隔离进程环境传递，审计文档不记录密钥、页面认证URL或探针凭证。仓库147个非依赖文件的本轮凭证扫描无命中；npm pack --dry-run确认67个发布文件包含runtime与固定fixture、不含临时探针。
