import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialTask, reduceTask, readTaskCheckpoint } from '../src/task/state.mjs'
import { taskState, taskProjection, transitionTask, flushTasks } from '../src/task/store.mjs'
import { executeAcceptance, registerArtifact } from '../src/task/acceptance.mjs'
import { inspectAction } from '../src/task/action-check.mjs'
import { commandOutcome } from '../src/util/tool-outcome.mjs'
import { scopedAgent } from './helpers/agent.mjs'
import { initializeDiagnostics } from '../src/logging/session-log.mjs'
import { noteShellEvidence, shouldHintEvidence } from '../src/quality/evidence-gate.mjs'

const workspace = await mkdtemp(join(tmpdir(), 'patchwork-task-'))
const requirement = { id: 'tests', label: 'Run required checks', kind: 'command' }
function agent(id = 'task-test') { return scopedAgent({ session: { header: { id, cwd: workspace } }, ctx: { tools: { execute: async () => ({ value: { exitCode: 0 }, content: [] }) } } }) }
function define(a, requirements = [requirement], extra = {}) {
  return transitionTask(a, { kind: 'define', baseRevision: taskState(a).revision, data: { title: 'Task under test', phase: 'implement', requirements, ...extra } })
}
const execution = { callId: 'check-1', rootCallId: 'check-1', signal: new AbortController().signal }
const check = a => ({ action: 'check', baseRevision: taskState(a).revision, id: 'tests', tool: 'pwsh', arguments: { command: 'exit 0', description: 'test' } })

test('unknown exit, AF failure, timeout and cancellation remain distinct from pass', () => {
  assert.equal(commandOutcome({ isError: false }).outcome, 'unknown')
  assert.equal(commandOutcome({ value: { thenRun: { status: 'failed', exitCode: 7 } } }).outcome, 'failed')
  assert.equal(commandOutcome({ value: { timedOut: true, exitCode: 0 } }).outcome, 'failed')
  assert.equal(commandOutcome({ value: { aborted: true } }).outcome, 'cancelled')
  assert.equal(commandOutcome({ value: { exitCode: 0 } }).outcome, 'passed')
})
test('schema alone never means human authorization or ready', () => {
  const a = agent(); define(a, [])
  assert.equal(taskState(a).status, 'in-progress')
  assert.equal(taskState(a).understandingStatus, 'stated')
  assert.equal(taskState(a).source.kind, 'unknown')
  assert.throws(() => define(a, [{ ...requirement, coverage: [] }]), /coverage/)
  assert.throws(() => define(a, [requirement, requirement]), /duplicate/)
})
test('a real bound command is required and model supplied success cannot pass semantic review', async () => {
  const a = agent(); define(a)
  assert.equal(taskState(a).status, 'in-progress')
  const { receipt } = await executeAcceptance(a, check(a), execution)
  assert.equal(receipt.outcome, 'passed'); assert.equal(taskState(a).status, 'ready')
  const semantic = agent('writing'); define(semantic, [{ ...requirement, kind: 'semantic' }])
  transitionTask(semantic, { kind: 'assessment', id: 'tests', verdict: 'supported' })
  assert.equal(taskState(semantic).status, 'partial'); assert.equal(taskState(semantic).requirements[0].status, 'unknown')
})
test('declared instance is not promoted to a verified environment by a successful command', async () => {
  const a = agent(); define(a, [requirement], { instance: { id: 'lab', endpoint: 'http://127.0.0.1:4323/private?secret=x' } })
  await executeAcceptance(a, check(a), execution)
  assert.equal(taskState(a).requirements[0].status, 'unknown')
  assert.equal(taskState(a).instance.endpoint, 'http://127.0.0.1:4323')
})
test('corrections invalidate selected dependencies and reject old revisions', async () => {
  const a = agent(); define(a, [requirement, { ...requirement, id: 'other' }])
  await executeAcceptance(a, check(a), execution)
  const rev = taskState(a).revision
  transitionTask(a, { kind: 'correct', baseRevision: rev, data: { title: 'Corrected target', phase: 'implement', affected: ['other'] } })
  assert.equal(taskState(a).requirements[0].status, 'passed')
  assert.throws(() => transitionTask(a, { kind: 'cancel', baseRevision: rev }), /conflict/)
  transitionTask(a, { kind: 'incoming', eventId: 'new-user-event', sourceKind: 'user' })
  assert.equal(taskState(a).requirements[0].status, 'stale')
  assert.equal(taskState(a).source.kind, 'observed-user-kind')
})
test('correction inherits existing title, phase and instance without weakening version or field validation', async () => {
  const a = agent('correction-defaults')
  define(a, [requirement], { instance: { id: 'lab', endpoint: 'http://127.0.0.1:4323' } })
  const before = taskProjection(a)
  transitionTask(a, { kind: 'incoming', eventId: 'new-requirements', sourceKind: 'user' })
  const revision = taskState(a).revision
  transitionTask(a, { kind: 'correct', baseRevision: revision, data: { affected: ['tests'] } })
  assert.equal(taskState(a).title, before.title)
  assert.equal(taskState(a).phase, before.phase)
  assert.deepEqual(taskState(a).instance, before.instance)
  assert.equal(taskState(a).understandingStatus, 'stated')
  assert.notEqual(taskState(a).status, 'ready')
  assert.throws(() => transitionTask(a, { kind: 'correct', baseRevision: revision, data: {} }), /revision conflict/)
  assert.throws(() => transitionTask(a, { kind: 'correct', data: { phase: 'bogus-phase' } }), /phase must be/)
  assert.throws(() => transitionTask(a, { kind: 'correct', data: { title: '' } }), /requires title/)
  assert.throws(() => transitionTask(a, { kind: 'correct', data: { affected: ['unknown'] } }), /unknown affected/)
})

test('old async completion is retained but cannot satisfy corrected task', async () => {
  const a = agent(); define(a)
  a.ctx.tools.execute = async () => { transitionTask(a, { kind: 'incoming', eventId: 'correction', sourceKind: 'user' }); return { value: { exitCode: 0 } } }
  const { receipt } = await executeAcceptance(a, check(a), execution)
  assert.equal(receipt.current, false); assert.notEqual(taskState(a).status, 'ready')
})
test('coverage is a set of required units, not a success count', async () => {
  const a = agent(); define(a, [{ ...requirement, coverage: ['first', 'last'] }])
  await executeAcceptance(a, { ...check(a), unit: 'first' }, execution)
  assert.notEqual(taskState(a).status, 'ready')
  await executeAcceptance(a, { ...check(a), unit: 'last' }, { ...execution, callId: 'check-2' })
  assert.equal(taskState(a).status, 'ready')
})
test('artifact structure is useful without a shell, but later changes become stale', async () => {
  const a = agent(); const path = join(workspace, 'note.md'); await writeFile(path, '# Title\nUseful note')
  define(a, [{ ...requirement, kind: 'artifact', targets: ['note'] }])
  await registerArtifact(a, { id: 'note', path }, taskState(a).revision)
  await executeAcceptance(a, { baseRevision: taskState(a).revision, id: 'tests', rules: { anchors: ['# Title'], maxLength: 40 } }, execution)
  assert.equal(taskProjection(a).status, 'ready')
  noteShellEvidence({ agent: a })
  assert.equal(shouldHintEvidence(a.session.header.id, '已完成'), false)
  await writeFile(path, '# Changed\nUseful note')
  assert.equal(shouldHintEvidence(a.session.header.id, '已完成'), true)
  assert.equal(taskProjection(a).requirements[0].status, 'stale')
  await assert.rejects(registerArtifact(a, { id: 'note', path: 'relative.md' }, taskState(a).revision), /absolute/)
})
test('one-off reads can skip task registration but structured mutations cannot', async () => {
  const a = agent()
  assert.equal((await inspectAction({ agent: a, name: 'read' })).reason, undefined)
  assert.match((await inspectAction({ agent: a, name: 'write', arguments: { file_path: join(workspace, 'new.md') } })).reason, /register current task/)
})

test('work and reference targets, plan and analysis phases are checked independently', async () => {
  const a = agent(); const reference = join(workspace, 'reference')
  define(a, [], { references: [reference], phase: 'plan' })
  const inspect = file_path => inspectAction({ agent: a, name: 'write', arguments: { file_path } })
  assert.match((await inspect(join(workspace, '..', 'outside.md'))).reason, /outside/)
  assert.match((await inspect(join(reference, 'readme.md'))).reason, /read-only/)
  assert.match((await inspect(join(workspace, 'src.mjs'))).reason, /Markdown/)
  assert.equal((await inspect(join(workspace, 'plan.md'))).reason, undefined)
  define(a, [], { phase: 'analysis' })
  assert.match((await inspect(join(workspace, 'plan.md'))).reason, /read-only/)
  assert.match((await inspectAction({ agent: a, name: 'pwsh' }, 'strict')).reason, /unsupported/)
})
test('junction to outside workspace does not become an allowed write', async () => {
  const a = agent(); define(a)
  const outside = await mkdtemp(join(tmpdir(), 'patchwork-outside-'))
  const link = join(workspace, 'external-junction'); await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
  const result = await inspectAction({ agent: a, name: 'write', arguments: { file_path: join(link, 'new.txt') } })
  assert.match(result.reason, /outside/)
})

test('new input requires a restated contract before structured mutation', async () => {
  const a = agent(); define(a)
  const exec = { agent: a, name: 'write', arguments: { file_path: join(workspace, 'current.md') } }
  transitionTask(a, { kind: 'incoming', eventId: 'followup', sourceKind: 'user' })
  assert.match((await inspectAction(exec)).reason, /restate/)
  transitionTask(a, { kind: 'correct', data: { title: 'Restated current task', phase: 'implement' } })
  assert.equal((await inspectAction(exec)).reason, undefined)
})

test('experience candidates require retained failed evidence and never activate themselves', async () => {
  const a = agent(); define(a)
  const data = { id: 'candidate', sourceReceiptId: 'missing', trigger: 'Repeated failure', label: 'Try a different method' }
  assert.throws(() => transitionTask(a, { kind: 'candidate', data }), /retained failure/)
  const passed = await executeAcceptance(a, check(a), execution)
  assert.throws(() => transitionTask(a, { kind: 'candidate', data: { ...data, sourceReceiptId: passed.receipt.id } }), /retained failure/)
  a.ctx.tools.execute = async () => ({ value: { exitCode: 7 } })
  const { receipt } = await executeAcceptance(a, check(a), { ...execution, callId: 'failed-candidate' })
  transitionTask(a, { kind: 'candidate', data: { ...data, sourceReceiptId: receipt.id } })
  assert.equal(taskState(a).candidates[0].status, 'candidate')
  assert.notEqual(taskState(a).status, 'ready')
})
test('three failures stop repeated execution, correction permits a revised method', async () => {
  const a = agent(); define(a); let calls = 0
  a.ctx.tools.execute = async () => { calls++; return { value: { exitCode: 7 } } }
  for (let i = 0; i < 3; i++) await executeAcceptance(a, check(a), { ...execution, callId: `failure-${i}` })
  assert.equal(taskState(a).status, 'blocked')
  await assert.rejects(executeAcceptance(a, check(a), execution), /repeated failure/)
  assert.equal(calls, 3)
  transitionTask(a, { kind: 'correct', data: { title: 'Revised method', phase: 'verify', affected: ['tests'] } })
  await executeAcceptance(a, check(a), execution); assert.equal(calls, 4)
})
test('native checkpoint restores separately from model context; fork does not inherit instance', async () => {
  const records = []
  class Session { constructor(id = 'native') { this.header = { id, cwd: workspace }; this.seq = 0 } eventAt(i) { return records[i] } }
  await initializeDiagnostics(null, { sessionApi: { Session, appendPluginRecord(session, type, data) { records.push({ type, data: structuredClone(data), ignorable: true }); return session.seq++ } } })
  const a = scopedAgent({ session: new Session(), ctx: { tools: { execute: async () => ({ value: { exitCode: 0 } }) } } })
  define(a); await executeAcceptance(a, check(a), execution); await flushTasks(a)
  const restored = new Session(); restored.seq = records.length
  const b = scopedAgent({ session: restored })
  assert.equal(taskState(b).status, 'ready'); assert.equal(taskState(b).persistence, 'native')
  const fork = new Session('fork'); fork.header.parentSession = 'native'; fork.seq = records.length
  const c = scopedAgent({ session: fork })
  assert.notEqual(taskState(c).status, 'ready'); assert.equal(taskState(c).instance, null)
  assert.equal(taskState(c).source.kind, 'restored')
  a.selectPreset('standard'); assert.equal(taskProjection(a), null)
  assert.throws(() => transitionTask(a, { kind: 'cancel' }), /Patchwork/)
})
test('corrupt/large restore cannot silently grant empty full permissions', () => {
  const a = scopedAgent({ session: { header: { id: 'bad', cwd: workspace }, seq: 1, eventAt: () => ({ type: 'plugin:patchwork/task', ignorable: true, data: {} }) } })
  assert.equal(taskState(a).status, 'blocked'); assert.equal(taskState(a).persistence, 'failed')
  assert.throws(() => transitionTask(a, { kind: 'cancel' }), /degraded/)
  const initial = initialTask('safe', workspace)
  assert.equal(readTaskCheckpoint({ ...initial, status: 'ready' }, 'safe', workspace).status, 'in-progress')
})
