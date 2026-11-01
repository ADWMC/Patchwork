import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isPatchworkAgent } from '../scope.mjs'
import { diagnosticData, readDiagnostic, RECORD_TYPE, LOG_LIMIT } from './schema.mjs'

const states = new WeakMap()
const apis = new Set()
let loading

/** Resolve the host's own Session class, not a second private-brand copy. */
export async function initializeDiagnostics(_ctx, { sessionApi } = {}) {
  if (sessionApi?.appendPluginRecord && sessionApi.Session) apis.add(sessionApi)
  if (!loading) loading = (async () => {
    const anchors = [import.meta.url]
    if (process.argv[1] && isAbsolute(process.argv[1])) anchors.push(pathToFileURL(process.argv[1]).href)
    for (const anchor of anchors) {
      try {
        const require = createRequire(anchor)
        const api = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session')).href)
        if (typeof api.appendPluginRecord === 'function' && api.Session) apis.add(api)
      } catch { /* Older hosts remain usable; expose unavailable persistence explicitly. */ }
    }
  })()
  await loading
}

function stateFor(session) {
  if (!states.has(session)) states.set(session, { recent: [], pending: Promise.resolve(), failures: 0, persistence: 'unavailable', cursor: 0, history: [] })
  return states.get(session)
}

/** The selected host API also serves other producer-owned plugin records. */
export function nativeSessionApi(session) {
  return [...apis].find(candidate => session instanceof candidate.Session)
}

/** Non-blocking metadata only. Recheck scope in the microtask before committing. */
export function logDiagnostic(ctx, target, input) {
  const agent = target?.agent ?? target
  if (!isPatchworkAgent(agent)) return
  const data = diagnosticData(input, target?.agent ? target : {})
  if (!data) return
  const state = stateFor(agent.session)
  state.pending = state.pending.then(() => {
    if (!isPatchworkAgent(agent)) return
    const api = nativeSessionApi(agent.session)
    let seq = null
    if (api) {
      try { seq = api.appendPluginRecord(agent.session, RECORD_TYPE, data); state.persistence = 'native' }
      catch { state.failures += 1; state.persistence = 'failed' }
    }
    if (seq === null) {
      state.recent.push({ ...data, seq: null, at: new Date().toISOString() })
      if (state.recent.length > LOG_LIMIT) state.recent.shift()
    }
    if (data.level !== 'info') {
      // Fixed, already-sanitized fields only; never pass the original Error.
      try { ctx?.logger?.[data.level]?.(`[patchwork] ${data.mechanism}.${data.event} reason=${data.reason}${data.errorCode ? ` code=${data.errorCode}` : ''}`) } catch { /* Logging cannot break the task. */ }
    }
  }).catch(() => { state.failures += 1; state.persistence = 'failed' })
}

export async function flushDiagnostics(agent) {
  await states.get(agent?.session)?.pending
}

/** Bounded incremental reader; recovered history comes from the real Session. */
export function diagnosticSnapshot(agent) {
  if (!isPatchworkAgent(agent)) return null
  const session = agent.session
  const state = stateFor(session)
  const end = Number.isSafeInteger(session.seq) ? session.seq : 0
  if (end < state.cursor) { state.cursor = 0; state.history = [] }
  const start = Math.max(state.cursor, end - 5000)
  for (let seq = start; seq < end; seq += 1) {
    try {
      const event = session.eventAt(seq)
      if (event?.type !== RECORD_TYPE || event.ignorable !== true) continue
      const data = readDiagnostic(event.data)
      if (!data || !Number.isFinite(event.time)) continue
      state.history.push({ ...data, seq, at: new Date(event.time).toISOString() })
      if (state.history.length > LOG_LIMIT) state.history.shift()
    } catch { /* An unknown/corrupt record cannot change the session. */ }
  }
  state.cursor = end
  const entries = [...state.history, ...state.recent].sort((a, b) => b.at.localeCompare(a.at)).slice(0, LOG_LIMIT)
  return { schemaVersion: 1, persistence: state.history.length && state.persistence === 'unavailable' ? 'native' : state.persistence,
    failures: state.failures, limit: LOG_LIMIT, historyScanLimit: 5000, entries }
}
