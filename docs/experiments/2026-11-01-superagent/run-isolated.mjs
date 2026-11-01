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
const root = await mkdtemp(join(tmpdir(), 'patchwork-superagent-real-'))
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
  + '    - id: superagent-evaluation-driver\n      name: ' + JSON.stringify(pathToFileURL(join(repo, 'docs/experiments/2026-10-30-solpi/dsh-runner.mjs')).href) + '\n'
const overlayPath = join(root, 'runtime.overlay.yml')
await writeFile(overlayPath, overlay)
const first = join(root, 'first.txt'), correction = join(root, 'correction.txt'), result = join(root, 'result.private.json')
await writeFile(join(workspace, 'math.mjs'), 'export function add(a, b) { return a - b }\nexport function mul(a, b) { return a * b }\n')
await writeFile(first, '这是一个隔离代码维护任务。修复当前工作区 math.mjs 中 add 的加法错误；保留 mul 的现有导出及行为。只修改 math.mjs，不新建文档、不提交。使用现有 patchwork_task 登记这项编辑及真实命令验收，然后修复并验证 add(2,3)=5、add(-2,1)=-1、mul(3,4)=12。完成后简短汇报。不要创建子代理或使用网络。')
await writeFile(correction, '补充纠正并继续实施当前任务：add 的两个参数都必须是有限 number；字符串、NaN、Infinity、undefined 均抛出 TypeError。保持 add 的加法和 mul 的导出及行为。只修改 math.mjs，不新建文档、不提交。先读取 patchwork_task handoff 恢复当前任务，再 correct 更新受影响的验收，执行真实检查。不要重复已完成且未受影响的工作。完成后简短汇报。不要创建子代理或使用网络。')
const modelOverlay = join(repo, 'docs/experiments/2026-11-01-superagent/step5.overlay.yml')
const env = { ...process.env, DSH_HOME: home, SOL_TASK_FILE: first, SOL_FOLLOWUP_FILE: correction,
  SOL_RESULT_FILE: result, SOL_COMPACT_PROBE: '1', SOL_TIMEOUT_MS: '600000' }
const sourceHashes = Object.fromEntries(await Promise.all([
  'src/task/handoff.mjs', 'src/task/lifecycle.mjs', 'src/task/state.mjs', 'src/task/store.mjs',
  'src/mechanisms/online-context-compact/lifecycle.mjs', 'src/mechanisms/observation-pack/index.mjs',
  'docs/experiments/2026-11-01-superagent/run-isolated.mjs', 'docs/experiments/2026-11-01-superagent/step5.overlay.yml',
].map(async path => [path, createHash('sha256').update(await readFile(join(repo, path))).digest('hex')])) )
// Do not forward a profile-module path or a parent home as a model-visible variable.
delete env.SUPERAGENT_PROFILE_MODULES
console.log(JSON.stringify({ state: 'started', root, model: 'step-5-preview', dsh: '0.2.1-rc.2' }))
const child = spawn(process.execPath, [cli, '--profile', 'headless', '--patch', overlayPath, '--patch', modelOverlay], { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
const log = []
child.stdout.on('data', chunk => log.push(chunk)); child.stderr.on('data', chunk => log.push(chunk))
const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
await writeFile(join(root, 'run.private.log'), Buffer.concat(log))
let raw
try { raw = JSON.parse(await readFile(result, 'utf8')) } catch { console.log(JSON.stringify({ state: 'failed-before-result', exitCode, root })); process.exit(1) }
const file = await import(pathToFileURL(join(workspace, 'math.mjs')).href)
const checks = { addition: file.add(2, 3) === 5 && file.add(-2, 1) === -1, preservedExport: file.mul(3, 4) === 12,
  invalidArguments: ['3', NaN, Infinity, undefined].every(value => { try { file.add(value, 2); return false } catch (error) { return error instanceof TypeError } })
    && ['3', NaN, Infinity, undefined].every(value => { try { file.add(2, value); return false } catch (error) { return error instanceof TypeError } }) }
const events = raw.events ?? []
const calls = events.filter(e => e.type === 'tool/call').map(e => {
  const call = { ...e.data }
  if (typeof call.arguments === 'string') { try { call.arguments = JSON.parse(call.arguments) } catch { call.arguments = {} } }
  return call
})
const handoffs = events.filter(e => e.type === 'user/message' && e.data?.source?.kind === 'patchwork' && e.data?.source?.summary === 'current task handoff')
const finalTask = events.findLast(e => e.type === 'plugin:patchwork/task')?.data
checks.taskReady = finalTask?.status === 'ready' && finalTask.understandingStatus === 'stated'
const lastCompaction = events.findLastIndex(e => e.type === 'compaction/end')
const restoredHandoffs = events.slice(lastCompaction + 1).filter(e => e.type === 'user/message' && e.data?.source?.kind === 'patchwork' && e.data?.source?.summary === 'current task handoff').length
const summary = { schema: 1, date: '2026-11-01', kind: 'real-model-smoke-not-ab', model: 'step-5-preview', contextWindow: 1000000,
  host: '0.2.1-rc.2', maxOutputTokens: 16384, root, sessionId: raw.sessionId, preset: raw.preset, requests: raw.requests, elapsedMs: raw.elapsedMs,
  exitCode, compactionProbes: raw.compactionProbes?.map(({ action, outcome, before, after, code, name }) => ({ action, outcome, before, after, code, name })),
  checks, handoffNotices: handoffs.length, handoffNoticesAfterCompaction: lastCompaction < 0 ? 0 : restoredHandoffs,
  handoffToolCalls: calls.filter(c => c.name === 'patchwork_task' && c.arguments?.action === 'handoff').length,
  correctionToolCalls: calls.filter(c => c.name === 'patchwork_task' && c.arguments?.action === 'correct').length,
  toolErrors: events.filter(e => e.type === 'tool/result' && e.data?.message?.isError).length,
  toolNames: [...new Set(calls.map(c => c.name).filter(Boolean))], turns: events.filter(e => e.type === 'turn/end').map(e => e.data?.reason?.kind),
  sourceHashes, mainDshConfigured: false, benchmarkImprovementClaimed: false }
await writeFile(join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary))
process.exitCode = exitCode === 0 && Object.values(checks).every(Boolean) ? 0 : 1
