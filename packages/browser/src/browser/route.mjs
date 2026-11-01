import { browserClient } from './tool.mjs'
import { resolveBrowserAgent } from '../scope.mjs'
import { webRuntime } from '../ui/web-runtime.mjs'
import { safeBrowserError } from './policy.mjs'
import { registerBrowserTransport } from './transport.mjs'

export const BROWSER_ROUTE_PATH = '/api/plugins/patchwork-browser/browser'
const routeKey = `exact\u0000${BROWSER_ROUTE_PATH}`
const MAX_BODY_BYTES = 16 * 1024

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function registerBrowserRoute(ctx, { token, manager } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)
  const register = () => {
    const transport = registerBrowserTransport(server, BROWSER_ROUTE_PATH + '/stream', id => {
      const agent = resolveBrowserAgent(ctx, id)
      if (!agent || manager && !manager.status(agent).enabled) return null
      const client = browserClient(agent)
      return client ? { agent, client } : null
    })
    const dispose = server.register({ kind: 'exact', path: BROWSER_ROUTE_PATH, async handler(req, res) {
      const reply = (status, body) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify(body))
      }
      if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
      if (!['GET', 'POST'].includes(req.method)) return reply(405, { ok: false, reason: 'method-not-allowed' })
      const url = new URL(req.url ?? BROWSER_ROUTE_PATH, 'http://localhost')
      const id = url.searchParams.get('sessionId')
      const agent = resolveBrowserAgent(ctx, id, { authorized: !manager })
      if (manager && agent) {
        if (req.method === 'GET' && url.searchParams.get('view') === 'access') return reply(200, { ok: true, ...manager.status(agent) })
        if (req.method === 'POST' && url.searchParams.get('view') === 'access') {
          try {
            const body = JSON.parse(await readBody(req))
            if (resolveBrowserAgent(ctx, id, { authorized: false }) !== agent) return reply(403, { ok: false, reason: 'browser-access-required' })
            if (body?.action === 'enable') manager.enable(agent, body.preset)
            else if (body?.action === 'disable') {
              const access = manager.status(agent)
              if (body.preset !== access.preset || body.accessId !== access.accessId) return reply(409, { ok: false, reason: 'browser-access-changed' })
              await manager.disable(agent)
            }
            else return reply(400, { ok: false, reason: 'invalid-access-action' })
            return reply(200, { ok: true, ...manager.status(agent) })
          } catch (error) { return reply(400, { ok: false, reason: safeBrowserError(error) }) }
        }
      }
      if (!agent) return reply(403, { ok: false, reason: 'browser-access-required' })
      if (manager && !manager.status(agent).enabled) return reply(403, { ok: false, reason: 'browser-access-required' })
      const client = browserClient(agent)
      if (!client) return reply(503, { ok: false, reason: 'browser-runtime-unavailable' })
      try {
        if (req.method === 'POST' && url.searchParams.get('view') === 'stream-ticket') return reply(200, { ok: true, ...transport.issue(id) })
        if (req.method === 'GET') {
          if (url.searchParams.get('view') === 'stream') {
            res.statusCode = 200
            res.setHeader('content-type', 'text/event-stream')
            res.setHeader('cache-control', 'no-store')
            res.setHeader('x-accel-buffering', 'no')
            res.flushHeaders?.()
            let latest, stop, scheduled, lastSent = 0, closed = false, blocked = false, starting = true, endedDuringStart = false
            const valid = () => resolveBrowserAgent(ctx, id) === agent && browserClient(agent) === client
            const end = () => { if (closed) return; closed = true; clearTimeout(scheduled); clearInterval(timer); latest = null; stop?.(); res.end() }
            const flush = () => {
              scheduled = null
              if (!valid()) return end()
              if (!latest || blocked || closed) return
              const { image, ...metadata } = latest; latest = null; lastSent = performance.now()
              blocked = !res.write(`data: ${JSON.stringify({ ...metadata, image: image.toString('base64') })}\n\n`)
            }
            const schedule = () => { if (!scheduled && !blocked && !closed) scheduled = setTimeout(flush, Math.max(0, 33 - (performance.now() - lastSent))) }
            const timer = setInterval(() => {
              if (resolveBrowserAgent(ctx, id) !== agent || browserClient(agent) !== client) return end()
              if (!blocked && !closed) blocked = !res.write(': heartbeat\n\n')
            }, 1000)
            res.on('drain', () => { blocked = false; schedule() })
            res.on('close', end)
            req.on('aborted', end)
            try {
              stop = await client.stream(frame => { if (!closed) { latest = frame; schedule() } }, () => { if (starting) endedDuringStart = true; else end() })
              starting = false
              if (endedDuringStart) end()
              if (closed) stop()
            } catch { starting = false; if (!closed) { res.write('event: fallback\ndata: {}\n\n'); end() } }
            return
          }
          if (url.searchParams.get('view') === 'frame') {
            const frame = await client.frame()
            if (resolveBrowserAgent(ctx, id) !== agent || browserClient(agent) !== client) return reply(403, { ok: false, reason: 'browser-access-required' })
            if (!frame) { res.statusCode = 204; res.setHeader('cache-control', 'no-store'); return res.end() }
            res.statusCode = 200
            res.setHeader('content-type', 'image/jpeg')
            res.setHeader('cache-control', 'no-store')
            res.setHeader('x-patchwork-frame-id', frame.frameId)
            res.setHeader('x-patchwork-tab-id', frame.tabId)
            res.setHeader('x-patchwork-viewport', `${frame.viewport.width},${frame.viewport.height}`)
            res.setHeader('x-patchwork-focus-id', frame.focusId ?? '')
            res.setHeader('x-patchwork-capture-id', frame.capture.id)
            res.setHeader('x-patchwork-epoch', String(frame.epoch))
            return res.end(frame.image)
          }
          const status = await client.status()
          if (resolveBrowserAgent(ctx, id) !== agent || browserClient(agent) !== client) return reply(403, { ok: false, reason: 'browser-access-required' })
          return reply(200, { ok: true, ...status })
        }
        const body = JSON.parse(await readBody(req))
        if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { ok: false, reason: 'invalid-action' })
        if (resolveBrowserAgent(ctx, id) !== agent || browserClient(agent) !== client) return reply(403, { ok: false, reason: 'browser-access-required' })
        const view = url.searchParams.get('view')
        const result = view === 'cancel' ? await client.cancel() : view === 'input' ? await client.input(body) : await client.action(body)
        if (resolveBrowserAgent(ctx, id) !== agent || browserClient(agent) !== client) return reply(403, { ok: false, reason: 'browser-access-required' })
        return reply(200, { ok: true, ...result })
      } catch (error) {
        // Revocation can win while an authorized request awaits browser work.
        if (resolveBrowserAgent(ctx, id) !== agent || browserClient(agent) !== client) return reply(403, { ok: false, reason: 'browser-access-required' })
        return reply(400, { ok: false, reason: safeBrowserError(error) })
      }
    } })
    return () => { transport.dispose(); dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(register, 'patchwork: shared browser surface')
  else return register()
}
