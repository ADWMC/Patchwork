import assert from 'node:assert/strict'
import test from 'node:test'
import { UPDATE_ROUTE_PATH, checkForUpdate, registerUpdateRoute, resetUpdateRouteRegistry } from '../src/ui/update-route.mjs'

test.beforeEach(() => resetUpdateRouteRegistry())

function fakeServer() {
  const routes = []
  return { routes, server: { register(route) { routes.push(route); return () => {} } } }
}

function request(route, { method = 'POST', token } = {}) {
  let payload
  const res = { statusCode: 0, setHeader() {}, end: value => { payload = JSON.parse(value) } }
  route.handler({ method, url: UPDATE_ROUTE_PATH, headers: token === undefined ? {} : { 'x-patchwork-token': token } }, res)
  return { status: res.statusCode, payload }
}

test('the update route is authenticated and POST-only', () => {
  const { routes, server } = fakeServer()
  registerUpdateRoute({ get: name => name === 'webServer' ? server : undefined }, { token: 'update-token' })
  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, UPDATE_ROUTE_PATH)
  assert.equal(request(routes[0], { method: 'GET', token: 'update-token' }).status, 405)
  assert.equal(request(routes[0], { token: 'wrong' }).status, 403)
})

test('a newer GitHub release is reported with the release URL', async () => {
  let seen
  const result = await checkForUpdate({
    fetchImpl: async (url, options) => {
      seen = { url, options }
      return { ok: true, status: 200, text: async () => JSON.stringify({ tag_name: 'v9.9.9', html_url: 'https://github.com/ADWMC/Patchwork/releases/tag/v9.9.9', published_at: '2026-11-04T00:00:00Z' }) }
    },
    now: () => 'checked-at',
  })
  assert.equal(seen.url, 'https://api.github.com/repos/ADWMC/Patchwork/releases/latest')
  assert.equal(seen.options.redirect, 'manual')
  assert.equal(seen.options.headers.accept, 'application/vnd.github+json')
  assert.equal(result.ok, true)
  assert.equal(result.updateAvailable, true)
  assert.equal(result.latest, '9.9.9')
  assert.equal(result.url, 'https://github.com/ADWMC/Patchwork/releases/tag/v9.9.9')
  assert.equal(result.checkedAt, 'checked-at')
})

test('an older or invalid release is not an update', async () => {
  const older = await checkForUpdate({ fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ tag_name: 'v0.0.1' }) }) })
  assert.equal(older.ok, true)
  assert.equal(older.updateAvailable, false)

  const badJson = await checkForUpdate({ fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'not json' }) })
  assert.equal(badJson.ok, false)
  assert.equal(badJson.reason, 'update-check-invalid-json')

  const httpError = await checkForUpdate({ fetchImpl: async () => ({ ok: false, status: 403, text: async () => '' }) })
  assert.equal(httpError.ok, false)
  assert.equal(httpError.reason, 'update-check-http-403')
})

test('without a webserver or a token the update route is a silent no-op', () => {
  assert.doesNotThrow(() => registerUpdateRoute({ get: () => undefined }, { token: 'x' }))
  assert.doesNotThrow(() => registerUpdateRoute({ get: () => fakeServer().server }, {}))
})
