import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { inspectStructure, MUTATION_TOOLS } from './structure-check.mjs'
import { shouldEmitPrompt } from './warning-cooldown.mjs'

const promptPath = fileURLToPath(new URL('../../assets/prompts/structure-hook-warning.md', import.meta.url))
const prompt = (await readFile(promptPath, 'utf8')).trim()

/** 只有会改动文件的工具才可能产出需要检查的结构。 */
export function isMutationTool(name) {
  return typeof name === 'string' && MUTATION_TOOLS.has(name)
}

/**
 * 结构警告的完整组装：纯检查 + 冷却决策 + 提示词文本。
 * @param {{ cwd?: string, sessionId?: string, files?: unknown[] }} payload
 */
export async function buildStructureWarning(payload = {}) {
  const { warnings } = await inspectStructure(payload)
  if (!warnings.length) return { ok: true, warnings: [] }

  const session = payload.sessionId || payload.session?.id || payload.cwd || 'default'
  const emit = await shouldEmitPrompt(session, warnings)
  return { ok: true, warnings, ...(emit ? { prompt } : {}) }
}
