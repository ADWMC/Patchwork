import { readFile } from 'node:fs/promises'
import { basename, relative, sep } from 'node:path'

export const SOURCE = /\.(?:c|cc|cpp|cxx|h|hpp|java|js|jsx|mjs|ts|tsx|go|rs|py|kt|swift)$/i

/** 单文件行数上限：超过即认为职责可能混杂。 */
export const LARGE_FILE_LINES = 800

const VAGUE = /(?:^|[_-])(?:final|new|old|copy|tmp|temp|debug|test|backup|fix|v\d+)(?:\.|[_-]|$)/i

/** 只有会改动文件的工具才产出可检查的结构事实。读取不属于本检查的范围。 */
export const MUTATION_TOOLS = new Set(['write', 'edit'])

export function isSourcePath(file) {
  return SOURCE.test(file)
}

/**
 * 工作区判定：第三方依赖、其他仓库与用户目录下的文件不是本项目的结构契约，
 * 检查它们只会给出 Agent 无法执行的建议。
 */
export function isInsideWorkspace(cwd, absolutePath) {
  const rel = relative(cwd, absolutePath)
  if (rel === '') return false
  if (rel.startsWith('..')) return false
  if (rel.startsWith(`${sep}`) || rel.startsWith('/')) return false
  return true
}

/**
 * 计算结构与命名警告。纯检查：只读文件用于计数，不做冷却与提示决策。
 * @param {{ cwd?: string, files?: unknown[] }} payload
 * @returns {Promise<{ ok: true, warnings: Array<{code: string, file: string, lines?: number}> }>}
 */
export async function inspectStructure(payload = {}) {
  const cwd = payload.cwd || process.cwd()
  const entries = Array.isArray(payload.files) ? payload.files : []
  const warnings = []

  for (const entry of entries) {
    const file = typeof entry === 'string' ? entry : entry?.path
    if (!file || !SOURCE.test(file)) continue

    const absolute = resolveInside(cwd, file)
    if (!absolute || !isInsideWorkspace(cwd, absolute)) continue

    const rel = relative(cwd, absolute)
    const name = basename(absolute)
    if (!rel.includes(sep) && !rel.includes('/')) warnings.push({ code: 'root-source', file: rel })
    if (VAGUE.test(name)) warnings.push({ code: 'vague-name', file: rel })
    try {
      const lines = (await readFile(absolute, 'utf8')).split(/\r?\n/).length
      if (lines > LARGE_FILE_LINES) warnings.push({ code: 'large-file', file: rel, lines })
    } catch {
      // 路径不存在或不可读时检查保持建议性；不阻断，也不虚构结论。
    }
  }

  return { ok: true, warnings }
}

function resolveInside(cwd, file) {
  try {
    return file.startsWith('/') || /^[A-Za-z]:[\\/]/.test(file) ? file : `${cwd}${sep}${file}`
  } catch {
    return undefined
  }
}
