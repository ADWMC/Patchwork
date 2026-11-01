import { effectiveConfig, readUserConfig, configRevision } from '../config/user-config.mjs'
import { webRuntime } from './web-runtime.mjs'
import { isPatchworkAgent, resolvePatchworkAgent } from '../scope.mjs'
import { diagnosticSnapshot, logDiagnostic } from '../logging/session-log.mjs'
import { fingerprint } from '../logging/schema.mjs'
import { redactPreview } from '../logging/redact.mjs'
import { taskProjection } from '../task/store.mjs'
import { superagentSnapshot } from '../superagent/controller.mjs'
import { retrievalSnapshot } from '../retrieval/ledger.mjs'
import { memorySnapshot } from '../memory/store.mjs'
import { improvementSnapshot, recordIncident } from '../improvement/store.mjs'

export const STATE_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/state'
const sessions = webRuntime.sessions
const routeKey = `exact\u0000${STATE_ROUTE_PATH}`
const keys = ['actionFusion', 'observationPack', 'evidencePreservingReducer', 'onlineContextCompact']
const idOf = agent => agent?.session?.header?.id

function sessionState(agent) {
  if (!isPatchworkAgent(agent)) return undefined
  const id = idOf(agent)
  if (!id) return undefined
  if (!sessions.has(id)) {
    if (sessions.size >= 64) sessions.delete(sessions.keys().next().value)
    sessions.set(id, { agent, status: 'unknown', events: [], seen: new Set() })
  }
  const state = sessions.get(id)
  state.agent = agent
  return state
}

export function collectToolEvidence(exec, result) {
  const state = sessionState(exec?.agent)
  if (!state || state.seen.has(exec.callId)) return
  state.seen.add(exec.callId)
  const text = (result?.content ?? []).filter(b => b?.type === 'text').map(b => b.text).join('\n')
  const value = result?.value
  const canonical = value?.thenRun ?? value
  const exitCode = Number.isInteger(canonical?.exitCode) ? canonical.exitCode : null
  const outcome = result?.isError || canonical?.status === 'failed' || canonical?.timedOut || canonical?.aborted || (exitCode !== null && exitCode !== 0) ? 'failed' : canonical?.status === 'skipped' || canonical?.status === 'unverified' ? canonical.status : 'completed'
  state.events.push({
    id: exec.callId, rootCallId: exec.rootCallId ?? null, at: new Date().toISOString(), tool: exec.name,
    callIdHash: fingerprint(exec.callId), rootCallIdHash: fingerprint(exec.rootCallId ?? exec.callId),
    command: redactPreview(exec.arguments?.then_run?.command ?? exec.arguments?.command ?? null),
    path: redactPreview(exec.arguments?.file_path ?? null), exitCode, outcome,
    bytes: Buffer.byteLength(text, 'utf8'), text: redactPreview(text).slice(0, 16000), truncated: text.length > 16000,
  })
  if (outcome === 'failed' || outcome === 'unverified') {
    recordIncident(state.agent, {
      kind: outcome === 'failed' ? 'failure' : 'unverified-tool',
      sourceReceiptIds: [exec.callId],
      trigger: `工具 ${exec.name ?? 'unknown'} 返回${outcome === 'failed' ? '失败' : '未验证'}回执`,
      action: '保留真实回执，等待有范围的候选和隔离实验',
    })
  }
  if (state.events.length > 100) { const removed = state.events.shift(); state.seen.delete(removed.id) }
}

export function runtimeSnapshot(sessionId, rowConfig = {}, loadedConfig = {}) {
  const state = sessions.get(sessionId)
  if (!state || !isPatchworkAgent(state.agent)) return null
  rowConfig = state.rowConfig ?? rowConfig
  loadedConfig = state.loadedConfig ?? loadedConfig
  let context = { tokens: null, window: null }
  if (state) {
    try {
      const meter = state.agent.ctx?.get?.('tokenMeter')
      const measurement = meter?.measure?.(state.agent.session)
      context = {
        tokens: Number.isFinite(measurement?.totalTokens) ? measurement.totalTokens : null,
        window: state.agent.session.requestContext?.()?.contextWindow ?? null,
      }
    } catch { /* Unavailable measurement remains unknown, never zero. */ }
  }
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), sessionId,
    scope: 'current-process-session', status: state?.status ?? 'not-started',
    config: effectiveConfig(rowConfig, readUserConfig()), loadedConfig,
    revision: configRevision(), context,
    mechanisms: Object.fromEntries(keys.map(key => [key, {
      configured: loadedConfig[key] === true,
      // Runtime capability is only asserted when the agent tool contract proves it.
      active: key === 'actionFusion' && state ? Boolean(state.agent.ctx?.tools?.get?.('write', state.agent)?.parameters?.properties?.then_run) : null,
    }])),
    events: state ? [...state.events].reverse() : [],
    diagnostics: diagnosticSnapshot(state.agent),
    retrieval: retrievalSnapshot(state.agent),
    memory: memorySnapshot(state.agent),
    improvements: improvementSnapshot(state.agent),
    task: taskProjection(state.agent),
    superagent: superagentSnapshot(state.agent),
  }
}

export function registerRuntimeCollector(ctx, { rowConfig = {}, loadedConfig = {} } = {}) {
  function track(agent) {
    const state = sessionState(agent)
    if (state) Object.assign(state, { rowConfig, loadedConfig })
    return state
  }
  ctx.on('agent/created', ({ agent }) => {
    const state = track(agent)
    if (state) logDiagnostic(ctx, agent, { mechanism: 'runtime', event: 'loaded', reason: 'enabled' })
  })
  ctx.on('agent/status', ({ agent, status }) => { const state = track(agent); if (state) state.status = status })
  ctx.on('tools/result', (exec, result) => { track(exec?.agent); collectToolEvidence(exec, result) })
  ctx.on('agent-preset/selected', sessionId => {
    const agent = ctx.get?.('agents')?.get?.(sessionId)
    if (!isPatchworkAgent(agent)) sessions.delete(sessionId)
    else track(agent)
  })
}

export function registerRuntimeState(ctx, { token }) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)
  const register = () => {
    const dispose = server.register({ kind: 'exact', path: STATE_ROUTE_PATH, handler(req, res) {
      const reply = (status, body) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify(body))
      }
      if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
      if (req.method !== 'GET') return reply(405, { ok: false, reason: 'method-not-allowed' })
      const id = new URL(req.url, 'http://localhost').searchParams.get('sessionId')
      if (!id || id.length > 256) return reply(400, { ok: false, reason: 'session-id-required' })
      const agent = resolvePatchworkAgent(ctx, id)
      if (!agent) { sessions.delete(id); return reply(403, { ok: false, reason: 'patchwork-agent-required' }) }
      sessionState(agent)
      return reply(200, { ok: true, ...runtimeSnapshot(id) })
    } })
    return () => { dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(register, 'patchwork: session state endpoint')
  else register()
}
