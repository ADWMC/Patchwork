import { evaluateProposal, retainNonDominated } from './gates.mjs'

/**
 * 一条 lineage 的完整判决：逐个提案过两道门，再对通过者做非支配筛选。
 *
 * 这里刻意不做「加权总分」。原因是加权会把「用一点能力换很多效率」这类候选
 * 压成一个数，从而掩盖它其实动了能力下限；而能力下限正是本方法论的约束。
 */
export function runLineage({ proposals, measurements, baseline, directions = {} }) {
  if (!Array.isArray(proposals) || proposals.length === 0) throw new TypeError('proposals must be a non-empty array')

  const evaluated = proposals.map(proposal => {
    const measured = measurements?.[proposal.id]
    if (!measured) {
      return {
        id: proposal.id,
        proposal,
        verdict: { id: proposal.id, keep: false, reason: 'not-measured' },
      }
    }
    return { id: proposal.id, proposal, verdict: evaluateProposal({ proposal, candidate: measured, baseline }) }
  })

  const passed = evaluated.filter(item => item.verdict.keep)
  const metrics = [...new Set(proposals.flatMap(proposal => proposal.efficiencyMetrics ?? []))]
  const survivors = retainNonDominated(
    passed.map(item => ({ id: item.id, efficiency: measurements[item.id].efficiency })),
    { metrics, directions },
  )
  const survivorIds = new Set(survivors.map(item => item.id))

  return {
    evaluated: evaluated.map(item => ({
      ...item,
      nonDominated: survivorIds.has(item.id),
    })),
    survivors: [...survivorIds],
    metrics,
  }
}

export function formatLineage(result) {
  const lines = []
  for (const item of result.evaluated) {
    const mark = item.verdict.keep ? (item.nonDominated ? 'KEEP ' : 'dominated') : 'drop '
    const detail = item.verdict.keep
      ? item.verdict.efficiency.improvements
          .filter(change => change.reason === undefined)
          .map(change => `${change.metric} -${(change.ratio * 100).toFixed(1)}%`)
          .join(', ')
      : item.verdict.reason
    lines.push(`${mark.padEnd(9)} ${item.id.padEnd(16)} ${detail}`)
  }
  lines.push(`survivors: ${result.survivors.length ? result.survivors.join(', ') : '(none)'}`)
  return lines.join('\n')
}
