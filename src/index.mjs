import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Config } from './config/plugin-config.mjs'
import { registerReviewCommand } from './review/review-command.mjs'
import { registerStructureHook } from './hook/post-execute-hook.mjs'
import { registerConfiguredMechanisms } from './mechanisms/index.mjs'

const promptPath = fileURLToPath(new URL('../assets/prompts/maintainable-coding-agent-prompt.md', import.meta.url))
const prompt = readFileSync(promptPath, 'utf8').trim()

export const name = 'patchwork-agent'
export const inject = ['systemPrompt', 'commands', 'tools']

export { Config }

export function apply(ctx, config) {
  ctx.systemPrompt.section({
    name,
    order: 50,
    text: prompt,
  })
  registerReviewCommand(ctx)
  registerStructureHook(ctx)
  registerConfiguredMechanisms(ctx, config)
}
