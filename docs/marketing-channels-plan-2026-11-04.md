# 营销渠道方案与首发清单（维护者备忘）

2026-11-04 调研。目标：让 DSH 用户看到 Patchwork，并把看到的人留下来。结论先行：**DSH 已经形成官方支持的插件生态，Patchwork 的首发动作应全部指向这个生态内现成的渠道**，通用 AI 工具渠道（HN、r/LocalLLaMA）暂缓。本文档为维护者备忘，不进入 `package.json` files 列表，不随包发布。

调研方法说明：生态信息来自搜索索引摘要，未能直接打开 github.com/npmjs.com 页面核对（调研环境网络受限）；文中 star 数、帖子热度等数字均为来源转述，使用前需人工复核链接。

## 漏斗现状

| 环节 | 现状 | 缺口 |
| :--- | :--- | :--- |
| 看见 | 仓库 description 有、8 个 topics、双语 hero README | topics 缺 `deepseek`/`dsh-plugins`/`plugin` 等生态词；无 social preview 图； Discussions 未开启；无 demo GIF |
| 安装 | v1.0.0 Release 已附带两个 `.tgz` | README 已改为"Release 直装优先、源码打包折叠"；无 npm 包，无法 `dsh plugin add <npm 包名>` 一键安装 |
| 留下 | Issues / CONTRIBUTING / SECURITY / 路线图齐备 | 无 Discussions 讨论区；无"谁在用"的社会证明（新项目，诚实呈现即可） |

## 渠道清单（按可直接使用程度排序）

### P0：生态内收录（零风险，今天可做）

1. **GitHub 仓库自身**（一切流量的落点）
   - topics 追加生态词：`deepseek`、`dsh-plugins`、`dsh`（已有）、`plugin`、`llm-agent`。`dsh-plugins` 是社区 awesome 列表和 hub 的抓取信号。
   - 上传 social preview 图（Settings → General）：建议用工作台"总览"视图截图，比 hero SVG 更能证明产品真实存在。
   - 开启 GitHub Discussions：比 Issues 更低门槛，适合首发帖引来的问题。
2. **awesome-deepseek-harness**（[0xsline/awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness)）：按其条目格式提 PR 收录 Patchwork。同类列表 [dongsheng123132/awesome-dsh-plugins](https://github.com/dongsheng123132/awesome-dsh-plugins) 同步提交；索引站 [dshseek.com](https://dshseek.com/map/awesome-deepseek-harness)（CC0）随之或单独提交。
3. **dsh-external/hub**：社区中央 hub，抓取 GitHub `dsh-plugin` topic。给仓库加上 topic 后确认是否被自动索引，否则提 issue 请求收录。
4. **官方仓库 Discussions 插件目录帖**（[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) Discussions，如插件目录 #1045、插件开发帖 #961）：回帖介绍 Patchwork + 一条安装命令。官方产品页明说欢迎插件生态，这是官方默许的自荐位。

### P1：首发帖（准备好素材后发，节奏 1–2 周）

5. **r/DeepSeek**（英文，"I built X" 体裁）：证据显示该版容忍插件自荐。获胜帖模式：标题带一个具体差异点；正文三段——为什么做（模型声称完成 ≠ 验收通过）、演示 GIF、一条安装命令（Release .tgz + `dsh plugin add`）。
6. **V2EX /go/create 分享创造**（中文）：自有开源项目放"分享创造"，带营销意图会被移到 /go/promotions（版规明确）。标题写"我做了一个 DSH 插件…"，正文复用 README 的"为什么需要它"三痛点表。
7. **Linux.do 开源自荐**：DSH 插件市场帖（扫 2211 个插件）与"开源自荐"是活跃体裁，插件自荐是常规内容。
8. **掘金教程文**：掘金生态偏好教程/经验体裁而非广告（"从零实现一个 AI Agent"类文章）。写《给 DeepSeek Harness 写一个带验收闭环的插件：Patchwork 设计与实现》，文中自然带安装路径；掘金还有 GitHub Trending 汇总号可争取被收录。

### P2：需要决策或条件成熟后再做

9. **发布到 npm**：可让 `dsh plugin add @patchwork/coding-agent` 式一键安装成为可能（ccusage 的 `npx` 零安装入口是其增长主证据）。但涉及发布纪律——**只在用户明确要求时发布**，本文档仅记录该选项及其收益。发布包名需先确认 `@patchwork` scope 可用性。
10. **bilibili 演示视频**："DSH一切皆插件"话题播放量数千万级（转述），DSH 插件视频教程是成熟体裁。素材：10–15 秒工作台操作 GIF/录屏。
11. **Show HN / r/LocalLLaMA**：受众大但 Patchwork 当前强绑定 DSH 宿主，时机放在安装路径更顺（npm 或一键脚本）之后。
12. **X/Twitter**：官方 @deepseek_ai 会转发社区插件动态；有英文帖后可带话题发布并 @ 官方，争取转发。

### 不投入（证据不足）

- **即刻**：未找到任何 DSH/AI 工具冷启动案例，无证据支撑。
- **Discord**：DeepSeek 有官方 Discord 但未发现 DSH 插件专属频道/发帖规范，优先级低于 Discussions。

## 首发帖通用结构（r/DeepSeek、V2EX、Linux.do 共用）

1. 标题：一句话定位 + 具体差异点（例："I built an acceptance-loop plugin for DeepSeek Harness / 我给 DSH 做了一个'验收不过不算完成'的插件"）。
2. 为什么做：三痛点（模型声称完成要人工复查 / 纠正后丢上下文 / 项目约定反复丢失）。
3. 看什么：demo GIF（最大素材缺口，需录制工作台任务-验收闭环的操作录屏）。
4. 怎么装：Release .tgz 下载 + `dsh plugin --profile <name> add <tgz>`，注明兼容 `>=0.2.1-rc.2 <0.3.0-0`。
5. 诚实边界：会话隔离非沙箱、无密钥搜索无 SLA——按项目一贯的边界声明风格保留。

## 效果度量

- GitHub：star/fork 增长、Release `.tgz` 下载量（`gh api repos/ADWMC/Patchwork/releases` 与 traffic）。
- 渠道：各帖回复数与后续 Issue 来源（首发后两周复盘，决定 P1 渠道是否加投）。
- 收录核验：awesome 列表 PR 合并状态、`dsh-external/hub` 索引页是否出现 Patchwork。

## 证据来源

生态调研：deepseek.com/en/harness（官方产品页）· github.com/deepseek-ai/deepseek-harness（Discussions #961/#1045/#2530）· npmjs.com/org/deepseek-ai · awesome 列表（0xsline/awesome-deepseek-harness、dongsheng123132/awesome-dsh-plugins、dshseek.com）· dsh-external/hub 与 dsh-market/dsh-market · r/DeepSeek 插件自荐帖 · V2EX（t/1234203 等 10+ 帖）· Linux.do（t/topic/2760390 插件市场帖）· 掘金插件教程（post/7673798665957720090 等）· bilibili 话题"DSH一切皆插件"。

同类项目打法：awesome-claude-code 收录流程（issues/298）· Show HN opencode 319 分（hn item 44482504）· r/ClaudeAI Cline 社区帖与 ccusage 20 天千星复盘 · react-bits 作者访谈（README 视觉优先 + 目录循环）· V2EX 版规帖（t/1058300、t/1107576）· ccusage 周下载→star 漏斗（ccassist.dev 对照页）。

以上链接均指向外部来源；数字为来源转述，未能直接核验，引用前请人工打开确认。
