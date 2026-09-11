/**
 * auto-research 的两道验收门，取自 SoL-Pi 的约束式效率搜索：
 *
 * 1. **能力下限**：每个能力指标都必须留在预先声明的容差内。
 *    省成本不能靠早停、跳过验证或删证据来换——那样省下来的不是效率。
 * 2. **效率增益**：至少一个效率指标相对基线变好。
 *
 * 两道门都过才留下。全部候选再过一次「非支配」筛选：在能力门内，没有别的候选
 * 在每一个效率维度上都不差于它且至少一维更好。这样「用一点能力换很多效率」和
 * 「效率一样但能力更高」都能被保留，而不是被加权魔法压成一个分数。
 */

export function capabilityGate({ measured = {}, floor = {} }) {
  const failures = []
  for (const [metric, minimum] of Object.entries(floor)) {
    const value = measured[metric]
    if (!Number.isFinite(value)) {
      failures.push({ metric, reason: 'not-measured', minimum })
      continue
    }
    if (value < minimum) failures.push({ metric, reason: 'below-floor', value, minimum })
  }
  return { pass: failures.length === 0, failures }
}

export function efficiencyGate({ baseline = {}, candidate = {}, metrics = [] }) {
  const improvements = []
  for (const metric of metrics) {
    const before = baseline[metric]
    const after = candidate[metric]
    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      improvements.push({ metric, reason: 'not-measured' })
      continue
    }
    // 越小越好：token、轮次、字节都属这一类。
    const delta = before - after
    improvements.push({ metric, before, after, delta, ratio: before === 0 ? null : delta / before })
  }
  const measured = improvements.filter(item => item.reason === undefined)
  return {
    pass: measured.some(item => item.delta > 0),
    improvements,
    allMeasured: measured.length === improvements.length,
  }
}

/** 判定一个提案：能力门先行，能力不过就直接淘汰，不再看效率。 */
export function evaluateProposal({ proposal, candidate, baseline }) {
  const capability = capabilityGate({ measured: candidate.capability, floor: proposal.capabilityFloor })
  if (!capability.pass) {
    return { id: proposal.id, keep: false, reason: 'capability-floor', capability }
  }
  const efficiency = efficiencyGate({
    baseline: baseline.efficiency,
    candidate: candidate.efficiency,
    metrics: proposal.efficiencyMetrics,
  })
  if (!efficiency.allMeasured) {
    return { id: proposal.id, keep: false, reason: 'efficiency-not-measured', capability, efficiency }
  }
  if (!efficiency.pass) {
    return { id: proposal.id, keep: false, reason: 'no-efficiency-gain', capability, efficiency }
  }
  return { id: proposal.id, keep: true, reason: 'passes-both-gates', capability, efficiency }
}

/**
 * 非支配筛选。`directions` 声明每个效率维度的方向（`lower` 越小越好）。
 * 只比较通过能力门的候选。
 */
export function retainNonDominated(candidates, { metrics, directions = {} } = {}) {
  const better = (a, b) => {
    let strictly = false
    for (const metric of metrics) {
      const lower = (directions[metric] ?? 'lower') === 'lower'
      const av = a.efficiency[metric]
      const bv = b.efficiency[metric]
      if (!Number.isFinite(av) || !Number.isFinite(bv)) return false
      if (lower ? av > bv : av < bv) return false
      if (lower ? av < bv : av > bv) strictly = true
    }
    return strictly
  }
  return candidates.filter(candidate => !candidates.some(other => other !== candidate && better(other, candidate)))
}
