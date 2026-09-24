import { randomBytes } from 'node:crypto'
import { Config } from './config/plugin-config.mjs'
import { effectiveConfig, readUserConfig } from './config/user-config.mjs'
import { registerReviewCommand } from './review/review-command.mjs'
import { registerStructureHook } from './hook/post-execute-hook.mjs'
import { registerConfiguredMechanisms } from './mechanisms/index.mjs'
import { registerStatsInjection } from './ui/stats-injection.mjs'
import { registerConfigRoute } from './ui/config-route.mjs'
import { registerPatchworkSkills } from './skills/register.mjs'

// 写密钥进程级共享：插件可能被加载多次（agent preset 与 profile 补丁各一份），
// 而配置路由只注册一次。所有实例必须注入同一个密钥，否则面板保存会用后写实例的
// token 打第一个实例注册的路由，直接 403。
let sharedWriteToken

export const name = 'patchwork-agent'
// DSH 否决 systemPrompt 段；技能走 ctx.skills 渐进披露（目录仅 name+description）。
export const inject = ['skills', 'commands', 'tools']

export { Config }

export async function apply(ctx, config) {
  const rowConfig = config ?? {}
  const effective = effectiveConfig(rowConfig, readUserConfig())

  const skills = await registerPatchworkSkills(ctx, effective)
  const enabled = ['actionFusion', 'observationPack', 'evidencePreservingReducer', 'onlineContextCompact'].filter(
    key => effective[key] === true,
  )
  console.log(
    `[patchwork] loaded; configuration ${config === undefined ? 'MISSING' : 'present'}; skills: ${skills.join(', ') || 'none'}; mechanisms: ${enabled.join(', ') || 'none'}; systemPrompt=none`,
  )

  registerReviewCommand(ctx)
  registerStructureHook(ctx, effective)
  registerConfiguredMechanisms(ctx, effective)

  sharedWriteToken ??= randomBytes(16).toString('hex')
  registerConfigRoute(ctx, { token: sharedWriteToken, rowConfig })
  registerStatsInjection(ctx, {
    token: sharedWriteToken,
    readConfig: () => effectiveConfig(rowConfig, readUserConfig()),
  })
}
