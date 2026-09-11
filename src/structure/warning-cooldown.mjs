import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** 同一会话同一问题的提示间隔：避免每轮重复注入同一段提醒。 */
export const COOLDOWN_ROUNDS = 30

export function warningKey(sessionId, warnings) {
  const fingerprint = warnings.map(item => `${item.code}:${item.file}`).join('|')
  return createHash('sha1').update(`${sessionId}:${fingerprint}`).digest('hex')
}

function statePath() {
  return process.env.PATCHWORK_HOOK_STATE || join(tmpdir(), 'patchwork-hook-state.json')
}

/**
 * 冷却决策：返回本次是否应当发出提示，并推进计数。
 * 状态读取与写入失败时按「首次」处理——冷却丢失只多一次提示，不影响正确性。
 */
export async function shouldEmitPrompt(sessionId, warnings) {
  const key = warningKey(sessionId, warnings)
  const path = statePath()
  let state = {}
  try {
    state = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    // 首次运行或状态不可读
  }
  const previous = state[key] || 0
  const count = previous + 1
  state[key] = count >= COOLDOWN_ROUNDS ? 0 : count
  try {
    await writeFile(path, JSON.stringify(state))
  } catch {
    // 冷却状态是建议性的
  }
  return previous === 0 || count >= COOLDOWN_ROUNDS
}
