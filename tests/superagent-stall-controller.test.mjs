import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { scopedAgent } from './helpers/agent.mjs'
import { initialSuperagent, setSuperagentStallConfig } from '../src/superagent/state.mjs'
import { SuperagentController, managedWorker } from '../src/superagent/controller.mjs'

const turn = () => new Promise(resolve => setImmediate(resolve))
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await turn() } assert.fail('condition did not settle') }
const job = (id, mode = 'read', dependencies = []) => ({ id, title: id, prompt: `Do ${id}`, mode, dependencies })

// Deterministic fake backend: children stay pending until the test settles or escalations act.
async function fixture({ thresholdMs = 600000 } = {}) {
  setSuperagentStallConfig(thresholdMs)
  const cwd = await mkdtemp(join(tmpdir(), 'pw-stall-'))
  const children = [], records = [], notices = []
  const runtime = {
    getProvider: () => ({ prepareContinuable() {} }), resolveMaxDepth: () => 1,
    async startActivation(spec) {
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
  const persist = async (_owner, value) => { records.push(structuredClone(value)) }
  const c = new SuperagentController(owner, { persist, restore: () => initialSuperagent(owner.session.header.id) })
  return { c, owner, cwd, children, notices, records }
}

test('a job with no progress escalates to review, then blocked, and the parent is told', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a', 'read')], 0)
  await until(() => f.children.length === 1)
  const started = Date.now()
  assert.ok(f.c.snapshot().jobs[0].stalledSec < 5, '刚派发的作业不停滞')

  // 第一次扫描：超阈值 → 一级 review
  await f.c.sweep(started + 601000)
  await until(() => f.c.state.jobs[0].status === 'review')
  assert.equal(f.c.state.jobs[0].stall.level, 1)
  const stallNotice = f.notices.find(n => n.content[0].text.includes('executor-stalled'))
  assert.ok(stallNotice, '升级必须通知父会话')
  assert.match(stallNotice.content[0].text, /"level":1/)

  // 第二次扫描：仍无进展 → 二级 blocked
  await f.c.sweep(started + 1202000)
  await until(() => f.c.state.jobs[0].status === 'blocked')
  assert.equal(f.c.state.jobs[0].stall.level, 2)

  // 阈值内不升级
  const f2 = await fixture({ thresholdMs: 600000 }); t.after(() => f2.c.close('test'))
  await f2.c.submit([job('b', 'read')], 0)
  await until(() => f2.children.length === 1)
  await f2.c.sweep(Date.now() + 1000)
  assert.equal(f2.c.state.jobs[0].status, 'running')
  assert.equal(f2.notices.length, 0)
})

test('a report refreshes progress so the sweep leaves the job alone', async t => {
  const f = await fixture(); t.after(() => f.c.close('test'))
  await f.c.submit([job('a', 'read')], 0)
  await until(() => f.children.length === 1)
  const binding = managedWorker(f.children[0].child)
  await f.c.report(f.children[0].child, { status: 'waiting', summary: 'needs input' })
  assert.equal(f.c.state.jobs[0].report.status, 'waiting')
  const refreshed = Date.parse(f.c.state.jobs[0].progressAt)
  await f.c.sweep(refreshed + 300000)
  await turn()
  assert.equal(f.c.state.jobs[0].status, 'running', '刚回报过的作业不被判停滞')
  assert.equal(f.c.state.jobs[0].stall, null)
  assert.ok(binding, 'worker binding still owned')
})

test('threshold zero disables escalation entirely', async t => {
  const f = await fixture({ thresholdMs: 0 }); t.after(() => f.c.close('test'))
  await f.c.submit([job('a', 'read')], 0)
  await until(() => f.children.length === 1)
  await f.c.sweep(Date.now() + 99999999)
  assert.equal(f.c.state.jobs[0].status, 'running')
  assert.equal(f.notices.length, 0)
})
