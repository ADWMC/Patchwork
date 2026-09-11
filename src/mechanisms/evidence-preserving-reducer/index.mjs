import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { contentHashOf, writeObject } from '../../util/content-archive.mjs'
import { record } from '../../ui/mechanism-stats.mjs'
import { MECHANISM_DIR } from './config.mjs'
import { reducibleLog } from './candidate.mjs'
import { appendJournal } from './journal.mjs'
import { buildRequest, parseReceipt, renderReceipt } from './receipt.mjs'
import { callReducer, resolveRoute } from './provider.mjs'

/** 归档原文与会话判断日志的根，落在宿主自己的用户数据根下。 */
export function sessionRoot(sessionId) {
  return dshHomePath('patchwork', MECHANISM_DIR, sessionId)
}

function sessionIdOf(agent) {
  const id = agent?.session?.header?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/**
 * 注册 Evidence-Preserving Reducer：把诊断命令的长输出换成紧凑收据，
 * 且每条保留的引用都必须能在归档原文中精确匹配。
 *
 * 任何一步失败都原样放行——本机制的价值是省 token，绝不能因为压缩失败而
 * 丢掉或改写工具证据。
 */
export function registerEvidencePreservingReducer(ctx, config = {}) {
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    const outcome = await reduce(exec, result, decision, ctx, config)
    if (outcome.reason) await journalSafe(exec, outcome)
    return outcome.decision ?? decision
  })
}

async function journalSafe(exec, outcome) {
  try {
    const sessionId = sessionIdOf(exec.agent)
    if (!sessionId) return
    await appendJournal(sessionId, {
      kind: outcome.applied ? 'applied' : 'fallback',
      reason: outcome.reason,
      command: outcome.command,
      source: outcome.sourceHash,
    })
  } catch {
    // 判断日志是诊断性的，写不进去也不改变结果
  }
}

async function reduce(exec, result, decision, ctx, config) {
  try {
    return await attempt(exec, result, decision, ctx, config)
  } catch (error) {
    return { decision, reason: `unexpected: ${error?.message ?? error}` }
  }
}

async function attempt(exec, result, decision, ctx, config) {
  if (decision.kind !== 'accept') return { decision, reason: 'upstream-declined' }

  const sessionId = sessionIdOf(exec.agent)
  if (!sessionId) return { decision, reason: 'no-session' }

  const candidate = reducibleLog(exec, result, decision.content)
  if (!candidate.ok) return { decision, reason: candidate.reason }

  const { command, body } = candidate
  const sourceHash = contentHashOf(body)
  await writeObject(sessionRoot(sessionId), sourceHash, body)

  const route = resolveRoute(ctx, config)
  const { system, userText } = buildRequest({ command, body, sourceHash, isError: result.isError })
  const call = await callReducer(ctx.get?.('llm'), { route, system, userText, signal: exec.signal, sessionId })
  if (!call.ok) return { decision, reason: call.reason, command, sourceHash }

  const parsed = parseReceipt(call.text, { body, sourceHash, isError: result.isError })
  if (!parsed.ok) return { decision, reason: parsed.reason, command, sourceHash }

  const text = renderReceipt(parsed.receipt, { model: call.model, provider: call.provider })
  // 比原文还大的「收据」没有意义——省 token 是本机制的全部理由。
  if (Buffer.byteLength(text, 'utf8') >= Buffer.byteLength(body, 'utf8')) {
    return { decision, reason: 'receipt-not-smaller', command, sourceHash }
  }

  record('evidencePreservingReducer', 'receipts')
  record('evidencePreservingReducer', 'reducedBytes', Buffer.byteLength(body, 'utf8') - Buffer.byteLength(text, 'utf8'))
  return {
    decision: { ...decision, content: [{ type: 'text', text }] },
    reason: `retained-${parsed.receipt.evidence.length}-quotes`,
    applied: true,
    command,
    sourceHash,
  }
}
