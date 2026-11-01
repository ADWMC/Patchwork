import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { registerSourceReceipt } from '../src/improvement/provenance.mjs'
import { recordIncident, proposeCandidate, runCandidateExperiment, decideCandidate, rollbackCandidate, improvementSnapshot } from '../src/improvement/store.mjs'
import { currentPolicy, revokePolicies } from '../src/improvement/policy.mjs'
import { registerTaskLifecycle } from '../src/task/lifecycle.mjs'
import { transitionTask } from '../src/task/store.mjs'
import { proposeMemory, confirmMemory, recallMemory, loadMemoryState } from '../src/memory/store.mjs'
import { admitPageEvidence, markEvidenceSent, citeEvidence, compareEvidence } from '../src/retrieval/evidence.mjs'

function fixture(id) {
  const handlers = new Map(), ctx = { tools: { register() {} }, commands: { register() {} }, on(name, handler) { handlers.set(name, handler) }, effect() {} }
  const agent = scopedAgent({ ctx, session: { header: { id, cwd: process.cwd() } } })
  registerSourceReceipt(agent, { id: 'actual-fixture-event', kind: 'test-fixture', outcome: 'failed' })
  const source = recordIncident(agent, { kind: 'failure', sourceReceiptIds: ['actual-fixture-event'], trigger: 'isolated policy fixture' }).incident
  return { agent, handlers, source }
}
async function activate(f, object, setting, value) {
  const proposed = proposeCandidate(f.agent, { incidentIds: [f.source.id], object, trigger: 'bounded test', hypothesis: 'check actual consumer', changeScope: 'temporary session', patch: { version: 1, setting, value } })
  const experiment = await runCandidateExperiment(f.agent, proposed.candidate.id, proposed.revision)
  assert.equal(experiment.status, 'committed')
  const applied = decideCandidate(f.agent, proposed.candidate.id, experiment.revision, { userConfirmed: true })
  assert.equal(applied.candidate.applied, true)
  return { candidate: proposed.candidate, experiment: experiment.experiment }
}
test('approved rule changes the real pre-step consumer; rollback restores the original prompt', async () => {
  const f = fixture('rule-consumer'); registerTaskLifecycle(f.agent.ctx)
  transitionTask(f.agent, { kind: 'define', data: { title: 'delivery', phase: 'verify', requirements: [] } })
  const next = async () => ({ kind: 'enter', messages: [] })
  const text = async () => JSON.stringify(await f.handlers.get('agent/pre-step')({ agent: f.agent }, next))
  assert.doesNotMatch(await text(), /先检查当前版本/)
  const { candidate } = await activate(f, 'rule', 'verifyBeforeDelivery', true)
  assert.match(await text(), /先检查当前版本/)
  rollbackCandidate(f.agent, candidate.id, improvementSnapshot(f.agent).revision, { userConfirmed: true })
  assert.doesNotMatch(await text(), /先检查当前版本/)
})
test('approved memory policy changes real recall count without changing stored memories or other sessions', async () => {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-recall-policy-'))
  const f = fixture('memory-consumer')
  for (let i = 0; i < 3; i++) { const p = await proposeMemory(f.agent, { key: `key-${i}`, value: `value-${i}` }); await confirmMemory(f.agent, p.recordId, p.revision, { userConfirmed: true }) }
  assert.equal((await recallMemory(f.agent)).entries.length, 3)
  const { candidate } = await activate(f, 'memory-policy', 'recallLimit', 1)
  assert.equal((await recallMemory(f.agent)).entries.length, 1)
  assert.equal(currentPolicy(fixture('another-session').agent).recallLimit, 5)
  rollbackCandidate(f.agent, candidate.id, improvementSnapshot(f.agent).revision, { userConfirmed: true })
  assert.equal((await recallMemory(f.agent)).entries.length, 3)
})
test('approved cross-check policy gates real citations and a later conflict revokes verified status', async () => {
  const f = fixture('cross-check-consumer'); await activate(f, 'tool-flow', 'requireCrossCheck', true)
  const page = (host, value) => { const e = admitPageEvidence(f.agent, { finalUrl: `https://${host}/`, excerpt: JSON.stringify({ version: value }), contentType: 'application/json' }, host); markEvidenceSent(e.id, e.excerpt); return e }
  const a = page('one.example', 3), b = page('two.example', 3), c = page('three.example', 4)
  const cite = () => citeEvidence(f.agent, { evidenceId: a.id, quote: 'version', claim: 'version field' })
  assert.equal(cite().failureCode, 'EVIDENCE_CROSS_CHECK_REQUIRED')
  compareEvidence(f.agent, { evidenceId: a.id, otherId: b.id, claimKey: 'version' }); assert.equal(cite().status, 'committed')
  const conflict = compareEvidence(f.agent, { evidenceId: a.id, otherId: c.id, claimKey: 'version' })
  assert.equal(conflict.verification.result, 'conflict'); assert.notEqual(conflict.evidence.status, 'verified'); assert.equal(cite().status, 'failed')
})
test('tampered experiment cannot apply, rerun restores eligibility, and revoked scope invalidates an in-flight experiment', async () => {
  const f = fixture('experiment-restore'), run = await activate(f, 'ui-copy', 'reviewDetail', 'full')
  assert.equal(currentPolicy(f.agent).reviewDetail, 'full')
  rollbackCandidate(f.agent, run.candidate.id, improvementSnapshot(f.agent).revision, { userConfirmed: true })
  await writeFile(run.experiment.evidenceRef, '{tampered')
  assert.equal(decideCandidate(f.agent, run.candidate.id, improvementSnapshot(f.agent).revision, { userConfirmed: true }).status, 'failed')
  const retried = await runCandidateExperiment(f.agent, run.candidate.id, improvementSnapshot(f.agent).revision)
  assert.equal(decideCandidate(f.agent, run.candidate.id, retried.revision, { userConfirmed: true }).candidate.applied, true)
  const pending = runCandidateExperiment(f.agent, run.candidate.id, improvementSnapshot(f.agent).revision)
  revokePolicies(f.agent)
  assert.equal((await pending).failureCode, 'IMPROVEMENT_SCOPE_REVOKED')
})
test('corrupt memory preserves last valid backup and can recover after an explicit offline restore', async () => {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-memory-recovery-'))
  const f = fixture('memory-recovery'), path = join(process.env.DSH_HOME, 'patchwork/memory.json')
  const p = await proposeMemory(f.agent, { key: 'retained', value: 'original' }); await confirmMemory(f.agent, p.recordId, p.revision, { userConfirmed: true })
  await proposeMemory(f.agent, { key: 'next', value: 'later' })
  const backup = await readFile(path + '.bak', 'utf8'); await writeFile(path, '{broken')
  assert.equal((await proposeMemory(f.agent, { key: 'unsafe', value: 'overwrite' })).failureCode, 'MEMORY_DATABASE_INVALID')
  assert.equal(await readFile(path + '.bak', 'utf8'), backup); assert.equal(await readFile(path, 'utf8'), '{broken')
  // Explicit offline maintenance step, never a cross-session restore UI action.
  await writeFile(path, backup); await loadMemoryState()
  assert.equal((await recallMemory(f.agent)).entries[0].value, 'original')
})
