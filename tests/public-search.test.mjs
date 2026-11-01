import assert from 'node:assert/strict'
import test from 'node:test'
import { NativeSearchError, parseBingResults, parseBraveResults, parseDuckDuckGoResults, searchDuckDuckGo, searchNativeWeb } from '../src/retrieval/public-search.mjs'

const page = `
<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs%3Fa%3D1&amp;rut=ignored">Example &amp; Docs</a>
<a class="result__snippet" href="#">A <b>useful</b> snippet.</a>
<a class="result__a" href="https://second.example/path#fragment">Second</a>
<a class="result__snippet" href="#">Second snippet</a>
`

const bingPage = ({ encodedUrl = 'https://example.com/bing' } = {}) => `
<ol id="b_results">
  <li class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=a1${encodedUrl}">Bing result</a></h2><div class="b_caption"><p>Bing snippet</p></div></li>
</ol>`

const bravePage = `
<div class="snippet svelte-jmfu5f" data-pos="2" data-type="web">
  <div class="result-content"><a href="https://brave.example/result">
    <div class="title search-snippet-title" title="Brave result">Brave result</div>
    <div class="generic-snippet"><div class="content">Brave snippet</div></div>
  </a></div>
</div>`

test('parses bounded DuckDuckGo results into safe URL and text records', () => {
  const parsed = parseDuckDuckGoResults(page, 1)
  assert.equal(parsed.truncated, true)
  assert.deepEqual(parsed.results, [{
    title: 'Example & Docs',
    url: 'https://example.com/docs?a=1',
    snippet: 'A useful snippet.',
  }])
})

test('parses Bing redirects and Brave server-rendered snippets', () => {
  const encoded = Buffer.from('https://example.com/bing').toString('base64url')
  assert.deepEqual(parseBingResults(bingPage({ encodedUrl: encoded }), 3).results, [{ title: 'Bing result', url: 'https://example.com/bing', snippet: 'Bing snippet' }])
  assert.deepEqual(parseBraveResults(bravePage, 3).results, [{ title: 'Brave result', url: 'https://brave.example/result', snippet: 'Brave snippet' }])
})

test('searchDuckDuckGo uses a focused query and preserves provider metadata', async () => {
  let requested
  const result = await searchDuckDuckGo({
    query: '  Patchwork native search  ',
    maxResults: 2,
    timeoutMs: 5000,
    fetchImpl: async (url, options) => {
      requested = { url: String(url), options }
      return { ok: true, status: 200, text: async () => page }
    },
  })
  assert.match(requested.url, /q=Patchwork\+native\+search/)
  assert.match(requested.url, /kp=1/)
  assert.equal(requested.options.method, 'GET')
  assert.equal(requested.options.timeoutMs, 5000)
  assert.equal(result.provider, 'duckduckgo-html')
  assert.equal(result.sources.length, 2)
  assert.equal(result.health.status, 'healthy')
})

test('native search rejects empty queries and provider failures with machine codes', async () => {
  await assert.rejects(searchDuckDuckGo({ query: ' ' }), error => error instanceof NativeSearchError && error.code === 'SEARCH_INVALID_QUERY')
  await assert.rejects(searchDuckDuckGo({ query: 'failure', fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }) }), error => error instanceof NativeSearchError && error.code === 'SEARCH_PROVIDER_HTTP')
})

test('native multi-search merges independent providers and records partial failure', async () => {
  const encoded = Buffer.from('https://example.com/bing').toString('base64url')
  const calls = []
  const result = await searchNativeWeb({
    query: 'Patchwork',
    maxResults: 4,
    providers: ['bing-html', 'brave-html', 'duckduckgo-html'],
    endpoints: { 'bing-html': 'https://bing.test/search', 'brave-html': 'https://brave.test/search', 'duckduckgo-html': 'https://duck.test/html/' },
    fetchImpl: async url => {
      calls.push(String(url))
      if (String(url).includes('bing.test')) return { ok: true, status: 200, text: async () => bingPage({ encodedUrl: encoded }) }
      if (String(url).includes('brave.test')) throw new Error('brave unavailable')
      return { ok: true, status: 200, text: async () => page }
    },
  })
  assert.deepEqual(result.providers, ['bing-html', 'duckduckgo-html'])
  assert.deepEqual(result.failedProviders, [{ provider: 'brave-html', code: 'SEARCH_PROVIDER_ERROR' }])
  assert.deepEqual(result.providerHealth.map(({ provider, family, status }) => ({ provider, family, status })), [
    { provider: 'bing-html', family: 'bing', status: 'healthy' },
    { provider: 'brave-html', family: 'brave', status: 'transport_error' },
    { provider: 'duckduckgo-html', family: 'duckduckgo', status: 'healthy' },
  ])
  assert.match(result.queryFingerprint, /^[a-f0-9]{64}$/)
  assert.equal(result.sources.length, 3)
  assert.equal(calls.length, 3)
})

test('provider health distinguishes parser drift and blocked responses', async () => {
  const drift = await searchNativeWeb({
    query: 'drift',
    providers: ['bing-html'],
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<li class="b_algo"><div class="changed-result-shape">no parser match</div></li>' }),
  })
  assert.equal(drift.providerHealth[0].status, 'parser_drift')
  const blocked = await searchNativeWeb({
    query: 'blocked',
    providers: ['brave-html', 'duckduckgo-html'],
    fetchImpl: async url => String(url).includes('brave') ? ({ ok: false, status: 403, text: async () => '' }) : ({ ok: true, status: 200, text: async () => page }),
  })
  assert.equal(blocked.providerHealth.find(item => item.provider === 'brave-html').status, 'blocked')
})
