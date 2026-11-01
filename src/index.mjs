import { Config } from './config/plugin-config.mjs'
import { registerStatsInjection } from './ui/stats-injection.mjs'
import { registerConfigRoute } from './ui/config-route.mjs'
import { registerRuntimeState } from './ui/runtime-state.mjs'
import { webRuntime } from './ui/web-runtime.mjs'
import { registerDiagnosticRoute } from './logging/route.mjs'
import { registerMemoryRoute } from './memory/route.mjs'
import { registerImprovementRoute } from './improvement/route.mjs'

// The profile installs only the web bridge. Agent behavior belongs exclusively
// to the Patchwork preset's standing composition (./runtime).

export const name = 'patchwork-agent'
export const inject = ['agents', 'agentPresets']

export { Config }

export function apply(ctx) {
  const mount = webCtx => {
    const sharedWriteToken = webRuntime.token
    registerConfigRoute(webCtx, { token: sharedWriteToken })
    registerRuntimeState(webCtx, { token: sharedWriteToken })
    registerDiagnosticRoute(webCtx, { token: sharedWriteToken })
    registerMemoryRoute(webCtx, { token: sharedWriteToken })
    registerImprovementRoute(webCtx, { token: sharedWriteToken })
    registerStatsInjection(webCtx, { token: sharedWriteToken })
  }
  // The web server can start after the agent registries. Follow the host's
  // optional-carrier lifecycle; a CLI profile needs no web bridge at all.
  if (ctx.inject) ctx.inject(['webServer'], mount)
  else mount(ctx)
}
