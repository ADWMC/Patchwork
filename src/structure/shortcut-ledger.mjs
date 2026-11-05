import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isAbsolute } from 'node:path'

/**
 * 妥协账本：代码锚定的有意妥协登记。
 *
 * 约定（与 standards 技能同源）：有意留下的妥协写成
 * `shortcut: <限制>, <何时升级>`。本模块把改动文件里已登记的妥协
 * 顺手带给 Agent——改到带登记的文件时不必主动查账本，限制与升级
 * 条件就在眼前。全仓汇总由 debt 技能按需执行。
 */

const SHORTCUT_PATTERN = /\bshortcut:\s*([^,，]+)[,，]\s*(.+?)\s*$/i
const COOLDOWN_ROUNDS = 30
const MAX_NOTICE_BYTES = 2000

/** 从文件文本提取全部妥协登记，保留行号。 */
export function extractShortcuts(text) {
  const found = []
  const lines = String(text ?? '').split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    const match = SHORTCUT_PATTERN.exec(line)
    if (!match) continue
    found.push({ line: index + 1, limit: match[1].trim().slice(0, 160), upgrade: match[2].trim().slice(0, 160) })
    if (found.length >= 20) break
  }
  return found
}

function statePath() {
  return process.env.PATCHWORK_HOOK_STATE || join(tmpdir(), 'patchwork-hook-state.json')
}

function cooldownKey(sessionId, file, line) {
  return createHash('sha1').update(`shortcut:${sessionId}:${file}:${line}`).digest('hex')
}

/** 同一会话同一登记的提醒间隔，语义与结构警告冷却一致。 */
async function firstForSession(sessionId, entries) {
  const path = statePath()
  let state = {}
  try { state = JSON.parse(await readFile(path, 'utf8')) } catch { /* 首次或不可读 */ }
  const fresh = []
  for (const entry of entries) {
    const key = cooldownKey(sessionId, entry.file, entry.line)
    const previous = state[key] || 0
    state[key] = previous + 1 >= COOLDOWN_ROUNDS ? 0 : previous + 1
    if (previous === 0) fresh.push(entry)
  }
  try { await (await import('node:fs/promises')).writeFile(path, JSON.stringify(state)) } catch { /* 冷却是建议性的 */ }
  return fresh
}

function renderNotice(entries) {
  const lines = entries.slice(0, 8).map(entry => `- ${entry.file}:${entry.line} — shortcut: ${entry.limit}, ${entry.upgrade}`)
  const more = entries.length > 8 ? `\n- 另有 ${entries.length - 8} 条未展示` : ''
  return `[pw:debt] 正在改动的文件登记过有意妥协：\n${lines.join('\n')}${more}\n核对本次改动是否触发这些限制；达到升级条件时连同升级一起完成，不要静默删除登记。`
}

/**
 * 读取改动文件里的妥协登记并生成提醒。
 * 读取失败按“无登记”处理——提醒是增强，不是关卡。
 */
export async function buildShortcutNotice({ cwd, files = [], sessionId } = {}) {
  const paths = [...new Set((Array.isArray(files) ? files : []).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))]
  if (!paths.length) return { ok: true, shortcuts: [] }
  const entries = []
  for (const path of paths) {
    const target = isAbsolute(path) ? path : cwd ? join(cwd, path) : path
    let text
    try { text = await readFile(target, 'utf8') } catch { continue }
    for (const shortcut of extractShortcuts(text)) entries.push({ file: path, ...shortcut })
  }
  if (!entries.length) return { ok: true, shortcuts: [] }
  const fresh = await firstForSession(sessionId || 'default', entries)
  if (!fresh.length) return { ok: true, shortcuts: entries }
  const prompt = renderNotice(fresh)
  return { ok: true, shortcuts: entries, prompt: Buffer.byteLength(prompt, 'utf8') > MAX_NOTICE_BYTES ? renderNotice(fresh.slice(0, 4)) : prompt }
}
