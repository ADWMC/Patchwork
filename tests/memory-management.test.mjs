import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { confirmMemory, forgetMemories, forgetMemory, listMemory, memorySnapshot, proposeMemory, recallMemory, reviseMemory, setMemoryValidity } from '../src/memory/store.mjs'
import { MEMORY_ROUTE_PATH, registerMemoryRoute } from '../src/memory/route.mjs'

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'patchwork-memory-management-'))
  process.env.DSH_HOME = home
  t.after(() => rm(home, { recursive: true, force: true }))
  const make = (id, cwd = join(home, 'project'), preset = 'patchwork') => scopedAgent({ session: { header: { id, cwd } } }, preset)
  return { home, a: make('a'), b: make('b'), other: make('other', join(home, 'other-project')), ordinary: make('ordinary', undefined, 'standard') }
}
async function confirmed(agent, input) {
  const p = await proposeMemory(agent, input)
  return confirmMemory(agent, p.recordId, p.revision, { userConfirmed: true })
}

test('revisions preserve active content until confirmation and retain stable content versions and provenance', async t => {
  const { a } = await fixture(t)
  const old = await confirmed(a, { key: 'build', value: 'npm test', conditions: 'before delivery' })
  const draft = await reviseMemory(a, old.recordId, { key: 'validation', value: 'npm run verify' }, old.revision, { userConfirmed: true })
  assert.equal(draft.status, 'committed'); assert.equal(draft.record.contentVersion, 2)
  assert.equal((await recallMemory(a)).entries[0].value, 'npm test')
  const result = await confirmMemory(a, draft.recordId, draft.revision, { userConfirmed: true })
  assert.equal(result.status, 'committed')
  const recalled = (await recallMemory(a)).entries
  assert.equal(recalled.length, 1); assert.equal(recalled[0].value, 'npm run verify')
  const detail = await listMemory(a, { id: draft.recordId })
  assert.equal(detail.history.length, 2)
  assert.equal(detail.history.find(item => item.id === old.recordId).status, 'superseded')
  assert.ok(detail.record.sources.some(item => item.kind === 'user-revised'))
  assert.ok(detail.record.changes.some(item => item.action === 'confirmed'))
  assert.equal((await listMemory(a, { id: old.recordId })).record.value, 'npm test')
})

test('revoked or replaced revision bases cannot be resurrected by a pending edit', async t => {
  const { a } = await fixture(t)
  const old = await confirmed(a, { key: 'rule', value: 'original' })
  assert.equal((await reviseMemory(a, old.recordId, { visibility: 'project-shared' }, old.revision, { userConfirmed: true })).failureCode, 'MEMORY_SCOPE_CHANGE_REQUIRES_COPY')
  assert.equal((await reviseMemory(a, old.recordId, { value: 'unauthorized' }, old.revision)).failureCode, 'MEMORY_USER_CONFIRMATION_REQUIRED')
  const draft = await reviseMemory(a, old.recordId, { value: 'replacement' }, old.revision, { userConfirmed: true })
  const forgotten = await forgetMemory(a, old.recordId, draft.revision, { userConfirmed: true })
  const result = await confirmMemory(a, draft.recordId, forgotten.revision, { userConfirmed: true })
  assert.equal(result.failureCode, 'MEMORY_BASE_CHANGED')
  assert.equal((await recallMemory(a)).entries.length, 0)
})

test('validity controls actual recall and project changes need explicit inclusion', async t => {
  const { a, b, other, ordinary } = await fixture(t)
  const active = await confirmed(a, { key: 'project-rule', value: 'run checks', visibility: 'project-shared' })
  assert.equal((await listMemory(b)).entryCount, 0)
  assert.equal((await listMemory(b, { scope: 'project-shared' })).entryCount, 1)
  assert.equal((await listMemory(other, { scope: 'all', id: active.recordId })).failureCode, 'MEMORY_NOT_FOUND')
  assert.equal((await listMemory(ordinary)).failureCode, 'MEMORY_SCOPE_REQUIRED')
  assert.equal((await setMemoryValidity(a, active.recordId, active.revision, 'stale')).failureCode, 'MEMORY_USER_CONFIRMATION_REQUIRED')
  const paused = await setMemoryValidity(a, active.recordId, active.revision, 'stale', { userConfirmed: true })
  assert.equal((await recallMemory(b, { includeProject: true })).entries.length, 0)
  const resumed = await setMemoryValidity(b, active.recordId, paused.revision, 'fresh', { userConfirmed: true })
  assert.equal((await recallMemory(b)).entries.length, 0)
  assert.equal((await recallMemory(b, { includeProject: true })).entries.length, 1)
  const unchanged = await setMemoryValidity(b, active.recordId, resumed.revision, 'fresh', { userConfirmed: true })
  assert.equal(unchanged.status, 'unchanged'); assert.equal(unchanged.revision, resumed.revision)
})

test('bulk forgetting is atomic, scope-bound and revision checked', async t => {
  const { a, b } = await fixture(t)
  const first = await proposeMemory(a, { key: 'one', value: 'one' })
  const second = await proposeMemory(a, { key: 'two', value: 'two' })
  const foreign = await proposeMemory(b, { key: 'private', value: 'FOREIGN_PRIVATE' })
  const revision = foreign.revision
  assert.equal((await forgetMemories(a, [first.recordId, foreign.recordId], revision, { userConfirmed: true })).failureCode, 'MEMORY_NOT_FOUND')
  assert.equal(memorySnapshot(a).entries[0].status, 'proposed')
  assert.equal((await forgetMemories(a, [first.recordId, second.recordId], revision - 1, { userConfirmed: true })).failureCode, 'MEMORY_REVISION_CONFLICT')
  const result = await forgetMemories(a, [first.recordId, second.recordId], revision, { userConfirmed: true })
  assert.equal(result.status, 'committed'); assert.equal(result.namespaceEpoch, 1)
  assert.ok(memorySnapshot(a).entries.every(item => item.status === 'revoked'))
  assert.equal(memorySnapshot(b).entries[0].status, 'proposed')
})

test('management pages search beyond 200 records without leaking another session or metadata-only bodies', async t => {
  const { home, a, b } = await fixture(t)
  const proposed = await proposeMemory(a, { key: 'seed', value: 'saved content' })
  const foreign = await proposeMemory(b, { key: 'foreign', value: 'FOREIGN_PRIVATE' })
  const path = join(home, 'patchwork', 'memory.json'), db = JSON.parse(await readFile(path, 'utf8'))
  const seed = db.records.find(item => item.id === proposed.recordId)
  db.records = [...Array.from({ length: 245 }, (_, i) => ({ ...seed, id: `record-${i}`, lineageId: `record-${i}`, key: `entry-${i}`, value: `needle-${i}`, revision: i + 1, status: i < 45 ? 'revoked' : 'proposed' })), db.records.find(item => item.id === foreign.recordId)]
  db.revision = 500; await writeFile(path, JSON.stringify(db))
  const first = await listMemory(a, { includeValue: true }), next = await listMemory(a, { offset: 20, includeValue: true })
  assert.equal(first.entryCount, 245); assert.equal(first.entries.length, 20); assert.equal(first.hasMore, true)
  assert.equal(first.quotas[0].used, 200)
  assert.equal(new Set([...first.entries, ...next.entries].map(item => item.id)).size, 40)
  assert.equal((await listMemory(a, { query: 'needle-0', includeValue: true })).entries[0].id, 'record-0')
  assert.equal((await listMemory(a, { id: foreign.recordId, scope: 'all' })).failureCode, 'MEMORY_NOT_FOUND')
  assert.equal(JSON.stringify(first).includes('FOREIGN_PRIVATE'), false)
  assert.equal((await listMemory(a)).entries.some(item => 'value' in item || 'valuePreview' in item), false)
  assert.equal((await listMemory(a, { limit: 51 })).failureCode, 'MEMORY_INVALID_QUERY')
})

test('management rejects sensitive fields, invalid drafts and stale manual creation', async t => {
  const { a } = await fixture(t)
  assert.equal((await proposeMemory(a, { key: 'title', value: 'safe', kind: 'password=secret' })).failureCode, 'MEMORY_SENSITIVE_VALUE')
  assert.equal((await proposeMemory(a, { key: 'x'.repeat(257), value: 'safe' })).failureCode, 'MEMORY_INVALID_RECORD')
  assert.equal((await proposeMemory(a, { key: 'safe', value: 'safe', visibility: 'global' })).failureCode, 'MEMORY_INVALID_RECORD')
  assert.equal((await proposeMemory(a, { key: 'safe', value: 'safe' }, { expectedRevision: 7 })).failureCode, 'MEMORY_REVISION_CONFLICT')
  assert.equal(memorySnapshot(a).entries.length, 0)
})

test('management routes require CAS and recheck Agent identity after the body arrives', async t => {
  const f = await fixture(t); let route, dispose
  registerMemoryRoute({ get(name) { if (name === 'webServer') return { register(value) { route = value; return () => {} } }; if (name === 'agents') return { get(id) { return f[id] } } }, effect(fn) { dispose = fn() } }, { token: 'management-test' })
  t.after(() => dispose())
  async function request(body, { method = 'POST', params = '', beforeBody, token = 'management-test' } = {}) {
    const listeners = new Map(), req = { method, url: MEMORY_ROUTE_PATH + '?sessionId=a' + params, headers: { 'x-patchwork-token': token }, on(event, fn) { listeners.set(event, fn); return this }, destroy() {} }
    const res = { statusCode: 0, setHeader() {}, end(text) { this.body = JSON.parse(text) } }
    const pending = route.handler(req, res); beforeBody?.(); listeners.get('data')?.(Buffer.from(JSON.stringify(body ?? {}))); listeners.get('end')?.(); await pending
    return res
  }
  const draft = { key: 'manual', value: 'user content' }
  assert.equal((await request({ action: 'propose', record: draft })).body.failureCode, 'MEMORY_REVISION_REQUIRED')
  assert.equal((await request({}, { method: 'GET', token: 'wrong' })).statusCode, 403)
  const created = await request({ action: 'propose', expectedRevision: 0, record: draft })
  assert.equal(created.statusCode, 200); assert.equal(created.body.record.sources[0].kind, 'user-authored')
  const detail = await request({}, { method: 'GET', params: '&id=' + created.body.recordId })
  assert.equal(detail.body.record.value, 'user content')
  const rejected = await request({ action: 'propose', expectedRevision: created.body.revision, record: draft }, { beforeBody() { f.a.selectPreset('standard') } })
  assert.equal(rejected.statusCode, 403)
  f.a.selectPreset('patchwork'); assert.equal((await listMemory(f.a)).entryCount, 1)
})
