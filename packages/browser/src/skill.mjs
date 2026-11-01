import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../assets/skills/browser-workspace/', import.meta.url)
const raw = readFileSync(new URL('SKILL.md', root), 'utf8')
const end = raw.indexOf('\n---', 3)
const description = raw.slice(3, end).match(/^description:\s*(.+)$/m)[1]
export const browserSkill = { name: 'browser-workspace', description, content: raw.slice(end + 4).trim(), source: 'runtime', invocation: { modelInvocable: true, userInvocable: true }, resourceBase: { kind: 'directory', path: fileURLToPath(root) } }

export function registerBrowserSkill(ctx) {
  // The same native Agent scope as its tools; never install a root catalog.
  if (ctx.skills?.register) return ctx.skills.register(browserSkill)
}
