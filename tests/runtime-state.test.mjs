import { scopedAgent } from './helpers/agent.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-state-test-'))
const { registerRuntimeState, registerRuntimeCollector, runtimeSnapshot, collectToolEvidence } = await import('../src/ui/runtime-state.mjs')

function boot() {
  const listeners = new Map()
  let route; const disposers = []
  const ctx = {
    get: key => key === 'webServer' ? { register: value => { route = value; return () => {} } } : key === 'agents' ? { get: id => agent(id) } : undefined,
    on: (key, fn) => listeners.set(key, fn),
    effect: fn => { disposers.push(fn()) },
  }
  registerRuntimeState(ctx, { token: 'test-only', rowConfig: { observationPack: false }, loadedConfig: { actionFusion: true } })
  registerRuntimeCollector(ctx, { loadedConfig: { actionFusion: true, skillsMode: 'expanded' }, skillNames: ['web-ui', 'retrieval'] })
  return { route, listeners, dispose: () => disposers.forEach(dispose => dispose?.()) }
}
function agent(id) {
  return scopedAgent({ session: { header: { id }, requestContext: () => ({ contextWindow: 1000 }) }, ctx: {
    get: key => key === 'tokenMeter' ? { measure: () => ({ totalTokens: 123 }) } : undefined,
    tools: { get: () => ({ parameters: { properties: { then_run: {} } } }) },
  } })
}

test('state route authenticates and releases its route on disposal', () => {
  const first = boot()
  try {
    function request(method, token, url) {
      let payload
      const res = { statusCode: 0, setHeader() {}, end: value => { payload = JSON.parse(value) } }
      first.route.handler({ method, headers: { 'x-patchwork-token': token }, url }, res)
      return { status: res.statusCode, payload }
    }
    assert.equal(request('GET', 'wrong', '/?sessionId=A').status, 403)
    assert.equal(request('POST', 'test-only', '/?sessionId=A').status, 405)
    assert.equal(request('GET', 'test-only', '/').status, 400)
    const ok = request('GET', 'test-only', '/?sessionId=A')
    assert.equal(ok.status, 200)
    assert.equal(ok.payload.sessionId, 'A')
    assert.equal(ok.payload.context.tokens, 123)
    assert.equal(ok.payload.mechanisms.actionFusion.active, true)
  } finally { first.dispose() }
  const second = boot()
  assert.ok(second.route)
  second.dispose()
})

test('same directory sessions keep evidence separate and canonical failures survive', async () => {
  const host = boot()
  try {
    const a = agent('A'), b = agent('B')
    a.session.header.cwd = b.session.header.cwd = 'same-directory'
    host.listeners.get('agent/created')({ agent: a })
    host.listeners.get('agent/created')({ agent: b })
    host.listeners.get('tools/result')(
      { agent: a, callId: 'write-1', rootCallId: 'write-1', name: 'write', arguments: { then_run: { command: 'exit 7' } } },
      { isError: false, value: { mutation: {}, thenRun: { status: 'failed', exitCode: 7 } }, content: [{ type: 'text', text: 'failure receipt' }] },
    )
    const state = runtimeSnapshot('A', {}, { actionFusion: true })
    assert.equal(state.events[0].outcome, 'failed')
    assert.equal(state.events[0].exitCode, 7)
    assert.equal(state.events[0].command, 'exit 7')
    assert.equal(state.context.tokens, 123)
    assert.equal(state.context.window, 1000)
    assert.deepEqual(state.skills, { names: ['web-ui', 'retrieval'], mode: 'expanded', bodies: 'on-demand' })
    assert.equal(state.mechanisms.actionFusion.active, true)
    assert.equal(runtimeSnapshot('B').events.length, 0)
    assert.equal(runtimeSnapshot('A').retrieval.entries.length, 0)
    collectToolEvidence({ agent: a, callId: 'unknown-exit', name: 'read' }, { content: [] })
    assert.equal(runtimeSnapshot('A').events[0].exitCode, null)
  } finally { host.dispose() }
})

test('bounded event previews deduplicate call IDs and retain unverified state', () => {
  const host = boot()
  try {
    const a = agent('bounded')
    for (let i = 0; i < 102; i++) collectToolEvidence({ agent: a, callId: 'c'+i, name: 'write' }, {
      value: { thenRun: { status: 'unverified', exitCode: null } }, content: [{ type: 'text', text: 'x'.repeat(17000) }],
    })
    collectToolEvidence({ agent: a, callId: 'c101', name: 'write' }, { isError: true })
    const events = runtimeSnapshot('bounded').events
    assert.equal(events.length, 100)
    assert.equal(events[0].id, 'c101')
    assert.equal(events[0].outcome, 'unverified')
    assert.equal(events[0].text.length, 16000)
    assert.equal(events[0].truncated, true)
    assert.equal(events.at(-1).id, 'c2')
  } finally { host.dispose() }
})

test('host hot reload keeps the page credential and existing session receipts', async () => {
  const { webRuntime: first } = await import('../src/ui/web-runtime.mjs')
  const { webRuntime: reloaded } = await import('../src/ui/web-runtime.mjs?reload-regression')
  assert.equal(reloaded, first)
  assert.match(first.token, /^[0-9a-f]{32}$/)
  const host = boot()
  collectToolEvidence({ agent: agent('reload'), callId: 'stable', name: 'read' }, { content: [] })
  host.dispose()
  const next = boot()
  try { assert.equal(runtimeSnapshot('reload').events[0].id, 'stable') }
  finally { next.dispose() }
})
