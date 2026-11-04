# GitHub 发布规范与检查单（维护者备忘）

2026-11-04 制定。起因：v1.0.0 采用"覆盖发布"（tag 移动并入 1.0.1/1.0.2 修复，烧掉两个版本号），与主流项目的不可变发布惯例相悖。本文档为维护者备忘，不进入 `package.json` files 列表，不随包发布。发布动作仍遵守既有纪律：**只发布用户明确要求的版本**。

## 核心原则（对照大项目）

| 原则 | 大项目证据 | 本仓库做法 |
| :--- | :--- | :--- |
| 发布不可变：破了/补了就发新版本号 | ripgrep 14.1.0 回归用 14.1.1 修复而非替换；pnpm 10.17.0→10.17.1；esbuild 逐号递增。六个受查项目均无覆盖发布政策 | v1.0.0 覆盖发布是一次性例外，不再重复；今后一律新号 |
| tag ↔ Release 严格 1:1 | esbuild/pnpm/ripgrep/cli/cli 每个版本 tag 都有 Release 对象 | 每个 `v*` tag 建对应 Release（tag-only 仅限用户明确要求的历史标记） |
| 资产带精确版本号 | `ripgrep-14.1.0-<target>.zip`、`gh_2.62.0_linux_amd64.tar.gz` | 保持 `patchwork-coding-agent-<版本>.tgz` / `patchwork-browser-<版本>.tgz` |
| pre-release 标志 | GitHub 官方：`/releases/latest` 取最新非 draft 非 pre-release；pnpm RC 勾 pre-release 避免劫持 | 带 `-alpha`/`-beta`/`-rc` 的版本发布时必须勾 pre-release，保护插件内"检查更新"的 latest 语义 |
| 资产长期可下载 | 大项目资产挂在 Release 页而非 14 天过期 artifact | 发布时将 CI Package 的两个 `.tgz` 上传到 Release 资产，不依赖 artifact |

## Release 正文模板

小工具的最佳参照是 ripgrep（一段散文 → compare 链接 → 资产）；结构化风格参照 gh/Biome（What's Changed + Full Changelog）。结合本仓库"证据优先"风格：

```markdown
v<版本号>

## <一句话概括这次发布>

<1–3 句散文：为什么发这一版，用户会感知到什么变化。>

## 新增
- <面向使用者的变化，与 CHANGELOG 口径一致>

## 修复
- <同上>

## 兼容
- engines.dsh 范围与已验证宿主版本

## 安装
- 从下方资产下载 `patchwork-coding-agent-<版本>.tgz`，然后：
  dsh plugin --profile <name> add <下载后的完整路径>
- 资产直链模式：https://github.com/ADWMC/Patchwork/releases/download/<tag>/patchwork-coding-agent-<版本>.tgz

## 验证
- <测试口径统一：注明是"每宿主回归套件 N 项"还是"本地 npm test 全量 N 项"，两种口径不混用>

Full Changelog: https://github.com/ADWMC/Patchwork/compare/v<上一版本>...v<这一版本>
```

要点：**标题只用版本号本身**（参照 Codex `rust-v0.166.0` 的标题就是 `0.166.0`），不加描述后缀；正文全部面向使用者（新增 / 修复 / 兼容 / 安装 / 验证），覆盖发布、tag 保留等过程性说明放 CHANGELOG，不进 Release 正文。安装命令必须包含"先下载资产"这一步（v1.0.0 旧正文的裸文件名命令不完整）；正文数字与 README/CHANGELOG 口径一致或注明口径差异。

## 发布流程检查单

1. [ ] 确认用户明确要求发布该版本号
2. [ ] CHANGELOG 已按[写作指南](changelog-guide.md)更新
3. [ ] `npm test`、`npm run check:release`、两个包的构建检查通过；文档链接检查通过
4. [ ] 推送 `v*` tag；等 CI Package 工作流产出两个 `.tgz` artifact
5. [ ] 创建 Release（新 tag，不移动旧 tag；不覆盖任何已发布 Release）：按上述模板写正文
6. [ ] 下载 artifact 并 `gh release upload <tag> *.tgz` 挂为长期资产
7. [ ] 若版本带 alpha/beta/rc 后缀：勾选 pre-release 标志
8. [ ] 发布后用 `gh release view --json assets,isLatest` 核验资产与 Latest 指向；若插件内"检查更新"可用，实测一次结果正确

## v1.0.0 覆盖发布事件（历史记录）

- v1.0.0 tag 现指向 `1bbae9d`（含 1.0.1/1.0.2 修复与 update-check）。2026-11-04 实测下载该 Release 资产：包内版本 `1.0.0`，`realpathSync.native`、`update-check`、`patchwork_code`（含 `graph-enable`）、`patchwork_project_docs` 均在包内——**当前资产内容与最新代码一致，无需紧急补发**。
- `v1.0.1`/`v1.0.2` tag 保留为历史标记，无 Release 对象；`/releases/tag/v1.0.1` 等深链接无发布页，属已知限制，不回补。
- 原始 v1.0.0（相对 `ef19dc7` 基线的初始内容）随覆盖发布不再可追溯；已安装原版 build 的实例与新版 build 版本号相同无法区分。此风险自本规范起不再引入。

## 证据来源

GitHub 官方文档（automatically-generated release notes、REST releases、managing releases）· ripgrep releases 与 CHANGELOG · esbuild releases/CHANGELOG-2025 与 issue #4324 · pnpm releases 与 10.17 notes · cli/cli releases · Biome releases · 镜像站（newreleases.io、SourceForge、Chocolatey）转述核验。调研环境无法直接抓取发布页，数字与细节为来源转述，引用前需人工复核。
