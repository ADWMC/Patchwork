import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { aggregate, aggregateAgent, loadManifest, scoreAgentRun, scoreRun } from './scorers/coding-scorer.mjs'
import { diffFileSnapshots } from './scorers/file-diff.mjs'
import { verifyDriverEvidence } from './scorers/driver-evidence.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const manifest = await loadManifest(join(here, 'manifest.json'))
const mode = process.argv.find(arg => arg.startsWith('--mode='))?.slice('--mode='.length) ?? 'oracle'
const taskFilter = process.argv.find(arg => arg.startsWith('--task='))?.slice('--task='.length)
const json = process.argv.includes('--json')
const keep = process.argv.includes('--keep')
const outputArg = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
const driverArg = process.argv.find(arg => arg.startsWith('--driver='))?.slice('--driver='.length)
const runId = process.argv.find(arg => arg.startsWith('--run-id='))?.slice('--run-id='.length)
  ?? `coding-${mode}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
if (!['oracle', 'agent'].includes(mode)) throw new Error('mode must be oracle or agent')
if (mode === 'agent' && !driverArg) throw new Error('agent mode requires a real DSH driver; pass --driver=<module>')

function runNode(args, cwd, env = {}) {
  return new Promise(resolveRun => {
    const started = Date.now(); const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, shell: false, windowsHide: true })
    let stdout = '', stderr = '', settled = false, timer
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolveRun({ durationMs: Date.now() - started, stdout, stderr, ...result }) }
    child.stdout.on('data', chunk => { stdout += chunk.toString(); if (stdout.length > 512 * 1024) stdout = stdout.slice(-512 * 1024) })
    child.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > 512 * 1024) stderr = stderr.slice(-512 * 1024) })
    child.on('error', error => finish({ exitCode: null, error: error.message }))
    child.on('close', exitCode => finish({ exitCode }))
    timer = setTimeout(() => { if (!settled) { child.kill('SIGTERM'); finish({ exitCode: null, timedOut: true }) } }, 120000)
  })
}

async function filesUnder(root) {
  const output = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isSymbolicLink()) throw new Error('Benchmark workspace must not contain symbolic links')
      if (entry.isDirectory()) await walk(path)
      else output.push(relative(root, path).replaceAll('\\', '/'))
    }
  }
  await walk(root); return output.sort()
}


const reportRoot = await mkdtemp(join(tmpdir(), 'patchwork-coding-benchmark-'))
function sanitizeOutput(value) {
  return value
    .replaceAll(reportRoot, '<isolated-benchmark>')
    .replaceAll(reportRoot.replaceAll('\\', '/'), '<isolated-benchmark>')
    .replace(/<isolated-benchmark>[\\/][^\\/]+-[A-Za-z0-9]{5,}/g, '<isolated-benchmark>/<task>')
}
const driver = mode === 'agent' ? await import(pathToFileURL(resolve(driverArg)).href) : null
const scores = []
for (const taskPath of manifest.tasks) {
  const task = JSON.parse(await readFile(join(here, taskPath), 'utf8'))
  if (taskFilter && task.id !== taskFilter) continue
  const caseRoot = await mkdtemp(join(reportRoot, `${task.id}-`))
  const workspace = join(caseRoot, 'workspace')
  await cp(join(dirname(join(here, taskPath)), 'workspace'), workspace, { recursive: true })
  const oracle = join(dirname(join(here, taskPath)), 'oracle')
  if (mode === 'oracle') await cp(oracle, join(workspace, 'oracle'), { recursive: true, force: true })
  const before = Object.fromEntries(await Promise.all((await filesUnder(workspace)).map(async file => [file, { content: await readFile(join(workspace, file)) }])))
  let score
  if (mode === 'oracle') {
    const solution = join(dirname(join(here, taskPath)), 'solution')
    const baseline = await runNode(['--test', 'test/public.test.mjs', 'oracle/hidden.test.mjs'], workspace)
    await cp(join(solution, 'src'), join(workspace, 'src'), { recursive: true, force: true })
    await cp(oracle, join(workspace, 'oracle'), { recursive: true, force: true })
    const reference = await runNode(['--test', 'test/public.test.mjs', 'oracle/hidden.test.mjs'], workspace)
    const afterFiles = await filesUnder(workspace)
    const after = Object.fromEntries(await Promise.all(afterFiles.map(async file => [file, { content: await readFile(join(workspace, file)) }])))
    const { changedFiles, changedLines } = await diffFileSnapshots(before, after)
    score = scoreRun({ task, baseline, solution: reference, changedFiles, changedLines })
    score.baseline.stdout = sanitizeOutput(score.baseline.stdout)
    score.baseline.stderr = sanitizeOutput(score.baseline.stderr)
    score.reference.stdout = sanitizeOutput(score.reference.stdout)
    score.reference.stderr = sanitizeOutput(score.reference.stderr)
    if (!json) console.log(`${score.passed ? 'PASS' : 'FAIL'} ${task.id} baseline=${baseline.exitCode} reference=${reference.exitCode} changedFiles=${changedFiles.length} changedLines=${changedLines}`)
  } else {
    const dshHome = join(caseRoot, 'dsh-home')
    const resultsDir = join(caseRoot, 'results')
    await mkdir(dshHome, { recursive: true })
    await mkdir(resultsDir, { recursive: true })
    const issuePath = join(caseRoot, 'issue.md')
    await cp(join(dirname(join(here, taskPath)), 'issue.md'), issuePath)
    const started = Date.now()
    let driverResult
    try {
      if (typeof driver.runTask !== 'function') throw new Error('DSH driver must export runTask({ task, issuePath, workspace, dshHome, resultsDir, runId })')
      driverResult = await driver.runTask({ task, issuePath, workspace, dshHome, resultsDir, runId, env: { ...process.env, DSH_HOME: dshHome, PATCHWORK_CODING_ROOT: caseRoot, PATCHWORK_CODING_TASK: task.id } })
    } catch (error) {
      driverResult = { status: 'driver-error', error: error instanceof Error ? error.message : String(error) }
    }
    // Withhold oracle files from the work directory until the trusted driver exits.
    // Separate directories are not an OS security sandbox against malicious drivers.
    const judgeRoot = await mkdtemp(join(tmpdir(), 'patchwork-judge-'))
    await cp(workspace, judgeRoot, { recursive: true })
    await cp(oracle, join(judgeRoot, 'oracle'), { recursive: true, force: true })
    const tests = await runNode(['--test', 'test/public.test.mjs', 'oracle/hidden.test.mjs'], judgeRoot, { DSH_HOME: join(judgeRoot, '.dsh-home') })
    await rm(judgeRoot, { recursive: true, force: true })
    const afterFiles = await filesUnder(workspace)
    const after = Object.fromEntries(await Promise.all(afterFiles.map(async file => [file, { content: await readFile(join(workspace, file)) }])))
    const diff = await diffFileSnapshots(before, after)
    const changedFiles = diff.changedFiles
    const unauthorizedFiles = changedFiles.filter(file => !task.allowedPaths.includes(file))
    const changedLines = diff.changedLines
    const driverMeta = {
      status: driverResult?.status ?? 'missing-status',
      model: driverResult?.model ?? null,
      dshVersion: driverResult?.dshVersion ?? null,
      requestCount: Number.isFinite(driverResult?.requestCount) ? driverResult.requestCount : null,
      durationMs: Number.isFinite(driverResult?.durationMs) ? driverResult.durationMs : Date.now() - started,
      runId,
      error: driverResult?.error ?? null,
      mode: driverResult?.mode ?? 'unverified',
      evidenceVerified: false,
    }
    Object.assign(driverMeta, await verifyDriverEvidence(resultsDir, driverResult, { ...driverMeta, taskId: task.id }))
    score = scoreAgentRun({ task, tests, changedFiles, unauthorizedFiles, changedLines, driver: driverMeta })
    score.changes = diff.files
    score.hiddenTests.stdout = sanitizeOutput(score.hiddenTests.stdout)
    score.hiddenTests.stderr = sanitizeOutput(score.hiddenTests.stderr)
    if (!json) console.log(`${score.passed ? 'PASS' : 'FAIL'} ${task.id} hidden=${tests.exitCode} changedFiles=${changedFiles.length} unauthorized=${unauthorizedFiles.length} changedLines=${changedLines}`)
  }
  scores.push(score)
  if (!keep) await rm(caseRoot, { recursive: true, force: true })
}
if (!scores.length) throw new Error('no coding tasks selected')
const report = {
  schemaVersion: 1,
  benchmark: manifest.id,
  benchmarkVersion: manifest.version,
  mode,
  runId,
  finishedAt: new Date().toISOString(),
  aggregate: mode === 'oracle' ? aggregate(scores) : aggregateAgent(scores),
  scores,
  marketing: {
    oracleTaskQualityRate: mode === 'oracle' ? aggregate(scores).oracleTaskQualityRate : null,
    agentTaskPassRate: mode === 'agent' ? aggregateAgent(scores).agentTaskPassRate : null,
    claim: mode === 'oracle'
      ? '题集质量验证；不代表模型完成率。'
      : '受信驱动的 Agent 运行结果；须发布模型、DSH 版本、run id、原生请求记录和裁判输出。哈希/身份一致性不等于独立证明模型调用。',
  },
  evidence: { retained: keep, root: keep ? reportRoot : null },
}
const reportPath = outputArg ? resolve(outputArg) : join(reportRoot, 'report.json')
if (outputArg) await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
if (json) console.log(JSON.stringify({ ...report, reportPath }, null, 2))
else {
  const metric = mode === 'oracle' ? report.aggregate.oracleTaskQualityRate : report.aggregate.agentTaskPassRate
  const label = mode === 'oracle' ? 'Coding task oracle quality' : 'Coding task Agent pass rate'
  console.log(`\n${label}: ${report.aggregate.passed}/${report.aggregate.tasks} (${(metric * 100).toFixed(1)}%)\nReport: ${reportPath}`)
}
