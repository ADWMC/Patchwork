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

The runtime plugin is delivered in the package but mounted by the Patchwork
agent preset. The package-level `cordis.patch.yml` is intentionally empty so
installing the dependency does not affect every agent in the profile. The plugin adds the full Agent
prompt through `systemPrompt.section` and observes the native
`tools/post-execute` waterfall. It extracts source paths from tool arguments,
runs the advisory structure check, and appends a `dsh-llm` `UserMessage` via
`additionalContexts`; failures are contained so the Hook never blocks a tool.

The generated preset keeps the host `standard` persona and adds exactly one
`@patchwork/coding-agent` row. This
avoids copying the full Agent prompt into the preset: `assets/prompts` is the
single source of truth and is injected once by the runtime plugin.

Verified against DSH `0.1.1-rc.2`: `dsh --profile web --no-open` reached the
web server after reinstalling the local file dependency, and the repository
test suite passed.
