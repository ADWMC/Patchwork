export const textMatches = (query, ...values) => !query.trim() || values.flat(Infinity).filter(value => value != null).join(' ').toLowerCase().includes(query.trim().toLowerCase())
export function workspaceSummary(data) {
  const requirements = data.task?.requirements ?? [], jobs = data.superagent?.jobs ?? [], events = data.events ?? []
  const required = requirements.filter(item => item.required)
  return {
    requirements: required.length, passed: required.filter(item => ['passed', 'accepted'].includes(item.status)).length,
    review: jobs.filter(item => item.status === 'review').length,
    running: jobs.filter(item => ['starting', 'running'].includes(item.status)).length,
    blocked: jobs.filter(item => ['failed', 'blocked', 'waiting'].includes(item.status)).length,
    failures: events.filter(item => item.outcome === 'failed').length,
    candidates: (data.improvements?.candidates ?? []).filter(item => !item.applied && !['revoked', 'rejected'].includes(item.decision)).length,
    tokens: Number.isFinite(data.context?.tokens) && data.context.tokens >= 0 ? data.context.tokens : null,
    window: Number.isFinite(data.context?.window) && data.context.window > 0 ? data.context.window : null,
  }
}
export const queueBucket = status => ['failed', 'blocked', 'waiting'].includes(status) ? 'attention' : ['starting', 'running'].includes(status) ? 'running' : status === 'review' ? 'review' : ['done', 'cancelled'].includes(status) ? 'finished' : 'queued'
export const improvementBucket = candidate => candidate.applied ? 'applied' : ['revoked', 'rejected'].includes(candidate.decision) ? candidate.decision : 'pending'
export function evidenceGroups(items) {
  const groups = new Map()
  for (const item of items) {
    const id = item.rootCallId ?? item.id
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(item)
  }
  return [...groups].map(([id, entries]) => ({ id, entries }))
}
export function safePublicLink(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
