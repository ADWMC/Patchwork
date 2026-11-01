import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { BrowserResources, resourcePolicy } from '../src/browser/resources.mjs'
import { measureBrowserMemory } from '../src/browser/resource-memory.mjs'
import { scopedAgent } from './helpers/agent.mjs'
import { requireBrowserAgent } from '../src/scope.mjs'
import { Config } from '../src/index.mjs'
import { BrowserSession } from '../src/browser/session.mjs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function fixture(t, policy = {}, options = {}) {
  let now = 100000
  const manager = new BrowserResources({ now: () => now, ...options })
  t.after(() => manager.dispose())
  function owner(id = 'private-session-id', overrides = {}) {
    const agent = scopedAgent({ session: { header: { id } } })
    const session = { agent, control: 'agent', tail: Promise.resolve(), check() { requireBrowserAgent(agent); if (this.ended) throw new Error('ended') }, enqueue(fn) { const work = this.tail.then(async () => { this.running = true; try { return await fn() } finally { this.running = false } }); this.tail = work.catch(() => {}); return work }, async hibernate(reason) { this.lease?.release(); this.browser = null; manager.hibernated(this, reason); this.reclaimed = true }, ...overrides }
    manager.register(session, policy)
    return session
  }
  async function boot(session) { session.lease = await manager.reserve(session); session.browser = new EventEmitter(); session.lease.activate(session.browser) }
  return { manager, owner, boot, tick: n => { now += n } }
}

test('resource defaults are bounded; user configuration rejects fractional, excessive and unknown values', () => {
  assert.deepEqual(resourcePolicy(), { maxInstances: 2, maxTabs: 8, idleTimeoutMs: 300000, memoryTargetMiB: 512, autoReclaim: false })
  for (const input of [{ maxInstances: 0 }, { maxTabs: 9 }, { idleTimeoutMs: 29999 }, { memoryTargetMiB: Infinity }, { maxInstances: 1.5 }, { autoReclaim: 'yes' }]) assert.throws(() => resourcePolicy(input), /Invalid/)
  assert.equal(Config({ maxTabs: 4 }).maxTabs, 4)
  for (const patch of [{ maxTabs: 8.1 }, { maxInstances: 0 }, { idleTimeoutMs: 0 }, { memoryTargetMiB: 16385 }, { maxInstances: '2' }]) assert.throws(() => Config(patch))
})

test('simultaneous starts cannot cross capacity; failed startup and disconnect release slots', async t => {
  const f = fixture(t, { maxInstances: 1 }), a = f.owner('a'), b = f.owner('b')
  const starts = await Promise.allSettled([f.manager.reserve(a), f.manager.reserve(b)])
  assert.equal(starts.filter(s => s.status === 'fulfilled').length, 1)
  assert.equal(f.manager.aggregate().running, 1)
  starts[0].value.release()
  await f.boot(b)
  assert.equal(f.manager.aggregate().running, 1)
  b.browser.emit('disconnected')
  assert.equal(f.manager.aggregate().running, 0)
  await f.boot(a); a.lease.release(); a.lease.release()
  assert.equal(f.manager.aggregate().running, 0)
})

test('no automatic reclamation until explicitly enabled; status polling is not activity', async t => {
  const f = fixture(t), a = f.owner(); await f.boot(a); f.tick(600000)
  await f.manager.sweep(); assert.equal(a.reclaimed, undefined)
  f.manager.setAutoReclaim(a, true); await f.manager.sweep(); assert.equal(a.reclaimed, undefined)
  f.tick(300000); f.manager.snapshot(a); await f.manager.sweep()
  assert.equal(a.reclaimed, true); assert.equal(f.manager.snapshot(a).state, 'hibernated')
})

test('takeover, queued work, recording, transfer, active download and viewers protect idle sessions', async t => {
  const gates = [{ control: 'user' }, { running: true }, { pendingResourceAction: 1 }, { recording: {} }, { transfers: 1 }, { downloadArm: { until: 9999999 } }, { streamWatchers: new Set([{}]) }]
  for (const gate of gates) {
    const f = fixture(t, { autoReclaim: true }), a = f.owner('a', gate); await f.boot(a); f.tick(600000)
    await f.manager.sweep(); assert.equal(a.reclaimed, undefined, JSON.stringify(gate))
    assert.equal(f.manager.snapshot(a).protected, true)
  }
  const f = fixture(t, { autoReclaim: true }), a = f.owner(); await f.boot(a); f.tick(600000); f.manager.view(a)
  await f.manager.sweep(); assert.equal(a.reclaimed, undefined)
  f.tick(15001); await f.manager.sweep(); assert.equal(a.reclaimed, true)
})

test('an expired download authorization does not pin a browser forever', async t => {
  const f = fixture(t, { autoReclaim: true }), a = f.owner('a', { downloadArm: { until: 99999 } }); await f.boot(a); f.tick(600000)
  await f.manager.sweep(); assert.equal(a.reclaimed, true)
})

test('reclamation rechecks takeover and pending actions inside the queue without mutating running', async t => {
  const f = fixture(t, { autoReclaim: true }), a = f.owner(); await f.boot(a); f.tick(600000)
  const reclaim = f.manager.reclaim(a); a.control = 'user'
  assert.equal(await reclaim, false); assert.equal(a.running, false); assert.equal(a.reclaimed, undefined)
  a.control = 'agent'; const second = f.manager.reclaim(a); a.pendingResourceAction = 1
  assert.equal(await second, false); assert.equal(a.reclaimed, undefined)
})

test('capacity uses only opted-in unprotected idle owners; cannot close other user sessions', async t => {
  const f = fixture(t, { maxInstances: 1 }), a = f.owner('private-a'), b = f.owner('private-b'); await f.boot(a)
  await assert.rejects(f.boot(b), /资源上限/); assert.equal(a.reclaimed, undefined)
  f.manager.setAutoReclaim(a, true); a.control = 'user'
  await assert.rejects(f.boot(b), /资源上限/); assert.equal(a.reclaimed, undefined)
  a.control = 'agent'; await f.boot(b); assert.equal(a.reclaimed, true); assert.equal(f.manager.aggregate().running, 1)
  assert.equal(f.manager.snapshot(a).lastReclaimReason, 'capacity')
})

test('anonymous host totals are user-only; unmeasured memory is unknown and not fabricated zero', async t => {
  const f = fixture(t), a = f.owner('private-a'), b = f.owner('private-b'); await f.boot(a); await f.boot(b)
  assert.equal(f.manager.snapshot(a, { forUser: false }).host, undefined)
  const host = f.manager.snapshot(a).host
  assert.equal(host.unmeasured, 2); assert.equal(host.pressure, 'unknown')
  assert.equal(/private-a|private-b|https:|PID|cookie/i.test(JSON.stringify(host)), false)
})

test('sampling coalesces and caches for 15 seconds; a released browser cannot commit a late sample', async t => {
  let calls = 0, finish
  const f = fixture(t, {}, { measure: async () => { calls++; return { status: 'measured', privateWorkingSetMiB: 100 } } }), a = f.owner(); await f.boot(a)
  await Promise.all([f.manager.measure(a), f.manager.measure(a)]); await f.manager.measure(a); assert.equal(calls, 1)
  f.tick(15001); await f.manager.measure(a); assert.equal(calls, 2)
  f.tick(15001); f.manager.sampler = () => new Promise(resolve => { finish = resolve })
  const pending = f.manager.measure(a); a.lease.release(); finish({ status: 'measured', privateWorkingSetMiB: 999 })
  await assert.rejects(pending, /changed/); assert.equal(f.manager.snapshot(a).memory, null)
})

test('soft memory pressure is separate from capacity; stale or unsupported samples do not pretend to enforce RAM', async t => {
  const f = fixture(t, { memoryTargetMiB: 128 }, { measure: async () => ({ status: 'measured', privateWorkingSetMiB: 140 }) }), a = f.owner(), b = f.owner('b'); await f.boot(a); await f.manager.measure(a)
  assert.equal(f.manager.aggregate().pressure, 'high'); await assert.rejects(f.boot(b), /软预算/)
  f.tick(30001); assert.equal(f.manager.aggregate().pressure, 'unknown'); await f.boot(b)
})

test('revocation prevents late sampling and startup; unregister releases capacity', async t => {
  const f = fixture(t), a = f.owner(); await f.boot(a); a.agent.selectPreset('standard')
  await assert.rejects(f.manager.reserve(f.owner('b', { ended: true })), /ended/)
  await assert.rejects(f.manager.measure(a), /browser access/i)
  f.manager.unregister(a); assert.equal(f.manager.aggregate().running, 0)
})

test('Windows sampler uses only validated current-browser CDP PIDs and returns no raw identifiers', async () => {
  let detached = false, calls = 0
  const browser = { newBrowserCDPSession: async () => ({ send: async () => ({ processInfo: [{ id: 123, type: 'browser' }, { id: 456, type: 'renderer' }] }), detach: async () => { detached = true } }) }
  const session = { browser, check() {}, profile: { backend: 'chromium' } }
  const result = await measureBrowserMemory(session, { platform: 'win32', run: async (_command, args, options) => {
    calls++; const script = Buffer.from(args.at(-1), 'base64').toString('utf16le')
    assert.match(script, /IDProcess = 123 OR IDProcess = 456/)
    assert.equal(options.windowsHide, true); assert.equal(options.timeout, 8000)
    assert.equal(options.env.PATCHWORK_STEPFUN_KEY, undefined)
    return { stdout: JSON.stringify({ processes: 2, privateWorkingSet: 104857600, workingSet: 209715200, privateCommit: 314572800 }) }
  } })
  assert.equal(result.privateWorkingSetMiB, 100); assert.equal(result.workingSetMiB, 200); assert.equal(result.privateCommitMiB, 300)
  assert.equal(calls, 1); assert.equal(detached, true); assert.equal(/123|456/.test(JSON.stringify(result)), false)
  assert.equal((await measureBrowserMemory(session, { platform: 'linux' })).status, 'unsupported')
})

test('sampler reports unknown on malformed IDs, missing processes and system errors', async () => {
  for (const ids of [['123;evil'], [], [0]]) {
    let invoked = false
    const session = { check() {}, browser: { newBrowserCDPSession: async () => ({ send: async () => ({ processInfo: ids.map(id => ({ id })) }), detach: async () => {} }) } }
    assert.equal((await measureBrowserMemory(session, { platform: 'win32', run: async () => { invoked = true } })).status, 'unsupported'); assert.equal(invoked, false)
  }
  const session = { check() {}, browser: { newBrowserCDPSession: async () => ({ send: async () => ({ processInfo: [{ id: 123 }] }), detach: async () => {} }) } }
  for (const run of [async () => { throw new Error('secret-system-detail') }, async () => ({ stdout: '{"processes":0}' })]) {
    const result = await measureBrowserMemory(session, { platform: 'win32', run }); assert.equal(result.status, 'unsupported'); assert.equal(JSON.stringify(result).includes('secret-system-detail'), false)
  }
})

test('BrowserSession failed launch releases its actual reservation and configured tab limits apply', async t => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-resource-unit-')); t.after(() => rm(root, { recursive: true, force: true }))
  const resources = new BrowserResources(); t.after(() => resources.dispose())
  let fail = true, connected = false
  const browser = { isConnected: () => connected, version: () => '156.0.0.0', async close() { connected = false }, async newContext() { const c = new EventEmitter(); c.route = async () => {}; c.close = async () => c.emit('close'); return c } }
  const session = new BrowserSession(scopedAgent({ session: { header: { id: 'launch-failure', cwd: root } } }), { root, resources, resourcePolicy: { maxTabs: 2 }, launch: async () => { if (fail) throw new Error('startup failed'); connected = true; return browser } }); t.after(() => session.dispose())
  await assert.rejects(session.ensureContext(), /startup failed/); assert.equal(resources.aggregate().running, 0)
  fail = false; await session.ensureContext(); assert.equal(resources.aggregate().running, 1); assert.equal(session.maxTabs, 2)
  session.tabs.set('a', {}); session.tabs.set('b', {}); await assert.rejects(session.newTab(), /At most 2/)
  await session.dispose(); assert.equal(resources.aggregate().running, 0); assert.equal(resources.records.size, 0)
})

test('a failed engine close retains its reservation; hibernation keeps URLs if opt-in storage save fails', async t => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-resource-close-')); t.after(() => rm(root, { recursive: true, force: true }))
  const resources = new BrowserResources(); t.after(() => resources.dispose())
  const session = new BrowserSession(scopedAgent({ session: { header: { id: 'close-failure', cwd: root } } }), { root, resources }); t.after(() => session.dispose())
  const lease = await resources.reserve(session); lease.activate({}); session.resourceLease = lease
  session.browser = { isConnected: () => true, close: async () => { throw new Error('close failed') } }
  await assert.rejects(session.close(), /close failed/); assert.equal(resources.aggregate().running, 1); assert.ok(session.browser)
  session.browser = { close: async () => {} }; session.context = { close: async () => {} }
  session.tabs.set('a', { page: { url: () => 'https://example.com/recover' } })
  session.profiles.saveStorage = async () => { throw new Error('storage encryption failed') }
  await assert.rejects(session.hibernate(), /storage encryption failed/)
  assert.deepEqual(session.recoverable, ['https://example.com/recover']); assert.equal(resources.snapshot(session).state, 'hibernated'); assert.equal(resources.aggregate().running, 0)
})
