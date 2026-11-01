import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { contentHashOf, writeObject } from '../../util/content-archive.mjs'
import { record } from '../../ui/mechanism-stats.mjs'
import { MECHANISM_DIR } from './config.mjs'
import { reducibleLog } from './candidate.mjs'
import { appendJournal } from './journal.mjs'
import { buildRequest, parseReceipt, renderReceipt } from './receipt.mjs'
import { callReducer, resolveRoute } from './provider.mjs'
import { isPatchworkAgent } from '../../scope.mjs'
import { nodeSpecReceipt } from './node-spec.mjs'
import { join } from 'node:path'
import { logDiagnostic } from '../../logging/session-log.mjs'

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
    if (!isPatchworkAgent(exec?.agent)) return decision
    const outcome = await reduce(exec, result, decision, ctx, config)
    // Irrelevant tools are not diagnostic events: avoid a record per read/skill.
    if (outcome.reason && !['not-a-shell-tool', 'not-a-diagnostic-command', 'below-threshold', 'already-reduced'].includes(outcome.reason)) {
      logDiagnostic(ctx, exec, { mechanism: 'epr', event: 'decision', reason: outcome.reason,
        level: outcome.applied ? 'info' : 'warn', command: outcome.command, source: outcome.sourceHash,
        routeKind: outcome.call?.kind, model: outcome.call?.model, provider: outcome.call?.provider,
        elapsedMs: outcome.call?.elapsedMs, usage: outcome.call?.usage,
        sourceBytes: outcome.call?.sourceBytes, resultBytes: outcome.call?.receiptBytes })
      await journalSafe(exec, outcome)
    }
    return outcome.decision ?? decision
  })
}

async function journalSafe(exec, outcome) {
  try {
    if (!isPatchworkAgent(exec.agent)) return
    const sessionId = sessionIdOf(exec.agent)
    if (!sessionId) return
    await appendJournal(sessionId, {
      kind: outcome.applied ? 'applied' : 'fallback',
      reason: outcome.reason,
      command: outcome.command,
      source: outcome.sourceHash,
      callId: exec.callId, rootCallId: exec.rootCallId ?? exec.callId,
      ...(outcome.call ? { reducer: outcome.call } : {}),
    }, { authorize: () => isPatchworkAgent(exec.agent) })
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

  const { command, body, isError } = candidate
  const sourceHash = contentHashOf(body)
  await writeObject(sessionRoot(sessionId), sourceHash, body)

  const local = nodeSpecReceipt({ ...candidate, sourceHash })
  const route = local ? { model: 'node-spec', provider: 'local' } : resolveRoute(ctx, config)
  const started = Date.now()
  const request = local ? undefined : buildRequest({ command, body, sourceHash, isError })
  const call = local
    ? { ok: true, text: JSON.stringify(local), ...route }
    : await callReducer(ctx.get?.('llm'), { route, ...request, signal: exec.signal, sessionId, maxTokens: config.reducerMaxTokens })
  const callInfo = { kind: local ? 'local' : 'model', model: route?.model, provider: route?.provider, elapsedMs: Date.now() - started, usage: call.usage }
  if (!call.ok) return { decision, reason: call.reason, command, sourceHash, call: callInfo }
  if (!isPatchworkAgent(exec.agent)) return { decision, reason: 'agent-scope-changed', command, sourceHash, call: callInfo }

  const parsed = parseReceipt(call.text, { body, sourceHash, isError })
  if (!parsed.ok) return { decision, reason: parsed.reason, command, sourceHash, call: callInfo }
  if (local && parsed.receipt.evidence.filter(item => item.kind === 'failure').map(item => item.quote).join('') !==
    local.evidence.filter(item => item.kind === 'failure').map(item => item.quote).join('')) {
    return { decision, reason: 'structured-evidence-collapsed', command, sourceHash, call: callInfo }
  }

  const text = renderReceipt(parsed.receipt, { model: call.model, provider: call.provider, isError, archivePath: join(sessionRoot(sessionId), 'objects', `${sourceHash}.txt`) })
  // 比原文还大的「收据」没有意义——省 token 是本机制的全部理由。
  if (Buffer.byteLength(text, 'utf8') >= Buffer.byteLength(body, 'utf8')) {
    return { decision, reason: 'receipt-not-smaller', command, sourceHash, call: callInfo }
  }

  record('evidencePreservingReducer', 'receipts')
  record('evidencePreservingReducer', 'reducedBytes', Buffer.byteLength(body, 'utf8') - Buffer.byteLength(text, 'utf8'))
  return {
    decision: { ...decision, content: [{ type: 'text', text }] },
    reason: `retained-${parsed.receipt.evidence.length}-quotes`,
    applied: true,
    command,
    sourceHash,
    call: { ...callInfo, sourceBytes: Buffer.byteLength(body, 'utf8'), receiptBytes: Buffer.byteLength(text, 'utf8') },
  }
}
