import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { redactPreview } from '../logging/redact.mjs'

export const TASK_RECORD = 'plugin:patchwork/task'
export const LIMITS = { requirements: 24, artifacts: 24, coverage: 64, receipts: 32 }
const idPattern = /^[a-zA-Z0-9_.:-]{1,96}$/
export function taskId(value) {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error('invalid task item id')
  return value
}
export function safeLabel(value, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('invalid bounded label')
  return redactPreview(value).replace(/[\u0000-\u001f]/g, ' ').slice(0, max)
}
function list(value, max) {
  if (!Array.isArray(value) || value.length > max) throw new Error('invalid bounded list')
  return value
}
function unique(items) {
  if (new Set(items.map(x => x.id ?? x)).size !== items.length) throw new Error('duplicate task item')
  return items
}
function absolute(value) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.length > 2048) throw new Error('absolute artifact/reference path required')
  return value
}
export function initialTask(sessionId, workspace) {
  return { schemaVersion: 1, sessionId, taskId: randomUUID(), revision: 0, title: null,
    phase: 'unassessed', understandingStatus: 'unassessed', source: { kind: 'unknown', eventId: null },
    workspace: typeof workspace === 'string' && isAbsolute(workspace) ? workspace : null,
    references: [], instance: null, requirements: [], artifacts: [], receipts: [],
    candidates: [], inputIds: [], lastCorrection: null, status: 'in-progress', policy: 'structured-tools-only', persistence: 'unavailable' }
}
export function defineRequirements(input) {
  return unique(list(input, LIMITS.requirements).map(r => {
    const kind = r.kind ?? 'command'
    if (!['command', 'artifact', 'semantic'].includes(kind)) throw new Error('invalid acceptance kind')
    return { id: taskId(r.id), label: safeLabel(r.label), kind, required: r.required !== false,
      targets: unique(list(r.targets ?? [], LIMITS.artifacts).map(taskId)),
      coverage: unique(list(r.coverage ?? ['all'], LIMITS.coverage).map(taskId)),
      status: 'pending', evidence: [], failures: 0, assessment: null }
  })).map(r => { if (!r.coverage.length) throw new Error('acceptance coverage must not be empty'); return r })
}
export function aggregateTask(state) {
  if (['cancelled', 'superseded'].includes(state.status)) return state.status
  if (state.persistence === 'failed' || state.understandingStatus === 'needs-clarification') return 'blocked'
  const required = state.requirements.filter(r => r.required)
  if (!state.title || required.length === 0 || state.understandingStatus !== 'stated') return 'in-progress'
  if (required.every(r => r.status === 'passed')) return 'ready'
  if (required.some(r => r.failures >= 3 && r.status === 'failed')) return 'blocked'
  return required.some(r => r.status !== 'pending') ? 'partial' : 'in-progress'
}

export function safeReceipt(input) {
  const outcome = input.outcome
  if (!['passed', 'failed', 'unknown', 'cancelled'].includes(outcome)) throw new Error('invalid receipt outcome')
  if (!['command', 'artifact'].includes(input.kind)) throw new Error('invalid receipt kind')
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('invalid receipt revision')
  return { id: taskId(input.id), requirementId: taskId(input.requirementId), revision: input.revision,
    unit: taskId(input.unit), kind: input.kind, outcome, current: input.current === true,
    tool: taskId(input.tool), callId: safeLabel(input.callId, 256),
    exitCode: Number.isInteger(input.exitCode) ? input.exitCode : null,
    instanceId: input.instanceId ? taskId(input.instanceId) : null,
    targets: list(input.targets ?? [], LIMITS.artifacts).map(a => ({ id: taskId(a.id), version: taskId(a.version) })),
    at: Number.isFinite(input.at) ? input.at : 0, strength: input.kind === 'command' ? 'tool-execution' : 'structure-only' }
}

/** Reconstruct a checkpoint from whitelisted fields; do not trust stored ready. */
export function readTaskCheckpoint(input, sessionId, workspace) {
  if (input?.schemaVersion !== 1 || input.sessionId !== sessionId || input.workspace !== workspace || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('invalid task checkpoint')
  let next = initialTask(sessionId, workspace)
  next.taskId = taskId(input.taskId)
  if (input.title !== null) next = reduceTask(next, { kind: 'define', data: {
    title: input.title, phase: input.phase, references: input.references, instance: input.instance,
    requirements: input.requirements, needsClarification: input.understandingStatus === 'needs-clarification' } })
  next.revision = input.revision
  next.inputIds = unique(list(input.inputIds ?? [], 128).map(id => {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new Error('invalid task input fingerprint')
    return id
  }))
  next.source = { kind: ['unknown', 'observed-user-kind', 'producer', 'restored'].includes(input.source?.kind) ? input.source.kind : 'unknown', eventId: input.source?.eventId ? safeLabel(input.source.eventId, 256) : null }
  next.understandingStatus = ['stated', 'unassessed', 'needs-clarification'].includes(input.understandingStatus) ? input.understandingStatus : 'unassessed'
  next.artifacts = list(input.artifacts, LIMITS.artifacts).map(a => {
    if (!['current', 'changed', 'superseded'].includes(a.status)) throw new Error('invalid artifact status')
    return { id: taskId(a.id), path: absolute(a.path), version: taskId(a.version), stamp: safeLabel(a.stamp, 128), status: a.status, supersedes: a.supersedes ? taskId(a.supersedes) : null }
  })
  next.receipts = list(input.receipts, LIMITS.receipts).map(safeReceipt)
  next.candidates = list(input.candidates ?? [], 12).map(c => ({ id: taskId(c.id), sourceReceiptId: taskId(c.sourceReceiptId),
    trigger: safeLabel(c.trigger), action: safeLabel(c.action), revision: c.revision, status: 'candidate' }))
  next.requirements = next.requirements.map((r, i) => {
    const prior = input.requirements[i]
    r.evidence = list(prior.evidence ?? [], LIMITS.coverage).map(safeReceipt)
    if (r.evidence.some(e => e.requirementId !== r.id || !r.coverage.includes(e.unit) || !e.current)) throw new Error('invalid acceptance evidence')
    r.failures = Number.isSafeInteger(prior.failures) && prior.failures >= 0 ? Math.min(prior.failures, 1000) : 0
    r.status = prior.status === 'stale' ? 'stale' : r.evidence.some(e => e.outcome === 'failed') ? 'failed'
      : r.coverage.every(unit => r.evidence.some(e => e.unit === unit && e.outcome === 'passed')) && r.coverage.length ? 'passed'
        : r.evidence.length ? 'unknown' : 'pending'
    if (r.kind === 'semantic') { r.evidence = []; r.status = prior.status === 'pending' ? 'pending' : 'unknown' }
    return r
  })
  if (input.lastCorrection) next.lastCorrection = { revision: input.lastCorrection.revision, affected: list(input.lastCorrection.affected, LIMITS.requirements).map(taskId) }
  next.persistence = 'native'
  next.status = ['cancelled', 'superseded'].includes(input.status) ? input.status : aggregateTask(next)
  return next
}
function stale(requirement) {
  return { ...requirement, status: requirement.evidence.length || requirement.status === 'passed' ? 'stale' : 'pending', evidence: [], failures: 0 }
}
/** Pure transitions. Model declarations narrow policy; they never grant host permissions. */
export function reduceTask(state, event) {
  if (event.baseRevision !== undefined && event.baseRevision !== state.revision) throw new Error('task revision conflict; inspect current task')
  let next = structuredClone(state)
  switch (event.kind) {
    case 'incoming': {
      safeLabel(event.eventId, 256)
      const inputId = createHash('sha256').update(JSON.stringify([event.eventId, event.sourceKind ?? 'unknown'])).digest('hex')
      if ((next.inputIds ?? []).includes(inputId)) return state
      next.inputIds = [...(next.inputIds ?? []), inputId].slice(-128)
      next.revision++
      next.source = { kind: event.sourceKind === 'user' ? 'observed-user-kind' : event.sourceKind === 'restored' ? 'restored' : 'producer', eventId: safeLabel(event.eventId, 256) }
      next.understandingStatus = 'unassessed'
      next.requirements = next.requirements.map(stale)
      break
    }
    case 'define':
    case 'correct': {
      const data = event.data
      const correcting = event.kind === 'correct'
      const phase = correcting && data.phase === undefined ? next.phase : data.phase
      const title = correcting && data.title === undefined ? next.title : data.title
      if (!['analysis', 'plan', 'implement', 'verify'].includes(phase)) throw new Error('phase must be analysis, plan, implement or verify; define requires phase, correct may inherit it from an existing task')
      if (typeof title !== 'string' || !title.trim()) throw new Error('define requires title; correct may inherit it from an existing task')
      next.revision++
      if (event.kind === 'define' && next.title) {
        next.taskId = next.taskId.split(':')[0] + ':r' + next.revision
        next.artifacts = []; next.receipts = []; next.candidates = []
      }
      next.title = safeLabel(title)
      next.phase = phase
      next.understandingStatus = data.needsClarification === true ? 'needs-clarification' : 'stated'
      next.references = unique(list(data.references ?? next.references, 24).map(absolute))
      if (!correcting || data.instance !== undefined) next.instance = data.instance ? { id: taskId(data.instance.id), endpoint: new URL(data.instance.endpoint).origin } : null
      if (data.requirements !== undefined) next.requirements = defineRequirements(data.requirements)
      else {
        const affected = data.affected ?? next.requirements.map(r => r.id)
        list(affected, LIMITS.requirements).forEach(id => { if (!next.requirements.some(r => r.id === id)) throw new Error('unknown affected requirement') })
        next.requirements = next.requirements.map(r => affected.includes(r.id) ? stale(r) : r)
      }
      if (event.kind === 'correct') next.lastCorrection = { revision: next.revision, affected: data.affected ?? next.requirements.map(r => r.id) }
      next.status = 'in-progress'
      break
    }
    case 'artifact': {
      const data = event.data
      const artifact = { id: taskId(data.id), path: absolute(data.path), version: taskId(data.version), stamp: safeLabel(data.stamp, 128),
        supersedes: data.supersedes ? taskId(data.supersedes) : null, status: 'current' }
      const prior = next.artifacts.find(a => a.id === artifact.id)
      if (prior && prior.path === artifact.path && prior.version === artifact.version) return state
      if (!prior && next.artifacts.length >= LIMITS.artifacts) throw new Error('artifact limit reached')
      next.artifacts = next.artifacts.filter(a => a.id !== artifact.id).map(a => a.id === artifact.supersedes ? { ...a, status: 'superseded' } : a)
      next.artifacts.push(artifact)
      next.revision++
      next.requirements = next.requirements.map(r => r.targets.includes(artifact.id) || r.targets.includes(artifact.supersedes) ? stale(r) : r)
      break
    }
    case 'invalidate':
      next.revision++
      next.requirements = next.requirements.map(r => !event.targets?.length || r.targets.some(id => event.targets.includes(id)) ? stale(r) : r)
      for (const a of next.artifacts) if (!event.targets?.length || event.targets.includes(a.id)) a.status = 'changed'
      break
    case 'receipt': {
      const receipt = safeReceipt(event.receipt)
      if (next.receipts.some(r => r.id === receipt.id)) return state
      next.receipts.push(receipt)
      next.receipts = next.receipts.slice(-LIMITS.receipts)
      const r = next.requirements.find(r => r.id === receipt.requirementId)
      if (!r || receipt.revision !== next.revision || !receipt.current || r.kind !== receipt.kind || !r.coverage.includes(receipt.unit)) break
      r.evidence = [...r.evidence.filter(e => e.unit !== receipt.unit), receipt].slice(-LIMITS.coverage)
      r.failures = receipt.outcome === 'failed' ? r.failures + 1 : receipt.outcome === 'passed' ? 0 : r.failures
      r.status = r.evidence.some(e => e.outcome === 'failed') ? 'failed'
        : r.coverage.every(unit => r.evidence.some(e => e.unit === unit && e.outcome === 'passed')) ? 'passed'
          : r.evidence.some(e => ['unknown', 'cancelled'].includes(e.outcome)) ? 'unknown' : 'pending'
      break
    }
    case 'assessment': {
      const r = next.requirements.find(r => r.id === event.id && r.kind === 'semantic')
      if (!r) throw new Error('semantic requirement required')
      if (!['supported', 'contradicted', 'unknown'].includes(event.verdict)) throw new Error('invalid semantic verdict')
      r.assessment = { verdict: event.verdict, source: 'model-stated' }
      r.status = 'unknown'
      break
    }
    case 'candidate': {
      const receipt = next.receipts.find(r => r.id === event.data.sourceReceiptId && r.outcome !== 'passed')
      if (!receipt) throw new Error('candidate requires a retained failure or unknown receipt')
      if (next.candidates.length >= 12 || next.candidates.some(c => c.id === event.data.id)) throw new Error('candidate limit or duplicate id')
      next.candidates.push({ id: taskId(event.data.id), sourceReceiptId: receipt.id, trigger: safeLabel(event.data.trigger),
        action: safeLabel(event.data.label), revision: next.revision, status: 'candidate' })
      break
    }
    case 'cancel': next.revision++; next.status = 'cancelled'; break
    default: throw new Error('unknown task transition')
  }
  next.status = aggregateTask(next)
  return next
}
