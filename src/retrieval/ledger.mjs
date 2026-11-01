import { fingerprint } from '../logging/schema.mjs'
import { nativeSessionApi } from '../logging/session-log.mjs'
import { isPatchworkAgent } from '../scope.mjs'
import { evidenceSnapshot } from './evidence.mjs'

export const RETRIEVAL_RECORD = 'plugin:patchwork/retrieval'
export const RETRIEVAL_LIMIT = 100
const VALID_STATUS = new Set(['retrieved', 'failed', 'partial', 'admitted', 'sent', 'cited', 'verified', 'rejected'])
const VALID_TRUST = new Set(['local', 'user-confirmed', 'external-untrusted'])
const states = new WeakMap()

function stateFor(agent) {
  const session = agent.session
  if (!states.has(session)) states.set(session, { recent: [], history: [], pending: Promise.resolve(), persistence: 'unavailable', cursor: 0, failures: 0 })
  return states.get(session)
}

function boundedText(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : undefined
}

function safeUrl(value) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return undefined
    url.hash = ''
    return url.href.slice(0, 2048)
  } catch { return undefined }
}

function operationId(value) {
  if (typeof value === 'string' && /^retr_[a-f0-9]{24}$/.test(value)) return value
  const seed = typeof value === 'string' && value ? value : `retrieval-${Date.now()}-${Math.random()}`
  return `retr_${fingerprint(seed).slice(0, 24)}`
}

function cleanHealth(items) {
  if (!Array.isArray(items)) return []
  return items.slice(0, 8).map(item => ({
    provider: boundedText(item?.provider, 64) ?? 'unknown',
    family: boundedText(item?.family, 64) ?? 'unknown',
    status: boundedText(item?.status, 32) ?? 'unknown',
    ...(Number.isInteger(item?.resultCount) && item.resultCount >= 0 ? { resultCount: item.resultCount } : {}),
    ...(Number.isInteger(item?.elapsedMs) && item.elapsedMs >= 0 ? { elapsedMs: item.elapsedMs } : {}),
    ...(typeof item?.code === 'string' ? { code: item.code.slice(0, 64) } : {}),
  }))
}

function cleanSources(items) {
  if (!Array.isArray(items)) return []
  return items.slice(0, 12).flatMap(item => {
    const url = safeUrl(item?.url)
    if (!url) return []
    return [{ url, title: boundedText(item?.title, 256) ?? url, ...(typeof item?.snippet === 'string' ? { snippet: item.snippet.slice(0, 600) } : {}) }]
  })
}

export function normalizeRetrievalRecord(input = {}) {
  const status = VALID_STATUS.has(input.status) ? input.status : 'retrieved'
  const data = {
    schemaVersion: 1,
    type: input.type === 'fetch' ? 'fetch' : 'search',
    operationId: operationId(input.operationId ?? input.callId),
    scope: 'current-session',
    trust: VALID_TRUST.has(input.trust) ? input.trust : 'external-untrusted',
    status,
    recordedAt: typeof input.recordedAt === 'string' && Number.isFinite(Date.parse(input.recordedAt)) ? input.recordedAt : new Date().toISOString(),
  }
  if (typeof input.queryFingerprint === 'string' && /^[a-f0-9]{64}$/.test(input.queryFingerprint)) data.queryFingerprint = input.queryFingerprint
  if (typeof input.provider === 'string') data.provider = input.provider.slice(0, 64)
  if (Array.isArray(input.providers)) data.providers = input.providers.slice(0, 8).map(value => String(value).slice(0, 64))
  if (Array.isArray(input.failedProviders)) data.failedProviders = input.failedProviders.slice(0, 8).map(item => ({ provider: String(item?.provider ?? 'unknown').slice(0, 64), code: String(item?.code ?? 'unknown').slice(0, 64) }))
  const health = cleanHealth(input.providerHealth)
  if (health.length) data.providerHealth = health
  const sources = cleanSources(input.sources)
  if (sources.length) data.sources = sources
  for (const key of ['resultCount', 'providerCount', 'failedProviderCount', 'elapsedMs']) {
    if (Number.isInteger(input[key]) && input[key] >= 0) data[key] = input[key]
  }
  if (typeof input.failureCode === 'string') data.failureCode = input.failureCode.slice(0, 64)
  return data
}

function readRecord(value) {
  if (value?.schemaVersion !== 1 || typeof value.operationId !== 'string' || !VALID_STATUS.has(value.status)) return undefined
  return normalizeRetrievalRecord(value)
}

export function recordRetrieval(agent, input = {}) {
  if (!isPatchworkAgent(agent)) return undefined
  const data = normalizeRetrievalRecord(input)
  const state = stateFor(agent)
  state.pending = state.pending.then(() => {
    if (!isPatchworkAgent(agent)) return
    const api = nativeSessionApi(agent.session)
    if (api) {
      try { api.appendPluginRecord(agent.session, RETRIEVAL_RECORD, data); state.persistence = 'native'; return }
      catch { state.failures += 1; state.persistence = 'failed' }
    }
    state.recent.push({ ...data, seq: null })
    if (state.recent.length > RETRIEVAL_LIMIT) state.recent.shift()
  }).catch(() => { state.failures += 1; state.persistence = 'failed' })
  return data
}

export async function flushRetrieval(agent) {
  await stateFor(agent).pending
}

export function retrievalSnapshot(agent) {
  if (!isPatchworkAgent(agent)) return null
  const session = agent.session
  const state = stateFor(agent)
  const end = Number.isSafeInteger(session.seq) ? session.seq : 0
  if (end < state.cursor) { state.cursor = 0; state.history = [] }
  const start = Math.max(state.cursor, end - 5000)
  for (let seq = start; seq < end; seq += 1) {
    try {
      const event = session.eventAt(seq)
      if (event?.type !== RETRIEVAL_RECORD || event.ignorable !== true) continue
      const data = readRecord(event.data)
      if (!data) continue
      state.history.push({ ...data, seq, at: Number.isFinite(event.time) ? new Date(event.time).toISOString() : data.recordedAt })
      if (state.history.length > RETRIEVAL_LIMIT) state.history.shift()
    } catch { /* Corrupt records are ignored and cannot change the task. */ }
  }
  state.cursor = end
  const entries = [...state.history, ...state.recent].sort((a, b) => String(b.at ?? b.recordedAt).localeCompare(String(a.at ?? a.recordedAt))).slice(0, RETRIEVAL_LIMIT)
  return { schemaVersion: 1, persistence: state.persistence, failures: state.failures, limit: RETRIEVAL_LIMIT, entries, evidence: evidenceSnapshot(agent) }
}
