import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-memory-test-'))
const { confirmMemory, forgetMemory, memorySnapshot, proposeMemory, recallMemory } = await import('../src/memory/store.mjs')
const { MEMORY_ROUTE_PATH, registerMemoryRoute } = await import('../src/memory/route.mjs')

function agents(prefix = 'memory') {
  const cwd = join(process.env.DSH_HOME, 'project')
  return {
    a: scopedAgent({ session: { header: { id: `${prefix}-A`, cwd } } }),
    b: scopedAgent({ session: { header: { id: `${prefix}-B`, cwd } } }),
    foreign: scopedAgent({ session: { header: { id: `${prefix}-standard`, cwd } } }, 'standard'),
  }
}

test('memory is proposal-first, scope-bound and never auto-recalled', { concurrency: false }, async () => {
  const { a, b, foreign } = agents()
  const proposed = await proposeMemory(a, { visibility: 'session-private', key: 'entry', value: 'src/index.mjs', kind: 'repo-fact' })
  assert.equal(proposed.status, 'committed')
  assert.equal((await recallMemory(a, { query: 'entry' })).entries.length, 0)
  assert.equal((await confirmMemory(a, proposed.recordId, proposed.revision)).failureCode, 'MEMORY_USER_CONFIRMATION_REQUIRED')
  const active = await confirmMemory(a, proposed.recordId, proposed.revision, { userConfirmed: true })
  assert.equal(active.status, 'committed')
  assert.equal((await recallMemory(a, { query: 'entry' })).entries[0].value, 'src/index.mjs')
  assert.equal((await recallMemory(b, { query: 'entry' })).entries.length, 0)
  assert.equal((await proposeMemory(foreign, { key: 'x', value: 'y' })).failureCode, 'MEMORY_SCOPE_REQUIRED')
})

function routeRequest(route, { method = 'GET', token = 'memory-secret', sessionId = 'route-A', body } = {}) {
  const listeners = new Map()
  const request = { method, url: `${MEMORY_ROUTE_PATH}?sessionId=${sessionId}`, headers: { 'x-patchwork-token': token },
    on(event, listener) { listeners.set(event, listener); return this }, destroy() {},
    emitBody() { if (body !== undefined) listeners.get('data')?.(Buffer.from(JSON.stringify(body))); listeners.get('end')?.() } }
  const response = { statusCode: 0, body: '', setHeader() {}, end(value) { this.body = value } }
  const pending = route.handler(request, response)
  request.emitBody()
  return Promise.resolve(pending).then(() => ({ status: response.statusCode, json: response.body ? JSON.parse(response.body) : undefined }))
}

test('memory route requires token, Patchwork scope and revision-safe confirmation', { concurrency: false }, async () => {
  const { a } = agents('route')
  const standard = scopedAgent({ session: { header: { id: 'route-standard', cwd: a.session.header.cwd } } }, 'standard')
  let route, dispose
  const server = { register(value) { route = value; return () => {} } }
  const ctx = { get(name) { if (name === 'webServer') return server; if (name === 'agents') return { get(id) { return id === 'route-A' ? a : standard } } }, effect(fn) { dispose = fn() } }
  registerMemoryRoute(ctx, { token: 'memory-secret' })
  try {
    assert.equal((await routeRequest(route, { token: 'wrong' })).status, 403)
    assert.equal((await routeRequest(route, { sessionId: 'route-standard' })).status, 403)
    const proposed = await proposeMemory(a, { visibility: 'session-private', key: 'route-key', value: 'route-value' })
    const conflict = await routeRequest(route, { method: 'POST', body: { action: 'confirm', id: proposed.recordId, expectedRevision: proposed.revision - 1 } })
    assert.equal(conflict.status, 409)
    const confirmed = await routeRequest(route, { method: 'POST', body: { action: 'confirm', id: proposed.recordId, expectedRevision: proposed.revision } })
    assert.equal(confirmed.status, 200)
  } finally { dispose?.() }
})

test('project sharing, CAS and tombstone prevent stale or late resurrection', { concurrency: false }, async () => {
  const { a, b } = agents('shared')
  const proposed = await proposeMemory(a, { visibility: 'project-shared', key: 'test-command', value: 'npm test' })
  assert.equal((await recallMemory(b, { includeProject: true })).entries.length, 0)
  const active = await confirmMemory(a, proposed.recordId, proposed.revision, { userConfirmed: true })
  assert.equal((await recallMemory(b, { includeProject: true })).entries[0].value, 'npm test')
  assert.equal((await forgetMemory(a, proposed.recordId, active.revision - 1, { userConfirmed: true })).failureCode, 'MEMORY_REVISION_CONFLICT')
  const forgotten = await forgetMemory(b, proposed.recordId, active.revision, { userConfirmed: true })
  assert.equal(forgotten.status, 'committed')
  assert.equal((await recallMemory(a, { includeProject: true })).entries.length, 0)
  const raw = JSON.parse(await readFile(join(process.env.DSH_HOME, 'patchwork', 'memory.json'), 'utf8'))
  assert.ok(raw.namespaceEpoch > 0)
  assert.equal(memorySnapshot(a).automaticInjection, 'disabled')
})
