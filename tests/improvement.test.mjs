import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'
import { registerSourceReceipt } from '../src/improvement/provenance.mjs'
import { currentPolicy } from '../src/improvement/policy.mjs'
import { scopedAgent } from './helpers/agent.mjs'
import { decideCandidate, improvementSnapshot, proposeCandidate, recordExperiment, recordIncident, rollbackCandidate, runCandidateExperiment } from '../src/improvement/store.mjs'
import { isolatedEnvironment, runIsolatedCommand, validateIsolationSpec } from '../src/improvement/runner.mjs'
import { IMPROVEMENT_ROUTE_PATH, registerImprovementRoute } from '../src/improvement/route.mjs'
import { registerImprovementTool } from '../src/improvement/tool.mjs'

function agent(id = 'improvement-session') {
  const a = scopedAgent({ session: { header: { id, cwd: process.cwd() } } })
  for (const id of ['receipt-1', 'receipt-2', 'route-receipt']) registerSourceReceipt(a, { id, outcome: 'failed' })
  return a
}

async function experiment(agent, candidateId) { return runCandidateExperiment(agent, candidateId, improvementSnapshot(agent).revision) }

test('improvement tool list exposes recent receipt ids for incident provenance', async () => {
  const a = agent('improvement-tool-list')
  let tool, dispose
  registerImprovementTool({ tools: { register(value) { tool = value } }, effect(fn) { dispose = fn() } })
  const list = await tool.execute({ action: 'list' }, { agent: a })
  assert.ok(list.receipts.some(receipt => receipt.id === 'receipt-1'))
  const incident = await tool.execute({ action: 'incident', kind: 'failure', sourceReceiptIds: ['receipt-1'], trigger: 'tool failure', actionText: 'retain evidence' }, { agent: a })
  assert.equal(incident.status, 'committed')
  dispose()
})

test('improvement records are scope-bound, provenance-bound and proposal-first', () => {
  const a = agent('improvement-a')
  const incident = recordIncident(a, { kind: 'failure', sourceReceiptIds: ['receipt-1'], trigger: 'tool failed', action: 'retain evidence' })
  assert.equal(incident.status, 'committed')
  const incomplete = proposeCandidate(a, { incidentIds: [incident.incident.id], object: 'rule', patch: { version: 1, setting: 'verifyBeforeDelivery', value: true } })
  assert.equal(incomplete.failureCode, 'IMPROVEMENT_CANDIDATE_FIELDS_REQUIRED')
  assert.deepEqual(incomplete.missing, ['trigger', 'hypothesis', 'changeScope'])
  const candidate = proposeCandidate(a, { incidentIds: [incident.incident.id], object: 'tool-flow', patch: { version: 1, setting: 'requireCrossCheck', value: true }, trigger: 'repeat failure', hypothesis: 'change flow', changeScope: 'current project', rollbackTarget: 'baseline' })
  assert.equal(candidate.candidate.decision, 'proposed')
  assert.equal(improvementSnapshot(a).automaticActivation, 'disabled')
  const standard = agent('improvement-standard'); standard.selectPreset('standard')
  assert.equal(recordIncident(standard, { kind: 'failure', sourceReceiptIds: ['x'], trigger: 'x' }).failureCode, 'IMPROVEMENT_SCOPE_REQUIRED')
})

test('only an eligible experiment can receive explicit trial and rollback decisions', async () => {
  const a = agent('improvement-experiment')
  const incident = recordIncident(a, { kind: 'failure', sourceReceiptIds: ['receipt-2'], trigger: 'tool failed', action: 'retain evidence' })
  const candidate = proposeCandidate(a, { incidentIds: [incident.incident.id], object: 'rule', patch: { version: 1, setting: 'verifyBeforeDelivery', value: true }, trigger: 'bounded rule', hypothesis: 'reduce repeats', changeScope: 'project', rollbackTarget: 'baseline' })
  const no = decideCandidate(a, candidate.candidate.id, 1, { mode: 'trial', userConfirmed: false })
  assert.equal(no.failureCode, 'IMPROVEMENT_USER_CONFIRMATION_REQUIRED')
  const recorded = await experiment(a, candidate.candidate.id, incident.incident.id)
  assert.equal(recorded.eligibility.eligibleForReview, true)
  const trial = decideCandidate(a, candidate.candidate.id, recorded.revision, { mode: 'trial', userConfirmed: true })
  assert.equal(trial.candidate.decision, 'trial')
  assert.equal(trial.candidate.applied, true)
  assert.equal(currentPolicy(a).verifyBeforeDelivery, true)
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
  const candidate = proposeCandidate(a, { incidentIds: [incident.incident.id], object: 'tool-flow', patch: { version: 1, setting: 'requireCrossCheck', value: true }, trigger: 'route candidate', hypothesis: 'reduce repeat', changeScope: 'project', rollbackTarget: 'baseline' })
  const recorded = await experiment(a, candidate.candidate.id, incident.incident.id)
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
    const generic = await call({ action: 'propose', incidentId: incident.incident.id, object: 'ui-copy', trigger: 'route generic', hypothesis: 'generic', changeScope: 'session', patch: { version: 1, setting: 'reviewDetail', value: 'full' }, expectedRevision: improvementSnapshot(a).revision })
    assert.equal(generic.status, 200); assert.equal(generic.json.candidate.trigger, 'route generic')
  } finally { dispose?.() }
})

test('fabricated sources and model supplied experiment metrics are refused', () => { const a = agent('forgery'); assert.equal(recordIncident(a, {sourceReceiptIds:['fake'],trigger:'x'}).failureCode, 'IMPROVEMENT_SOURCE_NOT_FOUND'); const inc=recordIncident(a,{sourceReceiptIds:['receipt-1'],trigger:'failure'}); const candidate=proposeCandidate(a,{incidentIds:[inc.incident.id],object:'rule',trigger:'x',hypothesis:'x',changeScope:'session'}); assert.equal(recordExperiment(a,{candidateId:candidate.candidate.id,baseline:{mode:'real-host'},candidate:{mode:'real-host'}}).failureCode,'IMPROVEMENT_RUNNER_EVIDENCE_REQUIRED') })
