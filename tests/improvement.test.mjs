import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { decideCandidate, improvementSnapshot, proposeCandidate, recordExperiment, recordIncident, rollbackCandidate } from '../src/improvement/store.mjs'
import { isolatedEnvironment, runIsolatedCommand, validateIsolationSpec } from '../src/improvement/runner.mjs'
import { IMPROVEMENT_ROUTE_PATH, registerImprovementRoute } from '../src/improvement/route.mjs'

function agent(id = 'improvement-session') {
  return scopedAgent({ session: { header: { id, cwd: process.cwd() } } })
}

function experiment(agent, candidateId, incidentId) {
  const run = { mode: 'real-host', model: 'fixed-model', harnessVersion: 'fixed-host', environment: 'isolated-lab', initialRevision: 'same-code', budget: 'same-budget', evidenceRef: 'local:receipts', correctness: 'passed', maintenance: 'passed', passedCases: ['tuning', 'heldout'], cost: 1, latency: 10 }
  return recordExperiment(agent, { candidateId, sourceFailureIds: [incidentId], sets: { tuning: ['tuning'], heldOut: ['heldout'] }, baseline: { ...run }, candidate: { ...run }, regressions: [], sideEffects: [] })
}

test('improvement records are scope-bound, provenance-bound and proposal-first', () => {
  const a = agent('improvement-a')
  const incident = recordIncident(a, { kind: 'failure', sourceReceiptIds: ['receipt-1'], trigger: 'tool failed', action: 'retain evidence' })
  assert.equal(incident.status, 'committed')
  const candidate = proposeCandidate(a, { incidentIds: [incident.incident.id], object: 'tool-flow', trigger: 'repeat failure', hypothesis: 'change flow', changeScope: 'current project', rollbackTarget: 'baseline' })
  assert.equal(candidate.candidate.decision, 'proposed')
  assert.equal(improvementSnapshot(a).automaticActivation, 'disabled')
  const standard = agent('improvement-standard'); standard.selectPreset('standard')
  assert.equal(recordIncident(standard, { kind: 'failure', sourceReceiptIds: ['x'], trigger: 'x' }).failureCode, 'IMPROVEMENT_SCOPE_REQUIRED')
})

test('only an eligible experiment can receive explicit trial and rollback decisions', () => {
  const a = agent('improvement-experiment')
  const incident = recordIncident(a, { kind: 'failure', sourceReceiptIds: ['receipt-2'], trigger: 'tool failed', action: 'retain evidence' })
  const candidate = proposeCandidate(a, { incidentIds: [incident.incident.id], object: 'rule', trigger: 'bounded rule', hypothesis: 'reduce repeats', changeScope: 'project', rollbackTarget: 'baseline' })
  const no = decideCandidate(a, candidate.candidate.id, 1, { mode: 'trial', userConfirmed: false })
  assert.equal(no.failureCode, 'IMPROVEMENT_USER_CONFIRMATION_REQUIRED')
  const recorded = experiment(a, candidate.candidate.id, incident.incident.id)
  assert.equal(recorded.eligibility.eligibleForReview, true)
  const trial = decideCandidate(a, candidate.candidate.id, recorded.revision, { mode: 'trial', userConfirmed: true })
  assert.equal(trial.candidate.decision, 'trial')
  const rollback = rollbackCandidate(a, candidate.candidate.id, trial.revision, { userConfirmed: true })
  assert.equal(rollback.candidate.decision, 'revoked')
  assert.equal(improvementSnapshot(a).candidates[0].applied, false)
})

test('isolated runner refuses the current DSH home and overlapping paths', () => {
  const bad = validateIsolationSpec({ dshHome: 'C:/current', workspace: 'C:/work', resultsDir: 'C:/results', port: 43210, model: 'm', budget: 10 }, { currentDshHome: 'C:/current' })
  assert.equal(bad.ok, false)
  assert.ok(bad.reasons.includes('must-not-use-current-dsh-home'))
  const good = isolatedEnvironment({ dshHome: 'C:/isolated/dsh', workspace: 'C:/isolated/work', resultsDir: 'C:/isolated/results', port: 43210, model: 'm', budget: 10 }, { currentDshHome: 'C:/main' })
  assert.equal(good.ok, true)
  assert.equal(good.env.DSH_HOME, 'C:\\isolated\\dsh')
  assert.equal(good.env.PATCHWORK_EVOLUTION_PORT, '43210')
})

test('isolated runner executes shell-free with bounded output and injected DSH_HOME', async () => {
  const root = await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(join(process.env.TEMP ?? process.cwd(), 'patchwork-runner-')))
  const result = await runIsolatedCommand({ dshHome: join(root, 'dsh'), workspace: join(root, 'work'), resultsDir: join(root, 'results'), port: 43211, model: 'm', budget: 10 },
    { command: process.execPath, args: ['-e', "process.stdout.write(process.env.DSH_HOME); process.stderr.write('stderr')"], timeoutMs: 5000, maxOutputBytes: 256 }, { currentDshHome: join(root, 'main') })
  assert.equal(result.status, 'completed')
  assert.equal(result.stdout, join(root, 'dsh'))
  assert.equal(result.stderr, 'stderr')
})

test('improvement route enforces token, scope and CAS before recording a decision', async () => {
  const a = agent('improvement-route')
  const incident = recordIncident(a, { kind: 'failure', sourceReceiptIds: ['route-receipt'], trigger: 'route failure', action: 'retain evidence' })
  const candidate = proposeCandidate(a, { incidentIds: [incident.incident.id], object: 'tool-flow', trigger: 'route candidate', hypothesis: 'reduce repeat', changeScope: 'project', rollbackTarget: 'baseline' })
  const recorded = experiment(a, candidate.candidate.id, incident.incident.id)
  let route, dispose
  const server = { register(value) { route = value; return () => {} } }
  const standard = agent('improvement-route-standard'); standard.selectPreset('standard')
  const ctx = { get(name) { if (name === 'webServer') return server; if (name === 'agents') return { get(id) { return id === 'improvement-route' ? a : standard } } }, effect(fn) { dispose = fn() } }
  registerImprovementRoute(ctx, { token: 'improvement-secret' })
  const call = async (body, { token = 'improvement-secret', sessionId = 'improvement-route' } = {}) => {
    const listeners = new Map(); const request = { method: 'POST', url: `${IMPROVEMENT_ROUTE_PATH}?sessionId=${sessionId}`, headers: { 'x-patchwork-token': token }, on(event, listener) { listeners.set(event, listener); return this }, destroy() {} }
    const response = { statusCode: 0, body: '', setHeader() {}, end(value) { this.body = value } }
    const pending = route.handler(request, response)
    listeners.get('data')?.(Buffer.from(JSON.stringify(body))); listeners.get('end')?.(); await pending
    return { status: response.statusCode, json: JSON.parse(response.body) }
  }
  try {
    assert.equal((await call({ action: 'trial', candidateId: candidate.candidate.id, expectedRevision: recorded.revision }, { token: 'wrong' })).status, 403)
    assert.equal((await call({ action: 'trial', candidateId: candidate.candidate.id, expectedRevision: recorded.revision - 1 })).status, 409)
    assert.equal((await call({ action: 'trial', candidateId: candidate.candidate.id, expectedRevision: recorded.revision })).status, 200)
    assert.equal((await call({ action: 'list' }, { sessionId: 'improvement-route-standard' })).status, 403)
  } finally { dispose?.() }
})
