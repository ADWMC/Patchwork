import { randomUUID, createHash } from 'node:crypto'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { nativeSessionApi } from '../logging/session-log.mjs'
import { redactPreview } from '../logging/redact.mjs'
import { currentPolicy } from '../improvement/policy.mjs'

const RECORD = 'plugin:patchwork/evidence', states = new WeakMap(), deliveries = new Map()
const hash = value => createHash('sha256').update(value).digest('hex')
function stateFor(agent) {
  if (!states.has(agent.session)) {
    const map = new Map(), session = agent.session
    for (let seq = Math.max(0, (session.seq ?? 0) - 5000); seq < (session.seq ?? 0); seq++) {
      try { const e = session.eventAt(seq); if (e?.type === RECORD && e.ignorable && e.data?.sessionId === session.header.id && typeof e.data.id === 'string' && typeof e.data.excerpt === 'string' && hash(e.data.excerpt) === e.data.excerptHash) { map.set(e.data.id, e.data); if (map.size > 100) map.delete(map.keys().next().value) } } catch {}
    }
    states.set(session, map)
  }
  return states.get(agent.session)
}
function commit(agent, item, status, extra = {}) {
  requirePatchworkAgent(agent)
  const previous = stateFor(agent).get(item.id) ?? item
  const data = { ...previous, ...extra, status, timeline: [...(previous.timeline ?? []), { status, at: new Date().toISOString() }] }
  const state = stateFor(agent); state.set(data.id, data)
  if (state.size > 100) state.delete(state.keys().next().value)
  try { nativeSessionApi(agent.session)?.appendPluginRecord(agent.session, RECORD, data) } catch {}
  return structuredClone(data)
}
export function admitPageEvidence(agent, page, operationId) {
  requirePatchworkAgent(agent)
  const excerpt = String(page.excerpt ?? '').slice(0, 12000), url = new URL(page.finalUrl)
  const item = { schemaVersion: 1, id: `ev_${randomUUID().replaceAll('-', '').slice(0, 24)}`, sessionId: agent.session.header.id, operationId, source: url.href, title: String(page.title).slice(0, 256), excerpt, excerptHash: hash(excerpt), trust: 'external-untrusted', contentType: page.contentType, timeline: [] }
  commit(agent, item, 'retrieved')
  const admitted = commit(agent, item, excerpt && redactPreview(excerpt) === excerpt ? 'admitted' : 'rejected', { reason: excerpt ? 'sensitive-input-check' : 'empty-excerpt' })
  if (admitted.status === 'admitted') {
    deliveries.set(item.id, agent)
    if (deliveries.size > 256) deliveries.delete(deliveries.keys().next().value)
  }
  return admitted
}
export function markEvidenceSent(evidenceId, excerpt) {
  const agent = deliveries.get(evidenceId)
  if (!isPatchworkAgent(agent)) return false
  const item = stateFor(agent).get(evidenceId)
  if (!item || hash(excerpt) !== item.excerptHash) return false
  if (item.status !== 'admitted') return ['sent', 'cited', 'verified'].includes(item.status)
  commit(agent, item, 'sent')
  return true
}
export function evidenceSnapshot(agent) {
  return isPatchworkAgent(agent) ? [...stateFor(agent).values()].map(({ excerpt, ...item }) => ({ ...item, excerptPreview: excerpt.slice(0, 600) })) : []
}
export function citeEvidence(agent, { evidenceId, quote, claim } = {}) {
  requirePatchworkAgent(agent)
  const item = stateFor(agent).get(evidenceId)
  if (!item || !['sent', 'cited', 'verified'].includes(item.status)) return { status: 'failed', failureCode: 'EVIDENCE_SENT_EXCERPT_REQUIRED' }
  if (typeof quote !== 'string' || !quote.trim() || quote.length > 2000 || !item.excerpt.includes(quote) || typeof claim !== 'string' || !claim.trim() || claim.length > 1000) return { status: 'failed', failureCode: 'EVIDENCE_EXACT_QUOTE_REQUIRED' }
  if (currentPolicy(agent).requireCrossCheck && item.verification?.result !== 'supported') return { status: 'failed', failureCode: 'EVIDENCE_CROSS_CHECK_REQUIRED' }
  const evidence = commit(agent, item, 'cited', { citation: { quote, quoteHash: hash(quote), claim: redactPreview(claim), claimHash: hash(claim), excerptHash: item.excerptHash } })
  return { status: 'committed', evidence }
}
export function compareEvidence(agent, { evidenceId, otherId, claimKey } = {}) {
  requirePatchworkAgent(agent)
  const a = stateFor(agent).get(evidenceId), b = stateFor(agent).get(otherId)
  if (!a || !b || ![a, b].every(item => ['sent', 'cited', 'verified'].includes(item.status)) || new URL(a.source).hostname === new URL(b.source).hostname) return { status: 'failed', failureCode: 'EVIDENCE_INDEPENDENT_SENT_SOURCES_REQUIRED' }
  let result = 'unknown', method = 'insufficient-structured-evidence', comparedValues = null
  if (typeof claimKey === 'string' && /^[a-zA-Z0-9_.-]{1,96}$/.test(claimKey) && !['__proto__', 'constructor', 'prototype'].includes(claimKey)) {
    try {
      const left = JSON.parse(a.excerpt), right = JSON.parse(b.excerpt)
      if (Object.hasOwn(left, claimKey) && Object.hasOwn(right, claimKey) && [left[claimKey], right[claimKey]].every(value => ['string', 'number', 'boolean'].includes(typeof value))) {
        result = left[claimKey] === right[claimKey] ? 'supported' : 'conflict'; method = 'exact-json-field-comparison'; comparedValues = [left[claimKey], right[claimKey]]
      }
    } catch {}
  }
  const verification = { result, method, claimKey: claimKey ?? null, comparedValues, sources: [a.id, b.id], hashes: [a.excerptHash, b.excerptHash], note: '验证来源字段一致性，不保证外部事实真实；非结构化语义保留 unknown。' }
  const evidence = commit(agent, a, result === 'supported' ? 'verified' : a.citation ? 'cited' : 'sent', { verification })
  return { status: 'committed', evidence, verification }
}
export function registerEvidenceTool(ctx) {
  ctx.tools.register({ name: 'patchwork_evidence', description: 'Cite only a sent Patchwork fetch excerpt using its evidenceId and exact quote. compare checks the same top-level JSON field in two independently hosted fetched excerpts; result is supported/conflict/unknown, never a model self-certified factual verdict. Search snippets alone cannot be cited as read pages.',
    parameters: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'cite', 'compare'] }, evidenceId: { type: 'string' }, otherId: { type: 'string' }, quote: { type: 'string', maxLength: 2000 }, claim: { type: 'string', maxLength: 1000 }, claimKey: { type: 'string', maxLength: 96 } }, required: ['action'], additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute(args, exec) { const agent = requirePatchworkAgent(exec.agent); return args.action === 'cite' ? citeEvidence(agent, args) : args.action === 'compare' ? compareEvidence(agent, args) : { status: 'indexed', entries: evidenceSnapshot(agent) } },
  })
}
