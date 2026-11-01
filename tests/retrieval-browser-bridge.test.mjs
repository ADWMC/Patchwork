import assert from 'node:assert/strict'
import test from 'node:test'
import { registerRetrievalTools } from '../src/retrieval/tool.mjs'
import { authorizeBrowserTarget } from '../src/retrieval/public-fetch.mjs'
import { scopedAgent } from './helpers/agent.mjs'
const key = Symbol.for('@patchwork/browser/retrieval/v1')
function fixture({ robots = 'User-agent: *\nAllow: /', config = {} } = {}) {
  const registered = [], agent = scopedAgent({ session: { header: { id: 'browser-fetch' } } })
  registerRetrievalTools({ tools: { register: value => registered.push(value) } }, config, { lookupImpl: async () => [{ address: '93.184.216.34' }], fetchImpl: async () => ({ ok: true, status: 200, text: async () => robots }) })
  return { agent, fetch: registered.find(value => value.name === 'patchwork_fetch') }
}

test('explicit browser retrieval is optional, session-bound and uses the original public/robots checks', async () => {
  const f = fixture(), other = scopedAgent({ session: { header: { id: 'other' } } })
  const providers = globalThis[key] ??= new WeakMap(); let authorized = 0
  providers.set(f.agent, async options => {
    const checked = await options.authorizeTarget(options.url, true); authorized++
    return { url: checked.url, finalUrl: checked.url, status: 200, contentType: 'text/html', title: 'Rendered', excerpt: 'Dynamic text', truncated: false, robots: checked.robots, retrievedAt: new Date().toISOString(), trust: 'external-untrusted' }
  })
  try {
    const result = await f.fetch.execute({ url: 'https://example.com/', transport: 'browser' }, { agent: f.agent })
    assert.equal(result.transport, 'browser'); assert.equal(result.robots.allowed, true); assert.equal(authorized, 1)
    await assert.rejects(f.fetch.execute({ url: 'https://example.com/', transport: 'browser' }, { agent: other }), /optional browser/)
    await assert.rejects(f.fetch.execute({ url: 'http://127.0.0.1/', transport: 'browser' }, { agent: f.agent }), /private|local/)
  } finally { providers.delete(f.agent) }
})

test('robots and host denials stay denials in browser mode', async () => {
  const f = fixture({ robots: 'User-agent: *\nDisallow: /' }), providers = globalThis[key] ??= new WeakMap()
  providers.set(f.agent, options => options.authorizeTarget(options.url, true))
  try { await assert.rejects(f.fetch.execute({ url: 'https://example.com/', transport: 'browser' }, { agent: f.agent }), error => error.code === 'FETCH_ROBOTS_DENIED') }
  finally { providers.delete(f.agent) }
  await assert.rejects(authorizeBrowserTarget('https://unapproved.example/', { allowedHosts: ['example.com'] }), error => error.code === 'FETCH_HOST_NOT_ALLOWED')
})
