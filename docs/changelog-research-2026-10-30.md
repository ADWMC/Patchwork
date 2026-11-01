# 更新日志调研：大型项目与官方规范

核查日期：2026-10-30。本文依据下列七份一手资料，比较它们如何筛选、编写和审查变更说明，再给出 Patchwork 的采用决策。网页会更新；Django 来源是开发版文档，不能视作某个稳定版本的规定。

## 结论

这些项目共同强调：按读者受到的影响筛选内容，随实现维护说明，并把发布说明作为审查对象。它们没有统一的收录范围、分类或生成方式。例如，GitLab 通常豁免纯文档变更，pytest 有专门的文档条目类型，Django 则按变更类型和分支决定写入哪份 release notes。[S2][S4][S5]

Patchwork 的问题是交付流程漏掉了更新日志判断。解决办法是把“需要记录吗、记录了什么、依据是什么”接入改动收尾；单独放一份写作规范不足以约束 Agent。具体执行规则见[更新日志指南](changelog-guide.md)。以下“采用”均为本项目的维护决定，不是来源对所有项目的强制要求。

## 一手来源与比较

| 来源 | 已核实的做法 | 对 Patchwork 的启发 |
|---|---|---|
| [S1 Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) | 人工筛选、面向人的版本变更记录；新版本在前，保留 Unreleased；采用 Added、Changed、Deprecated、Removed、Fixed、Security 类别，省略空类；不把 git log 直接当成更新日志。 | 保持短小的根目录 CHANGELOG，按最终用户结果合并实现细节。它是社区约定，不是全行业标准。 |
| [S2 GitLab：Changelog entries](https://docs.gitlab.com/development/changelog/) | 用 `Changelog:` Git trailer 选择进入生成器的提交；记录用户可见、API、安全、数据库或搜索迁移等变化；通常豁免内部重构、测试、纯文档及同一未发布版本中新引入又修复的问题，另有社区贡献例外。条目应让不了解实现的读者理解结果。 | 明确收录与豁免理由；一个未发布功能的迭代合并成最终结果。暂不引入 trailer 生成器。 |
| [S3 Kubernetes：Adding Release Notes](https://www.kubernetes.dev/docs/guide/release-notes/) | 用户或运维可见的 CLI、API、UI、配置、平台、效率与弃用等变化需要说明；测试、构建基础设施等可豁免。PR 用 release-note 区块和 label 表达判断，不适用可明确写 `NONE`；迁移标明 `action required`。 | 把是否需要日志变成审查中的明确判断；涉及升级时写准确的字段、命令、动作及文档链接。 |
| [S4 pytest：Contributing](https://docs.pytest.org/en/stable/contributing.html) | 随 PR 提交 `changelog/<issueid>.<type>.rst` fragment；类型包括 feature、improvement、bugfix、doc、deprecation、breaking 等；不影响已文档化行为时可以跳过。 | 采用随改动维护、按行为判断的原则；存在 doc 类型也说明不能把所有文档变更一律排除。暂不照搬 fragment 工具链。 |
| [S5 Django：Submitting patches（开发版）](https://docs.djangoproject.com/en/dev/internals/contributing/writing-code/submitting-patches/) | checklist 把 release notes 与测试、文档并列；新功能和不兼容变化写入 `docs/releases/A.B.txt`，稳定分支回补修复写入 `A.B.C.txt`，并非所有仅在 main 上的修复都需要说明；弃用另需正文标记与时间表。 | 收尾同时核使用文档、变更说明和验证；弃用、破坏性变化必须给升级路径，不能仅写“已优化”。 |
| [S6 GitHub：Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes) | 根据 tag 范围生成已合并 PR、贡献者和比较链接；`.github/release.yml` 可按 label 等条件分类及排除。官方要求检查生成结果，确保包含全部且仅包含想要的内容；保存草稿与发布是不同操作。 | 自动摘要只是材料，仍需核对范围和实际差异；它不能证明本地未提交工作已经被收录或发布。 |
| [S7 Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) | 先明确公共 API；已发布版本内容不能覆盖；定义预发布标识；`0.y.z` 属初始开发阶段。 | 区分未发布条目、目标版本与真实发布日期；不能机械地对所有 0.x 不兼容变更要求升 major，也不能因起草日志就擅自改版本或发布。 |

## 条目写法的共同依据

GitLab 要求站在零上下文读者的角度，说明用户能观察到的变化；Kubernetes 要求准确指出受影响接口和必要行动。二者都不支持把内部函数名、提交标题或“Fix CSS”直接作为可用说明。[S2][S3]

对 Patchwork，可把“调整 scope guard”写成“切走 Patchwork 后撤销工具与技能，保留的旧工具引用也不能继续调用”。这样读者知道何时生效和结果；技术映射及测试条件放进审计报告。若没有受控测量，不写“节省 50% token”；若尚未实现，不写进已完成变更。

Keep a Changelog 强调弃用、删除和破坏性变化不能遗漏，Django 进一步要求维护弃用路径。因此条目应明确“谁需要调整、调整什么、何时调整”，必要时链接迁移文档，而非只列新功能。[S1][S5]

## Patchwork 采用决策

1. **在交付时检查，而非等到发布才补。** 总规则导航到 standards；standards 判断收录范围，anti-slop 负责条目表达，evidence 复核是否覆盖当前任务。详细指南留在文档，不增加第八个技能，也不注入全局 system prompt。
2. **按实际影响收录。** 工具参数、默认配置、权限隔离、持久化、兼容范围及技能行为都可能影响使用者；Markdown 文件也可能是可执行的 Agent 行为资产。纯排版、测试和无行为变化的内部整理可以豁免，并在交付时说明具体理由。
3. **沿用项目约定。** Patchwork 当前使用根目录人工 CHANGELOG 和未发布区；维护其他项目时先找它的贡献规范、日志或 fragment 约定，不强行创建同名文件。
4. **正文、说明与证据分工。** CHANGELOG 写变化和升级行动；README/使用文档写怎么用；实验、审计和验证报告写环境、方法、失败及结果。测试总数不堆进每条用户变化。
5. **保持未发布事实。** 当前包版本为 `0.2.0`；本次整理不创建新版本、tag 或 Release，不为此前版本补造没有核实的日期和完整历史。
6. **暂不增加发布基础设施。** 目前不引入 Changesets、Towncrier、Release Please、Git trailer 生成器或 CI 硬门禁。将来多人并发维护出现日志冲突时，再评估 fragment；生成器不能替代事实和迁移审查。

## 实施范围与限制

本次把规则接入 `patchwork`、`standards`、`anti-slop`、`evidence` 四条既有技能，并在工程指南、发布经验和中英文 README 提供入口；[CHANGELOG](../CHANGELOG.md) 按用户变化重整。核心收尾规则在技能正文中，不依赖模型一定找到外部指南。

这属于工作流程约束。按需技能是否加载、模型是否逐项执行，仍不能只靠文档保证；本次没有新增最终回答拦截器，也不声称已经实现“永不漏写”的自动检查。注册与隔离测试能证明技能加载范围和正文可用性，不能证明所有未来任务的写作质量。

资料仅作为依据，没有执行来源网页里的 Git 历史改写、发布或其他项目专属流程。本文也不推导性能收益；既有功能和真实 DSH 验证条件见[融合执行报告](upgrade/2026-10-30-integration.md)。
