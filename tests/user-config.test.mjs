import { scopedAgent } from './helpers/agent.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 用户配置落在宿主用户数据根下；指到临时目录，测试不污染真实 ~/.dsh。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-user-config-'))

const { effectiveConfig, mergeUserConfig, mergeUserConfigState, configRevision, readUserConfig, userConfigPath, validatePatch } = await import(
  '../src/config/user-config.mjs'
)
const { CONFIG_ROUTE_PATH, CONFIG_TOKEN_HEADER, registerConfigRoute, resetRouteRegistry } = await import(
  '../src/ui/config-route.mjs'
)

// 路由注册表是进程级的：每个测试必须从干净状态开始。
test.beforeEach(() => resetRouteRegistry())

test('only known writable keys with the right types are accepted', () => {
  assert.equal(validatePatch({ browserEnabled: true }).reason, 'unknown-key:browserEnabled')
  assert.equal(validatePatch({ actionFusion: true }).ok, true)
  assert.equal(validatePatch({ cacheWriteReadRatio: 0 }).ok, true)
  assert.equal(validatePatch({ actionFussion: true }).reason, 'unknown-key:actionFussion')
  assert.equal(validatePatch({ actionFusion: 'yes' }).reason, 'actionFusion-must-be-boolean')
  assert.equal(validatePatch({ cacheWriteReadRatio: -1 }).reason, 'cacheWriteReadRatio-must-be-a-finite-non-negative-number')
  assert.equal(validatePatch({ cacheWriteReadRatio: 'fast' }).reason, 'cacheWriteReadRatio-must-be-a-finite-non-negative-number')
  assert.equal(validatePatch([]).reason, 'body-not-an-object')
  assert.equal(validatePatch(null).reason, 'body-not-an-object')
})

test('a patch merges into the stored user config without clearing other keys', async () => {
  assert.deepEqual(readUserConfig(), {}, 'no file yet means no user overrides')

  await mergeUserConfig({ actionFusion: true })
  await mergeUserConfig({ cacheWriteReadRatio: 4 })
  assert.deepEqual(readUserConfig(), { actionFusion: true, cacheWriteReadRatio: 4 })

  // 落盘的是完整 JSON，不是半个文件。
  const text = await readFile(userConfigPath(), 'utf8')
  assert.deepEqual(JSON.parse(text), { actionFusion: true, cacheWriteReadRatio: 4 })
})

test('the user layer wins over the deployment row config', () => {
  const row = { actionFusion: false, observationPack: true, cacheWriteReadRatio: 12.5 }
  assert.deepEqual(effectiveConfig(row, { actionFusion: true }), {
    actionFusion: true,
    observationPack: true,
    cacheWriteReadRatio: 12.5,
  })
  assert.deepEqual(effectiveConfig(row, {}), row, 'without user overrides the row config stands')
})

test('concurrent patches preserve fields and stale revisions conflict explicitly', async () => {
  await Promise.all([mergeUserConfig({ actionFusion: false }), mergeUserConfig({ observationPack: true })])
  assert.equal(readUserConfig().actionFusion, false)
  assert.equal(readUserConfig().observationPack, true)
  const revision = configRevision()
  const results = await Promise.allSettled([
    mergeUserConfigState({ actionFusion: true }, revision),
    mergeUserConfigState({ observationPack: false }, revision),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'revision-conflict')
  assert.equal(readUserConfig().actionFusion, true)
  assert.equal(readUserConfig().observationPack, true)
})

function fakeServer() {
  const agent = scopedAgent({ session: { header: { id: 'config-session' } } })
  const routes = []
  return {
    routes,
    agent,
    server: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
  }
}

function fakeRequest({ method = 'POST', token, body } = {}) {
  const listeners = new Map()
  return {
    __body: body,
    method,
    url: CONFIG_ROUTE_PATH + '?sessionId=config-session',
    headers: token === undefined ? {} : { [CONFIG_TOKEN_HEADER]: token },
    on(event, listener) {
      listeners.set(event, listener)
      return this
    },
    destroy() {},
    async emitBody(text) {
      const chunks = text === undefined ? [] : [Buffer.from(text, 'utf8')]
      for (const chunk of chunks) listeners.get('data')?.(chunk)
      listeners.get('end')?.()
      await new Promise(resolve => setImmediate(resolve))
    },
  }
}

function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(text) {
      this.body = text
    },
  }
}

async function callRoute(route, request) {
  const response = fakeResponse()
  const pending = route.handler(request, response)
  await request.emitBody(request.__body)
  await pending
  return { status: response.statusCode, json: response.body ? JSON.parse(response.body) : undefined }
}

test('the write route refuses anything that is not an authorised POST', async () => {
  const { routes, server } = fakeServer()
  const ctx = { get: name => name === 'webServer' ? server : name === 'agents' ? { get: () => scopedAgent({ session: { header: { id: 'config-session' } } }) } : undefined }
  registerConfigRoute(ctx, { token: 'secret', rowConfig: { observationPack: true } })
  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, CONFIG_ROUTE_PATH)

  const unauthorised = await callRoute(routes[0], { ...fakeRequest({ token: 'wrong', body: '{"actionFusion":true}' }) })
  assert.equal(unauthorised.status, 403)

  const wrongMethod = await callRoute(routes[0], { ...fakeRequest({ method: 'GET', token: 'secret' }) })
  assert.equal(wrongMethod.status, 405)

  const badJson = await callRoute(routes[0], { ...fakeRequest({ token: 'secret', body: '{' }) })
  assert.equal(badJson.status, 400)
  assert.equal(badJson.json.reason, 'body-not-json')

  const badKey = await callRoute(routes[0], { ...fakeRequest({ token: 'secret', body: '{"nope":1}' }) })
  assert.equal(badKey.status, 400)
  assert.equal(badKey.json.reason, 'unknown-key:nope')
})

test('an authorised save persists and answers with the effective config', async () => {
  const { routes, server } = fakeServer()
  let saved
  registerConfigRoute(
    { get: name => name === 'webServer' ? server : name === 'agents' ? { get: () => scopedAgent({ session: { header: { id: 'config-session' } } }) } : undefined },
    { token: 'secret', rowConfig: { observationPack: true }, onSaved: config => { saved = config } },
  )

  const ok = await callRoute(routes[0], { ...fakeRequest({ token: 'secret', body: '{"actionFusion":true}' }) })
  assert.equal(ok.status, 200)
  assert.equal(ok.json.ok, true)
  assert.equal(ok.json.config.actionFusion, true)
  assert.equal(ok.json.config.observationPack, true, 'the row config must survive the write')
  assert.equal(saved.actionFusion, true)
})

test('without a webserver or a token the route is a silent no-op', () => {
  assert.doesNotThrow(() => registerConfigRoute({ get: () => undefined }, { token: 'x' }))
  assert.doesNotThrow(() => registerConfigRoute({ get: () => fakeServer().server }, {}))
  assert.doesNotThrow(() => registerConfigRoute(undefined, { token: 'x' }))
})

test('registering twice on the same web server is idempotent', () => {
  const { routes, server } = fakeServer()
  const ctx = { get: name => name === 'webServer' ? server : name === 'agents' ? { get: () => scopedAgent({ session: { header: { id: 'config-session' } } }) } : undefined }
  registerConfigRoute(ctx, { token: 'first' })
  registerConfigRoute(ctx, { token: 'second' })
  assert.equal(routes.length, 1, 'a second registration must not duplicate the exact route')
  assert.equal(routes[0].path, CONFIG_ROUTE_PATH)
})

test('a different web-server instance still cannot register the route again', () => {
  // 真实场景：profile 根 realm 与 agent preset 隔离 realm 解析到不同的 webServer
  // 服务实例，但它们共享同一张路由表——第二次注册（哪怕在不同实例上）也必须跳过。
  const first = fakeServer()
  registerConfigRoute({ get: name => (name === 'webServer' ? first.server : undefined) }, { token: 'one' })
  assert.equal(first.routes.length, 1)

  const second = fakeServer()
  registerConfigRoute({ get: name => (name === 'webServer' ? second.server : undefined) }, { token: 'two' })
  assert.equal(second.routes.length, 0, 'a second server instance must not register the shared exact route')
})

test('config route ownership releases on plugin disposal so hot reload can register', () => {
  const first = fakeServer()
  let dispose
  registerConfigRoute({ get: () => first.server, effect: fn => { dispose = fn() } }, { token: 'stable' })
  assert.equal(first.routes.length, 1)
  dispose()
  const second = fakeServer()
  registerConfigRoute({ get: () => second.server }, { token: 'stable' })
  assert.equal(second.routes.length, 1)
})

test('even a valid page token cannot configure a standard or switched-away session', async () => {
  const { routes, server, agent } = fakeServer()
  const ctx = { get: name => name === 'webServer' ? server : name === 'agents' ? { get: id => id === 'config-session' ? agent : undefined } : undefined }
  registerConfigRoute(ctx, { token: 'secret' })
  const before = readUserConfig()
  agent.selectPreset('standard')
  const denied = await callRoute(routes[0], fakeRequest({ token: 'secret', body: '{"actionFusion":false}' }))
  assert.equal(denied.status, 403)
  assert.deepEqual(denied.json, { ok: false, reason: 'patchwork-agent-required' })
  agent.selectPreset('patchwork')
  const request = fakeRequest({ token: 'secret', body: '{"actionFusion":false}' })
  const response = fakeResponse()
  const pending = routes[0].handler(request, response)
  agent.selectPreset('standard')
  await request.emitBody(request.__body)
  await pending
  assert.equal(response.statusCode, 403)
  assert.deepEqual(readUserConfig(), before)
})

test('queued writes recheck authorization immediately before replacing the file', async () => {
  const before = readUserConfig()
  let checks = 0
  await assert.rejects(mergeUserConfigState({ actionFusion: !before.actionFusion }, undefined, () => ++checks < 2), error => error.code === 'patchwork-agent-required')
  assert.deepEqual(readUserConfig(), before)
})
