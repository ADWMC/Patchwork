import { resolvePatchworkAgent } from '../scope.mjs'
import { getController } from './controller.mjs'
import { taskProjection, transitionTask, flushTasks } from '../task/store.mjs'
import { webRuntime } from '../ui/web-runtime.mjs'
import { logDiagnostic } from '../logging/session-log.mjs'
import { crossSiteRequest } from '../ui/request-guard.mjs'

export const SUPERAGENT_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/superagent'
export function registerSuperagentRoute(ctx, { token } = {}) {
  const key = `exact\0${SUPERAGENT_ROUTE_PATH}`, server = ctx.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(key)) return
  webRuntime.routes.add(key)
  const mount = () => {
    const dispose = server.register({ kind: 'exact', path: SUPERAGENT_ROUTE_PATH, async handler(req, res) {
      const reply = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)) }
      if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
      if (crossSiteRequest(req)) return reply(403, { ok: false, reason: 'cross-site-request' })
      const agent = resolvePatchworkAgent(ctx, new URL(req.url, 'http://localhost').searchParams.get('sessionId'))
      if (!agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
      if (req.method !== 'POST') return reply(405, { ok: false, reason: 'method-not-allowed' })
      try {
        const body = JSON.parse(await new Promise((resolve, reject) => {
          const chunks = []; let bytes = 0
          req.on('data', chunk => { bytes += chunk.length; if (bytes > 16384) { reject(new Error('body too large')); req.destroy(); return }; chunks.push(chunk) })
          req.on('error', reject); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        }))
        if (resolvePatchworkAgent(ctx, agent.session.header.id) !== agent) return reply(403, { ok: false, reason: 'patchwork-agent-required' })
        if (body.action === 'task-review') {
          const task = taskProjection(agent)
          if (task.revision !== body.baseRevision) throw new Error('task revision conflict')
          transitionTask(agent, { kind: 'user-review', id: body.id, baseRevision: body.baseRevision, accept: body.accept === true, userConfirmed: true, at: new Date().toISOString() })
          await flushTasks(agent)
          logDiagnostic(ctx, agent, { mechanism: 'task', event: 'review', reason: 'queue-review' })
          return reply(200, { ok: true, task: taskProjection(agent) })
        }
        if (body.action === 'task-cancel') {
          const task = taskProjection(agent)
          if (task.revision !== body.baseRevision) throw new Error('task revision conflict')
          transitionTask(agent, { kind: 'cancel', baseRevision: body.baseRevision })
          await flushTasks(agent)
          logDiagnostic(ctx, agent, { mechanism: 'task', event: 'cancel', reason: 'task-cancelled' })
          return reply(200, { ok: true, task: taskProjection(agent) })
        }
        const controller = getController(agent)
        if (body.action !== 'reconcile') controller.assertRevision(body.baseRevision)
        let queue
        if (body.action === 'review') queue = await controller.review(body.id, body.baseRevision, { accept: body.accept === true, evidenceVersion: body.evidenceVersion, userConfirmed: true })
        else if (body.action === 'retry') queue = await controller.retry(body.id, body.baseRevision)
        else if (body.action === 'input') {
          if (typeof body.input !== 'string' || !body.input.trim() || body.input.length > 4000) throw new Error('input must be 1..4000 characters')
          queue = await controller.retry(body.id, body.baseRevision, body.input)
        }
        else if (body.action === 'reconcile') queue = await controller.reconcile()
        else if (body.action === 'resume') queue = await controller.resume(body.baseRevision)
        else if (body.action === 'pause' || body.action === 'cancel') queue = await controller.pause(body.action, body.action === 'cancel')
        else return reply(400, { ok: false, reason: 'unknown action' })
        const reasons = { input: 'queue-input', retry: 'queue-retry', review: 'queue-review', pause: 'queue-paused', resume: 'queue-resumed', cancel: 'queue-cancelled', reconcile: 'queue-reconciled' }
        logDiagnostic(ctx, agent, { mechanism: 'superagent', event: body.action, reason: reasons[body.action] ?? 'enabled' })
        return reply(200, { ok: true, queue })
      } catch (error) { return reply(/conflict/.test(error.message) ? 409 : 400, { ok: false, reason: error.message }) }
    } })
    return () => { dispose?.(); webRuntime.routes.delete(key) }
  }
  if (ctx.effect) ctx.effect(mount, 'patchwork: user review and queue controls'); else mount()
}
