# Patchwork

English version: [README.en.md](README.en.md)

更新记录：[CHANGELOG.md](CHANGELOG.md)（含未发布变更）。

## 开源协议

Patchwork 采用 [GNU Affero General Public License v3.0](LICENSE)（SPDX：`AGPL-3.0-only`）。允许商业使用；分发和修改须遵守协议，修改后的版本通过网络供用户交互时，须依第 13 条向这些用户提供相应源码。具体条款以许可证正文为准。第三方内容保留各自的许可证与声明；本次修改不撤回此前版本已经授予的许可。

## 项目简介

Patchwork 是一个面向 DeepSeek Harness 的代码编写与维护插件。
它采用 Skill + Hook：默认七条按需加载的 DSH 技能约束可维护编码行为（零 systemPrompt
注入，目录仅 name + description，正文按需拉取），Hook 负责可机械检查的维护警告与
完成证据提醒（当前检查工具结果文本，不是最终回答的强制门禁）。
`skillsMode: expanded` 可显式试用十三技能目录，`skillsEnabled: false` 可关闭注册；扩展技能尚无多任务净收益证明。

当前任务通过 `patchwork_task` 记录对象、阶段、纠正版本、产物绝对路径和逐项验收。
`{ "action": "handoff" }` 只读返回最多 8,000 UTF-16 单元的交接 JSON：当前要求、纠正、未完成验收与证据/产物指针；省略项通过 inspect 展开。原生压缩移除旧投影后会重新补入交接，取消、纠正或切换模式会阻止旧 OCC 续跑。最近 128 个输入指纹随 Session 保存以减少恢复后的重复处理，不向模型注入去重账本。实现与验证边界见 [Superagent 原生融合评估](docs/superagent-fusion-2026-11-01.md)。

纠正已登记任务时，`correct` 可省略未改的 `title` 和 `phase`，实例约束也保留；仍须传入当前 `baseRevision`。省略阶段不会将 analysis／plan 自动升级为 implement。
命令检查绑定实际宿主回执；失败、缺退出码、旧版本和未覆盖项不算通过。
写作可检查文件长度与锚点，语义判断仍明确为未知。任务记录复用原生 Session，
既有总览/证据页显示投影；全部融合依据、执行结果与能力边界见
[2026-10-30 全文档融合执行方案](docs/upgrade/2026-10-30-integration.md)。
面向用户体验的失败纠正、记忆、隔离验证和人工确认闭环见
[用户体验改进闭环方案](docs/product-experience-evolution-plan-2026-10-31.md)。
信息检索的 DSH 契约、成熟项目/skill 调研、来源治理、预算和隔离方案见
[信息检索调研与方案](docs/information-retrieval-research-2026-10-31.md)；独立的按需检索工作流提示词见
[retrieval-research-prompt.md](assets/prompts/retrieval-research-prompt.md)。
各方案的真实完成状态、依赖关系和后续执行顺序见[未完成方案执行路线图](docs/remaining-plans-execution-roadmap-2026-10-31.md)。

可选浏览器的输入／画面流提速、Agent 元素引用与表单批处理，以及 Patchwork 显式浏览器搜索接入见[浏览器融合记录](packages/browser/docs/community-agent-ux-2026-11-01.md)。浏览器仍单独安装，主包不增加 Playwright／ws／指纹依赖；搜索默认 HTTP，只有同一会话另行授权后才能指定 `transport:"browser"`。

## DSH 内部 Superagent

当前 Patchwork 根会话可用 `patchwork_superagent` 提交持久队列、原生执行器及依赖；默认两个读取槽，同工作区本模块写任务串行。继承 DSH 模型、权限、preset 和 SoL，结果只回所属主控，没有外部消息源、Webhook 或投递服务。

`/patchwork-superagent` 查看队列；工具提供 inspect、submit、report、input、retry、pause、resume、cancel、reconcile，修改前使用当前 revision。模型报告必须经最终真实 task 验收；不确定恢复暂停核对。详见[接入、社区源码调研与限制](docs/superagent-native-2026-11-01.md)。

## 功能验证基准

仓库提供一套可隔离运行的 [Patchwork Contract Benchmark](benchmarks/patchwork/README.md)。
它参考 Terminal-Bench 的 task/test/oracle 形态，分为公开演示、隐藏回归和安全负测三组，
覆盖 Agent scope、任务纠正、检索、记忆、日志、改进闭环、运行时机制和 WebUI。每题使用
独立临时 `DSH_HOME`，不会启动或改写主 DSH：

```powershell
node benchmarks/patchwork/run-isolated.mjs --suite=public-marketing
```

SWE-bench Verified、LiveCodeBench 和官方 Terminal-Bench 只作为外部模型/代码能力对照；
它们的排行榜分数不能替代 Patchwork 的隔离、日志和回滚合同验收。基准调研、许可证和
可比性规则见 [基准调研](docs/benchmark-research-2026-10-31.md)。

针对代码维护能力，另有 [Patchwork Coding Task Benchmark](benchmarks/coding/README.md)：
8 道真实维护形态题覆盖重试、路径边界、嵌套脱敏、稳定排序、JSONL 恢复、记忆 CAS、任务状态
和搜索去重。2026-10-31 的题集质量验证为 8/8（100%）：每题基线失败、参考修复通过公开与
隐藏验收。这个数字证明题集可复现，不是模型完成率；真实 Agent 数据必须另附模型、DSH 版本、
隔离工作区、隐藏测试输出和 run id。当前结果见
[oracle 质量报告](benchmarks/coding/reports/2026-10-31-oracle-quality.json)和
[营销口径](benchmarks/coding/marketing-copy.md)。

## SoL-Pi 机制复刻状态

Patchwork 正在复刻 [SoL-Pi](https://github.com/NVlabs/SoL-Pi) 的四个运行时机制。
开关都是 Cordis 配置项；**actionFusion 默认开启**，其余三个默认关闭。
融合次数不等于测得的 token 或请求收益，需要对照实验：

| 机制 | 配置键 | 状态 |
|---|---|---|
| Action Fusion | `actionFusion` | 真实 DSH + StepFun 验证 write/edit 成功与非零退出 |
| ObservationPack | `observationPack` | 真实归档/召回及首尾摘录已验证；文件盘点无需召回即可答复 |
| Evidence-Preserving Reducer | `evidencePreservingReducer` | 真实失败日志：本地 Node spec 路径完整保留失败段，零额外模型调用；未知格式仍需验证 |
| Online Context Compact | `onlineContextCompact` | 锁、边界、计量与结算已修；真实 native 压缩/续跑验证，自动策略收益待长任务对照 |

依赖基线主要为 DSH 0.2.0-rc.2；原生 Web UI 和真实调用在隔离 DSH 0.2.1-rc.2
的 Patchwork preset 中验证，并用标准模式做负向隔离验收。preset 来源已固定到
该宿主的 standard fixture；依赖整体迁移尚未完成。最新修复状态与边界见
[2026-10-29 升级与验证记录](docs/upgrade/2026-10-29/README.md)。
四类真实任务、失败样本及本轮优化见
[2026-10-30 SoL 实验与升级报告](docs/experiments/2026-10-30-solpi/report.md)。

## DSH 原生面板

从宿主右侧栏“开始”打开 **Patchwork**，查看总览、机制、证据、日志和设置。独立“浏览器”入口由可选包提供。
**先在新会话的 Agent 选择器选择 Patchwork**。面板复用 DSH 原生控件、设计 token
和外观设置；仅对 Patchwork 会话每2秒读取真实状态。其他 Agent 只显示锁定说明，
不采集工具回执、不读取配置；切换会话或隐藏面板会停止请求，卸载证据和未保存草稿。
配置的加载状态、已保存值与本地草稿分开；冲突保留草稿。配置作用域目前是
DSH_HOME，仍未迁移为 profile 独立设置。

“日志”页按机制/级别筛选并导出最近 200 条诊断元数据；支持的宿主写入原生
Session，旧宿主明确回退有界内存。诊断不复制提示词、完整命令或工具原文，
调用使用 SHA256 指纹；切走 Patchwork 后撤销读写。兼容 ledger/journal 轮转为
256 KiB 当前文件 + 一个备份，原文证据不自动删除。使用方法、保留策略和验证范围见
[日志文档](docs/logging.md)。

面板沿用 DSH 设置卡片的底色、细描边与圆角，以及原生分段页签。
总览把当前任务、登记阶段和验收行放在同一卡片，工具记录单独展示；没有候选时不显示空的改进卡片。
设置保留执行与上下文分组，技术字段默认折叠；浏览器资源策略由可选包管理。“证据”细分本次、检索、记忆与改进。
长期记忆按需读取且自动注入关闭；改进页汇聚脱敏 Incident、候选和实验准入，审批/试用/回滚需要用户确认，当前只记录决定，不提供自动激活。
日志采用扁平列表，选中后在下方查看结果、耗时与可展开的原始元数据，支持搜索事件、
原因及指纹。面板跟随宿主浅色/深色外观并适配窄侧栏。Ionicons 5 Outline 图标的
MIT 许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

当 DSH `web_search` 没有 provider 密钥或 provider 不可用时，Patchwork runtime 默认提供
`patchwork_search`。它并行查询 Bing、Brave Search 和 DuckDuckGo 公共 HTML 页面，返回最多
12 条去重结果，不要求 API key；结果包含标题、URL 和有界摘要，并标记为不可信外部数据。
工具只在 Patchwork Agent 作用域注册，切换到其他 Agent 后连同旧引用一起失效。可在 runtime
配置中用 `nativeSearch`、`nativeSearchProviders`、`nativeSearchMaxResults` 和
`nativeSearchTimeoutMs` 调整或关闭。它是可用性 fallback，不替代有 SLA 的 provider，也不
负责抓取完整网页。需要读取明确公开 URL 时，可使用独立的 `patchwork_fetch`：它执行
DNS/SSRF 与 host allowlist 检查、robots.txt 检查、有限重定向、响应字节限制和 HTML 文本摘录，
并把页面标成不可信外部数据。搜索和抓取可以分别用 `nativeSearch`、`nativeFetch` 开关控制；
抓取的部署配置包括 `nativeFetchAllowedHosts`、`nativeFetchTimeoutMs`、`nativeFetchMaxBytes`、
`nativeFetchMaxChars` 和 `nativeFetchRobots`。抓取结果不会自动写入长期记忆、规则或权限。

浏览器已拆为独立可选包 **`@patchwork/browser`**，不随 Patchwork 一起安装或打包。浏览器运行时、Playwright、指纹依赖、画面流界面和组件下载器均由该包单独提供。

安装可选包后，DSH 右侧栏出现独立的“浏览器”入口。任意模式均可显式启用当前会话；工具注册到该 Agent 的作用域，页面和登录状态按会话隔离。切换模式或停用会撤权并关闭对应内核，不启用其他 Patchwork 工具、记忆或运行机制。

使用方式为先读取 DOM 快照，再按真实 role/name、label 或文本操作，视觉任务按需截图；页面继续通过 DSH 画面流显示。主包安装不下载内核、不注册浏览器工具，也不创建浏览器入口。安装、旧配置迁移和验证范围见[可选包说明](docs/browser-optional-package-2026-11-01.md)与[浏览器包 README](packages/browser/README.md)。

长期记忆现在提供显式的 `patchwork_memory` 管理工具和侧栏“记忆”页：默认只生成待确认候选，
会话私有记录与项目共享记录分开，读取必须按需请求；确认和忘记使用版本校验与命名空间 epoch。
它不会自动注入普通请求，也不会因为记忆内容授予工具、目录或发布权限。

## 技能包（零 systemPrompt）

行为规则不进系统提示词，拆成 13 个 DSH 原生 skill，经 `ctx.skills` 渐进披露：

| skill | 何时加载 |
|---|---|
| `patchwork` | Patchwork Agent 编码/维护任务入口与技能导航 |
| `anti-slop` | 写文案、更新日志、汇报、PR 描述：拒模板句与谄媚 |
| `web-ui` | 设计、实现或评审 Web 界面：按任务类型定视觉方向，检查交互/动效、真实数据边界与截图 |
| `architecture` | 跨模块职责、状态所有权和依赖边界 |
| `collaborator` | 核实纠正与冲突；确有取舍时解释选项 |
| `debugging` | 复现故障、失败测试和性能回退的根因定位 |
| `code-review` | 只读评审差异、用户路径与实际安全边界 |
| `retrieval` | 当前外部资料、多来源与冲突证据核查 |
| `documentation` | README、使用指南、更新日志与迁移说明 |
| `memory` | 显式跨会话召回、提议、确认和遗忘 |
| `improvement` | 真实失败与纠正形成受控改进候选 |
| `standards` | 实现/修复收尾、文档与更新日志、提交等规范 |
| `evidence` | 逐项验收与来源，区分命令、文件结构和语义判断 |

默认 `skillsMode: core` 只注册原七技能；在 preset 的 `patchwork-runtime` 行设置 `skillsMode: expanded` 可试用十三技能目录，`skillsEnabled: false` 可关闭技能注册；设计依据见
[协作技能架构](docs/architecture-collaborator-skills.md)。
`web-ui` 的详细设计契约与验证矩阵通过宿主原生技能资源目录按需读取；
原七技能的深度与边界见[可靠性评估](docs/skill-reliability-audit-2026-10-31.md)；扩展技能的实际验证范围见[融合执行记录](docs/skills-fusion-execution-2026-10-31.md)。

## 核心行为

- 修改前先调查事实、调用方、配置和测试。
- 会改变实现或验收结果的歧义先询问用户，不凭猜测推进。
- 大功能先按职责/领域拆分，避免数千行单文件。
- 命名表达业务角色，拒绝 `final_new`、`debug3`、`CommonUtils` 等兜底命名。
- 修改后沿原路径验证，并只汇报实际证据。
- 代码、配置或行为变化同轮维护使用文档和更新日志；交付前核覆盖，不适用给具体理由。
- Hook 发现结构或命名问题时注入一行 `[pw:structure]` 短码（指向对应技能）；同一会话同一问题每 30 轮最多提示一次。
- EvidenceGate（`evidenceGate`，默认开）：工具结果文本出现完成断言而当前任务未通过登记验收时，提示补相关回执；每任务 revision 最多一次，不再接受近期任意 shell 成功。
- `/patchwork-task` 查看当前任务；`patchwork_task` 的 define/correct/artifact/check/assessment/candidate 操作更新任务。字段都在顶层，check 使用验收 id 与 command，完整路径用 artifact 登记。
- `taskPolicyMode` 在 runtime 行设为 `structured`（默认）检查已知 write/edit 路径、参考对象、声明阶段与版本；`strict` 拒绝未支持的效果通道。两者都不是 OS 沙箱，也不能从模型陈述证明人类授权。
- 已登记任务收到新输入会保守失效证据；已知结构化写入须先重述契约，再继续修改。任务原生记录可冷恢复，分支不继承原任务通过状态。
- `/patchwork-review` 命令：站在用户立场评审代码——走用户路径找 bug 与体验缺陷，兼顾商业化边界。

## Agent preset

Patchwork 以 DSH bundle 插件注册：安装增加 Agent preset 和原生面板桥接；
**只有选择 Patchwork 的会话才装载其技能、评审命令、Hook 与机制**。浏览器由独立可选包按会话授权。

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.2.0.tgz"
```

同一个 bundle 声明 `patchwork` preset（`presets/patchwork.patch.yml`）：
`scripts/gen-preset.mjs` 逐行复制固定的 DSH 0.2.1-rc.2 standard fixture，再追加
`@patchwork/coding-agent/runtime`，不注册浏览器工具。宿主 registry 提供工具、技能与命令的 scope 隔离；
运行前还会检查会话当前实际组合，不能用伪造 header/cwd 或保留旧工具引用绕过。
标准模式、PTC、Helmd 等其他 preset 不装载这些行为。0.1.7 起 preset 不再靠往
`$DSH_HOME/.agent-presets/` 拷文件生效。

部署默认配置请放在 preset 的 `patchwork-runtime` 行；原 profile 根
`patchwork-agent` 行现在只负责 Web 桥接，其机制配置不再控制 Agent。
面板保存的用户覆盖仍位于 `$DSH_HOME/patchwork/config.json`，优先于 runtime 行配置，
只影响 Patchwork runtime 的后续加载。详情与验收边界见
[Agent 隔离审计](docs/upgrade/2026-10-29/isolation.md)。

## /patchwork-review 命令

站在用户立场评审代码的主入口：

```text
/patchwork-review [评审范围]
```

Agent 会以目标用户身份走一遍首次价值路径，从用户会犯的错里找 bug，把体验差
当缺陷对待，并检查商业化边界（免费核心完整性、付费边界、安装摩擦）。可当场
修复的最小修复直接实施并沿用户路径验证，其余按已知问题/待决策项汇报。

## Hook 检查

Hook 同时支持独立 stdin 调用和 DSH 原生 `tools/post-execute` 生命周期。
它接收包含 `cwd` 和 `files` 的 JSON，或从工具参数提取源码路径，返回
`warnings`/`additionalContexts`，不会阻断 Agent：

```powershell
'{"event":"PostToolUse","cwd":"C:\项目","files":[{"path":"C:\项目\debug_final.cpp"}]}' |
  node hooks/patchwork-hook.mjs
```

## 文档

- [DSH 内部 Superagent 主控接入、社区源码对照与验收，2026-11-01](docs/superagent-native-2026-11-01.md)

- [DSH Superagent 原型评估、原生适配与 SoL 融合，2026-11-01](docs/superagent-fusion-2026-11-01.md)

- [浏览器缺口执行记录：安全、实时流、自检、回执、交付与验证范围（2026-11-01）](docs/browser-gap-execution-2026-11-01.md)
- [开源指纹浏览器专项：15 个仓库、内核开放范围、身份生命周期与接入取舍（2026-11-01，调研依据）](docs/fingerprint-browser-research-2026-11-01.md)
- [ZCode 浏览器专项：会话边界、标签恢复、截图、虚拟剪贴板与录制融合方案（2026-11-01，调研依据）](docs/zcode-browser-research-2026-11-01.md)
- [浏览器社区再调研：26 个项目、内核/环境自检/实时流/回放与采用顺序（2026-11-01）](docs/browser-community-research-2026-11-01.md)
- [浏览器工作台升级与真实隔离验收（2026-11-01）](docs/browser-workspace-upgrade-2026-11-01.md)
- [记忆、自进化与 UI/UX、产物质量融合方案（2026-10-30，提案未实施）](docs/memory-evolution-design-2026-10-30.md)
- [配套源码调研：7 个项目、DSH 请求隔离与存储取舍](docs/memory-evolution-research-2026-10-30.md)
- [记忆再调研：4 套 DSH 适配、读写一致性、时间更新与真实任务评测（2026-10-31）](docs/memory-deep-dive-2026-10-31.md)
- [信息检索调研与方案：DSH 搜索、成熟项目、skills 与隔离评测（2026-10-31）](docs/information-retrieval-research-2026-10-31.md)
- [独立信息检索工作流提示词](assets/prompts/retrieval-research-prompt.md)
- [更新日志指南：收录、写法与交付检查](docs/changelog-guide.md)
- [Web UI 社区技能对照与采用取舍（2026-10-31）](docs/web-ui-skill-community-review-2026-10-31.md)
- [AI UI 设计判断、配色与 Apple Design skill：调研及接入记录](docs/human-centered-ai-ui-research-2026-10-31.md)
- [七个技能的可靠性评估（2026-10-31）](docs/skill-reliability-audit-2026-10-31.md)
- [全技能调研与融合方案（2026-10-31，待实施）](docs/skills-fusion-plan-2026-10-31.md)
- [大型项目与官方更新日志规范调研（2026-10-30）](docs/changelog-research-2026-10-30.md)
- [2026-10-29 升级方案、源码审查、原生 Web UI 与真实验证](docs/upgrade/2026-10-29/README.md)
- [工程代理指南 | Engineering agent guide](docs/engineering-agent-guide.md)
- [SoL-Pi 机制复刻设计 | SoL-Pi mechanisms design](docs/solpi-mechanisms-design.md)
- [协作技能架构 | Collaborator skill architecture](docs/architecture-collaborator-skills.md)
- [维护代码提示词（技能正文来源） | Maintainable coding prompt](assets/prompts/maintainable-coding-agent-prompt.md)
- [Hook 基础 | Hook foundation](docs/hook-foundation.md)
- [Agent 基础 | Agent foundation](docs/agent-foundation.md)
- [Git 提交规范 | Git commit conventions](docs/git-commit-conventions.md)
- [Preset 与发布经验 | Preset and release lessons](docs/preset-and-release-lessons.md)
- [DeepSeek Harness 插件开发 | Plugin development](docs/deepseek-harness-plugin-development.md)
- [产品工程指南 | Product engineering guide](docs/product-engineering-guide.md)
- [未完成方案执行路线图（2026-10-31）](docs/remaining-plans-execution-roadmap-2026-10-31.md)
- [受控改进执行记录（2026-10-31）](docs/improvement-execution-2026-10-31.md)

## Git 提交与推送

完成一个明确任务后提交一次；提交使用 Conventional Commits 格式。
推送必须由用户明确要求；“完成代码后关机/结束”不触发推送。

## 目标

Patchwork 的目标是让代码更容易理解、验证和继续演进，同时减少重复提示和无效 token。
