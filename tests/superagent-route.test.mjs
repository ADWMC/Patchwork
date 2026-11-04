import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { scopedAgent } from './helpers/agent.mjs'
import { registerSuperagentRoute, SUPERAGENT_ROUTE_PATH } from '../src/superagent/route.mjs'
import { SuperagentController } from '../src/superagent/controller.mjs'
import { initialSuperagent, defineJobs } from '../src/superagent/state.mjs'
import { transitionTask, taskProjection } from '../src/task/store.mjs'

test('superagent management requires token, same composition, current revision and evidence version', async () => {
  const agent = scopedAgent({ session: { header: { id: 'queue-route', cwd: process.cwd() } } }), standard = scopedAgent({ session: { header: { id: 'queue-standard' } } }, 'standard')
  const state = defineJobs(initialSuperagent('queue-route'), [{ id: 'one', title: 'Review fixture', prompt: 'No model calls', mode: 'read' }]); state.status = 'paused'
  Object.assign(state.jobs[0], { status: 'review', evidence: { version: 'current', reviewable: true, verified: false, artifacts: [] } })
  const controller = new SuperagentController(agent, { restore: () => state, persist: async () => {} })
  let route, dispose
  const ctx = { get(name) { return name === 'agents' ? { get(id) { return id === 'queue-route' ? agent : id === 'queue-standard' ? standard : undefined } } : name === 'webServer' ? { register(value) { route = value.handler; return () => {} } } : undefined }, effect(fn) { dispose = fn() } }
  registerSuperagentRoute(ctx, { token: 'fixture-token' })
  async function call(body, { token = 'fixture-token', session = 'queue-route', method = 'POST', beforeBody } = {}) {
    const req = new EventEmitter(); Object.assign(req, { url: `${SUPERAGENT_ROUTE_PATH}?sessionId=${session}`, method, headers: { 'x-patchwork-token': token }, destroy() {} })
    const res = { statusCode: 0, setHeader() {}, end(data) { this.body = JSON.parse(data) } }
    const pending = route(req, res); beforeBody?.(); req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); await pending; return res
  }
  try {
    const review = { action: 'review', id: 'one', baseRevision: 1, accept: true, evidenceVersion: 'current' }
    assert.equal((await call(review, { token: 'bad' })).statusCode, 403)
    assert.equal((await call(review, { session: 'queue-standard' })).statusCode, 403)
    assert.equal((await call(review, { method: 'GET' })).statusCode, 405)
    assert.equal((await call({ ...review, baseRevision: 0 })).statusCode, 409)
    assert.equal((await call({ ...review, evidenceVersion: 'old' })).statusCode, 400)
    assert.equal(controller.snapshot().jobs[0].status, 'review')
    assert.equal((await call(review)).statusCode, 200); assert.equal(controller.snapshot().jobs[0].status, 'done'); assert.equal(controller.snapshot().jobs[0].evidence.verified, false)
    transitionTask(agent, { kind: 'define', data: { title: 'semantic fixture', phase: 'verify', requirements: [{ id: 'meaning', kind: 'semantic', label: 'Meaning' }] } })
    const revision = taskProjection(agent).revision
    assert.equal((await call({ action: 'task-review', id: 'meaning', baseRevision: revision - 1, accept: true })).statusCode, 409)
    assert.equal((await call({ action: 'task-review', id: 'meaning', baseRevision: revision, accept: true })).statusCode, 200)
    assert.equal(taskProjection(agent).requirements[0].status, 'accepted')
    assert.equal((await call({ action: 'task-cancel', baseRevision: taskProjection(agent).revision - 1 })).statusCode, 409)
    assert.equal((await call({ action: 'task-cancel', baseRevision: taskProjection(agent).revision })).statusCode, 200)
    assert.equal(taskProjection(agent).status, 'cancelled')
    const retry = controller.retry, reconcile = controller.reconcile
    let inputCall, reconciled = false
    controller.retry = async (id, baseRevision, input) => { inputCall = { id, baseRevision, input }; return controller.snapshot() }
    const input = await call({ action: 'input', id: 'one', baseRevision: controller.snapshot().revision, input: '补充当前验收范围' })
    assert.equal(input.statusCode, 200); assert.deepEqual(inputCall, { id: 'one', baseRevision: controller.snapshot().revision, input: '补充当前验收范围' })
    controller.retry = retry
    controller.reconcile = async () => { reconciled = true; return { queue: controller.snapshot(), children: [], policy: 'fixture' } }
    const reconciledResponse = await call({ action: 'reconcile', baseRevision: controller.snapshot().revision })
    assert.equal(reconciledResponse.statusCode, 200); assert.equal(reconciled, true); assert.equal(reconciledResponse.body.ok, true)
    controller.reconcile = reconcile
    assert.equal((await call({ action: 'input', id: 'one', baseRevision: controller.snapshot().revision, input: '' })).statusCode, 400)
    assert.equal((await call(review, { beforeBody: () => agent.selectPreset('standard') })).statusCode, 403)
  } finally { dispose(); await controller.close('test').catch(() => {}) }
})
