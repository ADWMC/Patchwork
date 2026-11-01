import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { initialTask, readTaskCheckpoint, reduceTask } from '../src/task/state.mjs'
import { taskState, taskProjection, transitionTask, flushTasks } from '../src/task/store.mjs'
import { initializeDiagnostics } from '../src/logging/session-log.mjs'
import { registerTaskLifecycle } from '../src/task/lifecycle.mjs'
import { canContinueTask, continuationLease, HANDOFF_SOURCE, hasTaskHandoff, taskHandoff, taskHandoffText } from '../src/task/handoff.mjs'

const cwd = await mkdtemp(join(tmpdir(), 'patchwork-handoff-work-'))
function agent(id = 'handoff') { return scopedAgent({ session: { header: { id, cwd } } }) }
function define(a, requirements = [{ id: 'tests', label: 'Keep the current public interface', kind: 'command' }]) {
  transitionTask(a, { kind: 'define', data: { title: 'Fix a regression', phase: 'implement', requirements, references: [join(cwd, 'reference')] } })
}

test('handoff preserves actual requirements, correction and references without granting authority', () => {
  const a = agent(); define(a)
  transitionTask(a, { kind: 'correct', data: { title: 'Preserve API and fix cancellation', phase: 'implement', affected: ['tests'] } })
  const h = taskHandoff(a)
  assert.equal(h.requirements[0].label, 'Keep the current public interface')
  assert.equal(h.lastCorrection.revision, taskState(a).revision)
  assert.equal(h.references[0], join(cwd, 'reference'))
  assert.match(h.authority, /grant no host permissions/)
  assert.equal(taskState(a).revision, h.revision)
  assert.match(taskHandoffText(a), /Preserve API and fix cancellation/)
})

test('bounded handoff is valid JSON, prioritizes unfinished requirements and reports omissions', () => {
  const a = agent('budget')
  define(a, Array.from({ length: 24 }, (_, i) => ({ id: `r${i}`, label: 'A'.repeat(160), kind: 'command', coverage: Array.from({ length: 64 }, (_, j) => `unit-${j}`) })))
  const h = taskHandoff(a, 1600)
  assert.ok(JSON.stringify(h).length <= 1600)
  assert.equal(h.requirements.length + h.omitted.requirements, 24)
  assert.ok(h.omitted.requirements > 0)
  assert.equal(JSON.parse(JSON.stringify(h)).read, 'patchwork_task inspect')
  assert.throws(() => taskHandoff(a, 1023), /budget/)
})

test('same message is idempotent after checkpoint restoration, and source kinds are distinct', () => {
  let state = initialTask('restore', cwd)
  const incoming = { kind: 'incoming', eventId: 'request-1', sourceKind: 'user' }
  state = reduceTask(state, incoming)
  const restored = readTaskCheckpoint(state, 'restore', cwd)
  assert.equal(reduceTask(restored, incoming), restored)
  assert.equal(reduceTask(restored, { ...incoming, sourceKind: 'github' }).revision, restored.revision + 1)
  assert.equal(restored.inputIds.length, 1)
  assert.match(restored.inputIds[0], /^[a-f0-9]{64}$/)
  assert.equal(readTaskCheckpoint({ ...state, inputIds: undefined }, 'restore', cwd).inputIds.length, 0)
  assert.throws(() => readTaskCheckpoint({ ...state, inputIds: ['forged'] }, 'restore', cwd), /fingerprint/)
})

test('input receipts are bounded and producer context never becomes observed-user-kind', () => {
  let state = initialTask('bounded', cwd)
  for (let i = 0; i < 140; i++) state = reduceTask(state, { kind: 'incoming', eventId: `message-${i}`, sourceKind: 'github' })
  assert.equal(state.inputIds.length, 128)
  assert.equal(state.source.kind, 'producer')
  assert.equal(state.understandingStatus, 'unassessed')
})

test('uncommitted step retries reinject; effective history deduplicates and compaction restores handoff', async () => {
  const listeners = new Map()
  registerTaskLifecycle({ on: (event, fn) => listeners.set(event, fn), tools: { register() {} }, commands: { register() {} } })
  const a = agent('surface'); define(a)
  let history = []
  a.session.deriveMessages = () => history
  const hook = listeners.get('agent/pre-step')
  const next = async () => ({ kind: 'enter', messages: [] })
  const one = await hook({ agent: a }, next)
  assert.equal(one.messages.length, 1)
  assert.equal(one.messages[0].source.summary, HANDOFF_SOURCE)
  assert.equal((await hook({ agent: a }, next)).messages.length, 1, 'an uncommitted attempt is not delivery')
  history = one.messages
  assert.equal((await hook({ agent: a }, next)).messages.length, 0)
  history = [] // native compaction replaces old effective nodes
  assert.equal((await hook({ agent: a }, next)).messages.length, 1)
  a.selectPreset('standard')
  assert.equal((await hook({ agent: a }, next)).messages.length, 0)
})

test('handoff action is read-only, bounded and unavailable to other presets', async () => {
  let tool
  registerTaskLifecycle({ on() {}, tools: { register: value => { tool = value } }, commands: { register() {} } })
  const a = agent('tool'); define(a)
  const revision = taskState(a).revision
  const value = await tool.execute({ action: 'handoff' }, { agent: a })
  assert.deepEqual(Object.keys(value.task).sort(), ['revision', 'status', 'taskId'])
  assert.equal(value.handoff.requirements[0].id, 'tests')
  assert.equal(taskState(a).revision, revision)
  a.selectPreset('standard')
  await assert.rejects(tool.execute({ action: 'handoff' }, { agent: a }), /Patchwork/)
})

test('continuation rejects correction, cancellation, degraded persistence and session replacement', () => {
  for (const change of [
    a => transitionTask(a, { kind: 'incoming', eventId: 'correction', sourceKind: 'user' }),
    a => transitionTask(a, { kind: 'cancel' }),
    a => { taskState(a).persistence = 'failed' },
    a => { a.session = { header: { id: 'different', cwd } } },
    a => a.selectPreset('standard'),
  ]) {
    const a = agent(); define(a)
    const lease = continuationLease(a)
    assert.equal(canContinueTask(a, lease), true)
    change(a)
    assert.equal(canContinueTask(a, lease), false)
  }
})

test('persisted duplicate delivery does not append a redundant task checkpoint', async () => {
  const records = []
  class Session { constructor() { this.header = { id: 'durable', cwd }; this.seq = 0 } eventAt(i) { return records[i] } }
  await initializeDiagnostics(null, { sessionApi: { Session, appendPluginRecord(s, type, data) { records.push({ type, data: structuredClone(data), ignorable: true }); s.seq++ } } })
  const a = scopedAgent({ session: new Session() })
  const event = { kind: 'incoming', eventId: 'delivery-once', sourceKind: 'user' }
  transitionTask(a, event); await flushTasks(a)
  assert.equal(taskState(a).inputIds.length, 1)
  assert.equal(Object.hasOwn(taskProjection(a), 'inputIds'), false)
  const restored = new Session(); restored.seq = records.length
  const b = scopedAgent({ session: restored })
  const before = records.length
  transitionTask(b, event); await flushTasks(b)
  assert.equal(records.length, before)
  assert.equal(taskState(b).revision, 1)
})

test('pending context is considered only for the latest complete handoff', () => {
  const a = agent(); define(a)
  const text = taskHandoffText(a)
  const m = value => ({ source: { kind: 'patchwork', summary: HANDOFF_SOURCE }, content: [{ type: 'text', text: value }] })
  assert.equal(hasTaskHandoff(a, text, [m(text)]), true)
  assert.equal(hasTaskHandoff(a, text, [m(text), m('outdated')]), false)
})
