# Patchwork 全文档融合执行方案

> 后续提案索引（2026-10-30）：[记忆、自进化与产物质量融合设计](../memory-evolution-design-2026-10-30.md)及[补充源码调研](../memory-evolution-research-2026-10-30.md)。新提案尚未实施；本文的文档数量、测试数字与执行结果保留为原轮次快照，不作为新记忆或学习能力已完成的证据。

日期：2026-10-30。范围：当前插件、现有 DSH 入口、隔离宿主验证；不修改主 DSH，不提交、推送或发布。本文同时是执行台账，结果只在验证后填写。

## 1. 统一目标与取舍

把“理解任务 → 有范围的动作 → 实际回执 → 逐项验收 → 纠正后重验 → 可恢复交付”接入现有运行时。研究报告是设计输入，不是待安装的指令包。继续复用四个 SoL 机制、宿主原生插件记录、既有鉴权路由与侧边栏；不另起记忆服务、WebUI、维护循环或自动发布器。

宿主不能证明的能力保持未知：模型提交的任务描述只是陈述，不是用户授权；普通 shell 不是文件系统沙箱；工具结果检查不是最终回答硬门禁；结构检查不能替代审美或语义质量。

## 2. 输入到执行的完整映射

| 输入 | 提炼与落点 | 验收 |
|---|---|---|
| `dsh-session-audit-2026-10-30/solution-plan.md`、`improvement-plan.md`、`user-corrections.md`、`evidence.md`、`methodology.md` | 通用任务版本、来源分层、目标/参考对象、动作策略、验收依赖、纠正失效；原始审计数据只作研究来源 | 失败/未知不 ready；旧版本回执不覆盖新要求；引用与命令派生不升级成人类授权；绝对路径导航 |
| `agent-memory-completion-grounding-research-2026-10-30.md` | 一种会话原生事件后端；任务/事实/经验分开；claim 与验收证据绑定；恢复与删除/替代关系 | 恢复、作用域、过期证据、缺退出码、矛盾/无支持、非代码验收 |
| `ai-self-evolution-research-2026-10-29.md` | 有来源的候选经验与固定条件评估档案；正确性优先、留出集、回退版本；沿现有 OCC 压缩保留短任务投影 | 代理文本分数不算真实执行；失败/退化阻止接纳；不自动改全局 prompt、评价器或发布 |
| `agent-skills-ui-ux-writing-coding-research-2026-10-29.md` | 六类职责融进已有 skills：宿主 UI、UX、README、发布说明、代码审查、技能评估；按需读取 | 触发/执行/收益分开；README 对真实命令；发布范围与状态明确；UI 主题/窄屏/交互 |
| `anti-slop-skills-research-2026-10-29.md` | 现有 anti-slop/standards/evidence/web-ui 技能内置事实保真、行为保真、宿主一致性与双向回归 | 保留否定、范围、时序、归属；不为自然表达编造；不为清理删安全边界；不追词表或综合分 |
| `upgrade/2026-10-29/*`、`experiments/2026-10-30-solpi/report.md`、`solpi-mechanisms-design.md` | 延续已落地隔离、四机制与真实调用基线，补任务回执关联与 AF 两阶段检查 | 不重建现有功能；历史实验数字保留其原始条件 |
| `logging.md`、`logging-audit-2026-10-30.md` | 日志继续白名单；任务事件独立 schema、只存有界元数据与引用，UI 投影复用现有 route | 不存提示词/命令全文/凭据；切换 preset 停止读写；恢复失败显式 degraded |
| 基础架构、设计与工程指南 | 保留 ESM/宿主注册、渐进披露、零全局 systemPrompt 修改和维护边界 | 原有测试全回归、bundle 一致、diff 检查 |

## 3. 实施顺序与完成条件

### A. 状态与证据（先落地）

- 新增 `src/task/` 的纯 reducer、验收聚合和原生记录适配。任务、要求 revision、产物版本、验收方法、覆盖集合与真实 tool call 分离。
- 用真实派发/结果绑定验收；命令缺退出码为 unknown。ready 只能由当前有效的必需验收项得出；没有验收定义不能自行 ready。
- 纠正/产物变化使相关证据 stale；旧异步结果保留旧 revision。baseRevision 拒绝旧编辑。
- 注册 Patchwork 范围内的任务工具/内部命令；保留来源强度，不用 schema 或 `source.kind=user` 伪造授权。

完成条件：正反、非代码、并发、取消、覆盖、旧修改、恢复与标准 preset 隔离测试通过。

### B. 动作边界与 SoL 接线

- 在本机宿主实际支持的 `pre-execute` / guard 接口上接入已知结构化写工具检查；工作对象与参考对象分开。
- AF 写入与 then_run 各自检查，第二段执行前再验证 revision。普通 shell 明示策略检查而非强隔离；不绕开原审批。
- 当前任务短投影接入现有上下文维护/工具回执，避免依赖额外后台循环；失败重复计数仅对相同验收输入，不能无限整批重试。

完成条件：结构化越界拒绝、正常工作区允许、复合工具中途纠正、切换 preset、实例匹配与普通 shell 边界有对应测试。

### C. 技能与演化闭环

- 更新现有技能的步骤与触发描述，不把四份报告全文注入模型。写作/README/changelog 与代码/UI 使用各自验收，不一律要求 shell。
- 增加可执行的候选评估档案检查：条件、来源失败、基线/候选、调优/留出集、正确性/维护/成本/延迟、退化、决定与回退点。未做对照不得声称稳定收益。
- 不自动全局存经验、安装第三方技能、自修改或提交代码。

完成条件：技能结构和行为约束测试；候选缺证据、伪执行、留出缺失及退化反例被拒绝。

### D. 既有 UI 投影与真实隔离验证

- 仅扩展当前总览/证据页：任务阶段、revision、工作/参考范围、策略能力、验收覆盖和有效产物；继续宿主 tokens/浅深色/键盘路径。
- 用独立 DSH home、work、端口和真实宿主工具验证：成功、失败、纠正、恢复、standard 会话无泄漏。精确识别受管实例，绝不回退主实例。
- 完成全量测试、client build/check、差异与凭据扫描，更新入口文档与本执行台账。原始研究保留“未复现”的历史边界。

完成条件：明确区分单元/组合/真实宿主/浏览器证据。宿主接口限制如最终文本无法硬拦、自由 shell 不能强隔离，列为产品能力边界。

## 4. 证据与执行台账

| 阶段 | 状态 | 本轮结果 |
|---|---|---|
| 文档融合方案 | 已完成 | 研究、审计与工程指南统一映射；实现、证据、取舍与宿主边界写回本台账 |
| A 状态与证据 | 已实施并验证 | `src/task/` 的 reducer、原生 checkpoint、逐项覆盖、产物版本、真实工具回执、纠正失效与任务工具；失败/未知/旧版本不通过，冷恢复与 fork 已实测 |
| B 动作与 SoL 接线 | 已实施并验证 | 真实 pre-execute + 同步 guard 检查结构化路径、junction、参考对象、阶段、参数和 revision；新消息后先重述契约；AF 写入后再检查接续，OCC 复用原维护锁与短投影 |
| C 技能与评估 | 已实施并验证 | 更新既有 patchwork/evidence/anti-slop/web-ui/standards；任务内候选绑定失败回执，新增实验档案检查器；不自动激活或声称收益 |
| D UI 与真实隔离验证 | 已实施并验证 | 既有总览/证据页展示任务、覆盖、路径与来源；隔离官方宿主、真实模型修复、冷恢复/分支、原生 ZIP、主题/窄屏/复制/standard 实测通过；195 项回归全通过 |

### 4.1 实现入口与 API

`src/runtime.mjs` 注册任务生命周期；`src/index.mjs` 仍只负责 Web 桥接。任务模块按职责拆分：

| 文件 | 职责 |
|---|---|
| `src/task/state.mjs` | 有界状态、revision、验收覆盖与聚合、纠正/替代、候选来源；恢复时白名单重建并重新计算状态 |
| `src/task/store.mjs` | 原生 Session checkpoint、异步落笔前重新授权、最多尾部 5000 事件恢复；产物 stat/真实路径变化后失效 |
| `src/task/action-check.mjs` | 路径规范化与作用域、已知 write/edit 策略、宿主同步 guard、验收 callId 标记 |
| `src/task/acceptance.mjs` | 产物登记、真实宿主命令派发、退出码/取消/版本绑定、非代码文件结构检查 |
| `src/task/lifecycle.mjs` | preset 内工具、内部命令、输入来源与 pre-step 短投影 |
| `src/client/TaskEvidence.jsx` | 宿主原生侧栏的任务、逐项覆盖与完整路径投影 |
| `src/quality/evolution.mjs` | 候选实验的结构准入检查；不运行实验、不认证来源、不自动接纳 |

模型工具名称为 `patchwork_task`，操作为 `inspect/define/correct/artifact/check/assessment/candidate/cancel`。
先 inspect，再使用返回的当前 `revision` 作为每次修改的 `baseRevision`。所有字段均在顶层，不能包进 `arguments`：

```js
// 以下是工具参数示例；r 必须取最近工具返回的 revision。
{ action: 'define', baseRevision: r, title: '修复加法行为', phase: 'implement',
  requirements: [{ id: 'sum-tests', label: '固定测试', kind: 'command', targets: ['sum'] }] }
{ action: 'artifact', baseRevision: r, id: 'sum', path: 'C:/isolated-work/sum.mjs' }
{ action: 'check', baseRevision: r, id: 'sum-tests', tool: 'pwsh',
  command: 'node --test --test-isolation=none acceptance.test.mjs', description: '验证固定加法测试' }
```

`check.id` 是验收项 ID；`artifact.id` 与该验收的 `targets` 对应。省略 coverage 默认 `['all']`，不能发送空数组；多单位检查必须逐项覆盖。
写作/文档使用 `kind: 'artifact'` 与 `rules: { anchors, minLength, maxLength }`，仅对一个已登记的 ≤1MiB UTF-8 文件做结构判断。
`kind: 'semantic'` 使用 assessment 记录模型意见，状态始终 unknown。`/patchwork-task` 是宿主内部状态命令。
`cancel` 更改任务状态，不等于停止任意外部进程；实际子进程取消仍依赖宿主信号。

任务初始为空时保留原工具路径以兼容普通任务；已登记任务收到新输入后，证据保守失效，已知结构化写入须先 correct/define 重述契约。
显式 correct 可只失效 `affected` 项；这不是自然语言已被自动精确理解，也不授予额外权限。
普通非验收 shell 会保守失效当前证据；只有由 check 精确派发的 callId 能作为该次检查的命令回执。
EvidenceGate 和任务短投影都会重新检查产物是否变更，避免直接使用陈旧 ready。

### 4.2 回归与真实宿主证据

| 层次 | 本轮结果 | 证据位置 |
|---|---|---|
| 全量回归 | `node --test`：195 项通过，失败/取消/跳过均为 0 | `%TEMP%/patchwork-integration-tests.log` |
| client 产物 | `node scripts/build-client.mjs --check` 通过，76728 bytes | `lib/client.js` |
| 格式差异 | `git diff --check` 无错误；保留仓库原有未提交工作 | 工作区差异 |
| 包文件预检 | `npm pack --dry-run --json`：86个文件，任务/技能/实验检查器及 client 等必需文件无缺失；未实际发布 | 本轮隔离结果与终端回执 |
| 授权凭据扫描 | 仓库和本轮隔离目录精确匹配为0；也解码 Zstd 与 ZIP 内容，未发现本轮授权凭据；排除 `.git/node_modules/symlink`，不等于任意秘密全面检测 | `credential-scan.json` |
| 真宿主驱动 | 原生工具实际调用：越界/参考写入拒绝、AF exit 7、失败不 ready、纠正后重验、文档结构验收、standard 无工具、旧工具引用撤销 | `docs/checks/task-integration-driver.mjs`；隔离结果 `native-model.json` |
| 真模型任务 | StepFun `step-3.5-flash` 读取固定测试并把 `sum.mjs` 的减法修为加法；登记产物后由原生 pwsh 执行同一固定测试，通过后 ready；新用户纠正后 stale/partial | `native-model.json`，12 次实际模型工具调用（含 skill/read/edit/patchwork_task） |
| 冷启动/真实 fork | 精确停止本轮实例，再使用同一隔离 home 重启官方宿主；原生 Session resume 保留 ready/revision，模型纠正 stale 保留；真实 fork 不继承 ready 或实例，新输入未重述的写入被拒绝 | `restore.json` |
| 原生导出 | 从宿主“更多操作 → 下载 Session 日志”下载真实 ZIP，90 条记录中含 7 条 task records，全部 ignorable；官方 Session 重建，替换任务记录为等序号空 ignorable 对照及追加后派生消息不变 | `ui-session.zip`、`export-check.json` |
| 浏览器 | 1440×1000 与 390×844，宿主设置切换浅/深色并恢复深色；真实 clipboard 与键盘标签；窄面板 client/scroll 均389px、路径无溢出；standard 实际回复后锁定面板且停止轮询，页面/控制台错误0 | `ui-final.json` 与截图 |

隔离环境为 `%TEMP%/patchwork-integration-20261030/`：独立 `home/agents/work/results`，绑定 `127.0.0.1:4324`，官方 DSH 0.2.1-rc.2；没有修改、停止或重启主 DSH。
provider 凭据只通过子进程环境传入；overlay 只记环境变量名。Browser plugin not available，使用本机已有 Playwright/Chromium；未新增浏览器依赖。
截图包括 `task-evidence-dark.png`、`task-evidence-light.png`、`task-evidence-mobile.png` 与 `task-standard-locked.png`，保留在隔离 results 内，不加入发布包。

首次真实模型 pilot 暴露了工具嵌套参数、产物 ID 和空 coverage 的误用，验收未被错误聚合为 ready；已改为顶层参数、明确示例和省略 coverage 的默认值。
Windows 宿主内原 `node --test acceptance.test.mjs` 曾遇到 `spawn EPERM`。重试沿用同一固定测试文件，使用 Node 的 `--test-isolation=none`，没有替换为更弱的自编验收或改写测试。
失败 pilot 的自由文本曾自称“实质完成”，因此本轮只证明任务状态和工具回执约束，明确不宣称最终文本已被硬拦。

原始 task records 不进入宿主派生模型消息；显式调用任务工具所得结果、pre-step 短投影及 OCC 续跑摘要会进入 Patchwork 上下文，存在实际 token 成本。
没有受控的旧/新版本收益对照，不能把调用数量、技能字节数或本次成功率当作性能提升。

### 4.3 技能、候选经验和交付

未新增第八套常驻规则或外部记忆后端。五份受影响技能都保持短小（最大正文文件2674 bytes），architecture/collaborator 继续保留原职责。
任务内 candidate 必须引用仍保留的失败/未知回执，成功回执或无来源输入不能生成有效候选；状态永远为 candidate。

实验档案检查入口：`node scripts/check-evolution.mjs <experiment.json>`。要求基线/候选同模型、宿主、环境、初始版本、预算，调优/留出不重叠，正确性/维护门槛、成本/延迟、覆盖、退化与回退点齐全。
这是人工代码评审前的结构准入，不能认证档案提供者的“real-host”声明，也不自动激活、改 prompt、提交或发布。
本轮只实施与测试该准入器，未执行可证明经验泛化收益的受控研究。

入口 README 中英文、基础架构、Hook、日志、定位、来源说明与 preset 排障同步更新。历史研究、会话审计与上一轮报告加实施索引，保留原样本与测试数字所属日期。

## 5. 不采用与剩余边界

不同时引入多套外部记忆后端，不使用 AI 检测器/词重合分代表质量，不复制高视觉变化模板，不把每次历史纠正变为永久禁令，不把研究作者的报告当本插件收益。首句顺序、最终回答可否决、任意 shell 强沙箱及真正人类授权证明，只有宿主提供可靠接口后才能宣称硬保障；当前实施应可观察、可恢复并诚实呈现未验证状态。

ready 只反映登记集合，不能证明集合涵盖了用户全部意图，亦不能自动识别一个命令是否充分测试了行为。
文件新鲜度使用真实路径与 size/mtime/ctime，不是任意恶意篡改的密码学证明；known-tool 策略也无法消除文件系统检查与写入之间的 OS 竞态。
会话 checkpoint 不等于跨项目长期记忆。恢复扫描有界、进程内追加串行，未提供跨进程事务；配置仍以 DSH_HOME 为范围。
尚未验证任意外部进程树取消、多用户 ACL、所有第三方工具通道、所有宿主版本/浏览器，以及完整打包发布安装链路。
本轮验证使用隔离 profile 的源码挂载，没有提交、推送、发布或替换用户主实例。

## 6. 全部文档的归并口径

本轮 `docs/` 下共36份 Markdown（含本文），加中英文 README。不是把全部建议叠进 prompt，而是每组明确其当前职责、历史属性或不采用项：

| 文档组 | 归并结果 |
|---|---|
| 四份 `*-research-2026-10-29/30.md` | 任务记忆/完成依据、候选评估、职责技能、表达保真分别落到 A/B/C/D；保留原研究来源，不冒认其结果为本插件收益 |
| `dsh-session-audit-2026-10-30/` 七份文档（README、solution-plan、improvement-plan、evidence、methodology、session-index、user-corrections） | 汇总问题进入任务契约/来源/覆盖/失效/路径；原始会话不复制为常驻记忆，索引与审计是历史证据 |
| `upgrade/2026-10-29/` 六份（README、audit、isolation、research、verification、webui） | 沿用已落地的 preset 隔离、原生入口与四机制；其历史测试数仍属于原轮次，当前结果以本文为准 |
| `experiments/2026-10-30-solpi/` 两份（README、report） | 四类真实 SoL 任务及失败样本继续作机制基线；本轮增加任务版本绑定，不替换旧实验或推定统计收益 |
| `logging.md`、`logging-audit-2026-10-30.md` | 当前日志边界与历史问题分开，补任务记录的隐私/保留、冷恢复和 ZIP 结果 |
| `agent-foundation.md`、`hook-foundation.md`、`architecture-collaborator-skills.md` | 运行时/Hook/技能职责和入口同步，维持七技能、渐进披露、单一规则来源 |
| `deepseek-harness-plugin-development.md`、`dsh-web-plugin-contracts.md` | 官方接口索引与按版本实测契约；历史契约显著标明年代，当前宿主能力由真实验证限定 |
| `design-token-efficient-coding-plugin.md`、`solpi-mechanisms-design.md` | 保留最初候选与机制细节；原 systemPrompt 壳和未经对照的收益目标不采用，当前状态由实现及本文判定 |
| `engineering-agent-guide.md`、`product-engineering-guide.md` | 最小改动、事实优先、用户任务路径、隐私与维护边界；本轮走真实宿主/复制/导出/标准模式，而非只看接口200 |
| `git-commit-conventions.md`、`preset-and-release-lessons.md` | 授权后提交，推送另需明确要求；派生 preset 和 bundle 保持单一源，未执行发布安装链路就不宣称 release-ready |
| `positioning.md`、`source-notes.md`、`troubleshooting-agent-preset-switching.md` | 修正旧“完整运行时全 profile 生效”、旧提示词入口与常规删除历史目录的误导；更新为 root Web 桥接 / preset runtime |
| 本文、`README.md`、`README.en.md` | 统一方案、操作入口、当前已验证能力、失败记录和剩余边界；不增加第二套实现或新的全局指令 |
