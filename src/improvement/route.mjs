import { resolvePatchworkAgent } from '../scope.mjs'
import { webRuntime } from '../ui/web-runtime.mjs'
import { decideCandidate, improvementSnapshot, rollbackCandidate, runCandidateExperiment, proposeCandidate } from './store.mjs'
import { logDiagnostic } from '../logging/session-log.mjs'
import { crossSiteRequest } from '../ui/request-guard.mjs'

export const IMPROVEMENT_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/improvements'
const routeKey = `exact\u0000${IMPROVEMENT_ROUTE_PATH}`
const MAX_BODY_BYTES = 16 * 1024

export function registerImprovementRoute(ctx, { token } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)
  const mount = () => {
    const dispose = server.register({ kind: 'exact', path: IMPROVEMENT_ROUTE_PATH, handler: async (req, res) => {
      const reply = (status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)) }
      if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
      if (crossSiteRequest(req)) return reply(403, { ok: false, reason: 'cross-site-request' })
      const id = new URL(req.url ?? IMPROVEMENT_ROUTE_PATH, 'http://localhost').searchParams.get('sessionId')
      const agent = resolvePatchworkAgent(ctx, id)
      if (!agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      if (req.method === 'GET') return reply(200, { ok: true, ...improvementSnapshot(agent) })
      if (req.method !== 'POST') return reply(405, { ok: false, reason: 'method-not-allowed' })
      let body
      try { body = JSON.parse(await readBody(req)) } catch { return reply(400, { ok: false, reason: 'body-not-json' }) }
      if (resolvePatchworkAgent(ctx, id) !== agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      if (!Number.isSafeInteger(body?.expectedRevision) || body.expectedRevision !== improvementSnapshot(agent).revision) return reply(409, { ok: false, failureCode: 'IMPROVEMENT_REVISION_CONFLICT' })
      const cancellation = new AbortController()
      req.on('aborted', () => cancellation.abort())
      res.on?.('close', () => { if (!res.writableEnded) cancellation.abort() })
      let result
      if (body?.action === 'experiment') result = await runCandidateExperiment(agent, body.candidateId, body.expectedRevision, { signal: cancellation.signal })
      else if (body?.action === 'propose') result = proposeCandidate(agent, {
        incidentIds: Array.isArray(body.incidentIds) ? body.incidentIds : body.incidentId ? [body.incidentId] : [],
        object: body.object ?? 'rule',
        trigger: typeof body.trigger === 'string' ? body.trigger : '交付前复核当前验收证据',
        hypothesis: typeof body.hypothesis === 'string' ? body.hypothesis : '提醒复核可减少遗漏；效果由用户审查，不宣称模型收益。',
        changeScope: typeof body.changeScope === 'string' ? body.changeScope : '当前会话交付提醒',
        patch: body.patch ?? { version: 1, setting: 'verifyBeforeDelivery', value: true },
      })
      else if (body?.action === 'trial' || body?.action === 'approve') result = decideCandidate(agent, body.candidateId, body.expectedRevision, { mode: body.action === 'trial' ? 'trial' : 'enabled', userConfirmed: true })
      else if (body?.action === 'rollback') result = rollbackCandidate(agent, body.candidateId, body.expectedRevision, { userConfirmed: true })
      else return reply(400, { ok: false, reason: 'unsupported-improvement-action' })
      const improvementEvents = { propose: 'candidate', experiment: 'experiment', trial: 'approval', approve: 'approval', rollback: 'rollback' }
      logDiagnostic(ctx, agent, { mechanism: 'improvement', event: improvementEvents[body.action] ?? 'decision', reason: result.status === 'failed' ? 'exception' : 'enabled', level: result.status === 'failed' ? 'warn' : 'info' })
      if (result.status === 'failed') return reply(result.failureCode === 'IMPROVEMENT_REVISION_CONFLICT' ? 409 : 400, { ok: false, ...result })
      return reply(200, { ok: true, ...result })
    } })
    return () => { dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(mount, 'patchwork: improvement management endpoint')
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
