import test from 'node:test'
import assert from 'node:assert/strict'
import { defineJobs, initialSuperagent, sweepStalls, stalledSeconds, superagentStallConfig, setSuperagentStallConfig, touchProgress } from '../src/superagent/state.mjs'

const THRESHOLD = 600000
const now = Date.parse('2026-11-05T12:00:00.000Z')

function queue() {
  let state = initialSuperagent('owner')
  state = defineJobs(state, [
    { id: 'a', title: 'A', prompt: 'do a', mode: 'read' },
    { id: 'b', title: 'B', prompt: 'do b', mode: 'read' },
    { id: 'c', title: 'C', prompt: 'do c', mode: 'read' },
  ])
  return state
}

test('stalled jobs escalate along the ladder and the sweep is pure', () => {
  const base = queue()
  const stale = base.jobs.map(job => ({ ...job, status: 'running', progressAt: new Date(now - THRESHOLD - 1000).toISOString() }))
  const state = { ...base, jobs: stale }
  const first = sweepStalls(state, { thresholdMs: THRESHOLD, now })
  assert.notEqual(first, state, '超阈值必须产出新 state')
  assert.equal(first.jobs[0].status, 'review')
  assert.equal(first.jobs[0].stall.level, 1)
  assert.match(first.jobs[0].stall.reason, /no progress for \d+s/)
  assert.equal(first.revision, state.revision + 1)

  const second = sweepStalls(first, { thresholdMs: THRESHOLD, now: now + THRESHOLD + 1000 })
  assert.equal(second.jobs[0].status, 'blocked', '一级之后仍无进展升二级')
  assert.equal(second.jobs[0].stall.level, 2)

  const third = sweepStalls(second, { thresholdMs: THRESHOLD, now: now + 3 * THRESHOLD })
  assert.equal(third, second, '二级是顶点，不继续升级')
})

test('fresh progress, terminal and queued jobs are never escalated', () => {
  const base = queue()
  const jobs = base.jobs.map((job, index) => ({
    ...job,
    status: ['running', 'done', 'queued'][index],
    progressAt: new Date(now - (index === 0 ? 1000 : THRESHOLD * 2)).toISOString(),
  }))
  const state = { ...base, jobs }
  assert.equal(sweepStalls(state, { thresholdMs: THRESHOLD, now }), state, '刚有推进/终态/排队的作业不动')
  const cleared = { ...base, jobs: base.jobs.map(job => touchProgress({ ...job, status: 'running', stall: { level: 1, since: 'x' } }, new Date(now).toISOString())) }
  assert.equal(sweepStalls(cleared, { thresholdMs: THRESHOLD, now }), cleared, '进度刷新后停滞标记已清')
})

test('threshold zero disables the sweep and stalledSeconds is bounded', () => {
  const base = queue()
  const state = { ...base, jobs: base.jobs.map(job => ({ ...job, status: 'running', progressAt: new Date(now - 999999).toISOString() })) }
  assert.equal(sweepStalls(state, { thresholdMs: 0, now }), state)
  assert.equal(stalledSeconds({ progressAt: new Date(now - 5000).toISOString() }, now), 5)
  assert.equal(stalledSeconds({}, now), 0)
  assert.equal(stalledSeconds({ progressAt: 'not-a-date' }, now), 0)
})

test('the stall threshold is configurable and closable', () => {
  assert.equal(superagentStallConfig().thresholdMs, 600000)
  setSuperagentStallConfig(0)
  assert.equal(superagentStallConfig().thresholdMs, 0)
  setSuperagentStallConfig(120000)
  assert.equal(superagentStallConfig().thresholdMs, 120000)
  setSuperagentStallConfig(600000)
  assert.equal(superagentStallConfig().thresholdMs, 600000)
})
