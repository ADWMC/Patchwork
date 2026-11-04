import { resolvePatchworkAgent } from '../scope.mjs'
import { webRuntime } from '../ui/web-runtime.mjs'
import { compareEvidence, evidenceSnapshot } from './evidence.mjs'
import { logDiagnostic } from '../logging/session-log.mjs'

export const EVIDENCE_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/evidence'
const routeKey = `exact\u0000${EVIDENCE_ROUTE_PATH}`
const MAX_BODY_BYTES = 16 * 1024

export function registerEvidenceRoute(ctx, { token } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)
  const mount = () => {
    const dispose = server.register({ kind: 'exact', path: EVIDENCE_ROUTE_PATH, handler: async (req, res) => {
      const reply = (status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)) }
      if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
      const id = new URL(req.url ?? EVIDENCE_ROUTE_PATH, 'http://localhost').searchParams.get('sessionId')
      const agent = resolvePatchworkAgent(ctx, id)
      if (!agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      if (req.method === 'GET') return reply(200, { ok: true, entries: evidenceSnapshot(agent) })
      if (req.method !== 'POST') return reply(405, { ok: false, reason: 'method-not-allowed' })
      let body
      try { body = JSON.parse(await readBody(req)) } catch { return reply(400, { ok: false, reason: 'body-not-json' }) }
      if (resolvePatchworkAgent(ctx, id) !== agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      if (body?.action !== 'compare') return reply(400, { ok: false, reason: 'unsupported-evidence-action' })
      const result = compareEvidence(agent, { evidenceId: body.evidenceId, otherId: body.otherId, claimKey: body.claimKey })
      logDiagnostic(ctx, agent, { mechanism: 'evidence', event: 'compare', reason: result.status === 'failed' ? 'exception' : 'evidence-compared', level: result.status === 'failed' ? 'warn' : 'info' })
      return reply(result.status === 'failed' ? 400 : 200, { ok: result.status !== 'failed', ...result })
    } })
    return () => { dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(mount, 'patchwork: evidence comparison endpoint')
  else mount()
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY_BYTES) { reject(new Error('body-too-large')); req.destroy(); return }; chunks.push(chunk) })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
