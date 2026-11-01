import { record } from '../ui/mechanism-stats.mjs'
import { taskProjection } from '../task/store.mjs'
const CLAIM = /((?<!未)完成|修好了|全部通过|测试通过|已经修好|fix(?:ed|es)?\b|all tests pass|done\b|works now)/i
const agents = new Map(), hinted = new Map()
export function sessionKey(agent) { const id = agent?.session?.header?.id; return typeof id === 'string' && id ? id : undefined }
// Compatibility API: a random shell success is never task acceptance.
export function noteShellEvidence(exec) {
  const key = sessionKey(exec?.agent)
  if (key) { if (agents.size >= 64) agents.delete(agents.keys().next().value); agents.set(key, exec.agent) }
}
export function hasShellEvidence(key) {
  const state = taskProjection(agents.get(key))
  return Boolean(state?.status === 'ready' && state.requirements.some(r => r.required && r.kind === 'command' && r.status === 'passed'))
}
/** Advisory on tool text, not an interceptor for the assistant's final reply. */
export function shouldHintEvidence(key, text) {
  if (!key || !CLAIM.test(String(text || ''))) return false
  const state = taskProjection(agents.get(key))
  if (state?.status === 'ready') return false
  const revision = state?.revision ?? -1
  if (hinted.get(key) === revision) return false
  if (hinted.size >= 128) hinted.delete(hinted.keys().next().value)
  hinted.set(key, revision)
  record('maintenance', 'evidenceBlocks')
  return true
}
export const EVIDENCE_HINT = '[pw:evidence] 当前任务缺少有效验收；通过 patchwork_task 登记逐项要求并用 check 绑定真实回执。失败、未知、过期或未覆盖项须说明，不能以无关命令成功代替完成。写作结构检查不等于语义正确。此提示不是最终回答硬门禁。'
