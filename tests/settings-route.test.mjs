import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-settings-route-'))

const { userConfigPath } = await import('../src/config/user-config.mjs')
const { SETTINGS_ROUTE_PATH, registerSettingsRoute, resetSettingsRouteRegistry } = await import('../src/ui/settings-route.mjs')

test.beforeEach(() => resetSettingsRouteRegistry())

function fakeServer() {
  const routes = []
  return { routes, server: { register(route) { routes.push(route); return () => {} } } }
}

function request(route, { method = 'GET', token } = {}) {
  let payload
  const res = { statusCode: 0, setHeader() {}, end: value => { payload = JSON.parse(value) } }
  route.handler({ method, url: SETTINGS_ROUTE_PATH, headers: token === undefined ? {} : { 'x-patchwork-token': token } }, res)
  return { status: res.statusCode, payload }
}

test('the settings route is authenticated, read-only and sessionless', async () => {
  await mkdir(dirname(userConfigPath()), { recursive: true })
  await writeFile(userConfigPath(), `${JSON.stringify({ codeEnabled: false }, null, 2)}\n`, 'utf8')
  const { routes, server } = fakeServer()
  registerSettingsRoute({ get: name => name === 'webServer' ? server : undefined }, {
    token: 'settings-token',
    rowConfig: { codeEnabled: true, skillsMode: 'core' },
    loadedConfig: { codeEnabled: true },
  })
  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, SETTINGS_ROUTE_PATH)

  assert.equal(request(routes[0], { token: 'wrong' }).status, 403)
  assert.equal(request(routes[0], { method: 'POST', token: 'settings-token' }).status, 405)

  const ok = request(routes[0], { token: 'settings-token' })
  assert.equal(ok.status, 200)
  assert.equal(ok.payload.ok, true)
  assert.equal(ok.payload.config.codeEnabled, false, 'the user layer must win over the row config')
  assert.equal(ok.payload.config.skillsMode, 'core')
  assert.equal(ok.payload.loadedConfig.codeEnabled, true)
  assert.equal(typeof ok.payload.revision, 'string')
  // Global settings must not leak session state.
  assert.equal(ok.payload.sessionId, undefined)
  assert.equal(ok.payload.events, undefined)
  assert.equal(ok.payload.task, undefined)
})

test('without a webserver or a token the settings route is a silent no-op', () => {
  assert.doesNotThrow(() => registerSettingsRoute({ get: () => undefined }, { token: 'x' }))
  assert.doesNotThrow(() => registerSettingsRoute({ get: () => fakeServer().server }, {}))
})
