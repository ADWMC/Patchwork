import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregate, loadTask, scoreTask } from './scorers/contract-scorer.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const manifestPath = join(here, 'manifest.json')
const args = process.argv.slice(2)
const json = args.includes('--json')
const keep = args.includes('--keep')
const suiteArg = args.find(arg => arg.startsWith('--suite='))?.slice('--suite='.length)
const taskArg = args.find(arg => arg.startsWith('--task='))?.slice('--task='.length)
const outputArg = args.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

if (manifest.schemaVersion !== 1) throw new Error('unsupported Patchwork benchmark manifest')
const taskPaths = manifest.tasks.filter(path => {
  const taskId = path.split('/').pop().replace(/\.json$/, '')
  const taskSuite = manifest.suites.find(suite => suite.taskIds.includes(taskId))?.id
  return (!suiteArg || taskSuite === suiteArg) && (!taskArg || taskId === taskArg)
})
if (!taskPaths.length) throw new Error('no benchmark tasks selected')

function executable(program) {
  if (program === 'node') return process.execPath
  if (program === 'npm' && process.platform === 'win32') return 'npm.cmd'
  return program
}

function runCommand(command, env, cwd) {
  return new Promise(resolveResult => {
    const started = Date.now()
    const child = spawn(executable(command.program), command.args ?? [], { cwd, env, shell: false, windowsHide: true })
    let stdout = '', stderr = '', settled = false, timer
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolveResult({ id: command.id, durationMs: Date.now() - started, stdout, stderr, ...result }) }
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); if (stdout.length > 1024 * 1024) stdout = stdout.slice(-1024 * 1024) })
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > 1024 * 1024) stderr = stderr.slice(-1024 * 1024) })
    child.on('error', error => finish({ exitCode: null, signal: null, error: error.message }))
    child.on('close', (exitCode, signal) => finish({ exitCode, signal, timedOut: false }))
    timer = setTimeout(() => { child.kill('SIGTERM'); finish({ exitCode: null, signal: 'SIGTERM', timedOut: true }) }, command.timeoutMs ?? 120000)
  })
}

const startedAt = new Date().toISOString()
const reportDir = await mkdtemp(join(tmpdir(), 'patchwork-contract-benchmark-'))
const scores = []
for (const relative of taskPaths) {
  const task = await loadTask(join(here, relative.replace(/^tasks[\\/]/, 'tasks/')))
  const taskRoot = await mkdtemp(join(reportDir, `${task.id}-`))
  const dshHome = join(taskRoot, 'dsh-home')
  await mkdir(dshHome, { recursive: true })
  const env = { ...process.env, DSH_HOME: dshHome, PATCHWORK_BENCHMARK_ROOT: taskRoot, PATCHWORK_BENCHMARK_TASK: task.id }
  const results = []
  for (const command of task.oracle?.commands ?? []) results.push(await runCommand(command, env, repoRoot))
  const score = scoreTask(task, results)
  score.isolation = { dshHome, taskRoot, mainDshTouched: false }
  score.commands = results.map(result => ({ ...result, stdout: result.stdout.slice(-4000), stderr: result.stderr.slice(-4000) }))
  scores.push(score)
  if (!json) process.stdout.write(`${score.passed ? 'PASS' : 'FAIL'} ${task.id} (${score.checks.map(check => `${check.id}:${check.passed ? 'ok' : check.failure}`).join(', ')})\n`)
  if (!keep) await rm(taskRoot, { recursive: true, force: true })
}

const report = { schemaVersion: 1, benchmark: manifest.id, benchmarkVersion: manifest.version, startedAt, finishedAt: new Date().toISOString(), repoRoot, reportDir, aggregate: aggregate(scores), scores }
const outputPath = outputArg ? resolve(outputArg) : join(reportDir, 'report.json')
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
if (json) process.stdout.write(`${JSON.stringify({ ...report, reportPath: outputPath }, null, 2)}\n`)
else process.stdout.write(`\nPatchwork contract benchmark: ${report.aggregate.passed}/${report.aggregate.tasks} passed (${(report.aggregate.passRate * 100).toFixed(1)}%)\nReport: ${outputPath}\n`)
