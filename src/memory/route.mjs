import { resolvePatchworkAgent } from '../scope.mjs'
import { webRuntime } from '../ui/web-runtime.mjs'
import { confirmMemory, forgetMemory, forgetMemories, listMemory, proposeMemory, recallMemory, reviseMemory, setMemoryValidity } from './store.mjs'
import { logDiagnostic } from '../logging/session-log.mjs'

export const MEMORY_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/memory'
const routeKey = `exact\u0000${MEMORY_ROUTE_PATH}`
const MAX_BODY_BYTES = 16 * 1024

export function registerMemoryRoute(ctx, { token } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)
  const mount = () => {
    const dispose = server.register({ kind: 'exact', path: MEMORY_ROUTE_PATH, handler: async (req, res) => {
      const reply = (status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)) }
      if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
      const params = new URL(req.url ?? MEMORY_ROUTE_PATH, 'http://localhost').searchParams
      const id = params.get('sessionId')
      const agent = resolvePatchworkAgent(ctx, id)
      if (!agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      const cancellation = new AbortController()
      req.on('aborted', () => cancellation.abort())
      res.on?.('close', () => { if (!res.writableEnded) cancellation.abort() })
      if (req.method === 'GET') {
        if (params.get('action') === 'recall') {
          const recalled = await recallMemory(agent, { query: params.get('query') ?? '', includeProject: params.get('includeProject') === 'true', limit: Number(params.get('limit') ?? 5), signal: cancellation.signal })
          if (resolvePatchworkAgent(ctx, id) !== agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
          return reply(200, { ok: true, ...recalled })
        }
        const result = await listMemory(agent, { query: params.get('query') ?? '', scope: params.get('scope') ?? 'session-private', status: params.get('status') ?? 'all', validity: params.get('validity') ?? 'all', offset: Number(params.get('offset') ?? 0), limit: Number(params.get('limit') ?? 20), id: params.get('id') ?? undefined, includeValue: true, signal: cancellation.signal })
        if (resolvePatchworkAgent(ctx, id) !== agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
        return reply(result.status === 'failed' ? 400 : 200, { ok: result.status !== 'failed', ...result })
      }
      if (req.method !== 'POST') return reply(405, { ok: false, reason: 'method-not-allowed' })
      let body
      try { body = JSON.parse(await readBody(req)) } catch { return reply(400, { ok: false, reason: 'body-not-json' }) }
      if (resolvePatchworkAgent(ctx, id) !== agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      if (!Number.isSafeInteger(body?.expectedRevision)) return reply(400, { ok: false, failureCode: 'MEMORY_REVISION_REQUIRED' })
      if (['propose', 'revise'].includes(body?.action) && (!body.record || typeof body.record !== 'object' || Array.isArray(body.record) || Object.keys(body.record).some(key => !['key', 'value', 'kind', 'conditions', 'visibility'].includes(key)))) return reply(400, { ok: false, failureCode: 'MEMORY_INVALID_RECORD' })
      let result
      if (body?.action === 'confirm') result = await confirmMemory(agent, body.id, body.expectedRevision, { userConfirmed: true, signal: cancellation.signal })
      else if (body?.action === 'forget') result = await forgetMemory(agent, body.id, body.expectedRevision, { userConfirmed: true, signal: cancellation.signal })
      else if (body?.action === 'forget-many') result = await forgetMemories(agent, body.ids, body.expectedRevision, { userConfirmed: true, signal: cancellation.signal })
      else if (body?.action === 'propose') result = await proposeMemory(agent, body.record, { expectedRevision: body.expectedRevision, sourceKind: 'user-authored', signal: cancellation.signal })
      else if (body?.action === 'revise') result = await reviseMemory(agent, body.id, body.record, body.expectedRevision, { userConfirmed: true, signal: cancellation.signal })
      else if (body?.action === 'validity') result = await setMemoryValidity(agent, body.id, body.expectedRevision, body.validity, { userConfirmed: true, signal: cancellation.signal })
      else return reply(400, { ok: false, reason: 'unsupported-memory-action' })
      const memoryEvents = { propose: ['propose', 'memory-proposed'], revise: ['revise', 'memory-revised'], confirm: ['confirm', 'memory-confirmed'], forget: ['forget', 'memory-forgotten'], 'forget-many': ['forget', 'memory-forgotten'], validity: ['validity', 'memory-validity'] }
      const [event, reason] = memoryEvents[body.action] ?? ['decision', 'enabled']
      logDiagnostic(ctx, agent, { mechanism: 'memory', event, reason: result.status === 'failed' ? 'exception' : reason, level: result.status === 'failed' ? 'warn' : 'info' })
      if (result.status === 'failed') return reply(result.failureCode === 'MEMORY_REVISION_CONFLICT' ? 409 : 400, { ok: false, ...result })
      return reply(200, { ok: true, ...result })
    } })
    return () => { dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(mount, 'patchwork: memory management endpoint')
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
