import { record } from '../ui/mechanism-stats.mjs'

const CLAIM =
  /((?<!未)完成|修好了|全部通过|测试通过|已经修好|fix(?:ed|es)?\b|all tests pass|done\b|works now)/i
const SHELL_TOOLS = new Set(['pwsh', 'bash', 'shell', 'run_tests'])

/** cwd/session → last successful shell timestamp (process-local). */
const shellOkAt = new Map()
/** Once per session: avoid repeating the evidence line. */
const hinted = new Set()

export function sessionKey(agent) {
  return agent?.session?.header?.cwd || agent?.id || agent?.session?.id || 'default'
}

export function noteShellEvidence(exec, result) {
  if (!exec || !SHELL_TOOLS.has(exec.name)) return
  if (result?.isError) return
  shellOkAt.set(sessionKey(exec.agent), Date.now())
}

export function hasShellEvidence(key, withinMs = 10 * 60 * 1000) {
  const at = shellOkAt.get(key)
  return Boolean(at && Date.now() - at <= withinMs)
}

/** True when a completion claim appears without shell evidence (once per session). */
export function shouldHintEvidence(key, text) {
  if (!CLAIM.test(String(text || ''))) return false
  if (hasShellEvidence(key)) return false
  if (hinted.has(key)) return false
  hinted.add(key)
  record('maintenance', 'evidenceBlocks')
  return true
}

export const EVIDENCE_HINT =
  '[pw:evidence] 完成断言缺少命令证据。请执行验收命令并粘贴退出码/关键输出；否则改为「未验证」。见 skill evidence。'
