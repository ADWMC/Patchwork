import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { KEEP_RECENT_TOKENS, SUMMARY_TOKEN_ESTIMATE } from './config.mjs'
import { record } from '../../ui/mechanism-stats.mjs'
import { decideCompaction } from './economics.mjs'
import { analyzeTransition } from './plan.mjs'
import { loadState, recordBoundary, saveState } from './state.mjs'
import { registerPlanTool } from './tools.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../../scope.mjs'
import { logDiagnostic } from '../../logging/session-log.mjs'
import { canContinueTask, continuationLease, taskHandoffText } from '../../task/handoff.mjs'

function sessionIdOf(agent) {
  const id = agent?.session?.header?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

function averageInterval(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return 0
  return intervals.reduce((sum, value) => sum + value, 0) / intervals.length
}

/**
 * Online Context Compact 的生命周期。
 *
 * 时序是本机制在 DSH 上最需要说明的地方：`compactNow` **要求 agent 空闲**，
 * 而 turn 边界不是空闲点。所以路径是
 * **边界 → turn 收尾（此处只评估）→ 真正 idle → compactNow → followup 续跑**，
 * 而不是 SoL-Pi 的「turn 边界直接压缩」。净效果一致（在语义边界压缩并自动继续），
 * 中间多一步收敛。
 *
 * 所有监听器都自带兜底：本机制是优化项，任何失败都不得影响 agent 的正常运行。
 */
export function registerOnlineContextCompact(ctx, config = {}) {
  const states = new Map()
  const boundaries = new Set()
  const ready = new Set()
  const inFlight = new Set()
  const updates = new Map()
  const leases = new Map()
  const active = new Map()
  const interrupt = sessionId => {
    ready.delete(sessionId)
    boundaries.delete(sessionId)
    leases.delete(sessionId)
    active.get(sessionId)?.abort(new DOMException('task or composition changed', 'AbortError'))
  }
  ctx.on('agent/inbox/inserted', ({ agent, message }) => {
    if (isPatchworkAgent(agent) && message?.source?.kind !== 'patchwork') interrupt(sessionIdOf(agent))
  })
  ctx.on('agent-preset/selected', sessionId => interrupt(sessionId))
  ctx.on('agent/disposed', ({ agent }) => interrupt(sessionIdOf(agent)))
  ctx.effect?.(() => () => { for (const controller of active.values()) controller.abort(); active.clear() }, 'patchwork: compact cancellation')

  const stateFor = async sessionId => {
    if (!states.has(sessionId)) states.set(sessionId, loadState(sessionId))
    return states.get(sessionId)
  }

  // Serialize read-modify-write operations within one session, including first load.
  const update = (sessionId, transform) => {
    const work = (updates.get(sessionId) ?? Promise.resolve()).then(async () => {
      const next = await transform(await stateFor(sessionId))
      await saveState(sessionId, next)
      states.set(sessionId, Promise.resolve(next))
      return next
    })
    const tail = work.catch(() => {})
    updates.set(sessionId, tail)
    void tail.then(() => { if (updates.get(sessionId) === tail) updates.delete(sessionId) })
    return work
  }

  registerPlanTool(ctx, async ({ steps, exec }) => {
    const sessionId = sessionIdOf(exec.agent)
    if (!sessionId) return {}
    const lease = continuationLease(exec.agent)
    let boundary = false
    await update(sessionId, state => {
      const transition = analyzeTransition(state.plan, steps)
      let next = { ...state, plan: steps, completed: transition.completed }
      if (transition.newlyCompleted.length > 0) {
        next = recordBoundary(next, next.requests)
        boundary = true
      }
      return next
    })
    if (boundary && canContinueTask(exec.agent, lease)) {
      boundaries.add(sessionId)
      leases.set(sessionId, lease)
      logDiagnostic(ctx, exec, { mechanism: 'occ', event: 'boundary', reason: 'plan-boundary', remaining: steps.filter(step => step.status !== 'completed').length })
    }
    return {}
  })

  // Count an admitted stream, not request assembly that may fail before any call.
  ctx.on('agent/assistant-stream', async payload => {
    if (!isPatchworkAgent(payload?.agent) || payload?.frame?.type !== 'start') return
    try {
      const sessionId = sessionIdOf(payload?.agent)
      if (sessionId) {
        const contextTokens = measureContextTokens(ctx, payload.agent)
        await update(sessionId, state => {
          const delta = state.lastContextTokens === null ? 0 : contextTokens - state.lastContextTokens
          return {
            ...state, requests: state.requests + 1,
            lastContextTokens: contextTokens,
            tokenDeltas: delta > 0 ? [...state.tokenDeltas, delta].slice(-20) : state.tokenDeltas,
            carriedDebtTokens: Math.max(0, state.carriedDebtTokens - state.debtRepaymentTokens),
          }
        })
      }
    } catch (error) {
      // 计数失败不改变任何决策的安全性，只是视界估计会更保守
      logDiagnostic(ctx, payload.agent, { mechanism: 'occ', event: 'failure', level: 'warn', reason: 'state-update-failed', error })
    }
  })

  // turn 收尾：此处**不是**空闲点，只做评估与标记。
  ctx.on('agent/turn-stopping', async payload => {
    if (!isPatchworkAgent(payload?.agent)) return
    try {
      await evaluateAtTurnEnd(ctx, payload?.agent, config, { update, boundaries, ready, leases })
    } catch (error) {
      // 评估失败等同于「不压缩」
      logDiagnostic(ctx, payload.agent, { mechanism: 'occ', event: 'failure', level: 'warn', reason: 'evaluation-failed', error })
    }
  })

  // 真正空闲后才动手压缩，并在成功后让任务继续。
  ctx.on('agent/status', async payload => {
    if (!isPatchworkAgent(payload?.agent)) return
    if (payload?.status !== 'idle') return
    try {
      await compactWhenReady(ctx, payload?.agent, config, { ready, boundaries, inFlight, update, leases, active })
    } catch (error) {
      // 压缩失败等同于「本次不压缩」
      logDiagnostic(ctx, payload.agent, { mechanism: 'occ', event: 'failure', level: 'warn', reason: 'compact-failed', error })
    }
  })
}

async function evaluateAtTurnEnd(ctx, agent, config, { update, boundaries, ready, leases }) {
  const sessionId = sessionIdOf(agent)
  if (!sessionId || !boundaries.has(sessionId)) return
  if (!canContinueTask(agent, leases.get(sessionId))) {
    boundaries.delete(sessionId)
    ready.delete(sessionId)
    return
  }

  let compact = false
  let detail = {}
  const state = await update(sessionId, state => {
    const remaining = state.plan.filter(step => step.status !== 'completed').length
    if (remaining === 0) return { ...state, lastDecision: 'plan-complete' }
    const contextTokens = measureContextTokens(ctx, agent)
    const keepRecentTokens = effectiveRetention(ctx, agent, config)
    const decision = decideCompaction({
      contextTokens,
      contextWindow: readContextWindow(agent),
      writeTokens: contextTokens,
      // Fixed system nodes cannot be removed; tool schemas are a conservative estimate.
      systemTokens: measureFixedTokens(ctx, agent),
      memoTokens: SUMMARY_TOKEN_ESTIMATE,
      keepRecentTokens,
      tokensPerRequest: averageInterval(state.tokenDeltas),
      intervals: state.intervals,
      boundariesRemaining: remaining,
      cacheWriteReadRatio: config.cacheWriteReadRatio ?? 0,
      isFirst: state.compactions === 0,
      carriedDebtTokens: state.carriedDebtTokens,
    })
    compact = decision.compact
    detail = { contextTokens, keepRecentTokens, breakeven: decision.breakeven, expectedRequests: decision.horizon?.expected }
    return { ...state, lastDecision: decision.reason, lastSaving: decision.saving ?? null, lastKeepRecentTokens: keepRecentTokens }
  })
  logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'decision', reason: state.lastDecision, ...detail,
    estimatedSaving: state.lastSaving, requests: state.requests, carriedDebtTokens: state.carriedDebtTokens,
    remaining: state.plan.filter(step => step.status !== 'completed').length })
  if (state.lastDecision === 'plan-complete') boundaries.delete(sessionId)
  if (compact) ready.add(sessionId)
  else ready.delete(sessionId)
}

async function compactWhenReady(ctx, agent, config, { ready, boundaries, inFlight, update, leases, active }) {
  const sessionId = sessionIdOf(agent)
  if (!sessionId || !ready.has(sessionId) || !boundaries.has(sessionId) || inFlight.has(sessionId)) return
  const lease = leases.get(sessionId)
  if (!canContinueTask(agent, lease)) {
    ready.delete(sessionId)
    boundaries.delete(sessionId)
    logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'skipped', reason: 'task-changed' })
    return
  }

  const compaction = compactionFor(ctx, agent)
  if (!compaction?.compactNow) {
    logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'skipped', level: 'warn', reason: 'compactor-unavailable' })
    return
  }

  ready.delete(sessionId)
  inFlight.add(sessionId)
  const controller = new AbortController()
  active.set(sessionId, controller)
  try {
    requirePatchworkAgent(agent)
    const before = measureContextTokens(ctx, agent)
    const started = Date.now()
    logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'start', reason: 'enabled', contextTokens: before })
    // The host compactNow owns runMaintenance. Wrapping it would re-enter its lock.
    const result = await compaction.compactNow(agent, controller.signal)
    if (result === null || result === undefined) {
      boundaries.delete(sessionId)
      await update(sessionId, state => ({ ...state, lastDecision: 'compact-noop' }))
      logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'noop', reason: 'compact-noop', elapsedMs: Date.now() - started })
      return
    }
    const saving = Math.max(0, before - measureContextTokens(ctx, agent))
    boundaries.delete(sessionId)
    const state = await update(sessionId, state => ({
      ...state,
      compactions: state.compactions + 1,
      carriedDebtTokens: state.carriedDebtTokens + before * Math.max(0, (config.cacheWriteReadRatio ?? 0) - 1),
      debtRepaymentTokens: saving,
      lastContextTokens: null,
      lastCompactedAt: new Date().toISOString(),
    }))
    logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'success', reason: 'compacted', contextTokens: before,
      afterTokens: measureContextTokens(ctx, agent), measuredSaving: saving, elapsedMs: Date.now() - started, carriedDebtTokens: state.carriedDebtTokens })
    if (isPatchworkAgent(agent)) record('onlineContextCompact', 'compactions')
    if (!canContinueTask(agent, lease) || controller.signal.aborted) {
      logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'skipped', reason: 'task-changed' })
      return
    }
    if (!state.plan.some(step => step.status !== 'completed')) return
    agent.followup(
      createUserMessage({
        content: [{
          type: 'text',
          text: 'The context was compacted at a completed plan step. Rebuild your plan from the current state and continue the task; do not restate work that is already done.\n' + taskHandoffText(agent),
        }],
        source: { kind: 'patchwork', form: 'notice', summary: 'context compacted; rebuild the plan' },
      }),
    )
    logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'continued', reason: 'continuation' })
  } catch (error) {
    logDiagnostic(ctx, agent, { mechanism: 'occ', event: 'failure', level: 'warn', reason: 'compact-failed', error })
    await update(sessionId, state => ({ ...state, lastDecision: 'compact-failed' }))
  } finally {
    active.delete(sessionId)
    inFlight.delete(sessionId)
  }
}

function compactionFor(ctx, agent) {
  const registry = ctx.get('agentPresets')
  return registry?.serviceFor ? registry.serviceFor(agent, 'compaction') : ctx.get('compaction')
}

function effectiveRetention(ctx, agent, config) {
  const fallback = config.keepRecentTokens ?? KEEP_RECENT_TOKENS
  // CompactionBasic publishes readonly resolved config. Honor exact route
  // overrides; for ratios use the full window as a conservative upper bound.
  const native = compactionFor(ctx, agent)?.config
  if (!native) return fallback
  const route = agent.session.requestContext?.()
  const override = native.modelPolicies?.find(policy => policy.provider === route?.provider && policy.model === route?.model)
  // Retention forms are mutually exclusive. A routed ratio replaces an
  // inherited absolute budget, matching the host's resolveRetention contract.
  const policy = override?.retainTokens !== undefined || override?.retainRatio !== undefined ? override : native
  if (Number.isFinite(policy.retainTokens)) return Math.max(fallback, policy.retainTokens)
  if (Number.isFinite(policy.retainRatio) && Number.isFinite(route?.contextWindow)) {
    return Math.max(fallback, Math.ceil(route.contextWindow * policy.retainRatio))
  }
  return fallback
}

function measureFixedTokens(ctx, agent) {
  try {
    const measured = ctx.get('tokenMeter')?.measure(agent.session)
    if (!Array.isArray(measured?.nodes)) return measureContextTokens(ctx, agent)
    const system = (measured?.nodes ?? []).reduce((sum, node) =>
      sum + (agent.session.eventAt?.(node.seq)?.type === 'system/message' ? node.tokens : 0), 0)
    const tools = agent.session.requestHeader?.()?.tools
    return system + (tools?.length ? Math.ceil(JSON.stringify(tools).length / 4) : 0)
  } catch { return measureContextTokens(ctx, agent) }
}

function measureContextTokens(ctx, agent) {
  const meter = ctx.get('tokenMeter')
  try {
    const measured = meter?.measure?.(agent?.session)
    if (Number.isFinite(measured?.totalTokens)) return measured.totalTokens
  } catch {
    // 计量失败时返回 0，经济性判定会拒绝压缩
  }
  return 0
}

function readContextWindow(agent) {
  try {
    const window = agent?.session?.requestContext?.()?.contextWindow
    return Number.isFinite(window) ? window : undefined
  } catch {
    return undefined
  }
}
