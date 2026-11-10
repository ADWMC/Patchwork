import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRealHostCandidate } from '../src/quality/evolution.mjs'

function record() {
  const run = { mode: 'real-host', model: 'fixed-model', harnessVersion: 'fixed-host', environment: 'same-lab', initialRevision: 'same-code', budget: 'same-budget',
    evidenceRef: 'local:actual-session-receipts', correctness: 'passed', maintenance: 'passed', passedCases: ['tuning', 'heldout'], cost: 1, latency: 10 }
  return { candidateId: 'candidate', parentId: 'baseline', sourceFailureIds: ['failure-1'], hypothesis: 'Bounded candidate', changeScope: 'One mechanism',
    rollbackTarget: 'baseline', sets: { tuning: ['tuning'], heldOut: ['heldout'] }, baseline: { ...run }, candidate: { ...run }, regressions: [], sideEffects: [], decision: 'proposed' }
}
test('experiment records require execution, held out coverage, comparable conditions and rollback', () => {
  assert.equal(evaluateRealHostCandidate(record()).eligibleForReview, true)
  for (const mutate of [r => r.candidate.mode = 'proxy-text-score', r => r.sets.heldOut = ['tuning'], r => r.rollbackTarget = '',
    r => r.candidate.budget = 'larger', r => r.candidate.correctness = 'failed', r => r.regressions.push('new failure'), r => r.candidate.passedCases = ['tuning'], r => r.candidate.cost = null]) {
    const r = record(); mutate(r); assert.equal(evaluateRealHostCandidate(r).eligibleForReview, false)
  }
  assert.equal(evaluateRealHostCandidate({}).eligibleForReview, false)
})
test('eligible is not activated and self-reported acceptance cannot publish itself', () => {
  const r = record(); r.decision = 'accepted'
  const result = evaluateRealHostCandidate(r)
  assert.equal(result.eligibleForReview, false); assert.equal(result.activation, 'manual-code-review-only')
})
