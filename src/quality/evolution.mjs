/**
 * Structural lint for archived real-host experiments. This is deliberately
 * separate from `improvement/store.mjs`, which gates current-session policy
 * contracts; neither path auto-activates a candidate.
 */
export function evaluateRealHostCandidate(record) {
  const reasons = []
  for (const key of ['candidateId', 'parentId', 'hypothesis', 'changeScope', 'rollbackTarget']) {
    if (typeof record?.[key] !== 'string' || !record[key].trim()) reasons.push(`missing:${key}`)
  }
  if (!Array.isArray(record?.sourceFailureIds) || !record.sourceFailureIds.length) reasons.push('failure-provenance-required')
  const sets = record?.sets
  if (!sets?.tuning?.length || !sets?.heldOut?.length) reasons.push('tuning-and-held-out-required')
  else if (sets.heldOut.some(id => sets.tuning.includes(id))) reasons.push('held-out-overlap')
  const baseline = record?.baseline, candidate = record?.candidate
  for (const [name, run] of [['baseline', baseline], ['candidate', candidate]]) {
    if (run?.mode !== 'real-host') reasons.push(`${name}:real-host-required`)
    for (const key of ['model', 'harnessVersion', 'environment', 'initialRevision', 'budget', 'evidenceRef']) if (!run?.[key]) reasons.push(`${name}:missing:${key}`)
    if (run?.correctness !== 'passed' || run?.maintenance !== 'passed') reasons.push(`${name}:quality-gate`)
    for (const key of ['cost', 'latency']) if (!Number.isFinite(run?.[key]) || run[key] < 0) reasons.push(`${name}:missing:${key}`)
    if (!Array.isArray(run?.passedCases) || ![...(sets?.tuning ?? []), ...(sets?.heldOut ?? [])].every(id => run.passedCases.includes(id))) reasons.push(`${name}:coverage-incomplete`)
  }
  if (baseline && candidate) {
    for (const key of ['model', 'harnessVersion', 'environment', 'initialRevision', 'budget']) if (baseline[key] !== candidate[key]) reasons.push(`conditions-differ:${key}`)
  }
  if (!Array.isArray(record?.regressions) || record.regressions.length) reasons.push('unresolved-regressions')
  if (!Array.isArray(record?.sideEffects)) reasons.push('side-effects-unassessed')
  if (record?.decision !== 'proposed') reasons.push('decision-must-remain-proposed')
  return { eligibleForReview: reasons.length === 0, reasons, activation: 'manual-code-review-only',
    warning: 'Structural eligibility is not independent verification of the supplied evidence or a measured quality gain.' }
}
