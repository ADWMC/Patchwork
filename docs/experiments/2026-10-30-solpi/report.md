# SoL 真实任务、源码调研与优化报告

2026-10-30。主 DSH、主配置与既有会话未改动；实验使用独立 DSH_HOME、preset 和任务副本。没有提交、推送或发布。本报告区分真实模型任务、实验 driver 的 native 探针和仓库的组合测试。

## 结论

- **EPR**：定向失败日志原文 5,084 bytes；模型 reducer 在 4096 预算下未生成可验证收据，原文放行，另一个更长日志的 2048 预算 pilot 也失败。新增 Node spec 确定性路径后为 3,566 bytes，缩小约 29.9%，完整保留三项失败段，额外模型调用为零。
- **OP**：真实文件盘点 13,386 bytes → 1,334 bytes 投影，模型未调用 `obs_recall`，准确回答 78 个文件及最后两个文件的 SHA256。独立读取原副本重新核对数量和哈希。归档仍保留原文。
- **OCC**：修复边界、原生锁重入、scoped service、no-op/取消结算和计量错误。真实 native compaction 将宿主 meter 从 19,590 降至 11,191，随后模型完成回归任务；这是 driver 显式调用，**尚不能证明 OCC 自动经济策略收益**。
- **AF**：同任务开关对照未完成相同验收；开启组还发生实验 driver 错误，且融合数为零。本轮没有 AF 收益结论，也没有据此盲目调整 AF 策略。

字节投影和宿主 meter 均不是账单费用；单次耗时不作统计显著的性能结论。默认开关保持 AF 开、OP/EPR/OCC 关。

## 官方源码基线

使用本机上游源码逐项核对，SoL-Pi HEAD 曾通过 `git ls-remote` 与远端比对；下列为固定实验基线，不声称后续版本兼容。

| 上游 | 固定 revision | 关键源码 |
|---|---|---|
| [NVlabs/SoL-Pi](https://github.com/NVlabs/SoL-Pi/tree/219568034fa54ed121ede80961655e33dfb9d0e3) | `219568034fa54ed121ede80961655e33dfb9d0e3` | `src/sol-pi/extensions/online-context-compact/{extension,state}.ts`、`observation-pack/index.ts`、`evidence-preserving-reducer/candidate.ts` |
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317) | `687f282e8625c6b8d11ff58211a90524be2e4317`，`dsh-v0.2.1-rc.2` | `packages/compaction/compaction-basic/src/{index,types,config,region,summarizer}.ts`、`packages/core/agent-loop/src/agent.ts`、`packages/preset/agent-preset-registry/src/index.ts`、`packages/llm/token-meter/src/types.ts` |

与 Pi 的关键差异及处理：

1. SoL-Pi OP 在上下文投影时替换旧观测；DSH 的 post-execute 只影响首次入库。保留当前首次占位符方案，补首尾证据；没有声称已经实现 Pi 的前两次全文重放。
2. DSH `compactNow` 自己调用非重入 `runMaintenance`。OCC 去掉外层维护锁，并从 `agentPresets.serviceFor(agent, 'compaction')` 取得当前 preset 的压缩服务；有 registry 时不能回退全局服务。
3. native compaction 有自己的保留量和 model policy。经济估计采用插件保留量与 native 实际保留策略的保守上界，固定 system 节点及工具 schema 不计作可移除内容；缺关键计量时拒绝乐观收益。最后核对还发现绝对保留量与 ratio 不能简单对象合并：路由 ratio 必须替换继承的 retainTokens；补测试先复现旧估计 20,000、正确上界 66,000，再修复并重跑全套。
4. DSH shell 派发成功不等于进程成功：真实失败输出可伴随 `isError:false`。统一检查 process exit、超时、取消及 AF thenRun，避免 OP/EPR/完成证据把失败算成功。
5. DSH `GenerateOptions.system` 是合法契约，无须改成额外 system 消息。没有采纳未被源码证实的修复猜想。

## 任务与原始结果

真实调用：官方 DSH CLI `0.2.1-rc.2`，模型 `step-3.5-flash`。实验 driver 显式组合 Patchwork preset，使用真实 Agents、LLM、工具及持久 session。默认 headless runner 不组合 preset，因此禁用该 runner，由本目录的 `dsh-runner.mjs` 驱动。

原始数据位于 `$env:TEMP\patchwork-sol-bench-20261030`；本目录保留无凭据任务输入、overlay、汇总与证据复核脚本。11 条运行记录含失败 pilot，并非 11 个成功任务。

### 1. 修复真实 OCC 边界缺陷，AF 关闭/开启

任务要求：只有同一 ID、同 text 从 pending/in_progress 变 completed 才触发；首次历史 completed、新 ID 直接 completed、重复 completed 都不触发。两组使用相同初始代码副本，并用独立五项验收检查模型提交的实现。

| 组别 | 实际调用与结果 | 独立验收 |
|---|---|---|
| AF off | 32 requests，186,647ms，以 max-tokens 结束；漏掉 same-text 条件 | 4/5 |
| AF on | 恢复出 62 条已提交 assistant 请求，约 359,334ms；未使用 then_run，融合 0 次 | 3/5 |

开启组六分钟超时后，早期 driver 调用了不存在的 `agent.abort` 而崩溃；已改为宿主 `agent.cancel(...)`。已提交 session 事件从 concat-zstd frames 恢复，明确标记 `harness-error`，排除效果比较。模型还迎合了旧错误测试；本轮未把模型补丁直接搬进主仓库，也未删验收点来获得通过。最终边界修复经代码审查和回归实现。

### 2. 诊断真实失败日志，EPR 原文/模型/本地路径

有效对照固定同一副本，命令为：

```text
node --test --test-reporter=spec tests/online-context-compact.test.mjs tests/observation-pack.test.mjs
```

三组实际均为 **31 tests / 28 pass / 3 fail**。日志来自任务 1 的失败副本，不是最终工作区的回归结果。

| 路径 | 结果 | 开销与证据 |
|---|---|---|
| 原文 | 5,084 bytes，4 conversation requests，14,326ms | 基准 |
| 模型 EPR，cap 4096 | 收据不可解析，原文回退；4 conversation requests，36,727ms | reducer 单独 22,055ms；已报告 input 1,634、cacheRead 128、output 4,096 |
| 新增本地 Node spec 路径 | 收据 3,566 bytes；3 conversation requests，11,927ms | 六条逐字引用，完整三项 failure section；local/node-spec，额外模型调用 0 |

早期 cap 2048 的长日志 reducer 也耗尽预算（12,623ms，input 5,973、output 2,048）并回退。因此选择格式可证明时本地解析优先；没有把默认预算盲目增大。`reducerMaxTokens` 仅作为可选配置，默认仍 2048。

本地路径要求：命令失败、Node spec summary 可识别、失败块数量与 fail 数完全一致、每条引用最多 600 字符、最多 12 条，且校验去重后仍能拼回完整 failure section。任何条件不满足均不套用该快路径；后续 reducer 失败仍原文放行。收据保留 `command_failed=true`、原文 SHA256、可读取的归档绝对路径。

模型最终正确报告 31/28/3，但根因解释仍有误判，不能据此声称诊断质量已解决。

无效 pilot 单列：Windows workspace-write 模式导致 test workers `spawn EPERM`，另一个副本缺少 research/benchmark/profiles/git 且受用户配置影响。后续有效组使用相同固定副本和相同隔离进程权限；这些环境失败不计作插件回归，也不混入收益比较。

### 3. 两阶段源码审查 → native 压缩 → 实际回归

真实读取四个机制文件，执行三次 update_plan；10 次会话请求，66,255ms。仅实验 overlay 设置 native compaction `auto=false / retainTokens=1000 / headroomTokens=8192 / maxTokens=4096`，没有修改产品默认。

- 取消 signal：native 返回 `AbortError`。
- driver 显式压缩：成功，宿主 meter **19,590 → 11,191**。
- 紧接着重复：`ManualCompactionError code=summary`，无法生成更小摘要；不是成功，也不是 null no-op。
- 后续真实模型执行 `node tests/online-context-compact.test.mjs`：当时任务副本 **21/21 pass、exit 0**。
- 独立 fresh session：native `compactNow` 返回 null/no-op，再由模型实际回答 READY。

OCC 自动状态最终是 `plan-complete`、compactions 0，短上下文的自动经济判定没有触发压缩。这轮证据证明 native 接线与压缩后续跑可行，不证明 OCC 自动触发的成本收益。新增 no-op、取消、已有债务保留、重叠 idle、并发计数、scoped retention 等回归验证其结算安全性。

### 4. 真实文件完整性盘点，OP 首尾证据

真实 pwsh 一次枚举 src/tests 的路径、大小、mtime、SHA256，并在末尾输出汇总及最后两项。初版 9,149 bytes 低于阈值，未打包；扩展实际清单后 13,386 bytes / 83 lines，投影 1,334 bytes。2 requests，6,874ms，**obs_recall 0 次**。

独立读取该实验副本重新计算，共 **78 文件**；末两项：

| 文件 | SHA256 |
|---|---|
| `tests/ui-stats.test.mjs` | `21C647B3879B794E08B7AD12BC96262BE98997CDC40044CAB2B508302B92838F` |
| `tests/user-config.test.mjs` | `E77938901E7898244C1D020DED1E440ABE789783B6EF0F8FBA9781163EAAD784` |

这是固定实验副本的哈希，不是当前持续编辑工作区的指纹。模型准确读到首尾证据；中段仍不重放，原文与分页召回保持可用。

## 已实施优化

| 机制 | 修复落点 | 解决的问题 |
|---|---|---|
| OCC | `plan/lifecycle/state/economics/config` | 真实完成转换；scoped native 服务；避免重入与并发触发；持久化成功再更新内存；原子状态写入；no-op/异常不清债、不续跑；计划完成不续跑；按 stream start 计数；token 增量、固定节点、native retention 与债务量纲一致 |
| EPR | `candidate/index/provider/receipt/node-spec` | 识别 Node 测试命令；失败判定；不重复处理 OP；本地完整失败段优先；逐字/hash 校验与原文找回；路由/耗时/usage/字节记录；模型返回后重新检查 agent scope |
| OP | `index/observation` | 失败命令不打包；增加尾部 512-byte 摘录，首部仍 512 bytes；尾部避免 UTF-8 continuation byte 开头 |
| 共享证据 | `src/util/tool-outcome.mjs`、`quality/evidence-gate.mjs` | exit 非零、超时、取消、融合验证失败不能算成功验收 |
| AF | 保留既有实现 | 本轮没有可靠的新策略结论，避免根据融合计数虚报节省 |

## 验证与边界

- 最终工作区 `node --test`：**158/158 pass，0 fail、0 skip、exit 0**；包含 agent scope、切换撤销、配置 API 授权和组合测试。原始输出保存在实验目录 `results/full-tests-complete.log`。
- OCC 定向覆盖为 23 项；真实阶段任务副本运行的 21 项与最终新增 retention 回归分开记录。
- 客户端构建一致性检查通过（31,307 bytes），`git diff --check` 通过；本轮未改 UI，也未重新执行上一轮 standard Web UI 切换流程。
- 对仓库 171 个已跟踪或未忽略文件扫描本次授权凭据的精确字面量，匹配 0；扫描仅输出路径与计数，凭据未写入文档或发布配置。这不等于对所有可能的秘密做穷尽扫描。
- 用真实 DSH 调用不等于所有测试都在真实产品入口执行：单元/组合测试、native driver 探针和模型任务分别报告。
- Usage 仅汇总宿主已报告值；不包括未报告的失败辅助调用或后台标题任务。没有货币成本或统计显著性结论。

## 后续升级优先级

1. **P1：AF 可用性与效果分开验收。** 固定简单 write/edit+验证任务、固定多步维护任务与外部验收，收集是否使用 then_run、实际请求、失败重试、任务完成率；跨多个任务重复后再决定提示和策略调整。开启组本轮失败不能被包装成收益。
2. **P1：OCC 长任务自动策略对照。** 在相同长会话里开关 OCC，验证真正自动边界触发、native retention、真实压缩费用和后续请求偿还。短任务维持拒绝压缩；没有数据前保持默认关闭。
3. **P1：EPR 扩展须先证据验收。** 优先收集 lint/build/其他 test reporter 失败语料；每个解析器都必须保证所有失败段可重建、失败状态不丢、随时读回原文。未知格式保留模型路径和原文回退，不强制缩写。
4. **P2：OP 历史投影策略。** 先验证 DSH surface-replacement 与原生 spill/pruner 同挂行为，再比较首次占位符与前两次全文策略；把召回频率、证据准确率及总请求开销一起量化。
5. **P2：配置与观测隔离。** 目前设置仍以 DSH_HOME 为边界；如迁移 profile 独立命名空间，应保留 standard 会话拒绝访问、切走撤销和并发重验授权，并补两会话同时调用的产品入口验收。
