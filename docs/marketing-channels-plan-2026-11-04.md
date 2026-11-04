# 营销渠道方案与首发清单（维护者备忘）

2026-11-04 初版；2026-11-05 用 `gh` 直查 GitHub 同类项目后修订渠道排序并补充物料。目标：让 DSH 用户看到 Patchwork，并把看到的人留下来。结论先行：**DSH 插件生态已高度组织化——旗舰精选列表本身就是插件市场索引，头部插件 2.2 万–60 万星；Patchwork 首发应打进这套现成的收录/发现体系**，通用 AI 工具渠道（HN、r/LocalLLaMA）暂缓。本文档为维护者备忘，不进入 `package.json` files 列表，不随包发布。

调研方法：2026-11-04 一轮来自搜索索引摘要（网络受限，数字为转述）；2026-11-05 一轮用 `gh api` / `gh search repos` 直接抓取仓库元数据、README、列表正文与发布形态（本地代理），本轮数据可信度更高。文中 star 数为抓取当时值。

## 漏斗现状

| 环节 | 现状 | 缺口 |
| :--- | :--- | :--- |
| 看见 | 双语 hero README、8 个 topics、Release v1.0.0 资产已核验 | topics 缺 `dsh-plugin`（雷达/列表的抓取信号，单数形式）、`deepseek`、`llm`；无 social preview 图；Discussions 未开启；无 demo GIF |
| 安装 | Release `.tgz` 两步安装，README 已接入 | 无 npm 包：**旗舰列表的应用内市场索引只收录 npm 发布的插件做一键安装**，GitHub-only 条目只能靠命令行 |
| 留下 | Issues / CONTRIBUTING / SECURITY / 路线图齐备 | 无社区聊天入口（头部项目全部有 QQ 群/Discord）；无社会证明（新项目，诚实呈现即可） |

## 同类项目实测（2026-11-05，gh 直查）

| 项目 | star | 它怎么呈现 |
| :--- | ---: | :--- |
| [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | 22.4k | 旗舰精选列表，双语；**同时是插件市场索引**（dsh 0.2.1+ 在 Plugins → Discover 添加源即可应用内安装）；条目按字母序、单行描述、可核验细节（"描述说 46 个工具就有人数 46 个"）；GitHub-only 条目在命令旁附安装方式 |
| [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) | 60.5k | 纯插件最高星。门面：icon + 双语切换 + 自定义状态徽章（零依赖/无构建/适配 DSH 版本）+ 单条 blockquote 全量价值主张（免登录免 Key 免费）+ QQ 群二维码 + Trendshift 榜单徽章（上榜后挂） |
| [esengine/DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix) | 36k | 同为编码 Agent。门面：双语导航 + 官网 + Discord/QQ 群 + npm 下载徽章 + Trendshift + 赞助区；正文首屏一句话定位（"reads your project, edits files and runs commands…"）+ 社群 IMPORTANT 块 |
| [Ebony-Vinyl/dsh-our-free-model 发布形态](https://github.com/Ebony-Vinyl/dsh-our-free-model/releases) | — | 高频小版本、标题带变更摘要（如"v2.8.0：免费道整形层对齐参考网关…"）——与我们已定的 Codex 式"标题=裸版本号"刻意不同，坚持现行规范 |
| [AdamPlatin123/dsh-plugin-radar](https://github.com/AdamPlatin123/dsh-plugin-radar) | 1.5k | 自动发现 2.1 万+ 候选、k8s 运行级实测兼容性、15 分钟快照；提供 PLUGINS.md 社区登记表 |
| [0xsline/awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness) | 1.3k | 抓 `dsh-external/hub` + 公开 `dsh-plugin` topic 自动汇总 |
| 其他可收录列表 | 0.4–0.7k | [bruc3van/awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)（每日自动抓取+人工复核，"蹭标签剔除"）、[Zhiyuan-Fan/Awesome-DeepSeek-Harness-Plugins](https://github.com/Zhiyuan-Fan/Awesome-DeepSeek-Harness-Plugins)（双语）、[LivXue/dsh-plugin-shop](https://github.com/LivXue/dsh-plugin-shop)（每日刷新+人工审）、[imsai-sh/awesome-deepseek-harness-plugins](https://github.com/imsai-sh/awesome-deepseek-harness-plugins)（1.1 万+，附免费搜索 API） |

### 借 / 不借

| 借 | 不借 |
| :--- | :--- |
| topics 对齐头部插件集：`dsh-plugin`（单数，发现信号）+ `deepseek` + `llm` | Trendshift 徽章（需上榜后才有，未上榜挂是造假） |
| 自定义状态徽章表达硬事实（零依赖、适配版本）——我们已有 DSH 兼容徽章，可再加"无 npm 依赖"式徽章 | 赞助区、高频 descriptive 版本号标题 |
| 单条 blockquote 价值主张放首屏（README 已达成：三痛点表 + "模型说做完了不算数"） | 免费模型类"完全免费不限量"式承诺（不适用也不真实） |
| 社区聊天入口（QQ 群/Discord）——头部项目标配，需用户建群后加进 README | — |
| 收录描述必须可核验：技能数、设置数、测试数全部对应真实实现（旗舰列表明确"有人数"） | — |

## 渠道清单（修订后排序）

### P0：生态收录（零风险，先做）

1. **GitHub 仓库门面**
   - topics 追加：`dsh-plugin`、`deepseek`、`llm`（对齐 60k 插件的 topic 集）。`dsh-plugin` 是雷达和自动列表的抓取信号，当前缺失是最大可见性漏洞。
   - About 一句话描述改双语（现仅英文功能罗列，头部项目全是"利益点+零门槛"双语）：建议
     `验收不过不算完成的 DSH 编码插件：回执绑定、纠正重核、显式记忆、本地代码检索。Coding tasks with verifiable acceptance for DeepSeek Harness — receipts, not claims.`
   - social preview 图、开启 Discussions（不变）。
2. **旗舰列表 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR**（22.4k 星 + 应用内市场索引，最高优先）。条目草稿（按字母序插入，分类建议 Workflow & Automation 或 Git & Code Review，最终听维护者）：
   > `- [ADWMC/Patchwork](https://github.com/ADWMC/Patchwork) - Coding-task plugin for DeepSeek Harness: requirements, corrections, tool receipts and acceptance checks in one workflow — failed, stale or uncovered results cannot pass; a read-only handoff recovers context after corrections. Also keyless parallel web search, workspace-local code retrieval (map, symbols, lexical references), explicit session-private/project-shared memory with version checks, a native Superagent queue, and a 6-view workbench with 26 settings. Install: download the .tgz from Releases, then dsh plugin --profile <name> add <path>. AGPL-3.0.`
   
   注意：描述里每个数字（6 视图、26 项设置）都要经得起"数一数"；发布 npm 后可把安装段缩成一条命令。
3. **dsh-plugin-radar 登记**：填 [PLUGINS.md](https://github.com/AdamPlatin123/dsh-plugin-radar/blob/main/PLUGINS.md) 社区登记表，进精选需人工策展。
4. **其余列表批量提交**：0xsline（1.3k）、bruc3van（自动抓取靠 topic）、Zhiyuan-Fan、LivXue、imsai-sh——同一份条目文案复用。
5. **官方仓库 Discussions 插件目录帖**回帖（不变）。

### P1：首发帖（素材齐后，1–2 周）

6. **r/DeepSeek**（英文"I built X"）、**V2EX /go/create 分享创造**、**Linux.do 开源自荐**、**掘金教程文**（体裁与版规见 2026-11-04 初版调研，规则不变）。

### P2：需决策或条件成熟

7. **npm 发布**——修订后优先级上调：旗舰列表的应用内市场索引明确"index covers plugins published on npm with a known version"，npm 发布意味着 dsh-market 里一键安装、列表条目缩成一条命令、radar 兼容性实测覆盖。仍按发布纪律：**只在用户明确要求时发布**，需先确认 `@patchwork` scope。
8. **QQ 群/Discord**：建群后 README 加入口（头部项目标配，留人手段）。
9. **bilibili 视频**、**Show HN / r/LocalLLaMA**（等安装路径更顺）、**X/Twitter**（不变）。

### 不投入（证据不足）

即刻（零案例）、DSH 专属 Discord 频道（未见规范）。

## 首发帖通用结构

不变（见 2026-11-04 初版）：一句话定位标题 → 三痛点 → demo GIF → 下载+安装命令 → 诚实边界。素材缺口仍是工作台操作 GIF。

## 效果度量

不变：star/Release 下载量、各帖回复、列表 PR 合并状态、radar 目录出现与否、（npm 后）周下载量。

## 证据来源

2026-11-05 gh 直查：`gh search repos --topic=dsh-plugin --sort=stars`、`gh repo view Ebony-Vinyl/dsh-our-free-model`、`gh api repos/{esengine/DeepSeek-Reasonix,awesome-dsh-plugin/awesome-dsh-plugin,AdamPlatin123/dsh-plugin-radar}/readme`、`gh release list -R Ebony-Vinyl/dsh-our-free-model`。2026-11-04 搜索索引一轮来源见 git 历史版本。所有 star 数为抓取时点值，引用前复核。
