import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { STATE_ENTRY_KIND } from './config.mjs'

/**
 * 本机制需要跨请求保存的东西：计划、已完成数、请求计数、边界间隔样本、
 * 已欠的压缩债务。
 *
 * 这里保留会话级旁挂文件作为可恢复的决策状态，并非事件审计，
 * 也不会自动随原生会话导出。历次判断与异常由 lifecycle.mjs 另外写入
 * 宿主非上下文插件诊断；两者都不进入模型消息。
 */
export function stateRoot(sessionId) {
  return dshHomePath('patchwork', STATE_ENTRY_KIND, sessionId)
}

function statePath(sessionId) {
  return join(stateRoot(sessionId), 'state.json')
}

export function emptyState() {
  return {
    version: 1,
    plan: [],
    completed: 0,
    requests: 0,
    lastContextTokens: null,
    tokenDeltas: [],
    lastBoundaryRequest: null,
    intervals: [],
    compactions: 0,
    carriedDebtTokens: 0,
    debtRepaymentTokens: 0,
  }
}

export async function loadState(sessionId) {
  try {
    const parsed = JSON.parse(await readFile(statePath(sessionId), 'utf8'))
    if (parsed?.version === 1) return { ...emptyState(), ...parsed }
  } catch {
    // 首次运行、或状态不可读：从空状态开始，绝不猜测历史
  }
  return emptyState()
}

export async function saveState(sessionId, state) {
  await mkdir(stateRoot(sessionId), { recursive: true, mode: 0o700 })
  const path = statePath(sessionId)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(state, null, 1), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  } finally { await rm(temporary, { force: true }) }
}

/**
 * 记录一次边界：推进请求计数到当前值，并把「距上一个边界的请求数」记为一个
 * 间隔样本——经济性判定正是靠这些样本外推还能用多少次请求来偿还写入成本。
 */
export function recordBoundary(state, requestsNow) {
  const previous = state.lastBoundaryRequest
  const intervals = [...state.intervals]
  if (typeof previous === 'number' && requestsNow > previous) intervals.push(requestsNow - previous)
  return { ...state, lastBoundaryRequest: requestsNow, intervals: intervals.slice(-20) }
}
