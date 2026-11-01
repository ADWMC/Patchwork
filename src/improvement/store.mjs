import { randomUUID } from 'node:crypto'
import { fingerprint } from '../logging/schema.mjs'
import { nativeSessionApi } from '../logging/session-log.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { redactPreview } from '../logging/redact.mjs'
import { evaluateCandidate } from '../quality/evolution.mjs'

export const IMPROVEMENT_RECORD = 'plugin:patchwork/improvement'
export const IMPROVEMENT_LIMIT = 100
const RESTORE_LIMIT = 5000
const states = new WeakMap()
const VALID_KINDS = new Set(['failure', 'correction', 'repeat', 'boundary', 'context-cost', 'ui-confusion', 'unverified-tool'])
const VALID_OBJECTS = new Set(['rule', 'memory-policy', 'tool-flow', 'ui-copy'])
const VALID_DECISIONS = new Set(['proposed', 'trial', 'enabled', 'revoked', 'superseded'])

const bounded = (value, max = 240) => typeof value === 'string' ? redactPreview(value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : ''
const list = (value, max = 8) => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, max) : []
const id = (prefix) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 24)}`
const hashId = value => typeof value === 'string' && value ? fingerprint(value).slice(0, 24) : undefined

function emptyState() {
  return { loaded: false, revision: 0, incidents: new Map(), candidates: new Map(), experiments: new Map(), recent: [], persistence: 'unavailable', failures: 0 }
}

function stateFor(agent) {
  const session = agent.session
  if (!states.has(session)) states.set(session, emptyState())
  const state = states.get(session)
  if (!state.loaded) restore(agent, state)
  return state
}

function normalizeIncident(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.id !== 'string') return undefined
  return {
    schemaVersion: 1, id: value.id.slice(0, 64), kind: VALID_KINDS.has(value.kind) ? value.kind : 'failure',
    sourceReceiptIds: list(value.sourceReceiptIds).map(hashId).filter(Boolean),
    scope: 'current-session', trigger: bounded(value.trigger, 280), action: bounded(value.action, 280),
    privacyClass: value.privacyClass === 'sensitive' ? 'sensitive' : 'ordinary',
    status: ['observed', 'triaged', 'dismissed', 'converted'].includes(value.status) ? value.status : 'observed',
    observedAt: typeof value.observedAt === 'string' ? value.observedAt : new Date().toISOString(),
  }
}

function normalizeCandidate(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.id !== 'string') return undefined
  return {
    schemaVersion: 1, id: value.id.slice(0, 64), parentId: value.parentId ? value.parentId.slice(0, 64) : null,
    incidentIds: list(value.incidentIds).map(item => item.slice(0, 64)), sourceReceiptIds: list(value.sourceReceiptIds).map(hashId).filter(Boolean),
    object: VALID_OBJECTS.has(value.object) ? value.object : 'tool-flow', trigger: bounded(value.trigger),
    hypothesis: bounded(value.hypothesis), changeScope: bounded(value.changeScope), rollbackTarget: bounded(value.rollbackTarget, 96),
    decision: VALID_DECISIONS.has(value.decision) ? value.decision : 'proposed', activationScope: value.activationScope === 'project' ? 'project' : 'session',
    applied: false, createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

function compactRun(value) {
  if (!value || typeof value !== 'object') return undefined
  const run = { mode: bounded(value.mode, 48), model: bounded(value.model, 96), harnessVersion: bounded(value.harnessVersion, 96),
    environment: bounded(value.environment, 160), initialRevision: bounded(value.initialRevision, 96), budget: bounded(value.budget, 96),
    evidenceRef: bounded(value.evidenceRef, 160), correctness: bounded(value.correctness, 32), maintenance: bounded(value.maintenance, 32),
    cost: Number.isFinite(value.cost) && value.cost >= 0 ? value.cost : null, latency: Number.isFinite(value.latency) && value.latency >= 0 ? value.latency : null,
    passedCases: list(value.passedCases, 64).map(item => item.slice(0, 96)) }
  return run
}

function normalizeExperiment(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.id !== 'string') return undefined
  const record = {
    schemaVersion: 1, id: value.id.slice(0, 64), candidateId: value.candidateId?.slice?.(0, 64),
    sourceFailureIds: list(value.sourceFailureIds).map(item => item.slice(0, 64)),
    sets: { tuning: list(value.sets?.tuning, 64).map(item => item.slice(0, 96)), heldOut: list(value.sets?.heldOut, 64).map(item => item.slice(0, 96)) },
    baseline: compactRun(value.baseline), candidate: compactRun(value.candidate), regressions: list(value.regressions, 32), sideEffects: list(value.sideEffects, 32),
    decision: 'proposed', eligibleForReview: value.eligibleForReview === true, eligibilityReasons: list(value.eligibilityReasons, 32),
    recordedAt: typeof value.recordedAt === 'string' ? value.recordedAt : new Date().toISOString(),
  }
  return record.candidateId ? record : undefined
}

function applyEvent(state, event) {
  if (!event || event.schemaVersion !== 1) return
  state.revision = Math.max(state.revision, Number.isSafeInteger(event.revision) ? event.revision : 0)
  if (event.kind === 'incident') { const item = normalizeIncident(event.data); if (item) state.incidents.set(item.id, item) }
  if (event.kind === 'candidate') { const item = normalizeCandidate(event.data); if (item) state.candidates.set(item.id, item) }
  if (event.kind === 'experiment') { const item = normalizeExperiment(event.data); if (item) state.experiments.set(item.id, item) }
  if (event.kind === 'decision') {
    const candidate = state.candidates.get(event.data?.candidateId)
    if (candidate) { candidate.decision = VALID_DECISIONS.has(event.data?.decision) ? event.data.decision : 'proposed'; candidate.applied = false; candidate.updatedAt = event.data?.at ?? new Date().toISOString() }
  }
}

function restore(agent, state) {
  state.loaded = true
  const session = agent.session
  const end = Number.isSafeInteger(session.seq) ? session.seq : 0
  const start = Math.max(0, end - RESTORE_LIMIT)
  for (let seq = start; seq < end; seq += 1) {
    try {
      const event = session.eventAt?.(seq)
      if (event?.type === IMPROVEMENT_RECORD && event.ignorable === true) applyEvent(state, event.data)
    } catch { state.persistence = 'failed'; state.failures += 1 }
  }
}

function append(agent, state, kind, data) {
  state.revision += 1
  const event = { schemaVersion: 1, kind, revision: state.revision, at: new Date().toISOString(), data }
  applyEvent(state, event)
  const api = nativeSessionApi(agent.session)
  if (api) {
    try { api.appendPluginRecord(agent.session, IMPROVEMENT_RECORD, event); state.persistence = 'native'; return event }
    catch { state.persistence = 'failed'; state.failures += 1 }
  }
  state.recent.push(event)
  if (state.recent.length > IMPROVEMENT_LIMIT) state.recent.shift()
  return event
}

function clean(item) { return item ? structuredClone(item) : item }

export function recordIncident(agent, input = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'IMPROVEMENT_SCOPE_REQUIRED' }
  const state = stateFor(agent)
  const incident = normalizeIncident({ schemaVersion: 1, id: id('inc'), kind: input.kind, sourceReceiptIds: input.sourceReceiptIds,
    trigger: input.trigger, action: input.action, privacyClass: input.privacyClass, status: 'observed', observedAt: new Date().toISOString() })
  if (!incident.trigger || !incident.sourceReceiptIds.length) return { status: 'failed', failureCode: 'IMPROVEMENT_PROVENANCE_REQUIRED' }
  append(agent, state, 'incident', incident)
  return { status: 'committed', revision: state.revision, incident: clean(incident) }
}

export function proposeCandidate(agent, input = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'IMPROVEMENT_SCOPE_REQUIRED' }
  const state = stateFor(agent)
  const incidentIds = list(input.incidentIds).map(item => item.slice(0, 64))
  if (!incidentIds.length || incidentIds.some(item => !state.incidents.has(item))) return { status: 'failed', failureCode: 'IMPROVEMENT_INCIDENT_REQUIRED' }
  const candidate = normalizeCandidate({ schemaVersion: 1, id: id('cand'), parentId: input.parentId, incidentIds,
    sourceReceiptIds: incidentIds.flatMap(item => state.incidents.get(item).sourceReceiptIds), object: input.object, trigger: input.trigger,
    hypothesis: input.hypothesis, changeScope: input.changeScope, rollbackTarget: input.rollbackTarget || 'none', decision: 'proposed',
    activationScope: input.activationScope, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  if (!candidate.trigger || !candidate.hypothesis || !candidate.changeScope) return { status: 'failed', failureCode: 'IMPROVEMENT_CANDIDATE_FIELDS_REQUIRED' }
  append(agent, state, 'candidate', candidate)
  return { status: 'committed', revision: state.revision, candidate: clean(candidate) }
}

export function recordExperiment(agent, input = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'IMPROVEMENT_SCOPE_REQUIRED' }
  const state = stateFor(agent)
  const candidate = state.candidates.get(input.candidateId)
  if (!candidate) return { status: 'failed', failureCode: 'IMPROVEMENT_CANDIDATE_NOT_FOUND' }
  const sourceFailureIds = list(input.sourceFailureIds).map(item => item.slice(0, 64))
  if (!sourceFailureIds.length || sourceFailureIds.some(item => !state.incidents.has(item) && !state.candidates.has(item))) return { status: 'failed', failureCode: 'IMPROVEMENT_PROVENANCE_REQUIRED' }
  const raw = { candidateId: candidate.id, parentId: candidate.parentId ?? 'baseline', hypothesis: candidate.hypothesis, changeScope: candidate.changeScope,
    rollbackTarget: candidate.rollbackTarget, sourceFailureIds, sets: input.sets, baseline: input.baseline, candidate: input.candidate,
    regressions: input.regressions, sideEffects: input.sideEffects, decision: 'proposed' }
  const result = evaluateCandidate(raw)
  const experiment = normalizeExperiment({ schemaVersion: 1, id: id('exp'), candidateId: candidate.id, sourceFailureIds, sets: input.sets,
    baseline: input.baseline, candidate: input.candidate, regressions: input.regressions, sideEffects: input.sideEffects,
    eligibleForReview: result.eligibleForReview, eligibilityReasons: result.reasons, recordedAt: new Date().toISOString() })
  append(agent, state, 'experiment', experiment)
  return { status: 'committed', revision: state.revision, experiment: clean(experiment), eligibility: result }
}

function assertRevision(state, expectedRevision) {
  if (expectedRevision !== undefined && expectedRevision !== state.revision) return { status: 'failed', failureCode: 'IMPROVEMENT_REVISION_CONFLICT', revision: state.revision }
}

export function decideCandidate(agent, candidateId, expectedRevision, { mode = 'trial', userConfirmed = false } = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'IMPROVEMENT_SCOPE_REQUIRED' }
  if (userConfirmed !== true) return { status: 'failed', failureCode: 'IMPROVEMENT_USER_CONFIRMATION_REQUIRED' }
  const state = stateFor(agent)
  const conflict = assertRevision(state, expectedRevision); if (conflict) return conflict
  const candidate = state.candidates.get(candidateId)
  const experiment = [...state.experiments.values()].find(item => item.candidateId === candidateId && item.eligibleForReview)
  if (!candidate || !experiment) return { status: 'failed', failureCode: 'IMPROVEMENT_NOT_ELIGIBLE' }
  if (!['trial', 'enabled'].includes(mode)) return { status: 'failed', failureCode: 'IMPROVEMENT_INVALID_DECISION' }
  append(agent, state, 'decision', { candidateId, decision: mode, at: new Date().toISOString() })
  return { status: 'committed', revision: state.revision, candidate: clean(state.candidates.get(candidateId)), activation: 'review-record-only' }
}

export function rollbackCandidate(agent, candidateId, expectedRevision, { userConfirmed = false } = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'IMPROVEMENT_SCOPE_REQUIRED' }
  if (userConfirmed !== true) return { status: 'failed', failureCode: 'IMPROVEMENT_USER_CONFIRMATION_REQUIRED' }
  const state = stateFor(agent); const conflict = assertRevision(state, expectedRevision); if (conflict) return conflict
  if (!state.candidates.has(candidateId)) return { status: 'failed', failureCode: 'IMPROVEMENT_CANDIDATE_NOT_FOUND' }
  append(agent, state, 'decision', { candidateId, decision: 'revoked', at: new Date().toISOString() })
  return { status: 'committed', revision: state.revision, candidate: clean(state.candidates.get(candidateId)), activation: 'rolled-back' }
}

export function improvementSnapshot(agent) {
  if (!isPatchworkAgent(agent)) return null
  const state = stateFor(agent)
  return { schemaVersion: 1, status: 'indexed', persistence: state.persistence, failures: state.failures, revision: state.revision,
    automaticActivation: 'disabled', incidents: [...state.incidents.values()].slice(-IMPROVEMENT_LIMIT).map(clean),
    candidates: [...state.candidates.values()].slice(-IMPROVEMENT_LIMIT).map(clean), experiments: [...state.experiments.values()].slice(-IMPROVEMENT_LIMIT).map(clean) }
}

export function loadImprovementState(agent) { return isPatchworkAgent(agent) ? improvementSnapshot(agent) : null }
export function requireImprovementAgent(agent) { return requirePatchworkAgent(agent) }
