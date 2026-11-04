import { isPatchworkAgent } from '../scope.mjs'
import { nativeSessionApi } from '../logging/session-log.mjs'
import { fingerprint } from '../logging/schema.mjs'

const records = new WeakMap()
export const SOURCE_RECORD = 'plugin:patchwork/source-receipt'
function sources(agent) {
  if (!records.has(agent.session)) {
    const map = new Map(), session = agent.session
    for (let seq = Math.max(0, (session.seq ?? 0) - 5000); seq < (session.seq ?? 0); seq++) {
      try { const event = session.eventAt(seq); if (event?.type === SOURCE_RECORD && event.ignorable && event.data?.sessionId === session.header.id && typeof event.data.id === 'string') map.set(event.data.id, event.data) } catch {}
    }
    records.set(session, map)
  }
  return records.get(agent.session)
}
export function registerSourceReceipt(agent, { id, outcome, kind = 'tool', revision = null, digest } = {}) {
  if (!isPatchworkAgent(agent) || typeof id !== 'string' || !id || id.length > 256) return undefined
  const map = sources(agent)
  if (map.has(id)) return map.get(id)
  const record = { id, sessionId: agent.session.header.id, outcome, kind, revision, digest: digest ?? fingerprint(JSON.stringify([id, outcome, kind, revision])), at: new Date().toISOString() }
  map.set(id, record)
  try { nativeSessionApi(agent.session)?.appendPluginRecord(agent.session, SOURCE_RECORD, record) } catch {}
  return record
}
export function resolveSourceReceipt(agent, id) {
  if (!isPatchworkAgent(agent) || typeof id !== 'string') return undefined
  return sources(agent).get(id)
}
/** Recent receipts are metadata only; the model uses their ids for incident provenance. */
export function recentSourceReceipts(agent, { limit = 12, outcome, kind } = {}) {
  if (!isPatchworkAgent(agent)) return []
  const boundedLimit = Math.max(1, Math.min(24, Math.trunc(Number(limit) || 12)))
  return [...sources(agent).values()]
    .filter(record => (!outcome || record.outcome === outcome) && (!kind || record.kind === kind))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, boundedLimit)
    .map(({ id, outcome: value, kind: type, revision, at }) => ({ id, outcome: value, kind: type, revision, at }))
}
