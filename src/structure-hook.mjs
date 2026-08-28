import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { basename, relative, sep } from 'node:path'

const SOURCE = /\.(?:c|cc|cpp|cxx|h|hpp|java|js|jsx|mjs|ts|tsx|go|rs|py|kt|swift)$/i
const VAGUE = /(?:^|[_-])(?:final|new|old|copy|tmp|temp|debug|test|backup|fix|v\d+)(?:\.|[_-]|$)/i
const PROMPT = '发现结构或命名警告。请先确认职责边界，再按领域/层次拆分文件并使用表达职责的名称；不要用临时改名或继续堆叠到大文件。完成后执行最小验证。'

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
  if (!warnings.length) return { ok: true }
  const session = payload.sessionId || payload.session?.id || payload.cwd || 'default'
  const key = createHash('sha1').update(`${session}:${warnings.map(item => `${item.code}:${item.file}`).join('|')}`).digest('hex')
  const statePath = process.env.PATCHWORK_HOOK_STATE || join(tmpdir(), 'patchwork-hook-state.json')
  let state = {}
  try { state = JSON.parse(await readFile(statePath, 'utf8')) } catch { /* first run */ }
  const previous = state[key] || 0
  const count = previous + 1
  state[key] = count >= 30 ? 0 : count
  try { await writeFile(statePath, JSON.stringify(state)) } catch { /* advisory state */ }
  return { ok: true, warnings, ...(previous === 0 || count >= 30 ? { prompt: PROMPT } : {}) }
}
