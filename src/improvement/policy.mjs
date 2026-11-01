import { isPatchworkAgent } from '../scope.mjs'

export const POLICY_VERSION = 1
export const POLICY_DEFAULTS = Object.freeze({ verifyBeforeDelivery: false, recallLimit: 5, requireCrossCheck: false, reviewDetail: 'compact' })
const allowed = { rule: 'verifyBeforeDelivery', 'memory-policy': 'recallLimit', 'tool-flow': 'requireCrossCheck', 'ui-copy': 'reviewDetail' }
const active = new WeakMap()
const epochs = new WeakMap()
export const policyEpoch = agent => epochs.get(agent.session) ?? 0
export function validatePolicyPatch(object, patch) {
  if (!patch || patch.version !== POLICY_VERSION || patch.setting !== allowed[object] || Object.keys(patch).some(key => !['version', 'setting', 'value'].includes(key))) return null
  const valid = ['verifyBeforeDelivery', 'requireCrossCheck'].includes(patch.setting) ? patch.value === true
    : patch.setting === 'recallLimit' ? Number.isInteger(patch.value) && patch.value >= 1 && patch.value <= 5
      : ['compact', 'full'].includes(patch.value)
  return valid ? { version: POLICY_VERSION, setting: patch.setting, value: patch.value } : null
}
export function currentPolicy(agent) {
  if (!isPatchworkAgent(agent)) return { ...POLICY_DEFAULTS }
  return Object.assign({}, POLICY_DEFAULTS, ...[...(active.get(agent.session)?.values() ?? [])].map(item => ({ [item.patch.setting]: item.patch.value })))
}
export function applyPolicy(agent, candidate) {
  if (!isPatchworkAgent(agent)) throw new Error('IMPROVEMENT_SCOPE_REQUIRED')
  if (candidate.activationScope !== 'session') throw new Error('Project application requires each receiving session to confirm its own candidate')
  const patch = validatePolicyPatch(candidate.object, candidate.patch)
  if (!patch) throw new Error('IMPROVEMENT_INVALID_PATCH')
  if (!active.has(agent.session)) active.set(agent.session, new Map())
  active.get(agent.session).set(candidate.id, { patch })
  return currentPolicy(agent)
}
export function rollbackPolicy(agent, candidateId) { active.get(agent.session)?.delete(candidateId); return currentPolicy(agent) }
export function revokePolicies(agent) { active.delete(agent.session); epochs.set(agent.session, policyEpoch(agent) + 1) }
export function policyApplied(agent, id) { return isPatchworkAgent(agent) && active.get(agent.session)?.has(id) === true }
export function policyOutputs(policy, context) {
  return { recallLimit: Math.min(5, Math.max(1, policy.recallLimit)), requireCrossCheck: policy.requireCrossCheck === true,
    deliveryReminder: policy.verifyBeforeDelivery && context.hasTask ? '先检查当前版本的验收证据，再交付；未覆盖项明确说明。' : '',
    reviewCopy: policy.reviewDetail === 'full' ? '请核对来源、版本、实验差异、退化与副作用，再决定是否应用；可随时回滚。' : '核对证据后确认，必要时回滚。' }
}
