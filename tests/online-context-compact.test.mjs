import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeTransition, completedIds, formatPlanSnapshot, validatePlan } from '../src/mechanisms/online-context-compact/plan.mjs'
import { decideCompaction } from '../src/mechanisms/online-context-compact/economics.mjs'

const step = (id, status, text = `do ${id}`) => ({ id, text, status })

test('a plan is only accepted when every step is unambiguous', () => {
  assert.equal(validatePlan({ steps: [step('a', 'completed'), step('b', 'in_progress')] }).ok, true)
  assert.equal(validatePlan(null).reason, 'plan-not-an-object')
  assert.equal(validatePlan({ steps: [] }).reason, 'plan-has-no-steps')
  assert.equal(validatePlan({ steps: 'nope' }).reason, 'plan-has-no-steps')
  assert.equal(validatePlan({ steps: Array.from({ length: 65 }, (_, i) => step(`s${i}`, 'pending')) }).reason, 'plan-exceeds-64-steps')
  assert.equal(validatePlan({ steps: [{ text: 'x', status: 'pending' }] }).reason, 'step-id-missing')
  assert.equal(validatePlan({ steps: [step('a', 'pending'), step('a', 'pending')] }).reason, 'step-id-duplicated:a')
  assert.equal(validatePlan({ steps: [{ id: 'a', text: '  ', status: 'pending' }] }).reason, 'step-text-missing:a')
  assert.equal(validatePlan({ steps: [step('a', 'pending', 'x'.repeat(401))] }).reason, 'step-text-too-long:a')
  assert.equal(validatePlan({ steps: [step('a', 'done')] }).reason, 'step-status-invalid:a')
})

test('a boundary only fires on a real transition into completed', () => {
  const before = [step('a', 'completed'), step('b', 'in_progress'), step('c', 'pending')]
  assert.deepEqual(completedIds(before), new Set(['a']))

  const after = [step('a', 'completed'), step('b', 'completed'), step('c', 'in_progress')]
  const transition = analyzeTransition(before, after)
  assert.deepEqual(transition.newlyCompleted, ['b'])
  assert.deepEqual(transition.warnings, [])

  // 重复提交同一份计划不应再产生边界，否则一次任务会被反复压缩。
  assert.deepEqual(analyzeTransition(after, after).newlyCompleted, [])
  assert.deepEqual(analyzeTransition(undefined, after).newlyCompleted, ['a', 'b'])
})

test('plan warnings surface ambiguous submissions', () => {
  const transition = analyzeTransition(
    [step('a', 'pending', 'first wording'), step('b', 'pending')],
    [step('a', 'in_progress', 'second wording'), step('b', 'in_progress')],
  )
  assert.ok(transition.warnings.includes('multiple-steps-in-progress:2'))
  assert.ok(transition.warnings.includes('step-text-changed:a'))
})

test('the snapshot is the model-visible plan', () => {
  assert.equal(
    formatPlanSnapshot([step('a', 'completed', 'ship it')]),
    ['<plan>', '- [completed] a: ship it', '</plan>'].join('\n'),
  )
})

const base = {
  contextTokens: 50_000,
  contextWindow: 200_000,
  writeTokens: 100_000,
  systemTokens: 0,
  keepRecentTokens: 20_000,
  tokensPerRequest: 5_000,
  cacheWriteReadRatio: 12.5,
}

test('a compaction that cannot shrink the context is refused', () => {
  const decision = decideCompaction({ ...base, writeTokens: 15_000 })
  assert.equal(decision.compact, false)
  assert.equal(decision.reason, 'non-positive-saving')
})

test('window pressure decides on its own', () => {
  const decision = decideCompaction({
    ...base,
    contextTokens: 100_000,
    contextWindow: 110_000,
    intervals: [],
    tokensPerRequest: 0,
  })
  assert.equal(decision.compact, true)
  assert.equal(decision.reason, 'window-pressure')
})

test('the first compaction is allowed a wider horizon', () => {
  // saving 80k, extra cache ratio 11.5 -> breakeven 14.375 requests.
  // three samples of 10 -> lower bound 10 -> expected 11; doubled to 22 for the first.
  const first = decideCompaction({ ...base, intervals: [10, 10, 10], isFirst: true })
  assert.equal(first.compact, true)
  assert.equal(first.reason, 'economic-first')
  assert.equal(first.breakeven, 14.375)
  assert.equal(first.horizon.expected, 11)

  const later = decideCompaction({ ...base, intervals: [10, 10, 10], isFirst: false })
  assert.equal(later.compact, false)
  assert.equal(later.reason, 'deferred-breakeven')
})

test('a later compaction must clear both the margin and the carried debt', () => {
  // 25 per boundary -> lower bound 25 -> unbounded 26; window allows 30 -> expected 26.
  const decision = decideCompaction({ ...base, intervals: [25, 25, 25], isFirst: false })
  assert.equal(decision.compact, true)
  assert.equal(decision.reason, 'economic')
  assert.equal(decision.horizon.expected, 26)

  // 已欠债务把这次压缩推到视界之外。
  const indebted = decideCompaction({ ...base, intervals: [25, 25, 25], isFirst: false, carriedDebtTokens: 3_000_000 })
  assert.equal(indebted.compact, false)
  assert.equal(indebted.reason, 'deferred-debt')
})

test('few samples halve the lower bound, and the window caps the horizon', () => {
  const few = decideCompaction({ ...base, intervals: [40, 40], isFirst: false })
  assert.equal(few.horizon.lowerBound, 20) // 两个样本不足，减半

  const capped = decideCompaction({ ...base, intervals: [100, 100, 100], isFirst: false })
  assert.equal(capped.horizon.unbounded, 101)
  assert.equal(capped.horizon.windowUpper, 30)
  assert.equal(capped.horizon.expected, 30)
})

test('without any horizon evidence a compaction is deferred', () => {
  const decision = decideCompaction({ ...base, intervals: [], tokensPerRequest: 0 })
  assert.equal(decision.compact, false)
  assert.equal(decision.reason, 'horizon-unavailable')
  assert.equal(decision.horizon.expected, null)
})
