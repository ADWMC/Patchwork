import test from 'node:test'
import assert from 'node:assert/strict'
import { scopedAgent } from './helpers/agent.mjs'
import { initialTask, readTaskCheckpoint, reduceTask } from '../src/task/state.mjs'
import { transitionTask, taskProjection } from '../src/task/store.mjs'
import { taskHandoff } from '../src/task/handoff.mjs'

const cwd = process.cwd()

test('task brief is bounded, restored, projected and included in handoff', () => {
  let state = initialTask('brief', cwd)
  state = reduceTask(state, { kind: 'define', baseRevision: 0, data: {
    title: 'Fix sum', phase: 'implement', requirements: [],
    brief: { goal: 'Fix sum', successCriteria: ['npm test'], unknowns: ['callers'], assumptions: ['tests are authoritative'], budget: { maxSteps: 12, maxSearchCalls: 6, maxTokens: 60000 } },
  } })
  assert.equal(state.brief.goal, 'Fix sum')
  assert.deepEqual(state.brief.successCriteria, ['npm test'])
  assert.equal(state.brief.budget.maxSearchCalls, 6)
  const restored = readTaskCheckpoint(state, 'brief', cwd)
  assert.deepEqual(restored.brief, state.brief)
  const agent = scopedAgent({ session: { header: { id: 'brief-agent', cwd } } })
  transitionTask(agent, { kind: 'define', baseRevision: 0, data: { title: 'Fix sum', phase: 'implement', requirements: [], brief: state.brief } })
  assert.equal(taskProjection(agent).brief.goal, 'Fix sum')
  const handoff = taskHandoff(agent)
  assert.equal(handoff.brief.goal, 'Fix sum')
  assert.equal(handoff.brief.budget.maxSteps, 12)
})

test('task brief rejects oversized text and invalid budgets', () => {
  const base = { title: 'x', phase: 'implement', requirements: [] }
  assert.throws(() => reduceTask(initialTask('bad', cwd), { kind: 'define', baseRevision: 0, data: { ...base, brief: { goal: 'x'.repeat(501) } } }), /brief/)
  assert.throws(() => reduceTask(initialTask('bad', cwd), { kind: 'define', baseRevision: 0, data: { ...base, brief: { budget: { maxSteps: 0 } } } }), /budget/)
  assert.throws(() => reduceTask(initialTask('bad', cwd), { kind: 'define', baseRevision: 0, data: { ...base, brief: { successCriteria: Array.from({ length: 13 }, () => 'x') } } }), /bounded list/)
})
