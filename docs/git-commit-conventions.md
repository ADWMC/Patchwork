# Git 提交规范

仅在用户明确授权后提交。每个提交只包含一个可独立审查的逻辑变化，使用
Conventional Commits：

```text
<type>(<scope>): <简短描述>
```

允许的 `type`：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`、
`perf`。没有合适范围时省略 scope，例如 `docs: clarify preset usage`。

- 描述使用动词，说明结果，不写实现流水账；保持简短，不以句号结尾。
- 不把格式化、重命名或无关清理混入功能提交。
- 需要补充说明时在正文写动机、影响和验证命令；破坏性变更使用 `!` 或
  `BREAKING CHANGE:` 明确标记。
- 推送前检查 `git diff --check`、相关测试和提交内容；未经授权不提交或推送。

示例：

```text
feat(hook): add structure warning cooldown
fix(preset): preserve host tool rows
docs: document agent preset installation
```
