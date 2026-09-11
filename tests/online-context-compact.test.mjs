import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyzeTransition, completedIds, formatPlanSnapshot, validatePlan } from '../src/mechanisms/online-context-compact/plan.mjs'
import { decideCompaction } from '../src/mechanisms/online-context-compact/economics.mjs'

// 状态落在宿主用户数据根下；指到临时目录，测试不污染真实 ~/.dsh。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-occ-home-'))
const { registerOnlineContextCompact } = await import('../src/mechanisms/online-context-compact/index.mjs')

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

let sessionSeq = 0

function harness({ contextWindow = 110_000, tokenTotal = 100_000, compactNow, sessionId } = {}) {
  const listeners = new Map()
  const definitions = []
  const followups = []
  const compactions = []
  // 每个 harness 一个独立会话 id：状态是落盘的，共用 id 会让测试互相污染。
  const id = sessionId ?? `occ-session-${(sessionSeq += 1)}`
  const ctx = {
    on(event, listener) {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
    },
    tools: { register: definition => definitions.push(definition) },
    get(name) {
      if (name === 'tokenMeter') return { measure: () => ({ totalTokens: tokenTotal }) }
      if (name === 'compaction') {
        return {
          compactNow: async (...args) => {
            compactions.push(args)
            return compactNow ? compactNow(...args) : { ok: true }
          },
        }
      }
      return undefined
    },
  }
  const agent = {
    session: { header: { id }, requestContext: () => ({ contextWindow }) },
    runMaintenance: task => task(new AbortController().signal),
    followup: message => followups.push(message),
  }
  registerOnlineContextCompact(ctx, { cacheWriteReadRatio: 12.5 })

  const emit = async (event, payload, next) => {
    for (const listener of listeners.get(event) ?? []) await listener(payload, next)
  }
  const submitPlan = steps =>
    definitions.find(definition => definition.name === 'update_plan').execute({ steps }, { agent })
  return { definitions, followups, compactions, emit, submitPlan, agent }
}

const PLAN_PENDING = [
  { id: 'a', text: 'write the code', status: 'pending' },
  { id: 'b', text: 'run the tests', status: 'pending' },
]
const PLAN_STEP_DONE = [
  { id: 'a', text: 'write the code', status: 'completed' },
  { id: 'b', text: 'run the tests', status: 'in_progress' },
]

test('a boundary under window pressure compacts once and continues the task', async () => {
  const h = harness()

  await h.submitPlan(PLAN_PENDING)
  await h.emit('agent/turn-stopping', { agent: h.agent })
  await h.emit('agent/status', { agent: h.agent, status: 'idle' })
  assert.equal(h.compactions.length, 0, 'no boundary yet, so nothing may compact')

  await h.submitPlan(PLAN_STEP_DONE)
  await h.emit('agent/turn-stopping', { agent: h.agent })
  await h.emit('agent/status', { agent: h.agent, status: 'idle' })

  assert.equal(h.compactions.length, 1, 'the boundary must compact exactly once')
  assert.equal(h.followups.length, 1, 'the task must continue after compaction')
  assert.equal(h.followups[0].source.kind, 'plugin')
  assert.match(h.followups[0].content[0].text, /Rebuild your plan/)
  assert.equal(h.followups[0].role, 'user')
})

test('a boundary without an economic case is evaluated and declined', async () => {
  // 窗口 200k 时没有压力；轨迹里还没有间隔样本，因此视界不可得 -> 推迟。
  const h = harness({ contextWindow: 200_000 })
  await h.submitPlan(PLAN_STEP_DONE)
  await h.emit('agent/turn-stopping', { agent: h.agent })
  await h.emit('agent/status', { agent: h.agent, status: 'idle' })
  assert.equal(h.compactions.length, 0)
  assert.equal(h.followups.length, 0)
})

test('resubmitting the same finished plan does not compact again', async () => {
  const h = harness()
  await h.submitPlan(PLAN_STEP_DONE)
  await h.emit('agent/turn-stopping', { agent: h.agent })
  await h.emit('agent/status', { agent: h.agent, status: 'idle' })
  assert.equal(h.compactions.length, 1)

  await h.submitPlan(PLAN_STEP_DONE)
  await h.emit('agent/turn-stopping', { agent: h.agent })
  await h.emit('agent/status', { agent: h.agent, status: 'idle' })
  assert.equal(h.compactions.length, 1, 'a repeated submission is not a new boundary')
})

test('a failing compaction is contained and does not continue the task', async () => {
  const h = harness({
    compactNow: async () => {
      throw new Error('compaction busy')
    },
  })
  await h.submitPlan(PLAN_STEP_DONE)
  await h.emit('agent/turn-stopping', { agent: h.agent })
  await h.emit('agent/status', { agent: h.agent, status: 'idle' })
  assert.equal(h.followups.length, 0)
})

test('requests are counted through the request waterfall', async () => {
  const h = harness()
  let passed = false
  await h.emit('agent/request', { agent: h.agent }, async () => {
    passed = true
    return { kind: 'delegated' }
  })
  assert.equal(passed, true, 'the listener must delegate instead of taking over the request')
})

test('an invalid plan is rejected loudly', async () => {
  const h = harness()
  await assert.rejects(() => h.submitPlan([{ id: 'a', text: 'x', status: 'done' }]), /invalid plan/)
})
