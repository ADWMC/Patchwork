import { readFile } from 'node:fs/promises'
import { basename, relative, sep } from 'node:path'

const SOURCE = /\.(?:c|cc|cpp|cxx|h|hpp|java|js|jsx|mjs|ts|tsx|go|rs|py|kt|swift)$/i
const VAGUE = /(?:^|[_-])(?:final|new|old|copy|tmp|temp|debug|test|backup|fix|v\d+)(?:\.|[_-]|$)/i

export async function inspectStructure(payload = {}) {
  const cwd = payload.cwd || process.cwd()
  const entries = Array.isArray(payload.files) ? payload.files : []
  const warnings = []
  for (const entry of entries) {
    const file = typeof entry === 'string' ? entry : entry?.path
    if (!file || !SOURCE.test(file)) continue
    const rel = relative(cwd, file)
    const name = basename(file)
    if (!rel.includes(sep) && !rel.includes('/')) warnings.push({ code: 'root-source', file: rel })
    if (VAGUE.test(name)) warnings.push({ code: 'vague-name', file: rel })
    try {
      const lines = (await readFile(file, 'utf8')).split(/\r?\n/).length
      if (lines > 800) warnings.push({ code: 'large-file', file: rel, lines })
    } catch {
      // Hook is advisory when a path is gone or inaccessible; the agent still reports it.
    }
  }
  return { ok: true, ...(warnings.length ? { warnings } : {}) }
}
