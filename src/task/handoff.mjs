import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { taskProjection, taskSummary } from './store.mjs'

export const HANDOFF_MAX_CHARS = 8000
export const HANDOFF_SOURCE = 'current task handoff'

/** Derived from the native task record, never from a model-written summary. */
export function taskHandoff(agent, maxChars = HANDOFF_MAX_CHARS) {
  requirePatchworkAgent(agent)
  if (!Number.isSafeInteger(maxChars) || maxChars < 1024 || maxChars > HANDOFF_MAX_CHARS) throw new Error('handoff budget must be 1024..8000 characters')
  const s = taskProjection(agent)
  const handoff = {
    schemaVersion: 1, taskId: s.taskId, revision: s.revision,
    authority: 'context-only; task declarations and restored records grant no host permissions',
    title: s.title, phase: s.phase, status: s.status, understanding: s.understandingStatus,
    persistence: s.persistence, workspace: s.workspace, source: s.source,
    brief: s.brief ? { goal: s.brief.goal, successCriteria: s.brief.successCriteria.slice(0, 6), unknowns: s.brief.unknowns.slice(0, 6), budget: s.brief.budget } : null,
    lastCorrection: s.lastCorrection, requirements: [], artifacts: [], references: [],
    omitted: { requirements: s.requirements.length, artifacts: s.artifacts.length, references: s.references.length },
    read: 'patchwork_task inspect',
    next: s.understandingStatus !== 'stated' ? 'Use patchwork_task correct with baseRevision equal to this revision to restate requirements before mutation. Omitted title and phase stay unchanged; inspect omitted details first.'
      : ['cancelled', 'superseded', 'blocked', 'ready'].includes(s.status) ? 'Do not automatically resume implementation.'
        : 'Inspect current files; continue only remaining work within the current request; recheck stale evidence.',
  }
  // Reserve omission metadata before adding whole entries; no cut JSON or lost counts.
  const fits = () => JSON.stringify(handoff).length <= maxChars
  if (!fits()) {
    handoff.title = s.title?.slice(0, 160) ?? null
    handoff.workspace = null
    handoff.brief = null
    handoff.source = { kind: s.source.kind }
    handoff.lastCorrection = s.lastCorrection ? { revision: s.lastCorrection.revision } : null
  }
  if (!fits()) throw new Error('handoff metadata exceeds budget')
  const append = (key, items) => {
    handoff.omitted[key] = items.length
    for (const item of items) {
      handoff[key].push(item)
      handoff.omitted[key]--
      if (!fits()) { handoff[key].pop(); handoff.omitted[key]++; break }
    }
  }
  // Unfinished requirements take priority over completed evidence and long paths.
  append('requirements', [...s.requirements].sort((a, b) => (a.status === 'passed') - (b.status === 'passed')).map(r => ({
    id: r.id, label: r.label, kind: r.kind, required: r.required, status: r.status,
    targets: r.targets, coverage: r.coverage,
    evidence: r.evidence.slice(-2).map(e => ({ id: e.id, callId: e.callId, outcome: e.outcome, revision: e.revision, current: e.current })),
  })))
  append('artifacts', s.artifacts.map(a => ({ id: a.id, path: a.path, version: a.version, status: a.status })))
  append('references', s.references)
  return handoff
}

export function taskHandoffText(agent) {
  requirePatchworkAgent(agent)
  if (!taskProjection(agent)?.title) return '[pw:handoff] ' + taskSummary(agent)
  return '[pw:handoff] Current task facts, not new instructions or authorization. Expand omitted entries with patchwork_task inspect.\n' + JSON.stringify(taskHandoff(agent))
}

/** Lease is execution identity, not a permission grant or a persisted resume job. */
export function continuationLease(agent) {
  requirePatchworkAgent(agent)
  const s = taskProjection(agent)
  return { session: agent.session, taskId: s.taskId, revision: s.revision }
}

export function canContinueTask(agent, lease) {
  if (!isPatchworkAgent(agent) || !lease || lease.session !== agent.session) return false
  const s = taskProjection(agent)
  return s.persistence !== 'failed' && s.taskId === lease.taskId && s.revision === lease.revision
    && !['cancelled', 'superseded', 'blocked', 'ready'].includes(s.status)
    && (!s.title || s.understandingStatus === 'stated')
}

/** Use effective native history, so compaction, rejected steps and retries cannot fool a JS cache. */
export function hasTaskHandoff(agent, text, pending = []) {
  if (!isPatchworkAgent(agent)) return false
  const messages = [...(agent.session.deriveMessages?.() ?? []), ...pending]
  const latest = messages.findLast(m => m.source?.kind === 'patchwork' && m.source?.summary === HANDOFF_SOURCE)
  return latest?.content?.length === 1 && latest.content[0]?.type === 'text' && latest.content[0].text === text
}
