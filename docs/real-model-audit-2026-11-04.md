# 真实模型调用审计报告（2026-11-03/04）

状态：**证据盘点，不是全量通过声明**。本轮真实模型调用没有全部写成仓库报告；下面是现有证据、结论和缺口。

> 2026-11-04 更新：已生成可离线校验的报告目录 [`docs/checks/real-model/2026-11-04/`](checks/real-model/2026-11-04/index.json)，把旧 A–D/I/regression 会话和本轮 code/memory/task 调用迁入 manifest/report；`npm run audit:verify` 通过。任务命令 check 仍被 Windows Job runner 基础设施错误阻塞，保留为 `task-check-db31` 失败样本。

环境：隔离 DSH `0.2.1-rc.5`，StepFun `step-5-preview`，独立 `DSH_HOME`、工作区、端口；主 DSH 未修改、未停止。
原始证据：`C:\Users\Administrator\AppData\Local\Temp\patchwork-latest-20261103`（临时目录，可能被清理；未提交到仓库）。

## 1. 结论

- 仓库里只有 2026-11-01 那轮的 `docs/checks/*`，不是本轮 11-03/04 真实模型调用的完整报告。
- 本轮 A–J 面板/会话审计、`final`/`rc5` 冒烟、`regression` 复验，主要留下原始 JSONL dump、审计 txt 和截图，没有统一的 Markdown/JSON 汇总。
- 其中 B 会话暴露的 `patchwork_memory inspect` 失败已在代码和单元测试中修复；2026-11-04 的 `memory-scope-87d4` 真实模型会话已复验 `MEMORY_PROJECT_SCOPE_REQUIRED` 与带 `includeProject:true` 的成功读取。
- D 与 I 都是“读取 README 并总结”，却出现两种行为：I 直接 read + report；D/child 走了完整 task/语义验收并停在 `review/partial`。说明 read 任务的提示仍有模型相关波动。
- `docs/checks/improvement-real.json` 明确 `modelRequests: 0`，不能算真实模型调用报告。

## 2. 会话清单

| 记号 | 会话 / 提示 | 实际结果 | 证据 | 报告状态 |
|---|---|---|---|---|
| 6b6e | 读 README，总结长期约束 | 成功；读取并总结三条约束 | `session-6b6e.txt`，11 frames / 72,750 bytes | 仅原始 dump |
| b7f9 | 只回复 OK，不调用工具 | 成功；未调用工具 | `session-b7f9.txt`，8 frames / 60,986 bytes | 仅原始 dump |
| c87 | 运行 `pwsh Write-Output OK` | 失败；Windows Job runner 无法启动子进程，多次重试后仍失败 | `session-c87.txt`，28 frames / 122,288 bytes | 失败与后续修复未写成报告 |
| final | 只回复 OK | 成功 | `session-final.txt`，10 frames / 60,153 bytes | 仅原始 dump |
| rc5 | rc5 上只回复 OK | 成功 | `session-rc5.txt`，8 frames / 60,101 bytes | 仅原始 dump；不是完整功能验收 |
| A | 修复 `sum.mjs` 加法，登记 artifact + npm test | 最终 `ready`；但 check 后又跑独立 `pwsh`，artifact 变为 stale，模型自行重登记并重跑 check 恢复 | `audit-A.txt`，50,012 bytes；`audit-A-before/after.png` | 仅原始 audit |
| B | 记忆 propose / recall / inspect / list | propose committed；recall 对 proposed 为空（符合预期）；inspect 返回 `MEMORY_NOT_FOUND`（当时缺陷）；list `includeProject` 可读到 | `audit-B.txt` 11,563 bytes；修复后复验见 `memory-scope-87d4` | 已迁移并复验 |
| C | fetch `example.com` + evidence cite | 两步均成功，evidence cited | `audit-C.txt`，10,253 bytes | 仅原始 audit |
| D | 主控提交 superagent 只读读 README | 子任务完成，但父会话用 `job_output` 轮询 agent 子会话，返回 `unknown job`；父最终 inspect 为 `review`，未自动接纳 | `audit-D.txt` 10,663 bytes；`audit-D-child.txt` 10,530 bytes | 仅原始 audit |
| I | superagent 只读读 README | 子会话直接 read + report `ready`，没有登记 task；路径更短 | `audit-I-child.txt`，6,112 bytes | 仅原始 audit |
| parent/child final | 最终 superagent 只读任务 | 父报告 `review`；子任务 `partial`，语义要求保留 `unknown`，未自动 ready | `parent-final.txt` 169,448 bytes；`child-final.txt` 326,227 bytes | 仅原始 dump |
| regression | 登记 sum.mjs 锚点 + `npm test`，验证 check 输出 | 两项 requirement 均 passed；check 返回 `output` 含真实 `npm test` 输出；未见 check 后独立 shell | `regression-session.txt` 26,203 bytes；`regression-run-before/after.png` | 仅原始 dump；未汇总成报告 |
| E–H, J | 面板截图审计 | 只有截图，没有对应文本/JSON 报告 | `audit-E..J-before/after.png` | 不完整 |
| panel | task/queue/memory/improve/plan 面板 | queue/memory `ERRORS []`；task/improve 有 console 404（可能是静态资源，未定性） | `panel-*.txt` | 部分文本，无汇总 |

## 3. 已确认的缺陷与修复状态

### A：check 后独立 shell 使 artifact 失效

`audit-A.txt` 在 `patchwork_task check` 通过后，模型又运行了 `node --version; npm --version; npm test`，随后 task 事件把 artifact 标为 changed、command 验收标为 stale。模型自行重登记并重跑 check，最终 `ready`。

后续 `regression-session.txt` 没有出现 check 后独立 shell，check 的 `output` 字段包含真实 `npm test` 输出。**行为已改善，但 A 会话本身仍是“模型先犯再恢复”，应保留为真实样本，不应从报告里抹掉。**

### B：project-shared 记录 inspect 失败

`audit-B.txt` 中：

- `propose`：`status: committed`，记录为 `project-shared`、`proposed`。
- `recall`：`entries: []`，因为 proposed 不参与召回，符合设计。
- `inspect`：`MEMORY_NOT_FOUND`。
- `list` + `includeProject: true`：能读到同一条记录。

当前 `src/memory/tool.mjs` 已加入 scope 判断：无 `includeProject` 时，如果 all-scope 能查到，返回 `MEMORY_PROJECT_SCOPE_REQUIRED`，而不是裸 `MEMORY_NOT_FOUND`；`tests/memory-tool.test.mjs` 覆盖该分支。2026-11-04 的 `memory-scope-87d4` 真实模型会话已复验该错误码和带 `includeProject:true` 的读取。

### C：fetch + evidence

`audit-C.txt` 显示 `patchwork_fetch` 成功，`patchwork_evidence cite` 返回 `committed`，excerpt/quote/claim 均有 hash。该链路通过。

### D / I：superagent 只读任务的行为不一致

- D：父会话把 agent 子会话当 background job，用 `job_output` 轮询，得到 `unknown job`；子任务本身完成。父最终 `review`，没有自动接纳，这一点符合安全纪律。
- I：子会话直接 `read` + `patchwork_superagent report ready`，没有登记 task，路径明显更短。
- parent/child final：仍出现 task 登记 + 语义 `unknown` + `review`，说明“简单 read 不应过度验收”的提示还没有稳定生效。

**缺口：** 需要用同一提示、同一 fixture 多次运行，统计 read job 的 task 登记率、report 状态和步数；当前只有少量样本。

### c87：Windows Job runner 失败

`session-c87.txt` 中 `pwsh` 连续失败，后台 job 也被 killed；模型尝试重试和换工作目录，仍失败。后续通过全新 profile 冷启动恢复，但失败会话、根因和修复证据没有写成仓库报告。

## 4. 仓库里已有的报告

`docs/checks/` 中与本主题相关的主要有：

- `memory-real.json`：记忆工具隔离/确认/重启恢复。
- `retrieval-fetch-real.json`：真实 fetch、无密钥搜索、robots/redirect/cancel 边界。
- `superagent-native-2026-11-01.json`：superagent 原生执行。
- `closure-2026-11-01.json`：2026-11-01 的 425 项测试、构建、文档链接等 closure 检查。
- `improvement-real.json`：**`modelRequests: 0`，不是真实模型调用报告**。

这些是 2026-11-01 及更早的证据，不能替代本轮 11-03/04 的真实模型审计。当前聊天中提到的“431 tests / UI 19 checks / 60 viewports / 全新 rc.5 profile 0 disabled”也没有对应的本轮仓库 JSON。

## 5. 还没写 / 需要补的

1. **统一汇总报告 + JSON**：已生成 `docs/checks/real-model/2026-11-04/`；后续新增会话继续追加 manifest/report。
2. **B 的真实模型复验**：已完成 `memory-scope-87d4`，确认 `MEMORY_PROJECT_SCOPE_REQUIRED` 后模型会带 `includeProject:true` 读取。
3. **D/I 的重复实验**：同一只读 README 任务至少 3 次，记录 task 登记率、report 状态、步数，验证 prompt 软化是否稳定。
4. **E–H/J 面板审计文本化**：目前只有截图；需要补 tab、控件、console error、布局断言。
5. **最终 closure 证据**：当前测试数、UI 验收、rc.5 冷启动、主 DSH 未触碰，写成 `docs/checks/*.json` 或 closure 报告。
6. **原始证据耐久化**：临时目录不可长期依赖；至少把关键 audit txt、session ID、hash 和结论复制到 `docs/checks/`，不要只留在 Temp。

## 6. 结论

**没有全部写完。** 真实模型调用本身做了不少，但“报告”目前是分层不完整的：

- 有原始证据；
- 有部分上一轮 `docs/checks`；
- 没有本轮统一报告；
- 有一个已修并在 `memory-scope-87d4` 复验的记忆缺陷；
- 有行为不稳定的只读 superagent 样本；
- 有只留截图、没有文本结论的面板审计。

下一步应先补第 5 节的 1–3 项，再谈“全部真实模型调用已报告”。
