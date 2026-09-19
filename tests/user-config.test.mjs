import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 用户配置落在宿主用户数据根下；指到临时目录，测试不污染真实 ~/.dsh。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-user-config-'))

const { effectiveConfig, mergeUserConfig, readUserConfig, userConfigPath, validatePatch } = await import(
  '../src/config/user-config.mjs'
)
const { CONFIG_ROUTE_PATH, CONFIG_TOKEN_HEADER, registerConfigRoute, resetRouteRegistry } = await import(
  '../src/ui/config-route.mjs'
)

// 路由注册表是进程级的：每个测试必须从干净状态开始。
test.beforeEach(() => resetRouteRegistry())

test('only known writable keys with the right types are accepted', () => {
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

function fakeServer() {
  const routes = []
  return {
    routes,
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
  const ctx = { get: name => (name === 'webServer' ? server : undefined) }
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
    { get: name => (name === 'webServer' ? server : undefined) },
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
  const ctx = { get: name => (name === 'webServer' ? server : undefined) }
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
