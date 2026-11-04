# 技能融合执行记录

日期：2026-10-31。对应[融合方案](skills-fusion-plan-2026-10-31.md)。本记录区分已经写入仓库的能力、确定性测试和真实 DSH 单次试跑；**没有完成多任务净收益验证**。

## 范围与基线

- 工作树开始时已有大量未提交修改；保留这些工作，不做 reset、clean、主 DSH 安装或主配置修改。当前 Git HEAD 为 `ef19dc7`，但它不代表全部实验代码：技能和运行时改动仍在 dirty 工作树中。因此 P0 所要求的可重跑七技能正文哈希与固定仓库快照**尚未完整冻结**。
- 原目录七技能：`anti-slop`、`architecture`、`collaborator`、`evidence`、`patchwork`、`standards`、`web-ui`。扩展目录另有 `debugging`、`code-review`、`retrieval`、`documentation`、`memory`、`improvement`。
- 结构测试覆盖上述 13 个目录、按需正文、资源目录、默认 `skillsMode: core` 的七技能目录、显式 `expanded` 和 `skillsEnabled: false` 的关闭路径。`tests/fixtures/skill-routing.json` 对每个技能有四条正例和四条相邻负例；该测试只检查样本与目录完整，**不判定模型路由正确率**。

## 已实施

1. 收紧原七技能的触发与行为边界：删除假二选一、固定重试、无条件任务登记等容易造成误判或额外调用的措辞；`patchwork` 负责导航，横切的验收、协作、标准按需加载。七个旧名称保留。
2. 新增六个原生 DSH 技能和条件参考。检索技能复用来源治理与工具可用性检查；读到足够回答问题的官方原文后应停止，provider 因凭据或网络边界失败后不循环重试。`web-ui` 的已有参考继续按需读取，未直接安装第三方技能或用户 ZIP 中的指令。
3. `src/skills/register.mjs` 默认注册七个 `core` 技能，显式 `skillsMode: expanded` 注册十三个，`skillsEnabled: false` 关闭；正文经宿主 `skill` 工具渐进披露，没有写入 systemPrompt。非 Patchwork Agent 的工具/技能隔离由现有注册与组合测试检查。
4. 对真实评审中暴露的额外任务工具调用，允许一次性只读任务不登记；未登记任务仍禁止结构化 `write/edit`。`/patchwork-review` 提示词明确禁止临时探针或写文件命令。对应守卫位于 `src/task/`，有回归测试。
5. README、英文 README、CHANGELOG、更新日志指南及发行包清单与当前显式试用状态同步。扩展十三技能尚未证明质量提升；检索复测退化后默认目录已退回 `core`。

## 隔离真实调用

实验在独立临时目录 `C:\Users\Administrator\AppData\Local\Temp\patchwork-skills-eval-26353d24b8d44741be114bb0b780740c` 完成，分别使用 `home`、`agents` 和 `workspace`；只在其 headless profile 安装本仓库链接。宿主是官方 DSH `0.2.1-rc.2`，模型为 StepFun `step-5-preview`，由 DSH agent、preset、技能和工具链执行；不是直接请求模型 API。实验输入与无凭据 overlay 位于 `docs/experiments/skills-2026-10-31/`；原始会话 JSON 留在临时目录，未并入仓库。凭据只在实验进程环境提供，不写入本记录。

| 单次任务与模式 | 实际结果 | 请求 / 耗时 / 工具调用 |
| --- | --- | --- |
| 六场景技能路由，expanded | 模型依次加载六个新增 `skill` 并结束；只证明这次路由可达。 | 2 / 43.9 秒 / 6 |
| Windows EPERM 调试，expanded | 加载 `debugging`，结束。 | 2 / 20.9 秒 / 1 |
| 同题，core | 首次请求后到达 `max-tokens`，未完成。 | 1 / 50.7 秒 / 0 |
| 同题，none | 加载宿主自带 `diagnose-windows-sandbox-acl`，结束。不能将结果归功于 Patchwork。 | 2 / 11.9 秒 / 1 |
| 内联 `startsWith` 路径评审，expanded/core/none | 三组都指出兄弟目录被前缀比较误判；首轮 expanded 额外调用四次 `patchwork_task`，开销偏高。 | expanded 6 / 39.8 秒 / 5；core 1 / 24.6 秒 / 0；none 4 / 55.0 秒 / 3 |
| 同一评审，改进只读边界后 expanded 重跑 | 加载 `code-review`，找出同一问题，没有文件操作；改动与提示词同时发生，不能独立归因。 | 2 / 16.1 秒 / 1 |
| 官方 Agent Skills 规范检索，expanded | 加载 `retrieval`；宿主 `web_search` 缺 provider 凭据，回退 Patchwork 搜索并打开官方规范，正确回答 frontmatter 必填 `name`、`description`。随后仍有重复搜索与抓取失败。 | 11 / 139.9 秒 / 15 |
| 同题，首次收紧停止条件后 expanded 复测 | 模型使用相似但错误的 `agentskills.dev` 域名，官方原文未打开；反复抓取无关站点，240 秒隔离超时后 `aborted`，未给出已核实答案。这是一次明确退化样本。 | 15 / 241.8 秒 / 29 |
| 同题，加入错误域名与窄问题边界后 expanded 复测 | 模型没有采信第三方结果，在官方路径受网络与 robots 限制后报告“未能核实”，未编造已打开来源；但仍进行了重复抓取，耗时偏高，任务未得到答案。 | 8 / 139.7 秒 / 14 |

请求数取 DSH `agent/request` 事件，工具调用取 `tool/call`，耗时取实验 driver 的 `elapsedMs`。上述任务不是同一固定输入、随机种子、预算和仓库快照上的完整 A/B；耗时也受网络与缓存影响。第三次复测说明误用相近域名与无关来源的问题有所收束，却仍没达到“从官方资料回答”的验收，并非检索收益证明。三次检索后将默认目录退回 `core`，`expanded` 改为显式试用；实验原始数据仍逐次保留。最后追加的“优先原生无密钥搜索”和窄问题两次查询预算**尚未真实模型复测**。由于切回默认配置发生在这些调用之后，复现 expanded 实验须显式指定 `skillsMode: expanded`。

## 确定性验证与剩余工作

### 地球 HTML 真实任务补测

2026-10-31 又用隔离 DSH 的 StepFun `step-5-preview` 运行地球任务。任务要求调用 `web-ui`，在空的隔离工作目录写单文件 HTML；原有 `artifacts/earth.html` 未读取或覆盖。四次尝试均保留，不能只展示最后成功的一次：

| 尝试 | 结果 | 请求 / 耗时 |
| --- | --- | --- |
| 原任务，4096 输出 token | 加载 `web-ui` 并读取两份参考，写入前 `max-tokens`，没有文件。 | 3 / 67.2 秒 |
| 原任务，16384 输出 token | 任务登记先因缺 `baseRevision` 失败，随后 `inspect`；四分钟隔离超时，没有文件。 | 5 / 240.0 秒 |
| 缩小任务，8192 输出 token | 加载 `web-ui` 并 `inspect`，在长设计推演中 `max-tokens`，没有文件。 | 2 / 121.2 秒 |
| 缩小任务 + 同会话执行提醒，8192 输出 token | 最终写出并完成；实际 45 次请求、3 次 `write`、36 次 `patchwork_task`。模型自行报告的行数有误：盘上为 233 行、9240 字节。 | 45 / 560.0 秒 |

最终模型产物先原样复制到 `artifacts/earth-step5.html`，当时 SHA256 与隔离源文件一致。独立静态检查确认内联 JavaScript 可解析、无外部链接；用 Playwright 驱动系统 Edge 的临时 profile 打开本地文件，1440×900 与 390×844 均非空白、无页面异常或横向溢出，暂停按钮状态、拖拽旋转和滚轮缩放均响应。可见画面是**简化多边形大陆**，视觉品质仍需用户审查；该次完成耗时与工具调用明显过高，不能作为技能效率提升案例。用户随后指出页面把“简化大陆 · 日照明暗 · 星空”等制作说明误当 UI 文案；仓库版已删除副标题、底部功能提示及技术性浏览器标题，并将“设计说明留在会话”加入 `web-ui` 技能。隔离原件保留供对照，仓库版不再与其哈希一致。原始 DSH 事件保存在隔离目录的 `earth-step5-run*.json`，不含模型凭据。

- 本轮 `npm test`：227/227 通过；`git diff --check` 无空白错误（已有文件的 CRLF 转换提示不算失败）。`npm pack --dry-run --json` 核实发行包包含执行记录、六个新增技能和八份技能参考；六份主要文档的相对链接检查无缺失。这些测试验证结构、隔离守卫与组合行为，不能替代模型任务质量测量。
- P0 尚需保存可重跑的七技能基线、完整 dirty 快照或固定提交及真实任务来源。P1/P2 的正文、每技能四正例加四难负例和条件参考已落地；但样本尚未逐条跑真实模型，误触发率与产物对照未知，不能视为阶段验收完成。
- P3 尚需预注册任务集、相同输入与工具预算、`none/core/expanded/等长无关文本` 四臂、多次重复、留出集、失败与成本全量报告；UI 要做同图同任务的人工盲评。单次正例不能用于营销收益声称。
- 检索任务的直接阻塞是隔离环境中宿主 `web_search` 无 provider 凭据、公共搜索只返回低相关结果或 transport error，以及官方页面抓取受网络/robots 失败影响。下一轮先在隔离 DSH 中排查 provider 连接、代理与官方来源发现质量，再复跑预注册的窄问题及多来源任务；不能通过绕过抓取边界制造成功样本。
- P4 目前仅为显式可回退试用。各技能是否进入默认目录，应由 P3 的用户任务验收、额外成本和非 Patchwork 隔离负例决定；未取得净收益前不宣称正式采用。
