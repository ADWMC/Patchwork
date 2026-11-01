import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodeSpecReceipt } from '../../../src/mechanisms/evidence-preserving-reducer/node-spec.mjs'
import { parseReceipt, renderReceipt } from '../../../src/mechanisms/evidence-preserving-reducer/receipt.mjs'

const root = process.env.SOL_LAB
if (!root) throw new Error('Set SOL_LAB to the isolated experiment directory')
const readRun = async name => JSON.parse(await readFile(join(root, 'results', `${name}.json`), 'utf8'))
const texts = run => run.events.filter(event => event.type === 'tool/result')
  .flatMap(event => event.data.message.content.filter(block => block.type === 'text').map(block => block.text))
const sha256 = body => createHash('sha256').update(body).digest('hex')

const packed = await readRun('task4-packed')
const handle = 'obs_fa416ac2708568d21632258d'
const opRoot = join(root, 'task4-op-home', 'patchwork', 'observation-pack', packed.sessionId)
const ledger = (await readFile(join(opRoot, 'ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
const entry = ledger.find(item => item.handle === handle && item.kind === 'placeholder')
const archive = await readFile(join(opRoot, 'objects', `${handle}.txt`), 'utf8')
const placeholder = texts(packed).find(text => text.startsWith(`[observation-pack] ${handle}`))
assert.ok(entry)
assert.equal(Buffer.byteLength(archive), entry.bytes)
assert.ok(placeholder)
assert.equal(Buffer.byteLength(placeholder), 1334)
const recalls = packed.events.filter(event => event.type === 'tool/call' && event.data.name === 'obs_recall').length
assert.equal(recalls, 0)
assert.match(archive, /^SUMMARY files=78\r?$/m)
assert.match(placeholder, /SUMMARY files=78/)
const inventoryRoot = join(root, 'task3-maintenance')
async function fileCount(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const counts = await Promise.all(entries.map(entry => entry.isDirectory() ? fileCount(join(directory, entry.name)) : 1))
  return counts.reduce((sum, value) => sum + value, 0)
}
assert.equal(await fileCount(join(inventoryRoot, 'src')) + await fileCount(join(inventoryRoot, 'tests')), 78)
const lastTwo = []
for (const file of ['tests/ui-stats.test.mjs', 'tests/user-config.test.mjs']) {
  const hash = sha256(await readFile(join(inventoryRoot, file))).toUpperCase()
  assert.ok(archive.includes(hash))
  assert.ok(placeholder.includes(hash))
  lastTwo.push({ file, sha256: hash })
}

const reduced = await readRun('task2-local-epr')
const eprRoot = join(root, 'task2-epr-home', 'patchwork', 'evidence-preserving-reducer', reduced.sessionId)
const journal = (await readFile(join(eprRoot, 'journal.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
const applied = journal.find(item => item.kind === 'applied')
assert.equal(applied?.reducer?.kind, 'local')
assert.equal(applied.reducer.model, 'node-spec')
const body = await readFile(join(eprRoot, 'objects', `${applied.source}.txt`), 'utf8')
assert.equal(sha256(body), applied.source)
assert.equal(Buffer.byteLength(body), 5084)
const candidate = nodeSpecReceipt({ command: applied.command, body, sourceHash: applied.source, isError: true })
assert.ok(candidate)
const parsed = parseReceipt(JSON.stringify(candidate), { body, sourceHash: applied.source, isError: true })
assert.ok(parsed.ok)
assert.equal(parsed.receipt.evidence.length, 6)
const failures = parsed.receipt.evidence.filter(item => item.kind === 'failure').map(item => item.quote).join('')
assert.equal(failures, body.slice(body.indexOf('✖ failing tests:')))
assert.equal((failures.match(/^test at /gm) ?? []).length, 3)
const visibleReceipt = texts(reduced).find(text => text.startsWith('[evidence-preserving-reducer]'))
assert.ok(visibleReceipt)
const archivePath = /^full_log_path=(.+)$/m.exec(visibleReceipt)?.[1]
assert.equal(visibleReceipt, renderReceipt(parsed.receipt, { model: 'node-spec', provider: 'local', isError: true, archivePath }))
assert.equal(Buffer.byteLength(visibleReceipt), 3566)
assert.match(visibleReceipt, /command_failed=true/)

const native = await readRun('task3-maintenance')
const noop = await readRun('task3-noop')
assert.ok(native.compactionProbes.some(probe => probe.action === 'cancelled' && probe.name === 'AbortError'))
assert.ok(native.compactionProbes.some(probe => probe.action === 'compact' && probe.outcome === 'compacted' && probe.before === 19590 && probe.after === 11191))
assert.ok(native.compactionProbes.some(probe => probe.action === 'repeat' && probe.code === 'summary'))
assert.ok(noop.compactionProbes.some(probe => probe.action === 'fresh-session' && probe.outcome === 'noop'))

const testLog = await readFile(join(root, 'results', 'full-tests-complete.log'), 'utf8')
const tests = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => {
  const match = new RegExp(`^ℹ ${key} (\\d+)`, 'm').exec(testLog)
  assert.ok(match, `missing test count: ${key}`)
  return [key, Number(match[1])]
}))
assert.equal(tests.pass, tests.tests)
assert.equal(tests.fail, 0)
assert.equal(tests.skipped, 0)

const summary = {
  date: '2026-10-30',
  observationPack: { sessionId: packed.sessionId, sourceBytes: entry.bytes, placeholderBytes: Buffer.byteLength(placeholder), recallCalls: recalls, files: 78, lastTwo },
  evidencePreservingReducer: { sessionId: reduced.sessionId, sourceBytes: Buffer.byteLength(body), receiptBytes: Buffer.byteLength(visibleReceipt), quotes: 6, failures: 3, completeFailureSection: true, extraModelCalls: 0, journal: applied.reducer },
  nativeCompaction: { sessionId: native.sessionId, automaticOccBenefitEstablished: false, probes: native.compactionProbes, freshSessionProbes: noop.compactionProbes },
  finalRegression: tests,
}
await writeFile(join(fileURLToPath(new URL('.', import.meta.url)), 'evidence-summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
