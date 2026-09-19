import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Config } from './config/plugin-config.mjs'
import { effectiveConfig, readUserConfig } from './config/user-config.mjs'
import { registerReviewCommand } from './review/review-command.mjs'
import { registerStructureHook } from './hook/post-execute-hook.mjs'
import { registerConfiguredMechanisms } from './mechanisms/index.mjs'
import { registerStatsInjection } from './ui/stats-injection.mjs'
import { registerConfigRoute } from './ui/config-route.mjs'

const promptPath = fileURLToPath(new URL('../assets/prompts/maintainable-coding-agent-prompt.md', import.meta.url))
const prompt = readFileSync(promptPath, 'utf8').trim()

// 写密钥进程级共享：插件可能被加载多次（agent preset 与 profile 补丁各一份），
// 而配置路由只注册一次。所有实例必须注入同一个密钥，否则面板保存会用后写实例的
// token 打第一个实例注册的路由，直接 403。
let sharedWriteToken

export const name = 'patchwork-agent'
export const inject = ['systemPrompt', 'commands', 'tools']

export { Config }

export function apply(ctx, config) {
  const rowConfig = config ?? {}
  // 有效配置 = 插件行的部署默认值 + 用户在侧边栏里保存的值（用户优先）。
  const effective = effectiveConfig(rowConfig, readUserConfig())

  // 一行启动事实：排障时比猜快得多。
  const enabled = ['actionFusion', 'observationPack', 'evidencePreservingReducer', 'onlineContextCompact'].filter(
    key => effective[key] === true,
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
  // 机制按**生效配置**注册；因此侧边栏保存的改动要重启后才改变机制行为。
  registerConfiguredMechanisms(ctx, effective)

  // 侧边栏的读与写：读走页面注入（每次渲染重读，保存后刷新即见），
  // 写走一条带进程级共享密钥的 POST 路由。
  sharedWriteToken ??= randomBytes(16).toString('hex')
  registerConfigRoute(ctx, { token: sharedWriteToken, rowConfig })
  registerStatsInjection(ctx, {
    token: sharedWriteToken,
    readConfig: () => effectiveConfig(rowConfig, readUserConfig()),
  })
}
