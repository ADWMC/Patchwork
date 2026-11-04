# 文档导航

当前行为以实现和对应使用指南为准。带日期的调研、方案与验证记录保留当时的范围、失败和未知项；旧方案不能自动当作已完成能力。

## 使用与维护

- [项目介绍与安装](../README.md) · [English README](../README_EN.md)
- [更新日志](../CHANGELOG.md)与[写作指南](changelog-guide.md)
- [贡献流程](../CONTRIBUTING.md)与[安全反馈](../SECURITY.md)
- [日志系统](logging.md)
- [Preset 切换与隔离排查](troubleshooting-agent-preset-switching.md)

## 当前功能与验证

- [2026-11-04 三方案执行与真实模型验证](closure-2026-11-04.md) · 原始机器证据未随仓库上传
- [DSH 多版本支持：0.2.1-rc.5 与 0.2.2-alpha.3](dsh-multi-version-2026-11-04.md) · 原始机器证据未随仓库上传

- [全功能工作台社区调研、扩充矩阵与实现](ui-community-expansion-2026-11-01.md) · 10 项目固定源码快照

- [24 项闭环、恢复与验收入口](closure-2026-11-01.md) · 原始机器证据未随仓库上传

- [DSH 内部 Superagent 主控](superagent-native-2026-11-01.md)、[提示词优化与实跑](superagent-prompt-optimization-2026-11-01.md)
- [受控改进执行记录](improvement-execution-2026-10-31.md)
- [记忆详细管理：内容、版本、范围与召回控制](memory-management-2026-11-01.md)
- [独立浏览器包](../packages/browser/README.md)、[迁移说明](browser-optional-package-2026-11-01.md)、[检索接入](browser-runtime-integration-2026-11-01.md)
- [编码任务评测](../benchmarks/coding/README.md)与[插件场景](../benchmarks/patchwork/README.md)
- [SoL 会话分析工具](../benchmark/README.md)与[机制研究门](../research/README.md)：与上述任务题集用途不同，继续保留原 CLI 入口。

## 调研与方案

- 记忆与改进：[产品体验方案](product-experience-evolution-plan-2026-10-31.md)、[融合设计](memory-evolution-design-2026-10-30.md)、[记忆再调研](memory-deep-dive-2026-10-31.md)
- 技能与 UI：[技能融合方案](skills-fusion-plan-2026-10-31.md)、[执行记录](skills-fusion-execution-2026-10-31.md)、[UI 判断与配色](human-centered-ai-ui-research-2026-10-31.md)
- 信息检索：[来源研究](information-retrieval-research-2026-10-31.md)、[执行方案](information-retrieval-execution-plan-2026-10-31.md)
- 真实模型审计：[本轮证据盘点与缺口](real-model-audit-2026-11-04.md)、[审计闭环方案](plan-real-model-audit-2026-11-04.md)
- 人类式认知：[认知脚手架方案](plan-human-like-agent-2026-11-04.md)
- 代码检索：[Cursor 式本地检索与 Explore](plan-cursor-style-retrieval-2026-11-04.md)、[实现与真实模型证据](code-retrieval-2026-11-04.md)
- 项目文档：[AGENTS.md / DESIGN.md 受控创建与更新](project-docs-2026-11-04.md)
- Agent 社区对照（维护者备忘，不随包）：[社区项目借/不借](community-agent-patterns-2026-11-04.md)
- 浏览器：[ZCode 研究](zcode-browser-research-2026-11-01.md)、[社区项目](browser-community-research-2026-11-01.md)、[指纹内核](fingerprint-browser-research-2026-11-01.md)
- 提示词：[ZCode / OpenClaude 源码](zcode-openclaude-prompt-engineering-research-2026-10-31.md)、[社区样本取舍](system-prompts-community-research-2026-11-01.md)
- [其余方案的执行路线](remaining-plans-execution-roadmap-2026-10-31.md)；历史状态保留，不推断全部完成。

## 文件边界

运行代码位于 `src/`，客户端构建载荷位于 `lib/`；浏览器所有权在 `packages/browser/`。`docs/checks/` 只保留探针/驱动脚本；整理后的验证证据、真实模型审计、隔离实验报告和本地 TLS 夹具都不进入 Git 或发行包。

最初的七技能静态展示页归档到 [archive/skills-preview](archive/skills-preview/README.md)，不作为当前 WebUI。研究源码副本、生成页面、截图、运行日志及私人会话审计移出仓库保存，不进入 Git 或发行包。不要为整理目录删除已有研究结论。

## 仓库维护

仓库只维护 `main`，默认分支也是 `main`；主分支禁止强推和删除，要求线性历史。为支持单分支维护，没有设置强制 PR 或必须先在临时分支通过的检查。维护者先执行本地验证，再提交推送；外部 fork PR 使用 squash 合并，合并后自动清理本仓库中的来源分支。

GitHub 启用依赖漏洞提醒、秘密扫描、推送保护和私密漏洞反馈。自动依赖更新 PR 未开启，避免后台创建额外分支。

[Validate 工作流](../.github/workflows/validate.yml)使用 Windows、Node.js 24 和固定 pnpm 12.4.2，所有 Actions 固定到完整 commit SHA；令牌只读，不保留检出凭据。`DSH compatibility` 用 0.2.1-rc.2 与 0.2.2-alpha.3 宿主重跑同一套测试，`CodeQL` 做 JavaScript/TypeScript 静态分析，`Dependency review` 在 PR 中拦截高危依赖变更，`Security audit` 每周复查新披露漏洞，标签或手动 `Package` 只生成两个 `.tgz` 产物并保留 14 天。验证包含冻结依赖锁、依赖审计、真模型审计证据校验、原生 DSH 测试依赖检查、客户端载荷一致性、回归测试和两个独立包的发行预检。CI 不调用付费模型、不安装浏览器内核、不自动发布包。
