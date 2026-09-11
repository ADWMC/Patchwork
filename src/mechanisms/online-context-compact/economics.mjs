import {
  FIRST_COMPACTION_HORIZON_FACTOR,
  HORIZON_MARGIN,
  KEEP_RECENT_TOKENS,
  MIN_INTERVAL_SAMPLES,
  WINDOW_RESERVE_TOKENS,
} from './config.mjs'

/**
 * 压缩是否划算。纯函数，不做 IO，也不改状态——所有输入由调用方测量。
 *
 * 核心量：
 * - `archive`：这次压缩真正能从上下文里移走的 token 量
 *   （当前上下文 − 固定系统提示 − 必须保留的近期量）。
 * - `breakeven`：写入成本要在多少次后续请求里才被省回来。
 *   缓存写入相对缓存读取的额外代价是 `max(0, ratio − 1)`，
 *   所以 `breakeven = writeTokens × 额外比率 / saving`。
 * - `expected`：预计还剩多少次请求可用来偿还。用**边界间隔**外推，
 *   并用剩余窗口能容纳的请求数封顶。
 *
 * 判据分两档：首次压缩视界放宽（还没有间隔样本），后续压缩要求更长的视界
 * 与已欠的债务一起结算，避免为一次压缩反复付写入成本。
 */
export function decideCompaction({
  contextTokens,
  contextWindow,
  writeTokens,
  systemTokens = 0,
  keepRecentTokens = KEEP_RECENT_TOKENS,
  memoTokens = 0,
  tokensPerRequest = 0,
  intervals = [],
  boundariesRemaining = 1,
  cacheWriteReadRatio = 0,
  isFirst = false,
  carriedDebtTokens = 0,
  windowReserve = WINDOW_RESERVE_TOKENS,
} = {}) {
  if (!Number.isFinite(contextTokens) || !Number.isFinite(writeTokens)) {
    return reject('inputs-unavailable')
  }

  const saving = writeTokens - systemTokens - keepRecentTokens - memoTokens
  if (saving <= 0) return reject('non-positive-saving', { saving })

  const windowPressure =
    Number.isFinite(contextWindow) && contextTokens >= contextWindow - windowReserve

  const incrementalRatio = Math.max(0, cacheWriteReadRatio - 1)
  const breakeven = (writeTokens * incrementalRatio) / saving
  const horizon = estimateHorizon({ intervals, boundariesRemaining, tokensPerRequest, contextWindow, contextTokens })

  // 窗口压力优先：上下文要撞上限时，经济性不再是唯一判据。
  if (windowPressure) return accept('window-pressure', { saving, breakeven, horizon })

  if (horizon.expected === null) return reject('horizon-unavailable', { saving, breakeven, horizon })

  if (isFirst) {
    const effective = horizon.expected * FIRST_COMPACTION_HORIZON_FACTOR
    return breakeven <= effective
      ? accept('economic-first', { saving, breakeven, horizon })
      : reject('deferred-breakeven', { saving, breakeven, horizon })
  }

  if (breakeven * HORIZON_MARGIN > horizon.expected) {
    return reject('deferred-breakeven', { saving, breakeven, horizon })
  }
  const debtPerSaving = (carriedDebtTokens + writeTokens * cacheWriteReadRatio) / saving
  if (debtPerSaving > horizon.expected) {
    return reject('deferred-debt', { saving, breakeven, horizon, debtPerSaving })
  }
  return accept('economic', { saving, breakeven, horizon, debtPerSaving })
}

function estimateHorizon({ intervals, boundariesRemaining, tokensPerRequest, contextWindow, contextTokens }) {
  const samples = Array.isArray(intervals) ? intervals.filter(value => Number.isFinite(value) && value > 0) : []
  const mean = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : null

  // 样本不足时把下界减半：宁可推迟压缩，也不要基于一个噪声估计就动手。
  const lowerBound = mean === null ? null : Math.max(1, Math.floor(mean * (samples.length < MIN_INTERVAL_SAMPLES ? 0.5 : 1)))
  const unbounded = lowerBound === null ? null : 1 + Math.floor(lowerBound * Math.max(1, boundariesRemaining))

  const windowUpper =
    Number.isFinite(contextWindow) && tokensPerRequest > 0
      ? Math.max(0, Math.floor((contextWindow - contextTokens) / tokensPerRequest))
      : null

  const candidates = [unbounded, windowUpper].filter(value => value !== null)
  return {
    samples: samples.length,
    mean,
    lowerBound,
    unbounded,
    windowUpper,
    expected: candidates.length ? Math.min(...candidates) : null,
  }
}

function accept(reason, detail) {
  return { compact: true, reason, ...detail }
}

function reject(reason, detail = {}) {
  return { compact: false, reason, ...detail }
}
