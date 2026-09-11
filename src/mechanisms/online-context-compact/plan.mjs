import { MAX_STEPS, MAX_STEP_CHARS, STEP_STATUSES } from './config.mjs'

/**
 * 校验模型提交的计划。
 *
 * 计划是本机制的语义输入：只有当某个步骤**真的**从非完成变为完成时，才产生一个
 * 压缩边界。因此这里对形状的要求从严——宁可拒绝一个坏计划，也不要让「完成」
 * 的含义变得含糊。
 */
export function validatePlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, reason: 'plan-not-an-object' }

  const steps = input.steps
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, reason: 'plan-has-no-steps' }
  if (steps.length > MAX_STEPS) return { ok: false, reason: `plan-exceeds-${MAX_STEPS}-steps` }

  const seen = new Set()
  const normalized = []
  for (const step of steps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) return { ok: false, reason: 'step-not-an-object' }
    const { id, text, status } = step
    if (typeof id !== 'string' || id.trim() === '') return { ok: false, reason: 'step-id-missing' }
    if (seen.has(id)) return { ok: false, reason: `step-id-duplicated:${id}` }
    if (typeof text !== 'string' || text.trim() === '') return { ok: false, reason: `step-text-missing:${id}` }
    if (text.length > MAX_STEP_CHARS) return { ok: false, reason: `step-text-too-long:${id}` }
    if (!STEP_STATUSES.includes(status)) return { ok: false, reason: `step-status-invalid:${id}` }
    seen.add(id)
    normalized.push({ id, text, status })
  }

  return { ok: true, steps: normalized }
}

export function completedIds(steps) {
  return new Set(steps.filter(step => step.status === 'completed').map(step => step.id))
}

/**
 * 比较两次计划快照，回答「这次提交新完成了哪些步骤」。
 *
 * 只在**由非完成变为完成**时才算边界：重复提交同一份已完成的计划不应再次触发
 * 压缩，否则一次任务会被反复压缩。
 */
export function analyzeTransition(previousSteps, nextSteps) {
  const before = completedIds(previousSteps ?? [])
  const newlyCompleted = nextSteps.filter(step => step.status === 'completed' && !before.has(step.id)).map(step => step.id)

  const warnings = []
  const inProgress = nextSteps.filter(step => step.status === 'in_progress')
  if (inProgress.length > 1) warnings.push(`multiple-steps-in-progress:${inProgress.length}`)

  const previousById = new Map((previousSteps ?? []).map(step => [step.id, step]))
  for (const step of nextSteps) {
    const prior = previousById.get(step.id)
    if (prior && prior.text !== step.text) warnings.push(`step-text-changed:${step.id}`)
  }

  return { newlyCompleted, completed: nextSteps.filter(step => step.status === 'completed').length, warnings }
}

/** 模型可见的计划快照，用于压缩后续跑时重建上下文。 */
export function formatPlanSnapshot(steps) {
  const lines = ['<plan>']
  for (const step of steps ?? []) lines.push(`- [${step.status}] ${step.id}: ${step.text}`)
  lines.push('</plan>')
  return lines.join('\n')
}
