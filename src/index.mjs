import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { registerReviewCommand } from './review-command.mjs'
import { registerPostExecuteHook } from './post-execute-hook.mjs'

const promptPath = fileURLToPath(new URL('../assets/prompts/maintainable-coding-agent-prompt.md', import.meta.url))
const prompt = readFileSync(promptPath, 'utf8').trim()

export const name = 'patchwork-agent'
export const inject = ['systemPrompt', 'commands']

export function apply(ctx) {
  ctx.systemPrompt.section({
    name,
    order: 50,
    text: prompt,
  })
  registerReviewCommand(ctx)
  registerPostExecuteHook(ctx)
}
