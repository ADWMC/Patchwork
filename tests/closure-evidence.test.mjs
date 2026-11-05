import test from 'node:test'
import assert from 'node:assert/strict'
import { scopedAgent } from './helpers/agent.mjs'
import { admitPageEvidence, markEvidenceSent, citeEvidence, compareEvidence, evidenceSnapshot } from '../src/retrieval/evidence.mjs'
import { normalizeRetrievalRecord } from '../src/retrieval/ledger.mjs'
import { collectToolEvidence, runtimeSnapshot } from '../src/ui/runtime-state.mjs'
import { scoreAgentRun, scoreRun, aggregateAgent } from '../benchmarks/coding/scorers/coding-scorer.mjs'
import { verifyDriverEvidence } from '../benchmarks/coding/scorers/driver-evidence.mjs'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { diffFileSnapshots } from '../benchmarks/coding/scorers/file-diff.mjs'
import { SETTING_FIELDS, validateSettings } from '../src/config/fields.mjs'

test('retrieval record id and original timestamp survive repeated restoration', () => {
  const record = normalizeRetrievalRecord({ operationId: 'actual-call', recordedAt: '2026-10-31T00:00:00.000Z', status: 'sent' })
  assert.deepEqual(normalizeRetrievalRecord(normalizeRetrievalRecord(record)), record)
})
test('fetch evidence binds admission, actual sent excerpt, citation and conservative cross-check', () => {
  const agent = scopedAgent({ session: { header: { id: 'evidence-lifecycle' } } })
  const page = (host, excerpt) => ({ finalUrl: `https://${host}/doc`, title: 'Evidence', excerpt, contentType: 'application/json' })
  const a = admitPageEvidence(agent, page('one.example', '{"version":3}'), 'fetch-a')
  assert.equal(citeEvidence(agent, { evidenceId: a.id, quote: 'version', claim: 'version' }).failureCode, 'EVIDENCE_SENT_EXCERPT_REQUIRED')
  assert.equal(markEvidenceSent(a.id, 'different bytes'), false)
  assert.equal(markEvidenceSent(a.id, a.excerpt), true)
  const b = admitPageEvidence(agent, page('two.example', '{"version":3}'), 'fetch-b'); markEvidenceSent(b.id, b.excerpt)
  assert.equal(compareEvidence(agent, { evidenceId: a.id, otherId: b.id, claimKey: 'version' }).verification.result, 'supported')
  assert.equal(citeEvidence(agent, { evidenceId: a.id, quote: 'missing', claim: 'fabricated' }).status, 'failed')
  assert.equal(citeEvidence(agent, { evidenceId: a.id, quote: '"version":3', claim: '两个来源字段一致' }).status, 'committed')
  const c = admitPageEvidence(agent, page('three.example', '{"version":4}'), 'fetch-c'); markEvidenceSent(c.id, c.excerpt)
  assert.equal(compareEvidence(agent, { evidenceId: a.id, otherId: c.id, claimKey: 'version' }).verification.result, 'conflict')
  assert.notEqual(evidenceSnapshot(agent)[0].status, 'verified')
  assert.equal(compareEvidence(agent, { evidenceId: a.id, otherId: b.id, claimKey: 'unread' }).verification.result, 'unknown')
  assert.deepEqual(evidenceSnapshot(agent)[0].timeline.slice(0, 3).map(item => item.status), ['retrieved', 'admitted', 'sent'])
  agent.selectPreset('standard'); assert.deepEqual(evidenceSnapshot(agent), []); assert.equal(markEvidenceSent(b.id, b.excerpt), false)
})
test('browser mismatch and repeated no-progress become failed source-backed incidents', () => {
  const agent = scopedAgent({ session: { header: { id: 'browser-evidence' } } })
  collectToolEvidence({ agent, name: 'patchwork_browser', callId: 'browser-test' }, { value: { receipt: { id: 'one', outcome: 'postcondition-mismatch' } } })
  collectToolEvidence({ agent, name: 'patchwork_browser', callId: 'browser-test-two' }, { value: { receipt: { id: 'two', outcome: 'completed', noProgress: true } } })
  const snapshot = runtimeSnapshot('browser-evidence')
  assert.ok(snapshot.events.every(event => event.outcome === 'failed'))
  assert.equal(snapshot.improvements.incidents.length, 2)
  assert.equal(snapshot.improvements.incidents[0].sourceReceiptIds[0], 'browser:one')
})
test('benchmark refuses successful tests without completed, evidenced model execution', () => {
  const input = { task: { id: 'synthetic', title: 'synthetic' }, tests: { exitCode: 0, stdout: '', stderr: '' }, changedFiles: [], unauthorizedFiles: [], changedLines: 0 }
  for (const driver of [{ status: 'driver-error' }, { status: 'completed', model: null, dshVersion: null }, { status: 'completed', model: 'synthetic', dshVersion: 'v', requestCount: 1, mode: 'synthetic' }]) assert.equal(scoreAgentRun({ ...input, driver }).passed, false)
})
test('benchmark evidence cannot escape results directory and incomplete baseline is not expected failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-driver-')), results = join(root, 'results'); await mkdir(results)
  const receipt = { runId: 'test', taskId: 'test', model: 'fixture', dshVersion: 'fixture', requestCount: 1, mode: 'real-host' }, data = JSON.stringify(receipt)
  const driver = { ...receipt, status: 'completed', evidenceRef: 'evidence.json', evidenceHash: createHash('sha256').update(data).digest('hex') }
  await writeFile(join(results, 'evidence.json'), data); await writeFile(join(root, 'external.json'), data)
  assert.equal((await verifyDriverEvidence(results, driver, receipt)).evidenceVerified, true)
  assert.equal((await verifyDriverEvidence(results, { ...driver, evidenceRef: '../external.json' }, receipt)).evidenceVerified, false)
  assert.equal((await verifyDriverEvidence(results, { ...driver, runId: 'other' }, receipt)).evidenceVerified, false)
  const empty = { exitCode: null, timedOut: true, stdout: '', stderr: '' }
  assert.equal(scoreRun({ task: receipt, baseline: empty, solution: { ...empty, exitCode: 0, timedOut: false }, changedFiles: [], changedLines: 0 }).passed, false)
  assert.equal(aggregateAgent([{ passed: false, eligibleRealModelResult: false, hiddenTests: { exitCode: 0 } }]).eligibleHiddenTestPassRate, null)
})
test('real diff counts equal-length edits, additions, deletions and binary hashes', async () => {
  const result = await diffFileSnapshots({ 'same.mjs': { content: 'const a=1\n' }, 'deleted.mjs': { content: 'removed\n' }, 'image': { content: Buffer.from([0, 1]) } }, { 'same.mjs': { content: 'const a=2\n' }, 'new.mjs': { content: 'added\n' }, 'image': { content: Buffer.from([0, 2]) } })
  assert.equal(result.changedLines, 4)
  assert.ok(result.changedFiles.includes('deleted.mjs'))
  assert.equal(result.binaryChanges, 1)
  assert.equal(result.files.find(item => item.path === 'deleted.mjs').afterHash, null)
})
test('all 28 user settings share one frontend/backend validation contract', () => {
  assert.equal(SETTING_FIELDS.length, 28)
  assert.equal(validateSettings(Object.fromEntries(SETTING_FIELDS.map(field => [field.key, field.defaultValue]))).ok, true)
  for (const input of [{ nativeFetchTimeoutMs: 1 }, { nativeSearchProviders: [] }, { skillsMode: 'unknown' }, { nativeFetchAllowedHosts: ['http://localhost/'] }, { reducerMaxTokens: 1.5 }]) assert.equal(validateSettings(input).ok, false)
})
