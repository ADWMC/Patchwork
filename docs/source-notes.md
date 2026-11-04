# Source Notes

## What was consolidated

This documentation records the user's engineering experience as the primary
behavioral baseline for a future Agent + Hook coding plugin. It also draws on
the engineering practices and maintenance records developed in the `helm-d`
project, together with the following reading supplied as a design reference:

- [Maintaining a complex project](https://github.com/ascoders/weekly/blob/master/%E5%89%8D%E6%B2%BF%E6%8A%80%E6%9C%AF/264.%E7%B2%BE%E8%AF%BB%E3%80%8A%E7%BB%B4%E6%8A%A4%E5%A5%BD%E4%B8%80%E4%B8%AA%E5%A4%8D%E6%9D%82%E9%A1%B9%E7%9B%AE%E3%80%8B.md)

The reusable ideas are evidence-based delivery, minimal changes, stable
boundaries, regression-oriented verification, single sources of truth, and
testing the actual deployment path.

## What was intentionally excluded

Patchwork does not copy the security-analysis domain workflow, binary-analysis
methods, sample handling rules, domain-specific tools, or security reference
library from `helm-d`.

The separation is deliberate: this repository is the design and implementation
base for a maintainable coding plugin, not a fork of the security-analysis
product.

## Status

The bundle declares two separate owners. `cordis.patch.yml` mounts the shared Web
bridge at the profile root. `presets/patchwork.patch.yml` declares a preset that
copies the pinned DSH 0.2.1-rc.5 standard fixture and appends
`@patchwork/coding-agent/runtime`. Only the Patchwork composition mounts model-side
skills, tools, hooks and mechanisms. Switching away revokes those capabilities;
the shared Web entry remains available with a locked explanation. Nothing reads
`$DSH_HOME/.agent-presets/` to activate this preset.

The plugin registers seven skills through `ctx.skills` (no `systemPrompt` section)
and observes the
native `tools/post-execute` waterfall. It extracts source paths from tool arguments,
runs the advisory structure check, and appends a `dsh-llm` `UserMessage` via
`additionalContexts`; failures are contained so the Hook never blocks a tool.
Path extraction is limited to mutating tools and to files inside the session
workspace, so reading a large third-party file produces no warning.

The generated preset keeps the host `standard` persona and adds exactly one
`@patchwork/coding-agent/runtime` row. This
avoids copying behavior rules into the preset: `assets/skills` is the
single source of truth and is registered once by the runtime plugin.

The earlier DSH 0.1.1-rc.2 startup was a historical baseline. Current isolated
0.2.1-rc.2 task, persistence and UI evidence is recorded in the
[2026-10-30 integration plan](upgrade/2026-10-30-integration.md). Native task
records and explicit short task projections are separate: records are ignorable,
while task-tool results and notices deliberately enter the Patchwork model context.
