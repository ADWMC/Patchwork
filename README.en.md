# Patchwork

中文版本：[README.md](README.md)

Change history: [CHANGELOG.md](CHANGELOG.md), including unreleased changes (Chinese).

## License

Patchwork is licensed under the [GNU Affero General Public License v3.0](LICENSE) (SPDX: `AGPL-3.0-only`). Commercial use is permitted. Distribution and modification must comply with the license; modified versions that support remote network interaction must offer their Corresponding Source to those users as required by section 13. The full license governs. Third-party materials retain their own licenses and notices; this change does not revoke licenses already granted for earlier versions.

## Overview

Patchwork is a coding and maintenance plugin for DeepSeek Harness.
It uses a Skill + Hook model: seven on-demand DSH skills constrain maintainable
coding behavior (zero systemPrompt injection; the catalog carries only
name + description, bodies load on demand), while Hooks provide mechanically
checkable maintenance warnings and evidence hints on tool output (not an enforced final-answer gate).

For code-maintenance tasks, the repository also ships the [Patchwork Coding Task Benchmark](benchmarks/coding/README.md):
eight maintenance issues covering retry behavior, path boundaries, nested redaction, stable ranking,
JSONL recovery, memory CAS, task status and search deduplication. The 2026-10-31 oracle quality run
passed 8/8 (100%): every buggy baseline failed and every reference fix passed public and hidden
acceptance. This is reproducibility evidence for the task set, not a model completion rate. A real
Agent report must include the model, DSH version, isolated workspace, hidden-test output and run id.
See the [oracle quality report](benchmarks/coding/reports/2026-10-31-oracle-quality.json) and
[marketing wording](benchmarks/coding/marketing-copy.md).

## DSH-internal Superagent

The current root Patchwork session can use `patchwork_superagent` for a persistent task queue, native DSH executors, dependencies, bounded retries and same-owner result notices. Executors inherit the host model, permissions, preset and SoL. Reads may run concurrently; this module serializes writes in the same workspace. No external sources, webhooks, delivery service or second runtime are introduced.

Use `/patchwork-superagent` to inspect the queue. Tool actions include inspect, submit, report, input, retry, pause, resume, cancel and reconcile; mutations require the inspected revision. Model completion claims cannot substitute for final native task acceptance; uncertain restored work pauses for review. See the [implementation, source research and limits](docs/superagent-native-2026-11-01.md) (Chinese).

## SoL-Pi mechanism status

Patchwork is replicating the four runtime mechanisms of
[SoL-Pi](https://github.com/NVlabs/SoL-Pi). The switches are Cordis configuration
fields; **Action Fusion is on by default**, and the other three are **off by default**.
Fusion counts are execution records; token/request savings require a controlled comparison.

| Mechanism | Config key | Status |
|---|---|---|
| Action Fusion | `actionFusion` | Real DSH + StepFun: write/edit success and nonzero exit |
| ObservationPack | `observationPack` | Live archive/recall and head/tail evidence verified; inventory answered without recall |
| Evidence-Preserving Reducer | `evidencePreservingReducer` | Real failed Node spec log: complete failure section retained locally, no extra model call; other formats need validation |
| Online Context Compact | `onlineContextCompact` | Lock, boundary, measurement and settlement fixed; native compaction/resumption verified; automatic strategy benefits await long-task comparison |

Dependencies mainly target DSH 0.2.0-rc.2. The native sidebar UI and live calls were
verified on an isolated official DSH 0.2.1-rc.2 Patchwork preset, with standard-mode
negative isolation checks. Preset generation now uses a pinned standard fixture;
dependency migration remains unfinished. See the
[2026-10-29 upgrade and verification report](docs/upgrade/2026-10-29/README.md).
Four real task classes, failed pilots and current optimizations are documented in the
[2026-10-30 SoL experiment report](docs/experiments/2026-10-30-solpi/report.md) (Chinese).

**Select Patchwork in a new session's Agent selector first.** The panel opens from
DSH's right sidebar Start page. It uses host controls, tokens and appearance settings,
polls state every two seconds only for Patchwork sessions,
and separates loaded configuration, saved values and local drafts. Configuration
currently applies to DSH_HOME, not an isolated profile settings namespace.
Other Agents show a locked explanation, collect no tool evidence, and read no
Patchwork configuration. Switching sessions or hiding the panel stops requests
and unmounts evidence and unsaved drafts.

The **Logs** tab filters by mechanism/severity and exports up to 200 recent diagnostic
metadata records. Supported hosts persist these as native Session plugin records;
older hosts explicitly fall back to bounded process memory. Diagnostics omit prompts,
full commands and raw tool output, and use SHA256 correlation fingerprints. Leaving
Patchwork revokes access. Compatibility ledgers/journals rotate at 256 KiB with one
backup; raw evidence objects are not deleted. See the [logging guide](docs/logging.md)
(Chinese) for retention, privacy boundaries and live validation coverage.

The panel uses DSH settings-card colors, thin strokes, radius tokens and native segmented tabs.
The overview groups the current task, declared phase and acceptance rows in one card, with tool records in a separate card.
An empty improvement card is omitted. Execution/context settings stay in Patchwork; browser resource policies belong to the optional browser plugin. Technical details start collapsed.
Evidence has Current, Retrieval, Memory and Improvements views. Memory is on-demand with
automatic injection disabled. Improvements collect redacted incidents, candidates and
experiment eligibility; approval, trial and rollback require user confirmation and currently
record a decision without activating a runtime rule.
Logs use a flat list with selected-record details below, combined filters and expandable
raw metadata. The panel adapts to narrow sidebars and host light/dark appearance.
Ionicons 5 Outline attribution and MIT license are included in the
[third-party notices](THIRD_PARTY_NOTICES.md).

When DSH `web_search` has no provider key or its provider is unavailable, the Patchwork
runtime exposes `patchwork_search` by default. It queries Bing, Brave Search, and DuckDuckGo
public HTML pages in parallel without an API key and returns up to 12 deduplicated results with
bounded snippets. Results are marked as untrusted external data. The tool is registered only in
the Patchwork Agent scope and retained references fail after switching away. Configure it with
`nativeSearch`, `nativeSearchProviders`, `nativeSearchMaxResults`, and `nativeSearchTimeoutMs`.
This is an availability fallback, not a replacement for an SLA-backed provider or a full page fetcher.

## Skill packs (zero systemPrompt)

`patchwork_task` tracks the current target, declared phase, correction revision,
absolute artifact paths and per-requirement acceptance. Command checks bind actual
host receipts; missing exits, failures, stale results and incomplete coverage cannot
pass. Artifact structure checks do not prove semantic correctness. Native Session
records restore task state and feed the existing Overview/Evidence views.
`{ "action": "handoff" }` reads a recovery JSON snapshot capped at 8,000 UTF-16 code units, with current requirements, corrections and evidence pointers; use inspect to expand omissions. Native compaction restores missing task context. Cancellation, corrections and mode changes prevent an old OCC continuation. The latest 128 input fingerprints persist with the Session and stay outside model/UI projections. See the [Superagent adaptation and SoL assessment](docs/superagent-fusion-2026-11-01.md).

For an existing task, `correct` inherits omitted `title`, `phase`, and instance constraints; the current `baseRevision` is still required. Omitting the phase never upgrades analysis or plan to implementation.
See the [integrated execution plan](docs/upgrade/2026-10-30-integration.md) for
source mapping, execution evidence and limitations. Fields are top-level:
`check` takes a requirement `id` and `command`; `artifact` takes an artifact `id` and absolute `path`.
`/patchwork-task` displays the current projection. Runtime `taskPolicyMode` defaults
to `structured`; `strict` rejects unsupported effect channels. Neither is an OS
sandbox or a proof of human authorization. Task-local experience candidates and the
experiment-record checker never activate or publish changes automatically.
New input conservatively invalidates an existing task's evidence. Structured
mutations require a restated contract first. Native checkpoints survive cold
resumption; forks do not inherit acceptance or instance authority.
The information-retrieval contract, DSH search inventory, source governance,
budgets and isolation plan are in the [information retrieval research and plan](docs/information-retrieval-research-2026-10-31.md)
and its [standalone retrieval workflow prompt](assets/prompts/retrieval-research-prompt.md).

Behavior rules never enter the system prompt; they are split into thirteen native
DSH skills disclosed progressively through `ctx.skills`:

| Skill | When it loads |
|---|---|
| `patchwork` | Coding and maintenance entrypoint for the Patchwork Agent |
| `anti-slop` | Writing copy, changelogs, reports, PR descriptions: reject template sentences and sycophancy |
| `web-ui` | Designing, building, or reviewing Web UI: choose direction by surface purpose; inspect interaction, motion, data limits, and rendered states |
| `architecture` | Cross-module responsibilities, state ownership, and dependency boundaries |
| `collaborator` | Verify corrections and conflicts; explain options when a real trade-off exists |
| `debugging` | Reproduce failures and locate causes of test or performance regressions |
| `code-review` | Review diffs, user paths, and concrete trust boundaries |
| `retrieval` | Check current external information and conflicting sources |
| `documentation` | README, usage guides, changelogs, and migrations |
| `memory` | Explicit cross-session recall, proposal, confirmation, and forgetting |
| `improvement` | Turn observed failures into controlled improvement candidates |
| `standards` | Implementation/fix handoff, usage docs, changelogs, and commit standards |
| `evidence` | Requirement-bound evidence, distinguishing commands, artifact structure and semantic review |

The default `skillsMode: core` registers the original seven skills. Set `skillsMode: expanded` on the preset's `patchwork-runtime` row to trial all thirteen skills, or `skillsEnabled: false` to disable skill registration; see the
[collaborator skill architecture](docs/architecture-collaborator-skills.md)
for the design rationale.
The `web-ui` skill exposes an on-demand local design contract and verification matrix through
the host's native skill resource directory. See the [seven-skill reliability audit](docs/skill-reliability-audit-2026-10-31.md)
and [fusion execution record](docs/skills-fusion-execution-2026-10-31.md) (Chinese) for the scope and limits.

Browser support is now a separate optional DSH plugin, **`@patchwork/browser`**. Patchwork does not package or install browser code, Playwright, fingerprint dependencies, the browser sidebar, or component installers.

Install the optional package separately to get a dedicated **Browser** sidebar entry. Any Agent mode can explicitly enable access for its current session. Tools are registered in that Agent's native scope; switching modes or disabling access revokes the grant and closes its engine. Other Patchwork tools, memory and mechanisms remain scoped to Patchwork.

Interactions follow observed DOM/ARIA facts and semantic locators, with fresh observation ids and screenshots when vision matters. Compact element refs, bounded reads, condition waits and up to eight form steps reduce repeated observations. Manual input uses an ordered lightweight path; display uses authenticated binary WebSocket frames with display acknowledgments, with SSE/JPEG fallbacks. Dragging, double-clicking, horizontal scrolling, composition input, display zoom and an expanded view are supported within the web-page surface.

Patchwork search/fetch defaults to HTTP. Explicit `transport:"browser"` requires a separate browser grant for the same live Agent. Retrieval renders in a temporary context without existing logins, preserves the visible tab, and retains host, robots, public-network and resource limits. Browser code and dependencies remain in the optional package. See the [integration and validation guide](docs/browser-runtime-integration-2026-11-01.md), [optional package guide](docs/browser-optional-package-2026-11-01.md) (Chinese) and [browser README](packages/browser/README.md).

## Core behavior

- Investigate facts, callers, configuration, and tests before editing.
- Ask the user before editing when ambiguity could change implementation or acceptance.
- Split large features by responsibility and domain; avoid thousand-line files.
- Use names that express business roles; reject vague names such as `final_new`, `debug3`, and `CommonUtils`.
- Verify the original path after editing and report only observed evidence.
- Maintain usage docs and changelog entries alongside behavior changes; check coverage before handoff and give a specific reason when exempt.
- When a Hook finds a structure or naming issue, it injects a one-line `[pw:structure]` code pointing at the matching skill; the same issue is prompted at most once every 30 rounds per session.
- EvidenceGate (`evidenceGate`, on by default): tool-result completion claims without valid current-task acceptance trigger a reminder once per revision. An unrelated successful shell no longer suppresses it. This does not intercept the assistant's final text.
- The `/patchwork-review` command reviews code from the user's standpoint: walking user paths for bugs and UX defects, including commercial boundaries.

## Agent preset

Installing the DSH bundle adds a preset and a native panel bridge. **Only sessions
that select Patchwork load its skills, review command, hooks and mechanisms.**

```powershell
npm pack --pack-destination "$env:USERPROFILE/.dsh/.tgz-cache"
dsh plugin --profile web add "$env:USERPROFILE/.dsh/.tgz-cache/patchwork-coding-agent-0.2.0.tgz"
```

The `patchwork` preset (`presets/patchwork.patch.yml`) copies a pinned DSH
0.2.1-rc.2 standard fixture row for row and appends `@patchwork/coding-agent/runtime`
without registering browser tools. Browser installation is independent.
Host registries scope tools, skills and commands; execution also checks the live
composition. Forged headers/cwd and retained tool references cannot authorize it.
Other presets, including standard, PTC and Helmd, do not load these behaviors.
Since 0.1.7, presets no longer activate by copying files into `$DSH_HOME/.agent-presets/`.

Put deployment defaults on the preset's `patchwork-runtime` row. The profile-level
`patchwork-agent` row now supplies only the Web bridge; mechanism fields on that row
no longer configure Agents. Panel overrides remain in `$DSH_HOME/patchwork/config.json`,
take precedence over runtime-row configuration, and apply on subsequent Patchwork
runtime loads. See the [Agent isolation audit](docs/upgrade/2026-10-29/isolation.md).

## /patchwork-review command

The main entry for reviewing code from the user's standpoint:

```text
/patchwork-review [<scope>]
```

The agent walks the first-value path as the target user, hunts bugs from
user mistakes, treats UX friction as defects, and checks commercial
boundaries (free-core completeness, paid-tier seams, install friction).
Minimal fixes it can make immediately are implemented and verified along
the user path; the rest are reported as known issues or open decisions.

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

- [DSH-internal Superagent controller, fixed community source research and validation, 2026-11-01 (Chinese)](docs/superagent-native-2026-11-01.md)

- [Browser gap execution: security, streaming, probes, receipts, delivery and validation scope, 2026-11-01 (Chinese)](docs/browser-gap-execution-2026-11-01.md)
- [Open-source fingerprint browser research: 15 repositories, engine source boundaries, identity lifecycle, and adoption decisions, 2026-11-01 (research basis; Chinese)](docs/fingerprint-browser-research-2026-11-01.md)
- [ZCode browser research: session boundaries, tab recovery, screenshots, virtual clipboard, and recording plan, 2026-11-01 (research basis; Chinese)](docs/zcode-browser-research-2026-11-01.md)
- [Browser community research: 26 projects, engine coherence, streaming, replay, and adoption order, 2026-11-01 (Chinese)](docs/browser-community-research-2026-11-01.md)
- [Browser workspace upgrade and isolated runtime validation, 2026-11-01 (Chinese)](docs/browser-workspace-upgrade-2026-11-01.md)
- [Scoped memory, self-improvement, and UI/UX quality design, 2026-10-30 (proposal, not implemented; Chinese)](docs/memory-evolution-design-2026-10-30.md)
- [Companion source research: seven projects, DSH request isolation, and storage choices (Chinese)](docs/memory-evolution-research-2026-10-30.md)
- [Memory deep dive: four DSH adapters, write consistency, temporal updates, and task evaluation, 2026-10-31 (Chinese)](docs/memory-deep-dive-2026-10-31.md)
- [Information retrieval research and plan: DSH search, mature projects, skills, and isolated evaluation, 2026-10-31 (Chinese)](docs/information-retrieval-research-2026-10-31.md)
- [Standalone information-retrieval workflow prompt](assets/prompts/retrieval-research-prompt.md)
- [Changelog guide: scope, writing, and handoff checks (Chinese)](docs/changelog-guide.md)
- [Web UI community skill review and adoption decisions, 2026-10-31 (Chinese)](docs/web-ui-skill-community-review-2026-10-31.md)
- [Seven-skill reliability audit, 2026-10-31 (Chinese)](docs/skill-reliability-audit-2026-10-31.md)
- [Skill research and integration plan, 2026-10-31 (proposal; Chinese)](docs/skills-fusion-plan-2026-10-31.md)
- [Official changelog practices across major projects, 2026-10-30 (Chinese)](docs/changelog-research-2026-10-30.md)
- [Engineering agent guide](docs/engineering-agent-guide.md)
- [SoL-Pi mechanisms design](docs/solpi-mechanisms-design.md)
- [Controlled improvement execution record, 2026-10-31 (Chinese)](docs/improvement-execution-2026-10-31.md)
- [Collaborator skill architecture](docs/architecture-collaborator-skills.md)
- [Maintainable coding prompt (source for the skill bodies)](assets/prompts/maintainable-coding-agent-prompt.md)
- [Hook foundation](docs/hook-foundation.md)
- [Agent foundation](docs/agent-foundation.md)
- [Git commit conventions](docs/git-commit-conventions.md)
- [Preset and release lessons](docs/preset-and-release-lessons.md)
- [DeepSeek Harness plugin development](docs/deepseek-harness-plugin-development.md)
- [Product engineering guide](docs/product-engineering-guide.md)

## Git commits and pushes

Commit once when a clearly scoped task is complete, using Conventional Commits.
Pushing always requires an explicit user request; “finish the code and shut down”
does not authorize a push.

## Goal

Patchwork aims to keep code understandable, verifiable, and evolvable while reducing
repeated instructions and wasted tokens.
