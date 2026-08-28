import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const promptPath = fileURLToPath(new URL('../docs/maintainable-coding-agent-prompt.md', import.meta.url))
const prompt = readFileSync(promptPath, 'utf8').trim()

export const name = 'patchwork-agent'
export const inject = ['systemPrompt']

export function apply(ctx) {
  ctx.systemPrompt.section({
    name,
    order: 50,
    text: prompt,
  })
}
