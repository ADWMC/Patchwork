import Schema from '@deepseek-ai/schemastery'
import { randomUUID } from 'node:crypto'
import { registerBrowserTool } from './browser/tool.mjs'
import { registerBrowserRoute, BROWSER_ROUTE_PATH } from './browser/route.mjs'
import { browserPreset, grantBrowserAccess, resolveBrowserAgent } from './scope.mjs'
import { webRuntime } from './ui/web-runtime.mjs'
import { registerBrowserSkill } from './skill.mjs'

export const name = 'patchwork-browser'
export const inject = ['agents', 'agentPresets']
export const Config = Schema.object({
  maxInstances: Schema.number().min(1).max(8).step(1).default(2),
  maxTabs: Schema.number().min(1).max(8).step(1).default(8),
  idleTimeoutMs: Schema.number().min(30000).max(3600000).step(1).default(300000),
  memoryTargetMiB: Schema.number().min(128).max(16384).step(1).default(512),
  autoReclaim: Schema.boolean().default(false),
})

export function createBrowserManager(ctx, config = {}, dependencies = {}) {
  const enabled = new Map(), closing = new Map()
  let disposed = false
  const current = agent => !disposed && resolveBrowserAgent(ctx, agent?.session?.header?.id, { authorized: false }) === agent
  const manager = {
    status(agent) { return { enabled: current(agent) && enabled.has(agent) && enabled.get(agent).preset === browserPreset(agent), closing: closing.has(agent), preset: browserPreset(agent), accessId: enabled.get(agent)?.accessId ?? null } },
    enable(agent, expectedPreset) {
      if (!current(agent) || expectedPreset !== browserPreset(agent)) throw new Error('Agent composition changed; refresh browser access')
      if (closing.has(agent)) throw new Error('Browser is still closing; retry shortly')
      if (manager.status(agent).enabled) return
      if (enabled.has(agent)) throw new Error('Previous browser access must be revoked first')
      const revoke = grantBrowserAccess(agent)
      let runtime, unregisterSkill
      try {
        // Register against the Agent's own native tool scope, never the root.
        runtime = registerBrowserTool(agent.ctx, { ...dependencies, expectedAgent: agent, listen: false, resourcePolicy: config, onReceipt: receipt => {
          dependencies.onReceipt?.(receipt)
          for (const sink of globalThis[Symbol.for('@patchwork/browser/receipt-sinks/v1')] ?? []) { try { sink(agent, receipt) } catch {} }
        } })
        unregisterSkill = registerBrowserSkill(agent.ctx)
        enabled.set(agent, { runtime, revoke, unregisterSkill, preset: expectedPreset, accessId: randomUUID() })
      } catch (error) {
        revoke(); unregisterSkill?.()
        if (runtime) {
          const cleanup = Promise.resolve(runtime.dispose()).finally(() => closing.delete(agent))
          closing.set(agent, cleanup)
          // enable is synchronous; preserve the registration failure for its caller.
          void cleanup.catch(() => {})
        }
        throw error
      }
    },
    async disable(agent, { graceful = true } = {}) {
      if (closing.has(agent)) return closing.get(agent)
      const item = enabled.get(agent)
      if (!item) return
      enabled.delete(agent); item.unregisterSkill?.()
      if (!graceful) item.revoke()
      // dispose synchronously freezes new actions before its first await. Keep
      // the saving capability only for an explicitly requested graceful close.
      const work = item.runtime.dispose().finally(() => { item.revoke(); closing.delete(agent) })
      closing.set(agent, work)
      return work
    },
    async dispose() {
      disposed = true
      await Promise.all([...enabled.keys()].map(agent => manager.disable(agent, { graceful: false })).concat([...closing.values()]))
    },
  }
  ctx.on?.('agent/disposed', ({ agent }) => manager.disable(agent, { graceful: false }))
  ctx.on?.('agent-preset/selected', id => {
    const agent = ctx.get?.('agents')?.get?.(id)
    if (agent) return manager.disable(agent, { graceful: false })
  })
  return manager
}

export function apply(ctx, config = {}) {
  const manager = createBrowserManager(ctx, config)
  ctx.effect(() => () => manager.dispose(), 'browser: independent runtime lifetime')
  const mount = webCtx => {
    registerBrowserRoute(webCtx, { token: webRuntime.token, manager })
    const server = webCtx.get('webServer')
    webCtx.effect(() => server.tapIndex(html => {
      const json = JSON.stringify({ browserPath: BROWSER_ROUTE_PATH, token: webRuntime.token }).replace(/</g, '\\u003c')
      const element = `<script type="application/json" data-patchwork-browser>${json}</script>`
      return html.includes('</head>') ? html.replace('</head>', `${element}</head>`) : element + html
    }), 'browser: independent page metadata')
  }
  ctx.inject(['webServer'], mount)
}
