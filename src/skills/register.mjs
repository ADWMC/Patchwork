import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const skillsRoot = fileURLToPath(new URL('../../assets/skills', import.meta.url))

function parseFrontmatter(raw, fallbackName) {
  const text = raw.replace(/^﻿/, '')
  if (!text.startsWith('---')) {
    return { name: fallbackName, description: '', content: text.trim() }
  }
  const end = text.indexOf('\n---', 3)
  if (end < 0) {
    return { name: fallbackName, description: '', content: text.trim() }
  }
  const fm = text.slice(3, end).trim()
  const content = text.slice(end + 4).trim()
  const field = key => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    name: field('name') || fallbackName,
    description: field('description'),
    content,
  }
}

/**
 * Register lean Patchwork skills via DSH progressive disclosure.
 * Catalog carries name+description only; bodies load with the skill tool.
 * Never touches systemPrompt.
 */
export async function registerPatchworkSkills(ctx, config = {}) {
  if (config.skillsEnabled === false) return []
  if (!ctx.skills?.register) {
    console.warn('[patchwork] skills service unavailable; skill catalog not registered')
    return []
  }

  let entries = []
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true })
  } catch {
    console.warn('[patchwork] assets/skills missing; no skills registered')
    return []
  }

  const registered = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const mdPath = join(skillsRoot, entry.name, 'SKILL.md')
    let raw
    try {
      raw = await readFile(mdPath, 'utf8')
    } catch {
      continue
    }
    const parsed = parseFrontmatter(raw, entry.name)
    if (!parsed.name || !parsed.description || !parsed.content) continue

    ctx.skills.register({
      name: parsed.name,
      description: parsed.description,
      content: parsed.content,
      // rc.2 的 get() 走 validateDefinition 强制 source:string，而 register 时
      // 校验宽松——缺这个字段会在模型首次 skill({name}) 拉正文时才爆（实证：
      // dsh-session-aa61be86 会话里连续 Error: loaded skill "…" source must be a string）。
      source: 'runtime',
      invocation: { modelInvocable: true, userInvocable: true },
    })
    registered.push(parsed.name)
  }
  return registered
}
