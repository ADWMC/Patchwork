import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedAgent } from './helpers/agent.mjs'
import { PATCHWORK_FETCH_TOOL, PATCHWORK_SEARCH_TOOL, registerRetrievalTools } from '../src/retrieval/index.mjs'

const html = '<a class="result__a" href="https://example.com">Example</a><a class="result__snippet" href="#">Snippet</a>'

function setup(options = {}) {
  const registered = []
  const ctx = { tools: { register(definition) { registered.push(definition) } } }
  registerRetrievalTools(ctx, {}, { fetchImpl: options.fetchImpl ?? (async () => ({ ok: true, status: 200, text: async () => html })), lookupImpl: options.lookupImpl })
  return { registered, definition: registered.find(item => item.name === PATCHWORK_SEARCH_TOOL), fetchDefinition: registered.find(item => item.name === PATCHWORK_FETCH_TOOL) }
}

test('registers the keyless native search tool by default', () => {
  const { definition } = setup()
  assert.ok(definition)
  assert.deepEqual(definition.parameters.required, ['query'])
  assert.match(definition.description, /without an API key/)
})

test('native search executes for Patchwork and rejects another preset', async () => {
  const { definition } = setup()
  const patchwork = scopedAgent({ session: { header: { id: 'search-patchwork' } } }, 'patchwork')
  const standard = scopedAgent({ session: { header: { id: 'search-standard' } } }, 'standard')
  const result = await definition.execute({ query: 'Patchwork' }, { agent: patchwork, callId: 'search-call', signal: new AbortController().signal })
  assert.equal(result.sources[0].url, 'https://example.com/')
  await assert.rejects(definition.execute({ query: 'Patchwork' }, { agent: standard, callId: 'foreign-search', signal: new AbortController().signal }), /Patchwork agent preset/)
})

test('native search can be disabled by Patchwork runtime configuration', () => {
  const registered = []
  registerRetrievalTools({ tools: { register(definition) { registered.push(definition) } } }, { nativeSearch: false })
  assert.deepEqual(registered.map(item => item.name), ['patchwork_evidence', PATCHWORK_FETCH_TOOL])
})

test('native fetch is independent from search and is scope guarded', async () => {
  const { fetchDefinition } = setup({
    lookupImpl: async () => [{ address: '93.184.216.34' }],
    fetchImpl: async url => String(url).endsWith('/robots.txt')
      ? { ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' }
      : { ok: true, status: 200, url: 'https://example.com/docs', headers: { get: () => 'text/html; charset=utf-8' }, text: async () => '<title>Docs</title><h1>Hello</h1><p>Readable page.</p>' },
  })
  const patchwork = scopedAgent({ session: { header: { id: 'fetch-patchwork' } } }, 'patchwork')
  const standard = scopedAgent({ session: { header: { id: 'fetch-standard' } } }, 'standard')
  const result = await fetchDefinition.execute({ url: 'https://example.com/docs' }, { agent: patchwork, callId: 'fetch-call', signal: new AbortController().signal })
  assert.equal(result.title, 'Docs')
  assert.match(result.excerpt, /Readable page/)
  await assert.rejects(fetchDefinition.execute({ url: 'https://example.com/docs' }, { agent: standard, callId: 'foreign-fetch', signal: new AbortController().signal }), /Patchwork agent preset/)
})
