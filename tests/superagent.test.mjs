import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, stat, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { scopedAgent } from './helpers/agent.mjs'
import { initialSuperagent, defineJobs, runnableJobs, restoreSuperagent } from '../src/superagent/state.mjs'
import { SuperagentController, managedWorker, flushWorkerTask, revokeExecutor, superagentSnapshot } from '../src/superagent/controller.mjs'
import { inspectDelegatedAction, registerSuperagent } from '../src/superagent/index.mjs'
import { transitionTask } from '../src/task/store.mjs'
import { restoreController, persistController } from '../src/superagent/store.mjs'
import { initializeDiagnostics } from '../src/logging/session-log.mjs'

const turn = () => new Promise(resolve => setImmediate(resolve))
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await turn() } assert.fail('condition did not settle') }
const job = (id, mode = 'write', dependencies = []) => ({ id, title: id, prompt: `Do ${id}`, mode, dependencies })
function ready() { return { taskId: 'native-task', revision: 4, status: 'ready', understandingStatus: 'stated', persistence: 'native', artifacts: [], requirements: [{ id: 'check', required: true, kind: 'command', status: 'passed' }] } }
// Deterministic fake backend for races and policy contracts. Real native/model
// coverage is recorded separately by docs/experiments/.../run-native.mjs.
async function fixture(options = {}) {
  const cwd = options.cwd ?? await mkdtemp(join(tmpdir(), 'pw-superagent-'))
  const children = [], records = [], notices = [], drained = []
  const runtime = {
    getProvider: () => ({ prepareContinuable() {} }), resolveMaxDepth: () => 1,
    async startActivation(spec) {
      assert.equal(records.at(-1).jobs.some(j => j.childId === spec.childId && j.status === 'starting'), true, 'intent must be durable before dispatch')
      assert.equal(spec.provider, 'spawn'); assert.equal(spec.delivery, 'caller')
      assert.equal(spec.request.agentOptions, undefined); assert.equal(spec.request.agentPreset, undefined)
      let finish
      const result = new Promise(resolve => { finish = resolve })
      const child = scopedAgent({ session: { header: { id: spec.childId, cwd, parentSession: owner.session.header.id } } })
      const entry = { spec, child, finish, disposed: false }; children.push(entry)
      return { childId: spec.childId, result, async dispose() { entry.disposed = true; finish({ stopReason: 'aborted', output: [] }) } }
    },
    async drainChildren(_parent, ids) { drained.push(...ids); for (const child of children) if (ids.includes(child.spec.childId)) child.finish({ stopReason: 'aborted', output: [] }) },
    async listChildren() { return children.map(c => ({ id: c.spec.childId, status: c.disposed ? 'idle' : 'running' })) },
  }
  const owner = scopedAgent({ session: { header: { id: randomUUID(), cwd } }, ctx: { get: name => name === 'subagents' ? runtime : undefined }, followup: message => notices.push(message) })
  const persist = options.persist ?? (async (_owner, value) => { records.push(structuredClone(value)) })
  const c = new SuperagentController(owner, { persist, restore: () => options.state ?? initialSuperagent(owner.session.header.id) })
  async function complete(index, { task = ready(), report = 'ready', stopReason = 'completed' } = {}) {
    const entry = children[index], binding = managedWorker(entry.child)
    if (binding) { binding.latestTask = task; c.state.jobs.find(j => j.id === binding.jobId).report = { status: report, summary: 'executor report' } }
    entry.finish({ stopReason, output: [{ type: 'text', text: 'model claim' }] }); await turn(); await c.tail; await turn()
  }
  return { c, owner, cwd, children, notices, records, runtime, drained, complete }
}

test('DAG validation, bounded jobs, explicit modes and read/write slot policy', () => {
  const initial = initialSuperagent('owner')
  assert.throws(() => defineJobs(initial, [job('a', 'invalid')]), /mode/)
  assert.throws(() => defineJobs(initial, [job('a', 'write', ['missing'])]), /missing/)
  assert.throws(() => defineJobs(initial, [job('a', 'write', ['b']), job('b', 'write', ['a'])]), /cyclic/)
  assert.throws(() => defineJobs(initial, [job('a'), job('a')]), /duplicate/)
  const s = defineJobs(initial, [job('a', 'read'), job('b', 'read'), job('c'), job('d', 'read', ['a'])])
  assert.deepEqual(runnableJobs(s).map(j => j.id), ['a', 'b'])
  const explore = defineJobs(initial, [job('e', 'explore')])
  assert.equal(explore.jobs[0].mode, 'explore')
  assert.deepEqual(runnableJobs(explore).map(j => j.id), ['e'])
  s.jobs[0].status = 'running'; assert.deepEqual(runnableJobs(s).map(j => j.id), ['b'])
  s.jobs[0].status = 'done'; s.jobs[1].status = 'done'
  assert.deepEqual(runnableJobs(s).map(j => j.id), ['c'])
})

test('durable dispatch intent, parallel reads, dependent write and bounded same-owner wakeups', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a', 'read'), job('b', 'read'), job('c', 'write', ['a', 'b'])], 0)
  await until(() => f.children.length === 2)
  await f.complete(0); assert.equal(f.children.length, 2)
  await f.complete(1); await until(() => f.children.length === 3)
  await f.complete(2); await until(() => f.c.state.status === 'completed')
  assert.equal(f.notices.length, 3)
  assert.ok(f.notices.every(n => n.source.kind === 'patchwork'))
  assert.ok(f.c.snapshot().jobs.every(j => j.status === 'done' && j.evidence.verified && !('prompt' in j)))
  await assert.rejects(f.c.submit([job('extra')], 0), /revision/)
})

test('completed model output and unknown semantics never unlock a dependency', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a'), job('b', 'write', ['a'])], 0); await until(() => f.children.length === 1)
  const task = ready(); task.requirements.push({ required: true, kind: 'semantic', status: 'unknown' })
  await f.complete(0, { task }); assert.equal(f.c.state.jobs[0].status, 'review'); assert.equal(f.children.length, 1)
})

test('only user review of the current evidence version unlocks an executor dependency', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a'), job('b', 'write', ['a'])], 0); await until(() => f.children.length === 1)
  const task = ready(); task.status = 'partial'; task.requirements.push({ id: 'meaning', required: true, kind: 'semantic', status: 'unknown' })
  await f.complete(0, { task })
  const evidenceVersion = f.c.state.jobs[0].evidence.version
  await assert.rejects(f.c.review('a', f.c.state.revision, { evidenceVersion, accept: true }), /confirmation/)
  await assert.rejects(f.c.review('a', f.c.state.revision, { userConfirmed: true, evidenceVersion: 'old', accept: true }), /version/)
  assert.equal(f.children.length, 1)
  await f.c.review('a', f.c.state.revision, { userConfirmed: true, evidenceVersion, accept: true })
  await until(() => f.children.length === 2)
  assert.equal(f.c.state.jobs[0].disposition.source, 'user-confirmed')
  assert.equal(f.c.state.jobs[0].evidence.verified, false)
})

test('review refuses changed or out-of-workspace artifacts; rejection and restore never silently release dependencies', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a'), job('b', 'write', ['a'])], 0); await until(() => f.children.length === 1)
  const path = join(f.cwd, 'result.txt'); await writeFile(path, 'original')
  const s = await stat(path), task = ready(); task.status = 'partial'
  task.artifacts = [{ path: await realpath(path), status: 'current', stamp: `${s.size}:${s.mtimeMs}:${s.ctimeMs}` }]
  task.requirements.push({ id: 'meaning', required: true, kind: 'semantic', status: 'unknown' })
  await f.complete(0, { task })
  const evidenceVersion = f.c.state.jobs[0].evidence.version
  await writeFile(path, 'changed current bytes')
  await assert.rejects(f.c.review('a', f.c.state.revision, { userConfirmed: true, accept: true, evidenceVersion }), /changed/)
  assert.equal(f.children.length, 1)
  await f.c.review('a', f.c.state.revision, { userConfirmed: true, accept: false, evidenceVersion })
  assert.equal(f.c.state.jobs[0].status, 'blocked'); assert.equal(f.children.length, 1)
  const state = structuredClone(f.c.state); state.jobs[0].status = 'done'
  const restored = restoreSuperagent(state, f.owner.session.header.id)
  assert.equal(restored.status, 'paused'); assert.equal(restored.jobs[0].status, 'review'); assert.equal(restored.jobs[0].disposition, null)
  f.c.state.jobs[0].status = 'review'
  f.c.state.jobs[0].evidence.artifacts[0].path = new URL(import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '')
  await assert.rejects(f.c.review('a', f.c.state.revision, { userConfirmed: true, accept: true, evidenceVersion }), /outside/)
})

test('waiting and input preserve job identity and allocate a new bounded attempt', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a')], 0); await until(() => f.children.length === 1)
  await f.complete(0, { task: null, report: 'waiting' }); assert.equal(f.c.state.jobs[0].status, 'waiting')
  const before = f.c.state.jobs[0].childId
  await f.c.retry('a', f.c.state.revision, 'Use the documented local fixture')
  await until(() => f.children.length === 2)
  assert.equal(f.c.state.jobs[0].id, 'a'); assert.notEqual(f.c.state.jobs[0].childId, before)
  assert.match(f.children[1].spec.request.prompt[0].text, /documented local fixture/)
  await f.complete(1); assert.equal(f.c.state.status, 'completed')
})

test('correction revokes running attempts and invalidates completed downstream evidence', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a'), job('b', 'write', ['a'])], 0); await until(() => f.children.length === 1)
  await f.complete(0); await until(() => f.children.length === 2)
  await f.complete(1); assert.equal(f.c.state.status, 'completed')
  await f.c.retry('a', f.c.state.revision, 'Correct the expected result')
  await until(() => f.children.length === 3)
  assert.equal(f.c.state.jobs[1].status, 'blocked'); assert.equal(f.c.state.jobs[1].evidence, null)
  await f.complete(2); assert.equal(f.children.length, 3)
})

test('cancel during a pending flush cannot dispatch or revive the old queue', async t => {
  let release, calls = 0
  const f = await fixture({ persist: async () => { if (++calls === 1) await new Promise(resolve => { release = resolve }) } }); t.after(() => f.c.close('test'))
  const submission = f.c.submit([job('a')], 0)
  await until(() => release)
  const stopped = f.c.pause('cancel', true); release()
  await assert.rejects(submission, /revoked/); await stopped
  assert.equal(f.c.state.status, 'cancelled'); assert.equal(f.children.length, 0)
})

test('persistence failure aborts owned work even if pause checkpoint cannot flush', async t => {
  const f = await fixture(); t.after(() => f.c.close('test').catch(() => {}))
  await f.c.submit([job('a')], 0); await until(() => f.children.length === 1)
  f.c.persist = async () => { throw new Error('disk failed') }
  await assert.rejects(f.c.pause('stop'), /disk failed/)
  assert.equal(f.children[0].disposed, true); assert.equal(f.c.snapshot().persistence, 'failed')
  await assert.rejects(f.c.submit([job('b')], f.c.state.revision), /unavailable/)
})

test('preset switch revokes worker capabilities; ordinary other-session work is untouched', async t => {
  const f = await fixture(), other = await fixture(); t.after(() => Promise.allSettled([f.c.close('test'), other.c.close('test')]))
  await f.c.submit([job('a')], 0); await other.c.submit([job('b')], 0)
  await until(() => f.children.length && other.children.length)
  f.owner.selectPreset('standard')
  assert.match(await inspectDelegatedAction({ agent: f.children[0].child, name: 'read', arguments: {} }), /revoked/)
  await f.c.close('mode changed')
  assert.equal(other.children[0].disposed, false); assert.equal(other.c.valid(), true)
  assert.equal(await inspectDelegatedAction({ agent: other.owner, name: 'pwsh', arguments: {} }), undefined)
})

test('same-workspace module writes wait and resume when the owning lock is released', async t => {
  const f = await fixture(), other = await fixture({ cwd: f.cwd }); t.after(() => Promise.allSettled([f.c.close('test'), other.c.close('test')]))
  await f.c.submit([job('a')], 0); await until(() => f.children.length === 1)
  await other.c.submit([job('b')], 0); await turn(); assert.equal(other.children.length, 0)
  await f.complete(0); await until(() => other.children.length === 1)
  await other.complete(0); assert.equal(other.c.state.status, 'completed')
})

test('read assignments deny shell, writes, messaging and nested orchestration', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('read', 'read')], 0); await until(() => f.children.length === 1)
  const agent = f.children[0].child
  for (const name of ['write', 'edit', 'pwsh', 'bash', 'send_message', 'subagent']) assert.ok(await inspectDelegatedAction({ agent, name, arguments: {} }))
  assert.ok(await inspectDelegatedAction({ agent, name: 'patchwork_superagent', arguments: { action: 'submit' } }))
  assert.ok(await inspectDelegatedAction({ agent, name: 'patchwork_task', arguments: { action: 'check', command: 'node check' } }))
  assert.equal(await inspectDelegatedAction({ agent, name: 'patchwork_task', arguments: { action: 'check', rules: { anchors: ['export'] } } }), undefined)
  assert.equal(await inspectDelegatedAction({ agent, name: 'read', arguments: {} }), undefined)
  for (const name of ['obs_recall', 'update_plan', 'patchwork_search', 'patchwork_fetch']) assert.equal(await inspectDelegatedAction({ agent, name, arguments: {} }), undefined)
})

test('parent references and phase cannot be bypassed by a fresh executor task', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  transitionTask(f.owner, { kind: 'define', data: { title: 'Plan', phase: 'plan', requirements: [], references: [join(f.cwd, 'refs')] } })
  await f.c.submit([job('a')], 0); await until(() => f.children.length === 1)
  const agent = f.children[0].child
  assert.match(await inspectDelegatedAction({ agent, name: 'write', arguments: { file_path: join(f.cwd, 'code.mjs') } }), /Markdown/)
  assert.match(await inspectDelegatedAction({ agent, name: 'write', arguments: { file_path: join(f.cwd, 'refs', 'a.md') } }), /reference/)
  assert.ok(await inspectDelegatedAction({ agent, name: 'pwsh', arguments: {} }))
  assert.equal(await inspectDelegatedAction({ agent, name: 'write', arguments: { file_path: join(f.cwd, 'plan.md') } }), undefined)
})

test('restore blocks uncertain side effects and validates ownership, mode and cycles', () => {
  const s = defineJobs(initialSuperagent('a'), [job('first'), job('later', 'write', ['first'])])
  s.jobs[0].status = 'starting'; s.jobs[0].attempt = 1; s.jobs[0].childId = 'session-pw-' + randomUUID()
  const restored = restoreSuperagent(s, 'a')
  assert.equal(restored.status, 'paused'); assert.equal(restored.jobs[0].status, 'blocked'); assert.equal(runnableJobs(restored).length, 0)
  assert.throws(() => restoreSuperagent(s, 'b'), /invalid/)
  s.jobs[0].mode = 'bad'; assert.throws(() => restoreSuperagent(s, 'a'), /mode/)
})

test('native session records require flush, preserve workspace and fail closed on corruption', async () => {
  const records = []
  class Session { constructor() { this.header = { id: 'native-owner', cwd: process.cwd() }; this.seq = 0 } eventAt(i) { return records[i] } }
  await initializeDiagnostics(null, { sessionApi: { Session, appendPluginRecord(s, type, data) { records.push({ type, data, ignorable: true }); s.seq++ } } })
  let flushed = 0
  const owner = scopedAgent({ session: new Session(), ctx: { get: name => name === 'sessions' ? { async flush() { flushed++ } } : undefined } })
  await persistController(owner, defineJobs(initialSuperagent('native-owner'), [job('a')]))
  assert.equal(flushed, 1); assert.equal(restoreController(owner).jobs[0].id, 'a')
  assert.equal(superagentSnapshot(owner).jobs[0].id, 'a')
  owner.session.header.cwd = join(process.cwd(), 'elsewhere'); assert.throws(() => restoreController(owner), /workspace/)
  owner.session.header.cwd = process.cwd(); records[0].data.jobs[0].dependencies = ['a']; assert.throws(() => restoreController(owner), /self/)
})

test('retained tool cannot run in another composition or report as a root', async () => {
  let tool
  const ctx = { tools: { register: value => { tool = value } }, commands: { register() {} }, on() {}, effect() {} }
  registerSuperagent(ctx)
  const a = scopedAgent({ session: { header: { id: 'ordinary', cwd: process.cwd() } } }, 'standard')
  await assert.rejects(tool.execute({ action: 'inspect' }, { agent: a }), /Patchwork/)
  a.selectPreset('patchwork'); await assert.rejects(tool.execute({ action: 'report' }, { agent: a }), /owned executor/)
})

test('final evidence flush happens while the native child is live, never after activation teardown', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a')], 0); await until(() => f.children.length === 1)
  const child = f.children[0].child, original = child.ctx.get, binding = managedWorker(child)
  let flushes = 0, live = true
  child.ctx.get = name => name === 'sessions' ? { async flush() { assert.equal(live, true); flushes++ } } : original(name)
  await flushWorkerTask(child); assert.equal(binding.finalFlushed, true); assert.equal(flushes, 1)
  live = false
  await f.complete(0, { task: null }); assert.equal(flushes, 1)
  assert.equal(f.c.state.jobs[0].status, 'review')
})

test('executor preset change revokes its assignment and cannot deliver an old ready report', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a'), job('next', 'write', ['a'])], 0); await until(() => f.children.length === 1)
  const child = f.children[0].child
  child.selectPreset('standard'); revokeExecutor(child.session.header.id)
  assert.match(await inspectDelegatedAction({ agent: child, name: 'read', arguments: {} }), /revoked/)
  await until(() => f.c.state.jobs[0].status === 'failed')
  assert.equal(f.children.length, 1); assert.equal(f.children[0].disposed, true)
})

test('restored passed work requires review before it can unlock a new dependency', () => {
  const s = defineJobs(initialSuperagent('owner'), [job('a'), job('b', 'write', ['a'])]); s.jobs[0].status = 'done'
  const restored = restoreSuperagent(s, 'owner'); assert.equal(restored.jobs[0].status, 'review')
  restored.status = 'active'; assert.deepEqual(runnableJobs(restored), [])
})

test('native plan mode blocks dispatch and delegated writes require absolute paths', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  const get = f.owner.ctx.get; let planning = true
  f.owner.ctx.get = name => name === 'planMode' ? { get: () => ({ active: planning }) } : get(name)
  await assert.rejects(f.c.submit([job('a')], 0), /plan mode/); assert.equal(f.children.length, 0)
  planning = false; await f.c.submit([job('a')], 0); await until(() => f.children.length === 1)
  const agent = f.children[0].child
  assert.match(await inspectDelegatedAction({ agent, name: 'write', arguments: { file_path: '../escape.mjs' } }), /absolute/)
  assert.ok(await inspectDelegatedAction({ agent, name: 'working_directory', arguments: { path: '..' } }))
})

test('a running-checkpoint failure after native admission stops that exact child before releasing its guard', async t => {
  let count = 0
  const f = await fixture(); t.after(() => f.c.close('test').catch(() => {}))
  f.c.persist = async (_owner, value) => {
    f.records.push(structuredClone(value))
    if (++count === 3) throw new Error('running checkpoint flush failed')
  }
  await f.c.submit([job('a')], 0)
  await until(() => f.children.length === 1 && f.children[0].disposed)
  assert.equal(f.c.persistence, 'failed'); assert.equal(f.children[0].spec.signal.aborted, true)
  assert.equal(f.children.length, 1)
})

test('dispatched executor capability brief agrees with guard across read/write and parent scope', async t => {
  for (const [mode, phase, references] of [['read', 'analysis', []], ['explore', 'analysis', []], ['write', 'implement', []], ['write', 'implement', [process.cwd()]], ['write', 'plan', []]]) {
    const f = await fixture(); t.after(() => f.c.close('test'))
    transitionTask(f.owner, { kind: 'define', baseRevision: 0, data: { title: 'Scoped parent', phase, references, requirements: [] } })
    await f.c.submit([job('brief', mode)], 0); await until(() => f.children.length === 1)
    const { spec, child } = f.children[0]
    const prompt = spec.request.prompt[0].text
    if (mode === 'read') assert.match(prompt, /do not register task requirements/)
    if (mode === 'explore') assert.match(prompt, /EXPLORE assignment/)
    const data = JSON.parse(prompt.split('\n\n').at(-1))
    assert.equal(data.mode, mode); assert.equal(data.parent.phase, phase)
    for (const name of ['read', 'patchwork_code', 'obs_recall', 'update_plan', 'patchwork_search', 'patchwork_fetch', 'pwsh', 'bash', 'todo_write', 'spawn', 'working_directory']) {
      const denied = await inspectDelegatedAction({ agent: child, name, arguments: {} })
      assert.equal(data.eligibleTools.includes(name), denied === undefined, `${mode}/${phase}/${name}`)
    }
    await f.c.close('case complete')
  }
})
