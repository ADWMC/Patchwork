import { randomUUID, createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPatchworkAgent } from '../scope.mjs'
import { runIsolatedCommand } from './runner.mjs'
import { validatePolicyPatch, policyEpoch } from './policy.mjs'

const issued = new WeakMap(), seal = new WeakSet()
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')
export function candidateVersion(candidate) { return hash([candidate.id, candidate.object, candidate.patch, candidate.sourceReceiptIds, candidate.hypothesis, candidate.activationScope]) }
export function runnerIssued(value) { return seal.has(value) }
export function verifyExperiment(agent, candidate, experiment) {
  if (!candidate || !experiment || !isPatchworkAgent(agent)) return false
  const record = issued.get(agent.session)?.get(experiment?.id)
  if (!record || record.candidateVersion !== candidateVersion(candidate) || record.evidenceHash !== experiment.evidenceHash) return false
  try { return hash(readFileSync(record.evidenceRef)) === record.evidenceHash } catch { return false }
}
export async function executePolicyExperiment(agent, candidate, receipts, { signal } = {}) {
  if (!isPatchworkAgent(agent) || !validatePolicyPatch(candidate.object, candidate.patch) || !receipts.length) throw new Error('IMPROVEMENT_EXPERIMENT_INPUT_REQUIRED')
  const ctx = agent.ctx, session = agent.session, cwd = session.header.cwd, epoch = policyEpoch(agent)
  const check = () => { signal?.throwIfAborted(); if (!isPatchworkAgent(agent) || agent.ctx !== ctx || agent.session !== session || session.header.cwd !== cwd || policyEpoch(agent) !== epoch) throw new Error('IMPROVEMENT_SCOPE_REVOKED') }
  const root = await mkdtemp(join(tmpdir(), 'patchwork-policy-experiment-'))
  const runs = {}
  for (const variant of ['baseline', 'candidate']) {
    check()
    const dir = join(root, variant); await mkdir(dir)
    const input = join(dir, 'input.json'), output = join(dir, 'output.json')
    await writeFile(input, JSON.stringify({ object: candidate.object, patch: variant === 'candidate' ? candidate.patch : null }), { mode: 0o600 })
    const spec = { dshHome: join(dir, 'dsh-home'), workspace: join(dir, 'workspace'), resultsDir: join(dir, 'results'), port: 19000, model: 'none:deterministic-policy-contract', budget: 1 }
    const start = performance.now()
    const execution = await runIsolatedCommand(spec, { command: process.execPath, args: [fileURLToPath(new URL('./policy-worker.mjs', import.meta.url)), input, output], timeoutMs: 10000, signal, cleanEnvironment: true })
    check()
    const data = execution.status === 'completed' ? JSON.parse(await readFile(output, 'utf8')) : null
    runs[variant] = { mode: 'policy-contract', status: execution.status, model: null, harnessVersion: 'policy-contract/1', environment: 'isolated-node-process', initialRevision: candidateVersion(candidate), budget: '2 processes / 10s each', correctness: data?.checks ? 'passed' : 'failed', maintenance: data?.checks ? 'passed' : 'failed', cost: null, latency: performance.now() - start, passedCases: data?.checks ? [...data.tuning, ...data.heldOut] : [], outputs: data?.outputs ?? [] }
  }
  check()
  const id = `exp_${randomUUID().replaceAll('-', '').slice(0, 24)}`
  const data = { schemaVersion: 1, id, sessionId: session.header.id, candidateId: candidate.id, candidateVersion: candidateVersion(candidate), sources: receipts, sets: { tuning: ['task-present', 'task-absent'], heldOut: ['restored-task', 'ordinary-session'] }, ...runs,
    regressions: Object.values(runs).every(run => run.correctness === 'passed') ? [] : ['policy-contract-failed'], sideEffects: [candidate.patch.setting === 'recallLimit' ? '改变每次召回上限；不修改已有记忆。' : '仅影响当前已确认会话；不授予新权限。'], recordedAt: new Date().toISOString(), claim: '仅验证受限策略契约、隔离和输出差异；未测量真模型收益。' }
  const evidenceRef = join(root, 'evidence.json'), bytes = JSON.stringify(data, null, 2)
  await writeFile(evidenceRef, bytes, { flag: 'wx', mode: 0o600 })
  const result = { ...data, sourceFailureIds: candidate.incidentIds, evidenceRef, evidenceHash: hash(bytes), eligibleForReview: data.regressions.length === 0,
    eligibilityReasons: data.regressions, baseline: { ...runs.baseline, evidenceRef }, candidate: { ...runs.candidate, evidenceRef } }
  if (!issued.has(session)) issued.set(session, new Map())
  issued.get(session).set(id, { candidateVersion: result.candidateVersion, evidenceRef, evidenceHash: result.evidenceHash })
  seal.add(result)
  return result
}
