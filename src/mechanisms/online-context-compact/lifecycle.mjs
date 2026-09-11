import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { KEEP_RECENT_TOKENS } from './config.mjs'
import { record } from '../../ui/mechanism-stats.mjs'
import { decideCompaction } from './economics.mjs'
import { analyzeTransition } from './plan.mjs'
import { emptyState, loadState, recordBoundary, saveState } from './state.mjs'
import { registerPlanTool } from './tools.mjs'

export const PLUGIN_NAME = 'patchwork-agent'

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
 * **边界 → turn 收尾（此处只评估）→ 真正 idle → runMaintenance 内 compactNow → followup 续跑**，
 * 而不是 SoL-Pi 的「turn 边界直接压缩」。净效果一致（在语义边界压缩并自动继续），
 * 中间多一步收敛。
 *
 * 所有监听器都自带兜底：本机制是优化项，任何失败都不得影响 agent 的正常运行。
 */
export function registerOnlineContextCompact(ctx, config = {}) {
  const states = new Map()
  const boundaries = new Set()
  const ready = new Set()

  const stateFor = async sessionId => {
    if (!states.has(sessionId)) states.set(sessionId, await loadState(sessionId))
    return states.get(sessionId)
  }

  const persist = async (sessionId, next) => {
    states.set(sessionId, next)
    await saveState(sessionId, next)
  }

  registerPlanTool(ctx, async ({ steps, exec }) => {
    const sessionId = sessionIdOf(exec.agent)
    if (!sessionId) return {}
    const state = await stateFor(sessionId)
    const transition = analyzeTransition(state.plan, steps)

    let next = { ...state, plan: steps, completed: transition.completed }
    if (transition.newlyCompleted.length > 0) {
      // 语义边界：本次提交把某些步骤真正推进到了完成。
      next = recordBoundary(next, next.requests)
      boundaries.add(sessionId)
    }
    await persist(sessionId, next)
    return {}
  })

  // 请求计数：间隔样本的唯一来源。
  ctx.on('agent/request', async (payload, next) => {
    try {
      const sessionId = sessionIdOf(payload?.agent)
      if (sessionId) {
        const state = await stateFor(sessionId)
        await persist(sessionId, { ...state, requests: state.requests + 1 })
      }
    } catch {
      // 计数失败不改变任何决策的安全性，只是视界估计会更保守
    }
    return next()
  })

  // turn 收尾：此处**不是**空闲点，只做评估与标记。
  ctx.on('agent/turn-stopping', async payload => {
    try {
      await evaluateAtTurnEnd(ctx, payload?.agent, config, { stateFor, persist, boundaries, ready })
    } catch {
      // 评估失败等同于「不压缩」
    }
  })

  // 真正空闲后才动手压缩，并在成功后让任务继续。
  ctx.on('agent/status', async payload => {
    if (payload?.status !== 'idle') return
    try {
      await compactWhenReady(ctx, payload?.agent, { ready, boundaries, stateFor, persist })
    } catch {
      // 压缩失败等同于「本次不压缩」
    }
  })
}

async function evaluateAtTurnEnd(ctx, agent, config, { stateFor, persist, boundaries, ready }) {
  const sessionId = sessionIdOf(agent)
  if (!sessionId || !boundaries.has(sessionId)) return

  const state = await stateFor(sessionId)
  const contextTokens = measureContextTokens(ctx, agent)
  const decision = decideCompaction({
    contextTokens,
    contextWindow: readContextWindow(agent),
    // 与 SoL-Pi 同一口径：writeTokens 取当前上下文规模，saving 是压缩真正移走的部分。
    writeTokens: contextTokens,
    // 系统提示的规模这里取 0（测不到就保守地高估可省量），已在文档中标注。
    systemTokens: 0,
    keepRecentTokens: config.keepRecentTokens ?? KEEP_RECENT_TOKENS,
    tokensPerRequest: averageInterval(state.intervals),
    intervals: state.intervals,
    boundariesRemaining: Math.max(1, state.plan.filter(step => step.status !== 'completed').length),
    cacheWriteReadRatio: config.cacheWriteReadRatio ?? 0,
    isFirst: state.compactions === 0,
    carriedDebtTokens: state.carriedDebtTokens,
  })

  await persist(sessionId, { ...state, lastDecision: decision.reason, lastSaving: decision.saving ?? null })
  if (decision.compact) ready.add(sessionId)
  else ready.delete(sessionId)
}

async function compactWhenReady(ctx, agent, { ready, boundaries, stateFor, persist }) {
  const sessionId = sessionIdOf(agent)
  if (!sessionId || !ready.has(sessionId) || !boundaries.has(sessionId)) return

  const compaction = ctx.get('compaction')
  if (!compaction?.compactNow) return

  ready.delete(sessionId)
  boundaries.delete(sessionId)

  // compactNow 要求空闲；runMaintenance 从真正的空闲相位拿走这段独占时间。
  const result = await agent.runMaintenance(signal => compaction.compactNow(agent, signal))

  const state = await stateFor(sessionId)
  await persist(sessionId, {
    ...state,
    compactions: state.compactions + 1,
    carriedDebtTokens: 0,
    lastCompactedAt: new Date().toISOString(),
  })

  if (result === null || result === undefined) return
  record('onlineContextCompact', 'compactions')
  agent.followup(
    createUserMessage({
      content: [
        {
          type: 'text',
          text: 'The context was compacted at a completed plan step. Rebuild your plan from the current state and continue the task; do not restate work that is already done.',
        },
      ],
      source: { kind: 'plugin', plugin: PLUGIN_NAME, form: 'notice', summary: 'context compacted; rebuild the plan' },
    }),
  )
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
