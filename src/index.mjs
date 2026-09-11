import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Config } from './config/plugin-config.mjs'
import { registerReviewCommand } from './review/review-command.mjs'
import { registerStructureHook } from './hook/post-execute-hook.mjs'
import { registerConfiguredMechanisms } from './mechanisms/index.mjs'
import { registerStatsInjection } from './ui/stats-injection.mjs'

const promptPath = fileURLToPath(new URL('../assets/prompts/maintainable-coding-agent-prompt.md', import.meta.url))
const prompt = readFileSync(promptPath, 'utf8').trim()

export const name = 'patchwork-agent'
export const inject = ['systemPrompt', 'commands', 'tools']

export { Config }

export function apply(ctx, config) {
  // 一行启动事实：配置有没有到手、哪些机制开着。排障时比猜快得多。
  const enabled = ['actionFusion', 'observationPack', 'evidencePreservingReducer', 'onlineContextCompact'].filter(
    key => config?.[key] === true,
  )
  console.log(
    `[patchwork] loaded; configuration ${config === undefined ? 'MISSING' : 'present'}; mechanisms: ${enabled.join(', ') || 'none'}`,
  )

  ctx.systemPrompt.section({
    name,
    order: 50,
    text: prompt,
  })
  registerReviewCommand(ctx)
  registerStructureHook(ctx)
  registerConfiguredMechanisms(ctx, config)
  // 配置与机制计数注入页面，供右侧栏看板读取；没有 webserver 时安静跳过。
  registerStatsInjection(ctx, config)
}
