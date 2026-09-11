import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { capabilityGate, efficiencyGate, evaluateProposal, retainNonDominated } from '../research/lib/gates.mjs'
import { formatLineage, runLineage } from '../research/lib/lineage.mjs'
import { appendVerdict, ledgerPath, readVerdicts } from '../research/lib/ledger.mjs'

const proposal = {
  id: 'P-001',
  mechanism: 'observationPack',
  capabilityFloor: { taskCompletionRate: 1 },
  efficiencyMetrics: ['tokens'],
}

test('the capability gate refuses a missing measurement instead of assuming it passed', () => {
  assert.equal(capabilityGate({ measured: {}, floor: { taskCompletionRate: 1 } }).failures[0].reason, 'not-measured')
  assert.equal(capabilityGate({ measured: { taskCompletionRate: 0.9 }, floor: { taskCompletionRate: 1 } }).pass, false)
  assert.equal(capabilityGate({ measured: { taskCompletionRate: 1 }, floor: { taskCompletionRate: 1 } }).pass, true)
})

test('the efficiency gate needs at least one real improvement', () => {
  const flat = efficiencyGate({ baseline: { tokens: 100 }, candidate: { tokens: 100 }, metrics: ['tokens'] })
  assert.equal(flat.pass, false)

  const worse = efficiencyGate({ baseline: { tokens: 100 }, candidate: { tokens: 120 }, metrics: ['tokens'] })
  assert.equal(worse.pass, false)

  const better = efficiencyGate({ baseline: { tokens: 100 }, candidate: { tokens: 60 }, metrics: ['tokens'] })
  assert.equal(better.pass, true)
  assert.equal(better.improvements[0].ratio, 0.4)
})

test('the capability floor is checked before any efficiency is credited', () => {
  const verdict = evaluateProposal({
    proposal,
    candidate: { capability: { taskCompletionRate: 0.8 }, efficiency: { tokens: 10 } },
    baseline: { efficiency: { tokens: 100 } },
  })
  assert.equal(verdict.keep, false)
  assert.equal(verdict.reason, 'capability-floor')
})

test('an unmeasured efficiency metric blocks the verdict rather than being skipped', () => {
  const verdict = evaluateProposal({
    proposal,
    candidate: { capability: { taskCompletionRate: 1 }, efficiency: {} },
    baseline: { efficiency: { tokens: 100 } },
  })
  assert.equal(verdict.keep, false)
  assert.equal(verdict.reason, 'efficiency-not-measured')
})

test('non-dominated retention keeps a cheaper candidate and a strictly better one only', () => {
  const candidates = [
    { id: 'cheap', efficiency: { tokens: 50, modelRequests: 100 } },
    { id: 'expensive', efficiency: { tokens: 90, modelRequests: 90 } },
    { id: 'dominated', efficiency: { tokens: 60, modelRequests: 110 } },
  ]
  const kept = retainNonDominated(candidates, { metrics: ['tokens', 'modelRequests'] })
  assert.deepEqual(kept.map(item => item.id).sort(), ['cheap', 'expensive'])
})

test('a lineage records every verdict, including the ones it did not measure', () => {
  const measurements = {
    'P-001': { capability: { taskCompletionRate: 1 }, efficiency: { tokens: 60 } },
    'P-002': { capability: { taskCompletionRate: 1 }, efficiency: { tokens: 80 } },
  }
  const proposals = [
    proposal,
    { id: 'P-002', mechanism: 'reducer', capabilityFloor: { taskCompletionRate: 1 }, efficiencyMetrics: ['tokens'] },
    { id: 'P-003', mechanism: 'compact', capabilityFloor: { taskCompletionRate: 1 }, efficiencyMetrics: ['tokens'] },
  ]
  const result = runLineage({ proposals, measurements, baseline: { efficiency: { tokens: 100 } } })

  const byId = Object.fromEntries(result.evaluated.map(item => [item.id, item]))
  assert.equal(byId['P-001'].verdict.reason, 'passes-both-gates')
  assert.equal(byId['P-002'].verdict.reason, 'passes-both-gates')
  assert.equal(byId['P-003'].verdict.reason, 'not-measured')
  // P-001 的 60 tokens 支配 P-002 的 80，因此只剩前者。
  assert.deepEqual(result.survivors, ['P-001'])
  assert.equal(byId['P-002'].nonDominated, false)

  assert.match(formatLineage(result), /KEEP\s+P-001/)
  assert.match(formatLineage(result), /drop\s+P-003/)
})

test('the ledger is append-only and readable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-research-'))
  await appendVerdict(dir, { id: 'P-001', keep: true, reason: 'passes-both-gates' })
  await appendVerdict(dir, { id: 'P-002', keep: false, reason: 'capability-floor' })

  const verdicts = await readVerdicts(dir)
  assert.deepEqual(verdicts.map(verdict => verdict.id), ['P-001', 'P-002'])
  assert.match(verdicts[0].timestamp, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(await readFile(ledgerPath(dir), 'utf8'), /passes-both-gates/)
})
