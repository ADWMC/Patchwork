import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { isPatchworkAgent } from '../scope.mjs'

const skillPath = fileURLToPath(new URL('../../assets/skills/web-ui/SKILL.md', import.meta.url))
const referencePath = fileURLToPath(new URL('../../assets/skills/web-ui/references', import.meta.url))
const surface = /(?:\bweb\s*ui\b|\bui\b|\bux\b|\bhtml\b|\bcss\b|\bjsx\b|\breact\b|\bvue\b|\bsvelte\b|\bdashboard\b|界面|页面|网页|前端|控制面板)/i
const action = /(?:设计|实现|制作|开发|重做|改版|美化|优化|修复|审查|评审|检查|调整|搭建|绘制|build|create|design|implement|redesign|review|fix|polish)/i

export function matchesUiWork(text) {
  return typeof text === 'string' && surface.test(text) && action.test(text)
}

function textOf(message) {
  return (message?.content ?? []).filter(block => block?.type === 'text').map(block => block.text).join('\n')
}

function bundledBody() {
  const raw = readFileSync(skillPath, 'utf8').replace(/^\uFEFF/, '')
  const end = raw.indexOf('\n---', 3)
  return end < 0 ? raw.trim() : raw.slice(end + 4).trim()
}

/** Activate bundled UI guidance only for Patchwork UI work turns. */
export function registerUiGuidance(ctx, config = {}, body) {
  if (config.skillsEnabled === false) return
  body ??= bundledBody()
  const seen = new WeakMap()
  ctx.on('agent/pre-step', async ({ agent, messages }, next) => {
    const decision = await next()
    if (decision.kind !== 'enter' || !isPatchworkAgent(agent)) return decision
    const incoming = (messages ?? []).filter(message => message?.source?.kind === 'user')
    const match = incoming.findLast(message => matchesUiWork(textOf(message)))
    if (!match) return decision
    let ids = seen.get(agent)
    if (!ids) seen.set(agent, ids = new Set())
    const key = match.id ?? textOf(match)
    if (ids.has(key)) return decision
    ids.add(key)
    if (ids.size > 32) ids.delete(ids.values().next().value)
    const notice = createUserMessage({
      content: [{ type: 'text', text: `[pw:web-ui] Current task is Web UI work. Apply this bundled skill before editing. Read only relevant references from ${referencePath}. This guidance does not grant permission.\n\n<skill_content name="web-ui">\n${body}\n</skill_content>` }],
      source: { kind: 'patchwork', form: 'notice', summary: 'scoped web-ui guidance' },
    })
    return { ...decision, messages: [...decision.messages, notice] }
  })
}
