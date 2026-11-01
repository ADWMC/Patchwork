// Real DSH/StepFun smoke experiment. No credentials or production home are copied.
import { mkdtemp, mkdir, readFile, writeFile, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { evaluationOverlay } from '../../../scripts/prepare-skills-eval-overlay.mjs'

if (!process.env.PATCHWORK_STEPFUN_KEY) throw new Error('PATCHWORK_STEPFUN_KEY is required in the process environment')
if (!process.env.SUPERAGENT_PROFILE_MODULES) throw new Error('SUPERAGENT_PROFILE_MODULES must point to an existing isolated headless profile node_modules')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const host = createRequire(join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh/package.json'))
const cli = join(dirname(host.resolve('@deepseek-ai/dsh/package.json')), 'lib/bin.js')
const root = await mkdtemp(join(tmpdir(), 'patchwork-native-superagent-'))
const home = join(root, 'home'), workspace = join(root, 'workspace'), profile = join(home, 'profiles/headless')
await mkdir(profile, { recursive: true }); await mkdir(workspace)
await symlink(resolve(process.env.SUPERAGENT_PROFILE_MODULES), join(profile, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'patchwork-superagent-evaluation', private: true,
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless', '@patchwork/coding-agent'] } } }))
await writeFile(join(profile, 'cordis.patch.yml'), '[]\n')
let overlay = evaluationOverlay(await readFile(join(repo, 'presets/patchwork.patch.yml'), 'utf8'), 'core')
overlay = overlay.replace('          skillsMode: core', '          skillsMode: core\n          actionFusion: true\n          observationPack: true\n          evidencePreservingReducer: true\n          onlineContextCompact: true')
// The generated standalone preset is de-indented by four spaces.
overlay = overlay.replace("            name: '@deepseek-ai/dsh-compaction-basic'", "            name: '@deepseek-ai/dsh-compaction-basic'\n            config:\n              auto: false\n              retainTokens: 1000\n              headroomTokens: 8192\n              maxTokens: 4096")
// Official headless has no preset registry. Keep registries on the host plane;
// move its default tools behind the real Patchwork preset, as the SoL driver does.
const hostRows = ['tool-plugin-manager', 'tool-bash', 'tool-pwsh', 'tool-jobs', 'tool-fs', 'tool-fs-search',
  'skill-filesystem', 'tool-skill', 'command-goal', 'tool-goal', 'plan-mode', 'compaction-basic', 'command-compact',
  'tool-result-pruner', 'tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent', 'tool-subagent-fork',
  'workflow-ptc', 'tool-workflow', 'agent-instructions', 'tool-todo', 'tool-web', 'headless-runner', 'headless-startup', 'session-telemetry-otel']
overlay += '\n' + hostRows.map(id => `- id: ${id}\n  disabled: true`).join('\n') + '\n- insert:\n'
  + "    - id: agent-preset-registry\n      name: '@deepseek-ai/dsh-agent-preset-registry'\n      config:\n        default: patchwork\n"
  + "    - id: subagent-model-selection-settings\n      name: '@deepseek-ai/dsh-tool-subagent/model-selection-settings'\n"
  + '    - id: superagent-evaluation-driver\n      name: ' + JSON.stringify(pathToFileURL(join(repo, 'docs/experiments/2026-11-01-superagent/native-driver.mjs')).href) + '\n'
const overlayPath = join(root, 'runtime.overlay.yml')
await writeFile(overlayPath, overlay)
const first = join(root, 'first.txt'), result = join(root, 'result.private.json')
await writeFile(join(workspace, 'alpha.txt'), 'alpha: local fixture A\n')
await writeFile(join(workspace, 'beta.txt'), 'beta: local fixture B\n')
await writeFile(join(workspace, 'math.mjs'), 'export function add(a, b) { return a - b }\n')
const readPrompt = name => 'Read '+name+'.txt without edits or shell. Define a patchwork_task in analysis phase with one artifact requirement targeting id doc. Register the absolute path of '+name+'.txt as artifact doc. Check its structure with rules anchors ["'+name+': local fixture"]. Then report ready via patchwork_superagent. No semantic requirement, no new files.'
const jobs = [
  { id: 'alpha', title: 'Read alpha fixture', mode: 'read', prompt: readPrompt('alpha') },
  { id: 'beta', title: 'Read beta fixture', mode: 'read', prompt: readPrompt('beta') },
  { id: 'fix', title: 'Fix addition after both reads', mode: 'write', dependencies: ['alpha', 'beta'],
    prompt: 'Fix add in math.mjs to return a+b. Only edit math.mjs. Define a patchwork_task implement phase with one command requirement id tests targeting artifact code. Register math.mjs as code AFTER editing. Run a real pwsh check using node --input-type=module to assert add(2,3)===5 and add(-2,1)===-1, exit nonzero on failure. Then patchwork_superagent report ready. Do not add a semantic requirement or new files.' },
]
await writeFile(first, 'Use the native patchwork_superagent controller to execute this isolated task graph. First inspect, then submit EXACTLY these jobs with concurrency 2 and the current baseRevision. Do not use other delegation tools. Do not edit files yourself or define a root patchwork_task. The two read jobs may run concurrently; fix must wait for both native acceptances. After submit, end the current turn briefly so native executor events can wake you. On each result event inspect only if needed, do not resubmit/retry automatically, and do not treat a model claim as acceptance. When all jobs are done, give a concise truthful summary. No network, commits, publishing, browser or external delivery. Jobs: ' + JSON.stringify(jobs))
const modelOverlay = join(repo, 'docs/experiments/2026-11-01-superagent/step5.overlay.yml')
const env = { ...process.env, DSH_HOME: home, SOL_TASK_FILE: first, SOL_RESULT_FILE: result }
delete env.SUPERAGENT_PROFILE_MODULES
console.log(JSON.stringify({ state: 'started', root, model: 'step-5-preview', dsh: '0.2.1-rc.2' }))
const sourcePaths = ['src/superagent/state.mjs', 'src/superagent/store.mjs', 'src/superagent/controller.mjs', 'src/superagent/index.mjs', 'src/superagent/prompt.mjs', 'src/task/lifecycle.mjs', 'src/task/acceptance.mjs', 'src/mechanisms/online-context-compact/tools.mjs', 'src/runtime.mjs',
  'docs/experiments/2026-11-01-superagent/native-driver.mjs', 'docs/experiments/2026-11-01-superagent/run-native.mjs']
const startSourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(join(repo, path))).digest('hex')])))
const child = spawn(process.execPath, [cli, '--profile', 'headless', '--patch', overlayPath, '--patch', modelOverlay], { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
const log = []
child.stdout.on('data', chunk => log.push(chunk)); child.stderr.on('data', chunk => log.push(chunk))
const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
await writeFile(join(root, 'run.private.log'), Buffer.concat(log))
let raw
try { raw = JSON.parse(await readFile(result, 'utf8')) } catch { console.log(JSON.stringify({ state: 'failed-before-result', exitCode, root })); process.exit(1) }
const file = await import(pathToFileURL(join(workspace, 'math.mjs')).href)
const flat = raw.events.flatMap(s => s.events), toolErrors = flat.filter(e => e.type === 'tool/result' && e.data?.message?.isError).length
const checks = { taskGraphCompleted: raw.queue?.status === 'completed', threeNativeChildren: raw.catalog?.length === 3,
  acceptanceVerified: raw.queue?.jobs?.every(j => j.status === 'done' && j.evidence?.verified) === true,
  addition: file.add(2, 3) === 5 && file.add(-2, 1) === -1, ordinaryIsolation: raw.ordinaryIsolation, notTimedOut: !raw.timedOut,
  nativePostAdmissionFaultStopped: raw.faultProbe?.injected === true && raw.faultProbe.failClosed && raw.faultProbe.noActiveAssignment && raw.faultProbe.nativeChildReleased,
  nativeCheckpointRecoveryPaused: raw.recoveryProbe?.fromNativeCheckpoint === true && raw.recoveryProbe.status === 'paused' && raw.recoveryProbe.historicalPassesRequireReview && raw.recoveryProbe.uncertainAssignmentBlocked }
const summary = { schema: 1, date: '2026-11-01', kind: 'real-model-native-superagent-smoke-not-benchmark', model: 'step-5-preview', contextWindow: 1000000,
  host: '0.2.1-rc.2', maxOutputTokens: 16384, root, sessionId: raw.sessionId, requests: raw.requests.length, elapsedMs: raw.elapsedMs,
  exitCode, checks, toolErrors, faultProbe: raw.faultProbe, recoveryProbe: raw.recoveryProbe, jobs: raw.queue?.jobs?.map(({ id, status, attempt, evidence, childId }) => ({ id, status, attempt, evidence, childId })),
  sourceHashes: startSourceHashes, mainDshConfigured: false, externalDelivery: false, benchmarkImprovementClaimed: false }
await writeFile(join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary))
process.exitCode = exitCode === 0 && Object.values(checks).every(Boolean) ? 0 : 1
