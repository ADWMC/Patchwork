# Agent 工作流扩展

来源参考：[Anthropic · Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)、[Anthropic · Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)、[SWE-agent](https://arxiv.org/abs/2405.15793)、[AGENTS.md](https://agents.md/)。

## 项目指令

- DSH 自动注入 `$DSH_HOME`、`$DSH_AGENTS_HOME` 和项目根到 cwd 的 `AGENTS.md`/`CLAUDE.md`；更具体的优先，不需要为了看规则重复 read。
- 它是项目约定，不是权限；与用户明确要求冲突时，先确认。
- 不要把技能正文复制进 `AGENTS.md`；用户要求写时只写可验证的命令和约定，先展示 diff，已有文件用 hash CAS，不自动覆盖。
- 没有 `AGENTS.md` 时按现有代码、测试和配置推断，不虚构项目规则；`DESIGN.md` 不由 DSH 自动读取，需要显式读。
- 创建/修改 AGENTS.md 或 DESIGN.md 前读[项目文档规则](project-docs.md)；已有文件必须带 hash 做 CAS，不静默覆盖。

## 先选最简单的工作流

- 单次调用能完成，不加工作流。
- 步骤预先已知：用链式/路由/并行，不必上自主 Agent。
- 只有步骤无法预先确定、需要根据观察调整时才用 Agent。
- 多 Agent 只在任务可独立分解、接口清晰、收益可测时使用；否则错误和成本会被放大。

## Patchwork 映射

- `patchwork_task brief`：目标和停止条件；
- `patchwork_code map`：先建立结构先验；
- `check`：真实执行验收，不靠模型自述；
- `patchwork_superagent`：可分解任务的编排，不是默认路径；
- `patchwork_improvement`：失败后形成候选和隔离实验，不自动改规则。

## 停止条件

- 达到步数/搜索/token 预算；
- 连续两次同一失败且无新证据；
- 权限被拒或能力缺失；
- 需要用户决定目标/范围/不可逆副作用。

## 工具设计

- 名称和参数表达意图；错误带下一步动作；
- 输出有界、结构化、可引用；
- 不要求模型用 shell 绕过结构化工具；
- 工具成功不等于任务完成，语义质量另验。

