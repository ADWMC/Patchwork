import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { diagnosticData, fingerprint, RECORD_TYPE } from '../src/logging/schema.mjs'
import { diagnosticSnapshot, flushDiagnostics, initializeDiagnostics, logDiagnostic } from '../src/logging/session-log.mjs'
import { appendBoundedJsonl } from '../src/logging/jsonl.mjs'
import { redactPreview } from '../src/logging/redact.mjs'
import { registerDiagnosticRoute } from '../src/logging/route.mjs'
import { writeObject, readObject } from '../src/util/content-archive.mjs'
import { reducibleLog } from '../src/mechanisms/evidence-preserving-reducer/candidate.mjs'

const secret = 'synthetic_PRIVATE_log_value_0123456789'
const entry = { mechanism: 'epr', event: 'decision', reason: 'retained-6-quotes' }

test('task, queue, skill, evidence, settings and maintenance actions stay in the allowlist', () => {
  for (const [mechanism, event, reason] of [
    ['task', 'check', 'task-check'], ['superagent', 'input', 'queue-input'], ['skill', 'load', 'skill-loaded'],
    ['evidence', 'compare', 'evidence-compared'], ['settings', 'save', 'settings-saved'], ['maintenance', 'warning', 'structure-warning'],
    ['taskMap', 'inject', 'task-anchored-map'], ['maintenance', 'warning', 'shortcut-ledger'],
  ]) {
    const data = diagnosticData({ mechanism, event, reason })
    assert.equal(data.mechanism, mechanism)
    assert.equal(data.event, event)
    assert.equal(data.reason, reason)
  }
  assert.equal(diagnosticData({ mechanism: 'unknown', event: 'success', reason: 'enabled' }), undefined)
})

// Unit-test adapter. Product-native Session persistence is checked separately.
class RecordSession {
  constructor(id) { this.header = { id }; this.events = []; this.seq = 0 }
  eventAt(seq) { return this.events[seq] }
}
const api = { Session: RecordSession, appendPluginRecord(session, type, data) {
  const seq = session.seq++
  session.events.push({ type, seq, data: structuredClone(data), time: Date.now(), ignorable: true })
  return seq
} }
await initializeDiagnostics(null, { sessionApi: api })
const agent = (id, preset = 'patchwork') => scopedAgent({ session: new RecordSession(id) }, preset)

test('diagnostic allowlist omits free text and hashes all correlation/routing values', () => {
  const data = diagnosticData({ ...entry, command: secret, model: secret, provider: secret, source: secret,
    handle: secret, output: secret, headers: { authorization: secret }, prompt: secret, error: new Error(secret),
    usage: { inputTokens: 7, private: secret }, elapsedMs: 12 }, { callId: secret, rootCallId: secret })
  assert.ok(!JSON.stringify(data).includes(secret))
  assert.equal(data.commandHash, fingerprint(secret))
  assert.equal(data.callIdHash, data.rootCallIdHash)
  assert.deepEqual(data.usage, { inputTokens: 7 })
  assert.equal(data.reason, 'retained')
  assert.equal(data.elapsedMs, 12)
  assert.equal(data.errorCode, 'exception')
})

test('retrieval diagnostics use the same bounded allowlist as other mechanisms', () => {
  const data = diagnosticData({ mechanism: 'search', event: 'success', reason: 'provider-partial', provider: secret,
    resultCount: 3, providerCount: 2, failedProviderCount: 1, elapsedMs: 9, query: secret })
  assert.equal(data.mechanism, 'search')
  assert.equal(data.reason, 'provider-partial')
  assert.equal(data.resultCount, 3)
  assert.equal(data.providerCount, 2)
  assert.equal(data.failedProviderCount, 1)
  assert.equal(data.providerHash, fingerprint(secret))
  assert.ok(!JSON.stringify(data).includes(secret))
})

test('native adapter receives only sanitized metadata and standard gets no records', async () => {
  const a = agent('A'), b = agent('B', 'standard')
  logDiagnostic({}, { agent: a, callId: 'call-A' }, { ...entry, command: secret })
  logDiagnostic({}, b, entry)
  await Promise.all([flushDiagnostics(a), flushDiagnostics(b)])
  assert.equal(a.session.seq, 1)
  assert.equal(b.session.seq, 0)
  assert.equal(diagnosticSnapshot(b), null)
  const snapshot = diagnosticSnapshot(a)
  assert.equal(snapshot.persistence, 'native')
  assert.equal(snapshot.entries.length, 1)
  assert.ok(!JSON.stringify(a.session.events).includes(secret))
})

test('switching away before queued append revokes it; switching back permits new entries', async () => {
  const a = agent('switch')
  logDiagnostic({}, a, entry)
  a.selectPreset('standard')
  await flushDiagnostics(a)
  assert.equal(a.session.seq, 0)
  assert.equal(diagnosticSnapshot(a), null)
  a.selectPreset('patchwork')
  logDiagnostic({}, a, entry)
  await flushDiagnostics(a)
  assert.equal(a.session.seq, 1)
})

test('same-directory sessions stay separate and do not accumulate duplicate reads', async () => {
  const a = agent('left'), b = agent('right')
  a.session.header.cwd = b.session.header.cwd = 'same-directory'
  logDiagnostic({}, { agent: a, callId: 'left-call' }, entry)
  logDiagnostic({}, { agent: b, callId: 'right-call' }, { ...entry, mechanism: 'op' })
  await Promise.all([flushDiagnostics(a), flushDiagnostics(b)])
  assert.equal(diagnosticSnapshot(a).entries[0].callIdHash, fingerprint('left-call'))
  assert.equal(diagnosticSnapshot(b).entries[0].callIdHash, fingerprint('right-call'))
  assert.equal(diagnosticSnapshot(a).entries.length, 1)
  assert.equal(diagnosticSnapshot(a).entries.length, 1)
})

test('restored records are revalidated and preview remains bounded', async () => {
  const a = agent('restore')
  for (let i = 0; i < 240; i++) api.appendPluginRecord(a.session, RECORD_TYPE, { ...diagnosticData(entry), raw: secret, command: secret })
  const snapshot = diagnosticSnapshot(a)
  assert.equal(snapshot.entries.length, 200)
  assert.ok(!JSON.stringify(snapshot).includes(secret))
  assert.equal(diagnosticSnapshot(a).entries.length, 200)
})

test('a failing native writer or host logger is contained and exposes persistence failure', async () => {
  class FailedSession extends RecordSession {}
  await initializeDiagnostics(null, { sessionApi: { Session: FailedSession, appendPluginRecord() { throw new Error(secret) } } })
  // The successful adapter above also accepts subclass instances: use an unrelated class.
  class Broken { constructor() { this.header = { id: 'broken' }; this.seq = 0 } }
  await initializeDiagnostics(null, { sessionApi: { Session: Broken, appendPluginRecord() { throw new Error(secret) } } })
  const a = scopedAgent({ session: new Broken() })
  logDiagnostic({ logger: { warn() { throw new Error(secret) } } }, a, { ...entry, level: 'warn', error: new Error(secret) })
  await flushDiagnostics(a)
  const snapshot = diagnosticSnapshot(a)
  assert.equal(snapshot.persistence, 'failed')
  assert.equal(snapshot.failures, 1)
  assert.equal(snapshot.entries.length, 1)
  assert.ok(!JSON.stringify(snapshot).includes(secret))
})

test('older sessions without an API explicitly use bounded memory diagnostics', async () => {
  const a = scopedAgent({ session: { header: { id: 'legacy' } } })
  for (let i = 0; i < 220; i++) logDiagnostic({}, a, entry)
  await flushDiagnostics(a)
  assert.equal(diagnosticSnapshot(a).persistence, 'unavailable')
  assert.equal(diagnosticSnapshot(a).entries.length, 200)
})

test('preview redacts credentials while ordinary output remains unchanged', () => {
  for (const value of [`api_key=${secret}`, `--token '${secret}'`, `Authorization: Bearer ${secret}`, `Cookie: sid=${secret}; other=${secret}`, `https://name:${secret}@localhost`, `{"access_token":"${secret}"}`]) {
    assert.ok(!redactPreview(value).includes(secret), value)
  }
  assert.equal(redactPreview('31 tests, 3 failed; exit 1'), '31 tests, 3 failed; exit 1')
})

test('bounded JSONL serializes concurrent writes, rotates metadata and leaves evidence intact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-logs-'))
  const path = join(root, 'journal.jsonl')
  await writeObject(root, 'evidence', secret)
  await Promise.all(Array.from({ length: 80 }, (_, index) => appendBoundedJsonl(path, { index }, { maxBytes: 512 })))
  assert.ok((await stat(path)).size <= 512)
  assert.ok((await stat(`${path}.1`)).size <= 512)
  const records = (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse)
  assert.equal(records.at(-1).index, 79)
  assert.equal((await readObject(root, 'evidence')).toString(), secret)
  assert.deepEqual((await readdir(root)).sort(), ['journal.jsonl', 'journal.jsonl.1', 'objects'])
})

test('queued compatibility append rechecks authorization before creating files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-log-revoke-'))
  let allowed = true
  const work = appendBoundedJsonl(join(root, 'journal.jsonl'), entry, { authorize: () => allowed })
  allowed = false
  await work
  assert.deepEqual(await readdir(root), [])
})

test('diagnostic export checks token, actual agent scope, and disposal', async () => {
  const a = agent('export-A'), b = agent('export-B', 'standard')
  logDiagnostic({}, a, { ...entry, command: secret })
  await flushDiagnostics(a)
  let route, cleanup
  const ctx = {
    get: name => name === 'webServer' ? { register(value) { route = value; return () => {} } } : name === 'agents' ? { get: id => ({ 'export-A': a, 'export-B': b })[id] } : undefined,
    effect(fn) { cleanup = fn() },
  }
  registerDiagnosticRoute(ctx, { token: 'page-token' })
  function request(id, token = 'page-token', method = 'GET') {
    let payload
    const headers = {}
    const res = { statusCode: 0, setHeader(key, value) { headers[key] = value }, end(value) { payload = JSON.parse(value) } }
    route.handler({ method, url: `/?sessionId=${id}`, headers: { 'x-patchwork-token': token } }, res)
    return { status: res.statusCode, payload, headers }
  }
  try {
    assert.equal(request('export-A', 'wrong').status, 403)
    assert.equal(request('export-B').status, 403)
    assert.equal(request('missing').status, 403)
    assert.equal(request('export-A', 'page-token', 'POST').status, 405)
    const result = request('export-A')
    assert.equal(result.status, 200)
    assert.equal(result.headers['cache-control'], 'no-store')
    assert.equal(result.payload.entries.length, 1)
    assert.ok(!JSON.stringify(result.payload).includes(secret))
    assert.equal(result.payload.sessionIdHash, fingerprint('export-A'))
    a.selectPreset('standard')
    assert.equal(request('export-A').status, 403)
  } finally { cleanup() }
  registerDiagnosticRoute(ctx, { token: 'page-token' })
  cleanup()
})

test('EPR never sends diagnostic commands containing recognizable credentials to the reducer', () => {
  const exec = { name: 'pwsh', arguments: { command: `node --test --api-key=${secret}` } }
  const content = [{ type: 'text', text: 'failure\n'.repeat(1000) }]
  assert.equal(reducibleLog(exec, { content }, content).reason, 'likely-secret')
})
