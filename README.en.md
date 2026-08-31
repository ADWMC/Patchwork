# Patchwork

中文版本：[README.md](README.md)

## Overview

Patchwork is a coding and maintenance plugin for DeepSeek Harness.
It uses an Agent + Hook model: the Agent handles understanding, implementation,
and verification; Hooks provide mechanically checkable maintenance warnings.

## Core behavior

- Investigate facts, callers, configuration, and tests before editing.
- Ask the user before editing when ambiguity could change implementation or acceptance.
- Split large features by responsibility and domain; avoid thousand-line files.
- Use names that express business roles; reject vague names such as `final_new`, `debug3`, and `CommonUtils`.
- Verify the original path after editing and report only observed evidence.
- Update affected documentation and the README after code, configuration, or behavior changes.
- When a Hook finds a structure or naming issue, it adds a focused prompt; the same issue is prompted at most once every 30 rounds per session.

## Agent preset

Run the full Patchwork tool surface in its own profile so it does not collide
with helmd or another preset that already registers `pwsh/read/...`. Copy
`profiles/patchwork` into the DSH profile root and install it:

```powershell
Copy-Item -Recurse profiles/patchwork "$env:USERPROFILE/.dsh/profiles/patchwork" -Force
pnpm --dir "$env:USERPROFILE/.dsh/profiles/patchwork" install
pnpm --dir "$env:USERPROFILE/.dsh/profiles/patchwork" add "file:$PWD"
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
```

Start it with `dsh --profile patchwork --no-open`. Do not mount helmd and
Patchwork full tool presets in the same DSH process.

After installing the plugin, derive a Patchwork preset from the host DSH standard preset:

```powershell
node scripts/gen-preset.mjs --out "$env:USERPROFILE/.dsh/.agent-presets/patchwork"
Copy-Item presets/patchwork/preset.yml "$env:USERPROFILE/.dsh/.agent-presets/patchwork/preset.yml" -Force
```

Then select `Patchwork` in the DSH Agent Preset picker. The preset exposes the DSH
standard shell, filesystem, search, task, and agent tools while using host-installed
implementations, so switching agents within one process remains safe.

## Hook checks

The Hook supports standalone stdin invocation and DSH's native
`tools/post-execute` lifecycle. It accepts JSON containing `cwd` and `files`,
or extracts source paths from tool arguments, returns `warnings` and
`additionalContexts`, and never blocks the Agent:

```powershell
'{"event":"PostToolUse","cwd":"C:\project","files":[{"path":"C:\project\debug_final.cpp"}]}' |
  node hooks/patchwork-hook.mjs
```

## Documentation

- [Engineering agent guide](docs/engineering-agent-guide.md)
- [Maintainable coding prompt](assets/prompts/maintainable-coding-agent-prompt.md)
- [Hook foundation](docs/hook-foundation.md)
- [Agent foundation](docs/agent-foundation.md)
- [Git commit conventions](docs/git-commit-conventions.md)
- [Preset and release lessons](docs/preset-and-release-lessons.md)
- [DeepSeek Harness plugin development](docs/deepseek-harness-plugin-development.md)

## Git commits and pushes

Commit once when a clearly scoped task is complete, using Conventional Commits.
Pushing always requires an explicit user request; “finish the code and shut down”
does not authorize a push.

## Goal

Patchwork aims to keep code understandable, verifiable, and evolvable while reducing
repeated instructions and wasted tokens.
