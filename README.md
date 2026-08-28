# Patchwork

Patchwork is a DeepSeek Harness plugin for writing and maintaining code.

Its first foundation is an Agent + Hook workflow: the agent handles the
reasoning and implementation loop, while hooks enforce project maintenance
boundaries around investigation, changes, and verification.

The project records the working rules that make an implementation agent useful
over time: establish facts before changing code, make the smallest correct
change, verify the affected behavior, and report what actually happened.

The current repository documents the foundation before the runtime plugin is
implemented. The implementation must follow the project's engineering rules
and the target project's conventions.

## Documents

- [Engineering agent guide](docs/engineering-agent-guide.md): the operating
  rules for investigation, implementation, debugging, and verification.
- [Git commit conventions](docs/git-commit-conventions.md): Conventional
  Commits format, scope, and authorization rules.
- [Preset and release lessons](docs/preset-and-release-lessons.md): reusable
  lessons from deploying an agent preset into a changing host environment.
- [Source notes](docs/source-notes.md): the materials consolidated here and
  the boundaries of this migration.
- [DeepSeek Harness plugin development](docs/deepseek-harness-plugin-development.md):
  a Chinese index of the upstream plugin development documentation.
- [Positioning and references](docs/positioning.md): the product boundary and
  the projects and writing that define this foundation.
- [Maintainable coding agent prompt](docs/maintainable-coding-agent-prompt.md):
  the actionable prompt distilled from the maintainability reference.
- [Hook foundation](docs/hook-foundation.md): Patchwork's native Hook direction,
  informed by Ponytail but implemented independently.
- [Agent foundation](docs/agent-foundation.md): the first DSH plugin entry that
  registers Patchwork's maintainability prompt.
- [Maintenance session core](src/maintenance-session.mjs): research, scope,
  verification, and output-budget boundaries shared by Agent and Hook layers.

## Agent preset

安装插件后，生成并安装可在 DSH Agent 选择器中显示的 preset：

```powershell
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
Copy-Item presets/patchwork/preset.yml "$env:USERPROFILE/.dsh/.agent-presets/patchwork/preset.yml" -Force
```

宿主 DSH 升级后重新运行生成命令；它会保留宿主 standard 的工具行，仅更新
Patchwork persona。

## Intended outcome

Patchwork should help with implementation, debugging, maintenance, and
refactoring without treating a successful-looking answer as proof. Its
behavior is guided by the documents in this repository and by the conventions
of the project it is asked to change.
