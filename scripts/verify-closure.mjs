import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { sourceFingerprint } from './source-fingerprint.mjs'

const root = fileURLToPath(new URL('../', import.meta.url)), args = process.argv.slice(2)
const arg = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined
const output = resolve(root, arg('--output') ?? 'docs/checks/closure-2026-11-01.json')
const temp = await mkdtemp(join(tmpdir(), 'patchwork-closure-verification-'))
const report = { schemaVersion: 1, date: new Date().toISOString(), status: 'running', node: process.version, platform: process.platform, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), checks: [], boundaries: { modelRequests: 0, modelQualityGainMeasured: false, projectWidePolicyActivation: false, operatingSystemSandbox: false, mainDshModified: false, hostBrowserAttached: false, confirmation: 'test-fixtures-only', benchmarkDriver: 'explicitly-trusted; hashes-are-consistency-not-provider-attestation' } }
const hash = value => createHash('sha256').update(value).digest('hex')
await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n')
async function run(id, command, commandArgs) {
  console.log(`Checking ${id}`)
  const start = performance.now()
  const result = await new Promise(resolveRun => {
    const child = spawn(command, commandArgs, { cwd: root, env: { ...process.env, DSH_HOME: join(temp, 'dsh-home') }, shell: false, windowsHide: true })
    const chunks = []; let count = 0
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { count += chunk.length; if (count <= 4_000_000) chunks.push(chunk) })
    const timer = setTimeout(() => child.kill(), 180000)
    child.on('error', error => { clearTimeout(timer); resolveRun({ code: null, text: error.message }) })
    child.on('close', code => { clearTimeout(timer); resolveRun({ code, text: Buffer.concat(chunks).toString('utf8') }) })
  })
  const record = { id, passed: result.code === 0, exitCode: result.code, durationMs: Math.round(performance.now() - start), outputHash: hash(result.text), command: [command === process.execPath ? 'node' : command, ...commandArgs.map(value => value.replaceAll(temp, '<temporary-verification>'))] }
  if (id === 'regression') { record.counts = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped'].map(key => [key, Number(new RegExp(`^# ${key} (\\d+)`, 'm').exec(result.text)?.[1] ?? -1)])); if (record.counts.tests < 1 || record.counts.fail || record.counts.cancelled || record.counts.skipped) record.passed = false }
  report.checks.push(record)
  await writeFile(join(temp, id + '.log'), result.text)
  if (!record.passed) { console.error(result.text.slice(-7000)); throw new Error(`${id} failed`) }
}
try {
  report.sourceFingerprint = await sourceFingerprint(root)
  await run('coding-client-bundle', process.execPath, ['scripts/build-client.mjs', '--check'])
  await run('browser-client-bundle', process.execPath, ['packages/browser/scripts/build-client.mjs', '--check'])
  await run('regression', process.execPath, ['--test', '--test-reporter=tap', 'tests/*.test.mjs', 'tests/real-composition/*.test.mjs', 'packages/browser/tests/*.test.mjs'])
  await run('documentation-links', process.execPath, ['scripts/check-doc-links.mjs'])
  await run('coding-oracles', process.execPath, ['benchmarks/coding/run-isolated.mjs', '--mode=oracle', '--run-id=closure-oracle-2026-11-01', `--output=${join(temp, 'oracle.json')}`])
  const oracle = JSON.parse(await readFile(join(temp, 'oracle.json'), 'utf8')); report.oracle = { ...oracle.aggregate, modelClaim: false }
  await run('native-improvement-composition', process.execPath, ['scripts/verify-improvement-isolation.mjs'])
  await run('coding-package-preflight', process.execPath, ['scripts/check-browser-release.mjs'])
  await run('browser-package-preflight', process.execPath, ['packages/browser/scripts/check-release.mjs'])
  await run('diff-whitespace', 'git', ['diff', '--check'])
  for (const kind of ['ui', 'browser', 'native']) {
    const path = arg(`--${kind}-report`)
    if (!path) { if (args.includes('--require-acceptance') && kind !== 'native') throw new Error(`--${kind}-report is required`); continue }
    const bytes = await readFile(resolve(path)), evidence = JSON.parse(bytes)
    const passed = kind === 'ui' ? evidence.ok === true : evidence.status === 'passed'
    const sameSource = evidence.sourceFingerprint?.hash === report.sourceFingerprint.hash
    if (!passed || !sameSource) throw new Error(`${kind} acceptance failed or does not match current source; rerun the explicit acceptance`)
    report[kind + 'Acceptance'] = { passed, sourceMatched: sameSource, reportHash: hash(bytes), modelRequests: evidence.modelRequests, checks: evidence.checks, consoleErrors: evidence.consoleErrors ?? [], viewports: evidence.viewports?.length ?? null, mainDshTouched: evidence.mainDshTouched ?? evidence.mainDshModified ?? false, hostBrowserAttached: evidence.hostBrowserAttached ?? evidence.hostBrowserUsed ?? false }
    if (kind === 'browser') report.browserAcceptance.measurements = evidence.measurements
  }
  const after = await sourceFingerprint(root)
  if (after.hash !== report.sourceFingerprint.hash) throw new Error('Source changed during verification; rerun')
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.failure = error.message; process.exitCode = 1 }
finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  if (report.status === 'passed') await rm(temp, { recursive: true, force: true })
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, tests: report.checks.find(item => item.id === 'regression')?.counts, sourceHash: report.sourceFingerprint?.hash, failure: report.failure ?? null, failureLogs: report.status === 'failed' ? temp : null, output }, null, 2))
