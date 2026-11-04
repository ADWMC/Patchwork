<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/hero-dark.svg">
  <img src="docs/assets/readme/hero-light.svg" width="1200" alt="Patchwork — a coding agent for DeepSeek Harness">
</picture>

<p><strong>Keep task context and evidence together while you code.</strong></p>

<p><a href="README.md">简体中文</a> · <strong>English</strong></p>

<p>
  <a href="https://github.com/ADWMC/Patchwork/actions/workflows/validate.yml"><img src="https://github.com/ADWMC/Patchwork/actions/workflows/validate.yml/badge.svg?branch=main" alt="Validate CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-2e7162?style=flat-square" alt="License: AGPL-3.0-only"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-22%2B-53625b?style=flat-square" alt="Node.js 22 or later"></a>
</p>

<p>
  <a href="#quick-start">Quick start</a> ·
  <a href="#capabilities">Features</a> ·
  <a href="#optional-browser">Optional browser</a> ·
  <a href="#docs">Docs</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

</div>

---

Patchwork is a **coding and maintenance plugin for DeepSeek Harness (DSH)**. It connects task requirements, user corrections, tool receipts and acceptance checks, with on-demand skills, retrieval, memory and a native Superagent controller.

Select the **Patchwork Agent** to enable its capabilities. Other modes keep their own tools and sessions. Browser support is a separate package with a separate session grant.

> **Improvements start with failures and corrections from actual use.** Candidate rules, memory strategies and tool workflows require isolated validation and user confirmation. The improvement module now runs isolated contracts for typed policies; explicit user approval applies a policy only to the current session, and rollback restores the previous policy. Contract checks are not evidence of model-quality gains.

<a id="quick-start"></a>

## Quick start

### 1. Build a local package

You need an installed DSH host, Node.js 22+ and **pnpm 12.4.2**. The commands below use **PowerShell**; CI runs on Windows with Node.js 24.

```powershell
git clone https://github.com/ADWMC/Patchwork.git
cd Patchwork
pnpm install --frozen-lockfile
pnpm build:client
npm run pack:local -- --pack-destination "$env:TEMP/patchwork-pack"
```

This creates a local tarball without publishing to npm or installing into DSH. The package version is currently `0.2.0`; see the [changelog](CHANGELOG.md) for unreleased changes on `main`.

### 2. Install into the DSH instance you choose

Replace `DSH_HOME` with an **initialized instance that already has its model configured**, and check the profile name. Use a separate instance when trying the plugin.

```powershell
$env:DSH_HOME = 'C:\dsh\patchwork-demo'
dsh plugin --profile web add "$env:TEMP/patchwork-pack/patchwork-coding-agent-0.2.0.tgz"
```

Patchwork uses the host's model and permission settings. `@deepseek-ai/dsh-agent-preset` and `@deepseek-ai/dsh-home-paths` are peer dependencies supplied by the target DSH base/web bundles, so the published package never pins an older copy over the host. If a profile still pins an older `@deepseek-ai/dsh-agent-preset`, remove it or align it with the host; otherwise the DSH version gate disables preset rows. The dependency baseline, bundled profile template, preset fixture and real-call verification all target DSH `0.2.1-rc.5`; older hosts are no longer the current test baseline.

### 3. Select the Agent and open the panel

1. Reload the target DSH instance and select **Patchwork** in a new session's Agent selector.
2. Open **Patchwork** from the right sidebar's Start page to see tasks, acceptance checks, logs and settings.
3. Use `/patchwork-task` to inspect the task and `/patchwork-superagent` to inspect the controller queue.

The Patchwork panel shows a locked explanation in other Agent modes. Switching sessions or hiding the panel stops its state requests.

<a id="capabilities"></a>

## Features

| Capability | What it does today |
| :--- | :--- |
| **Tasks and acceptance** | `patchwork_task` records requirements, phases, correction revisions and artifacts. Checks bind actual host receipts; failed, stale and incomplete results cannot pass. |
| **Native Superagent** | `patchwork_superagent` manages persistent queues, dependencies and bounded retries. It defaults to two read slots; this module serializes writes within the same workspace. |
| **On-demand skills** | Seven core skills are registered by default, with an opt-in catalog of thirteen. The catalog exposes names and descriptions; bodies load when requested. |
| **Information retrieval** | `patchwork_search` queries public Bing, Brave and DuckDuckGo pages in parallel without an API key. `patchwork_fetch` performs controlled reads of public URLs. |
| **Local code retrieval** | `patchwork_code` provides a workspace map, file outlines, symbol definitions, lexical references and text/regex search. Reads stay in the current workspace, skip dependencies, build outputs and sensitive files, and return bounded results. The workspace code graph is off by default: the model can `graph-enable` (writes `.patchwork/config.json`) and `graph-start` before using callers/callees/impact/affected. |
| **Project docs** | DSH injects `AGENTS.md`/`CLAUDE.md` automatically; `patchwork_project_docs` handles hash/CAS creation and updates for `AGENTS.md` and `DESIGN.md`. Only these two filenames are writable; no silent overwrite or permission grant. |
| **Explicit memory and improvements** | Search, filters, manual proposals, versioned edits, pause/resume, provenance, export and bulk forgetting; private and shared scopes require separate confirmation. Automatic injection stays off. Improvements retain isolated contracts and session rollback. |
| **Native workspace** | **Overview / Execution / Evidence / Management / Diagnostics / Settings**, with secondary views that appear on demand and carry pending counts; task handoff and correction history, queue input/reconcile, memory recall preview, generic improvement candidates, independent-source comparison, mechanism counters/plan/archive, task/queue/settings logs, 26 settings with reset/import/export. Wide panels use master-detail and two-column layouts, while empty views stay hidden. Uses DSH controls, light/dark tokens and sidebar layouts. See the [implementation record](docs/ui-community-expansion-2026-11-01.md). |

A model's completion claim cannot replace real acceptance. File-structure checks do not establish semantic correctness; those unknowns need separate review.

### How a task moves forward

```text
Define requirements → Investigate and plan → Implement and register artifacts → Verify
                                ↑                                              │
                                └──── Recheck after a user correction ──────────┘
```

Native Session records persist task state. Corrections invalidate old evidence; a bounded, read-only `handoff` supports recovery without replaying the full history. Controller executors inherit the DSH model, permissions, preset and SoL, and report only to their owning controller.

[Tasks and handoff](docs/superagent-fusion-2026-11-01.md) · [Superagent implementation and limits](docs/superagent-native-2026-11-01.md) (Chinese)

<details>
<summary><strong>Skill catalog and configuration</strong></summary>

| Catalog | Skills |
| :--- | :--- |
| Core, enabled by default | `patchwork` · `anti-slop` · `architecture` · `collaborator` · `evidence` · `standards` · `web-ui` |
| Expanded, opt-in | Adds `debugging` · `code-review` · `retrieval` · `documentation` · `memory` · `improvement` to the core catalog |

Configure the expanded catalog on the preset's `patchwork-runtime` row:

```yaml
- id: patchwork-runtime
  name: '@patchwork/coding-agent/runtime'
  config:
    skillsMode: expanded
```

Use `skillsMode: core` for the default catalog, or `skillsEnabled: false` to disable registration. A net benefit across multiple tasks has not yet been established for the expanded catalog. Deployment defaults belong on the runtime row; the profile-level `patchwork-agent` row supplies only the Web bridge.

Panel overrides live at `$DSH_HOME/patchwork/config.json`, take precedence over runtime-row defaults and apply on subsequent loads. Configuration is currently shared by `DSH_HOME`, not isolated by profile.

[Skill architecture](docs/architecture-collaborator-skills.md) · [Integration validation](docs/skills-fusion-execution-2026-10-31.md) · [Configuration and isolation](docs/upgrade/2026-10-29/isolation.md) (Chinese)

</details>

### SoL context mechanisms

The implementation draws on SoL-Pi and uses individual switches. Execution counts do not establish token, latency or cost savings.

| Mechanism | Configuration key | Default |
| :--- | :--- | :---: |
| Action Fusion | `actionFusion` | On |
| Observation archive and recall | `observationPack` | Off |
| Evidence-preserving tool-result reduction | `evidencePreservingReducer` | Off |
| Online context compaction | `onlineContextCompact` | Off |

[Design](docs/solpi-mechanisms-design.md) · [Real tasks, failed pilots and experiment scope](docs/experiments/2026-10-30-solpi/report.md) (Chinese)

<a id="optional-browser"></a>

## Optional browser

**Install `@patchwork/browser` when you need it.** It is an independent DSH plugin and can run without the Patchwork coding-agent package.

| | Patchwork | Patchwork Browser |
| :--- | :--- | :--- |
| Package | `@patchwork/coding-agent` | `@patchwork/browser` |
| Entry | Patchwork Agent and panel | Dedicated Browser sidebar |
| Authorization | Select the Patchwork Agent | Explicit grant for the current session in any Agent mode |
| Browser dependencies | None included | Playwright, frame streaming, environments and component installer |

The browser provides tabs, an address bar, history navigation, manual takeover and inspect-element annotations. Agents get DOM/ARIA snapshots, element references, condition waits and form batches. Pages and login state are isolated by session. It uses system Edge/Chrome by default; additional engines are installed on demand.

Patchwork retrieval defaults to HTTP. `transport: "browser"` requires a separate grant for the same Agent. Retrieval uses a temporary context without existing logins and leaves the user's visible tab in place.

[Installation and controls](packages/browser/README.md) · [Migration](docs/browser-optional-package-2026-11-01.md) · [Retrieval integration](docs/browser-runtime-integration-2026-11-01.md) (Chinese)

## Boundaries

- **Session scoping is not an OS sandbox.** Leaving Patchwork invalidates its capabilities and retained references. The `structured` / `strict` task policies do not replace OS isolation or prove human authorization.
- **Memory is read on demand.** Session-private and project-shared records are separate; confirmation, edits and forgetting use revision checks. The [memory management guide](docs/memory-management-2026-11-01.md) (Chinese) explains the controls. Forgetting stops recall and retains history and backups. Web pages, memories and candidate rules cannot grant new permissions.
- **Improvements require explicit approval.** Only typed current-session policies can be applied after isolated contract checks and confirmation. Switching Agent revokes them; restarting requires a new experiment and confirmation. No model training or automatic publishing. See the [closure and verification guide](docs/closure-2026-11-01.md).
- **Public-page search can fail.** Keyless search is an availability fallback without a provider SLA. Fetching retains DNS/SSRF, host, robots, size and timeout limits; external content is untrusted.
- **Diagnostics have content limits.** Logs omit prompts, full commands and raw tool output. Original evidence objects are retained separately and are not automatically deleted by diagnostic rotation.
- **Native fingerprint support is experimental.** AliasMode engine validation currently covers Windows x64. It does not establish changed egress IPs, TLS fingerprints or acceptance by external anti-bot systems.

<a id="docs"></a>

## Documentation

Most detailed research and implementation records are currently in Chinese.

| Looking for | Start here |
| :--- | :--- |
| Usage guides, research and plans | [Documentation index](docs/README.md) |
| Logs, diagnostics and retention | [Logging guide](docs/logging.md) |
| Memory, improvements and remaining work | [Experience improvement plan](docs/product-experience-evolution-plan-2026-10-31.md) · [Remaining roadmap](docs/remaining-plans-execution-roadmap-2026-10-31.md) |
| Retrieval design and source governance | [Retrieval research](docs/information-retrieval-research-2026-10-31.md) · [Workflow prompt](assets/prompts/retrieval-research-prompt.md) |
| Skills, UI and engineering conventions | [Skill integration](docs/skills-fusion-plan-2026-10-31.md) · [UI judgment and color](docs/human-centered-ai-ui-research-2026-10-31.md) · [Engineering guide](docs/engineering-agent-guide.md) |
| Changes, contributions and security | [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) |

Dated research and validation records retain their original scope and failures. A plan does not mean every capability it describes has been implemented.

## Development and validation

```powershell
node scripts/build-client.mjs --check
node packages/browser/scripts/build-client.mjs --check
npm test
npm run check:release
npm --prefix packages/browser run check:release
```

CI checks the lockfile, committed client bundles, regression tests and both package contents. It does not call paid models or download browser engines.

The [plugin contract benchmark](benchmarks/patchwork/README.md) covers scope, corrections, memory, retrieval and rollback. The [coding benchmark](benchmarks/coding/README.md) covers maintenance tasks. Oracle pass rates validate the task set, not model completion rates; unit-test results are not model capability rankings.

## License

[AGPL-3.0-only](LICENSE). Third-party dependencies, icons and optional browser engines keep their own licenses. See the [main package notices](THIRD_PARTY_NOTICES.md) and [browser notices](packages/browser/THIRD_PARTY_NOTICES.md).
