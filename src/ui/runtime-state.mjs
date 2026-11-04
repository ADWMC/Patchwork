import { effectiveConfig, readUserConfig, configRevision } from '../config/user-config.mjs'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { isAbsolute, join } from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readWorkspaceConfigSync } from '../code/workspace-config.mjs'
import { isCodeGraphStarted } from '../code/tool.mjs'
import { webRuntime } from './web-runtime.mjs'
import { isPatchworkAgent, resolvePatchworkAgent } from '../scope.mjs'
import { diagnosticSnapshot, logDiagnostic } from '../logging/session-log.mjs'
import { fingerprint } from '../logging/schema.mjs'
import { redactPreview } from '../logging/redact.mjs'
import { taskProjection } from '../task/store.mjs'
import { taskHandoff } from '../task/handoff.mjs'
import { superagentSnapshot } from '../superagent/controller.mjs'
import { retrievalSnapshot } from '../retrieval/ledger.mjs'
import { memorySnapshot } from '../memory/store.mjs'
import { improvementSnapshot, recordIncident } from '../improvement/store.mjs'
import { registerSourceReceipt } from '../improvement/provenance.mjs'
import { revokePolicies } from '../improvement/policy.mjs'
import { revokeMemoryOperations } from '../memory/store.mjs'
import { snapshot as mechanismStatsSnapshot } from './mechanism-stats.mjs'
import { planSnapshot } from '../mechanisms/online-context-compact/lifecycle.mjs'
import { observationSnapshot } from '../mechanisms/observation-pack/index.mjs'

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
  if (result?.value?.receipt?.id) exec = { ...exec, callId: `browser:${result.value.receipt.id}` }
  const state = sessionState(exec?.agent)
  if (!state || state.seen.has(exec.callId)) return
  state.seen.add(exec.callId)
  const text = (result?.content ?? []).filter(b => b?.type === 'text').map(b => b.text).join('\n')
  const value = result?.value
  const canonical = value?.thenRun ?? value
  const exitCode = Number.isInteger(canonical?.exitCode) ? canonical.exitCode : null
  const receipt = canonical?.receipt
  const outcome = result?.isError || ['postcondition-mismatch', 'error'].includes(receipt?.outcome) || receipt?.noProgress === true || canonical?.status === 'failed' || canonical?.timedOut || canonical?.aborted || (exitCode !== null && exitCode !== 0) ? 'failed' : canonical?.status === 'skipped' || canonical?.status === 'unverified' ? canonical.status : 'completed'
  registerSourceReceipt(state.agent, { id: exec.callId, outcome })
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
  // One bounded, model-visible nudge when exploration dominates and no edit
  // has happened. It never blocks a legitimate search and is emitted once.
  if (!state.explorationHinted && ['read', 'glob', 'grep', 'patchwork_code'].includes(exec.name)) {
    const exploration = state.events.filter(event => ['read', 'glob', 'grep', 'patchwork_code'].includes(event.tool))
    const edited = state.events.some(event => ['write', 'edit'].includes(event.tool))
    if (exploration.length >= 8 && !edited) {
      state.explorationHinted = true
      state.pendingExplorationHint = '已连续进行多次源码探索且尚无编辑或验收。先用 patchwork_code map/outline 缩小范围；不要重复同一 grep/glob；到预算就报告卡点，不要继续换同义词。'
      logDiagnostic(undefined, exec, { mechanism: 'maintenance', event: 'warning', reason: 'exploration-hint' })
    }
  }
  if (state.events.length > 100) { const removed = state.events.shift(); state.seen.delete(removed.id) }
  logToolLifecycle(exec, result, canonical, exitCode)
}

const TASK_REASONS = { define: 'task-defined', correct: 'task-corrected', artifact: 'task-artifact', check: 'task-check', assessment: 'task-assessment', candidate: 'task-candidate', cancel: 'task-cancelled' }
const QUEUE_REASONS = { submit: 'queue-submitted', input: 'queue-input', retry: 'queue-retry', review: 'queue-review', pause: 'queue-paused', resume: 'queue-resumed', cancel: 'queue-cancelled', reconcile: 'queue-reconciled' }

/** Tool lifecycle diagnostics for capabilities whose own tool handlers do not log. */
function logToolLifecycle(exec, result, canonical, exitCode) {
  const name = exec?.name, action = exec?.arguments?.action
  const failed = result?.isError || (Number.isInteger(exitCode) && exitCode !== 0) || canonical?.status === 'failed'
  const level = failed ? 'warn' : 'info'
  const emit = (mechanism, event, reason) => logDiagnostic(undefined, exec, { mechanism, event, reason, level, ...(Number.isInteger(exitCode) ? { exitCode } : {}) })
  if (name === 'patchwork_task' && typeof action === 'string') {
    const event = ['define', 'correct', 'artifact', 'check', 'assessment', 'candidate', 'cancel', 'handoff', 'inspect'].includes(action) ? action : 'decision'
    emit('task', event, failed ? 'exception' : TASK_REASONS[action] ?? 'enabled')
  } else if (name === 'patchwork_superagent' && typeof action === 'string') {
    emit('superagent', action, failed ? 'exception' : QUEUE_REASONS[action] ?? 'enabled')
  } else if (name === 'skill') {
    emit('skill', 'load', failed ? 'exception' : 'skill-loaded')
  } else if (name === 'patchwork_evidence' && typeof action === 'string') {
    emit('evidence', action, failed ? 'exception' : action === 'compare' ? 'evidence-compared' : action === 'cite' ? 'evidence-cited' : 'enabled')
  } else if (name === 'patchwork_browser') {
    emit('browser', failed ? 'failure' : 'success', failed ? 'browser-failed' : 'browser-completed')
  }
}

function explorationSnapshot(state) {
  const events = state?.events ?? []
  const counts = { read: 0, glob: 0, grep: 0, patchwork_code: 0 }
  const seen = new Map()
  let bytes = 0, duplicates = 0
  for (const event of events) {
    if (!(event.tool in counts)) continue
    counts[event.tool]++
    bytes += Number(event.bytes) || 0
    const key = `${event.tool}\u0000${event.command ?? ''}\u0000${event.path ?? ''}`
    const prior = seen.get(key) ?? 0
    if (prior > 0) duplicates++
    seen.set(key, prior + 1)
  }
  return { ...counts, duplicateQueries: duplicates, totalCalls: Object.values(counts).reduce((sum, value) => sum + value, 0), bytesRead: bytes }
}

function projectDocsSnapshot(agent) {
  const cwd = agent?.session?.header?.cwd
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) return null
  const read = name => {
    try {
      const content = readFileSync(join(cwd, name), 'utf8')
      return { name, exists: true, bytes: Buffer.byteLength(content, 'utf8'), sha256: createHash('sha256').update(content).digest('hex') }
    } catch { return { name, exists: false, bytes: null, sha256: null } }
  }
  return { agents: read('AGENTS.md'), design: read('DESIGN.md') }
}

function workspaceGraphSnapshot(agent) {
  const cwd = agent?.session?.header?.cwd
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) return null
  const info = readWorkspaceConfigSync(cwd)
  const graph = info.config?.codeGraph
  return {
    status: info.status, configPath: '.patchwork/config.json', exists: info.status === 'loaded',
    enabled: graph?.enabled === true, started: isCodeGraphStarted(cwd),
    maxFiles: graph?.maxFiles ?? null, maxFileBytes: graph?.maxFileBytes ?? null,
    tokenBudget: graph?.tokenBudget ?? null, exclude: graph?.exclude ?? [],
    ...(info.failureCode ? { failureCode: info.failureCode } : {}),
  }
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
  const stats = mechanismStatsSnapshot()
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), sessionId,
    scope: 'current-process-session', status: state?.status ?? 'not-started',
    config: effectiveConfig(rowConfig, readUserConfig()), loadedConfig,
    revision: configRevision(), context,
    skills: { names: [...state.skillNames ?? []], mode: loadedConfig.skillsMode ?? 'core', bodies: 'on-demand' },
    mechanisms: Object.fromEntries(keys.map(key => [key, {
      configured: loadedConfig[key] === true,
      // Runtime capability is only asserted when the agent tool contract proves it.
      active: key === 'actionFusion' && state ? Boolean(state.agent.ctx?.tools?.get?.('write', state.agent)?.parameters?.properties?.then_run) : null,
    }])),
    events: state ? [...state.events].reverse() : [],
    diagnostics: diagnosticSnapshot(state.agent),
    stats,
    exploration: explorationSnapshot(state),
    code: { configured: loadedConfig.codeEnabled !== false, available: Boolean(state.agent.ctx?.tools?.get?.(`patchwork_code`, state.agent)), ...(stats.code ?? {}) },
    codeGraph: workspaceGraphSnapshot(state.agent),
    projectDocs: projectDocsSnapshot(state.agent),
    plan: planSnapshot(state.agent),
    observations: observationSnapshot(state.agent),
    taskHandoff: state ? (() => { try { return taskProjection(state.agent)?.title ? taskHandoff(state.agent) : null } catch { return null } })() : null,
    retrieval: retrievalSnapshot(state.agent),
    memory: memorySnapshot(state.agent, { includeValue: false, includeProject: false }),
    improvements: improvementSnapshot(state.agent),
    task: taskProjection(state.agent),
    superagent: superagentSnapshot(state.agent),
  }
}

export function registerRuntimeCollector(ctx, { rowConfig = {}, loadedConfig = {}, skillNames = [] } = {}) {
  const ownedAgents = new Set()
  const sinks = globalThis[Symbol.for('@patchwork/browser/receipt-sinks/v1')] ??= new Set()
  const receive = (agent, receipt) => {
    if (!isPatchworkAgent(agent)) return
    track(agent)
    collectToolEvidence({ agent, name: 'patchwork_browser', callId: `browser:${receipt.id}`, arguments: {} }, { value: { receipt } })
  }
  sinks.add(receive)
  ctx.effect?.(() => () => {
    sinks.delete(receive)
    for (const agent of ownedAgents) { revokePolicies(agent); revokeMemoryOperations(agent.ctx); if (sessions.get(idOf(agent))?.agent === agent) sessions.delete(idOf(agent)) }
    ownedAgents.clear()
  }, 'patchwork: optional browser receipt bridge and scope teardown')
  function track(agent) {
    const state = sessionState(agent)
    if (state) { ownedAgents.add(agent); Object.assign(state, { rowConfig, loadedConfig, skillNames }) }
    return state
  }
  ctx.on('agent/created', ({ agent }) => {
    const state = track(agent)
    if (state) logDiagnostic(ctx, agent, { mechanism: 'runtime', event: 'loaded', reason: 'enabled' })
  })
  ctx.on('agent/status', ({ agent, status }) => { const state = track(agent); if (state) state.status = status })
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    if (decision.kind !== 'enter' || !isPatchworkAgent(agent)) return decision
    const state = sessions.get(idOf(agent))
    if (!state?.pendingExplorationHint) return decision
    const hint = state.pendingExplorationHint
    state.pendingExplorationHint = null
    return { ...decision, messages: [...decision.messages, createUserMessage({
      content: [{ type: 'text', text: hint }],
      source: { kind: 'patchwork', form: 'notice', summary: 'exploration hint' },
    })] }
  })
  ctx.on('tools/result', (exec, result) => { track(exec?.agent); collectToolEvidence(exec, result) })
  ctx.on('agent-preset/selected', sessionId => {
    const agent = ctx.get?.('agents')?.get?.(sessionId)
    if (!isPatchworkAgent(agent)) { if (agent) { revokePolicies(agent); revokeMemoryOperations(agent.ctx); ownedAgents.delete(agent) }; sessions.delete(sessionId) }
    else track(agent)
  })
  ctx.on('agent/disposed', ({ agent }) => { revokePolicies(agent); revokeMemoryOperations(agent.ctx); ownedAgents.delete(agent); sessions.delete(idOf(agent)) })
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
