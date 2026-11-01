import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const originalDshHome = process.env.DSH_HOME
const isolatedDshHome = await mkdtemp(join(tmpdir(), 'patchwork-real-improvement-'))
process.env.DSH_HOME = isolatedDshHome
const { bootPatchwork, loadDriver } = await import('../tests/real-composition/harness.mjs')
const boot = await bootPatchwork({ actionFusion: true, memoryEnabled: true })
const startedAt = new Date().toISOString()
try {
  const { createAgent, selectPreset } = await loadDriver()
  const { agent: patchwork, tools } = createAgent({ sessionId: 'improvement-patchwork', preset: 'patchwork', cwd: process.cwd() })
  const { agent: standard } = createAgent({ sessionId: 'improvement-standard', preset: 'standard', cwd: process.cwd() })
  const patchworkNames = tools.schemas(patchwork).map(schema => schema.name)
  const standardNames = tools.schemas(standard).map(schema => schema.name)
  await tools.execute({ agent: patchwork, name: 'pwsh', callId: 'real-host-receipt', rootCallId: 'real-host-receipt', arguments: { command: 'exit 7', description: 'Explicit synthetic failure using the real DSH tool' }, signal: new AbortController().signal })
  const incident = await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'real-improvement-incident', rootCallId: 'real-improvement-incident',
    arguments: { action: 'incident', kind: 'failure', sourceReceiptIds: ['real-host-receipt'], trigger: 'real host failure', actionText: 'retain evidence' }, signal: new AbortController().signal })
  const { currentPolicy } = await import('../src/improvement/policy.mjs')
  const { decideCandidate, rollbackCandidate } = await import('../src/improvement/store.mjs')
  const invoke = async args => (await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'verify-' + args.action, rootCallId: 'verify-' + args.action, arguments: args, signal: new AbortController().signal })).value
  const proposal = await invoke({ action: 'propose', incidentIds: [incident.value.incident.id], object: 'rule', trigger: 'verify delivery', hypothesis: 'bounded reminder', changeScope: 'this temporary session', patch: { version: 1, setting: 'verifyBeforeDelivery', value: true } })
  const experiment = await invoke({ action: 'experiment', candidateId: proposal.candidate.id, expectedRevision: proposal.revision })
  assert.equal(experiment.experiment.eligibleForReview, true)
  const unconfirmed = await invoke({ action: 'approve', candidateId: proposal.candidate.id, expectedRevision: experiment.revision })
  assert.equal(unconfirmed.failureCode, 'IMPROVEMENT_USER_CONFIRMATION_REQUIRED')
  const afterRejected = await invoke({ action: 'list' })
  const applied = decideCandidate(patchwork, proposal.candidate.id, afterRejected.revision, { userConfirmed: true })
  assert.equal(applied.candidate.applied, true); assert.equal(currentPolicy(patchwork).verifyBeforeDelivery, true); assert.equal(currentPolicy(standard).verifyBeforeDelivery, false)
  const rollback = rollbackCandidate(patchwork, proposal.candidate.id, applied.revision, { userConfirmed: true })
  assert.equal(rollback.status, 'committed'); assert.equal(currentPolicy(patchwork).verifyBeforeDelivery, false)
  const retained = tools.get('patchwork_improvement', patchwork)
  selectPreset(patchwork, 'standard')
  let stolenRejected = false
  try { await retained.execute({ action: 'list' }, { agent: patchwork }) } catch { stolenRejected = true }
  selectPreset(patchwork, 'patchwork')
  const list = await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'real-improvement-list', rootCallId: 'real-improvement-list', arguments: { action: 'list' }, signal: new AbortController().signal })
  const result = {
    schemaVersion: 1, executedAt: startedAt, host: 'official-dsh-composition',
    isolation: { dshHome: '<temporary-dsh-home>', workspace: '<repository>', mainDshTouched: false, modelRequests: 0, confirmation: 'explicit-test-fixture' },
    checks: {
      catalogIsolation: { patchworkHasImprovement: patchworkNames.includes('patchwork_improvement'), standardHasImprovement: standardNames.includes('patchwork_improvement') },
      realIncident: { isError: incident.isError === true, status: incident.value?.status ?? null, hasSource: Boolean(incident.value?.incident?.sourceReceiptIds?.length) },
      list: { isError: list.isError === true, incidentCount: list.value?.incidents?.length ?? 0, automaticActivation: list.value?.automaticActivation ?? null },
      stolenReference: { rejected: stolenRejected },
      policy: { experiment: 'isolated-policy-contract', eligible: experiment.experiment.eligibleForReview, unconfirmedRejected: unconfirmed.status === 'failed', applied: applied.candidate.applied, ordinaryUnchanged: currentPolicy(standard).verifyBeforeDelivery === false, rolledBack: rollback.status === 'committed' },
    },
  }
  await mkdir(join(process.cwd(), 'docs', 'checks'), { recursive: true })
  await writeFile(join(process.cwd(), 'docs', 'checks', 'improvement-real.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} finally {
  await boot.dispose()
  await rm(isolatedDshHome, { recursive: true, force: true })
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
}
