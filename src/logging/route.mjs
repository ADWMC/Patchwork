import { resolvePatchworkAgent } from '../scope.mjs'
import { webRuntime } from '../ui/web-runtime.mjs'
import { diagnosticSnapshot } from './session-log.mjs'
import { fingerprint } from './schema.mjs'

export const LOGS_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/logs'
const routeKey = `exact\u0000${LOGS_ROUTE_PATH}`

export function registerDiagnosticRoute(ctx, { token }) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)
  const mount = () => {
    const dispose = server.register({ kind: 'exact', path: LOGS_ROUTE_PATH, handler(req, res) {
      const reply = (status, data) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify(data))
      }
      if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
      if (req.method !== 'GET') return reply(405, { ok: false, reason: 'method-not-allowed' })
      const id = new URL(req.url ?? LOGS_ROUTE_PATH, 'http://localhost').searchParams.get('sessionId')
      const agent = resolvePatchworkAgent(ctx, id)
      if (!agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      return reply(200, { ok: true, schemaVersion: 1, generatedAt: new Date().toISOString(),
        sessionIdHash: fingerprint(id), scope: 'current-session-recent-diagnostics', ...diagnosticSnapshot(agent) })
    } })
    return () => { dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(mount, 'patchwork: diagnostic metadata endpoint')
  else mount()
}
