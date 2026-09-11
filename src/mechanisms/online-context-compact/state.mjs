import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { STATE_ENTRY_KIND } from './config.mjs'

/**
 * 本机制需要跨请求保存的东西：计划、已完成数、请求计数、边界间隔样本、
 * 已欠的压缩债务。
 *
 * 与 SoL-Pi 的差异：它写进 session log 的非上下文条目；这里写会话级旁挂文件。
 * 两者都不进模型上下文；差别是它随会话日志迁移，这里不随。这样选是因为 DSH 的
 * 自定义 session 事件要先合并进 `SessionEventMap` 才有稳定契约，而本机制的
 * 状态只是运行时决策输入。
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
    lastBoundaryRequest: null,
    intervals: [],
    compactions: 0,
    carriedDebtTokens: 0,
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
  await writeFile(statePath(sessionId), JSON.stringify(state, null, 1), { encoding: 'utf8', mode: 0o600 })
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
