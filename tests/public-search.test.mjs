import assert from 'node:assert/strict'
import test from 'node:test'
import { NativeSearchError, parseBingRss, parseBraveResults, parseDuckDuckGoResults, searchDuckDuckGo, searchNativeWeb } from '../src/retrieval/public-search.mjs'

const page = `
<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs%3Fa%3D1&amp;rut=ignored">Example &amp; Docs</a>
<a class="result__snippet" href="#">A <b>useful</b> snippet.</a>
<a class="result__a" href="https://second.example/path#fragment">Second</a>
<a class="result__snippet" href="#">Second snippet</a>
`

const bingRss = `<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0"><channel><title>Patchwork native search</title><link>https://www.bing.com/search?q=Patchwork</link>
<item><title>Patchwork &amp; Docs</title><link>https://example.com/docs?a=1</link><description>A &lt;b&gt;useful&lt;/b&gt; snippet.</description></item>
<item><title>Second result</title><link>https://second.example/path</link><description>Second snippet</description></item>
<item><title>No link</title><description>Missing link</description></item>
</channel></rss>`

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

test('parses Bing RSS items and skips entries without a link', () => {
  assert.deepEqual(parseBingRss(bingRss, 3).results, [
    { title: 'Patchwork & Docs', url: 'https://example.com/docs?a=1', snippet: 'A useful snippet.' },
    { title: 'Second result', url: 'https://second.example/path', snippet: 'Second snippet' },
  ])
  assert.equal(parseBingRss(bingRss, 1).truncated, true)
  assert.deepEqual(parseBingRss('<rss><channel></channel></rss>', 5).results, [])
})

test('parses Brave server-rendered snippets', () => {
  assert.deepEqual(parseBraveResults(bravePage, 3).results, [{ title: 'Brave result', url: 'https://brave.example/result', snippet: 'Brave snippet' }])
})

test('keyless JSON providers post bounded requests and map unified sources', async () => {
  const calls = []
  const result = await searchNativeWeb({
    query: 'patchwork',
    maxResults: 4,
    providers: ['uapis-keyless', 'tavily-keyless'],
    endpoints: { 'uapis-keyless': 'https://uapis.test/search', 'tavily-keyless': 'https://tavily.test/search' },
    fetchImpl: async (url, options) => {
      const request = { url: String(url), options }
      calls.push(request)
      const body = JSON.parse(options.body)
      if (String(url).includes('uapis.test')) {
        assert.equal(body.query, 'patchwork')
        assert.ok(!('max_results' in body))
        return { ok: true, status: 200, text: async () => JSON.stringify({ results: [
          { title: 'Uapis hit', url: 'https://uapis.example/one', snippet: 'first' },
          { title: 'No url', snippet: 'dropped' },
          { title: 'Shared', url: 'https://shared.example/x', snippet: 'from uapis' },
        ] }) }
      }
      assert.equal(body.query, 'patchwork')
      assert.equal(body.max_results, 4)
      assert.equal(body.include_answer, false)
      assert.equal(options.headers['x-tavily-access-mode'], 'keyless')
      assert.equal(options.headers['content-type'], 'application/json')
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [
        { title: 'Tavily hit', url: 'https://tavily.example/two', content: 'second' },
        { title: 'Shared', url: 'https://shared.example/x', content: 'from tavily' },
      ] }) }
    },
  })
  assert.deepEqual(result.providers, ['uapis-keyless', 'tavily-keyless'])
  assert.deepEqual(result.providerHealth.map(({ provider, family, status }) => ({ provider, family, status })), [
    { provider: 'uapis-keyless', family: 'uapis', status: 'healthy' },
    { provider: 'tavily-keyless', family: 'tavily', status: 'healthy' },
  ])
  for (const call of calls) {
    assert.equal(call.options.method, 'POST')
    assert.equal(call.options.redirect, 'manual')
    assert.equal(call.options.maxRedirects, 0)
  }
  const urls = result.sources.map(source => source.url)
  assert.deepEqual([...new Set(urls)].sort(), ['https://shared.example/x', 'https://tavily.example/two', 'https://uapis.example/one'])
  const tavilySource = result.sources.find(source => source.url === 'https://tavily.example/two')
  assert.equal(tavilySource.snippet, 'second')
})

test('keyless JSON providers report malformed payloads and empty results with codes', async () => {
  const malformed = await searchNativeWeb({
    query: 'x',
    providers: ['uapis-keyless'],
    endpoints: { 'uapis-keyless': 'https://uapis.test/search' },
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<html>not json</html>' }),
  }).catch(error => error)
  assert.equal(malformed.code, 'SEARCH_ALL_PROVIDERS_FAILED')
  assert.equal(malformed.failedProviders[0].code, 'SEARCH_PROVIDER_ERROR')
  const empty = await searchNativeWeb({
    query: 'x',
    providers: ['tavily-keyless'],
    endpoints: { 'tavily-keyless': 'https://tavily.test/search' },
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) }),
  })
  assert.deepEqual(empty.sources, [])
  assert.equal(empty.providerHealth[0].status, 'zero_result')
  const blocked = await searchNativeWeb({
    query: 'x',
    providers: ['tavily-keyless'],
    endpoints: { 'tavily-keyless': 'https://tavily.test/search' },
    fetchImpl: async () => ({ ok: false, status: 429, text: async () => '' }),
  }).catch(error => error)
  assert.equal(blocked.code, 'SEARCH_ALL_PROVIDERS_FAILED')
  assert.equal(blocked.providerHealth[0].status, 'blocked')
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
  const bingMerge = `<rss version="2.0"><channel><title>demo</title>
<item><title>Shared doc</title><link>https://example.com/docs?a=1</link><description>Shared snippet</description></item>
<item><title>Bing only</title><link>https://bing.example/only</link><description>Bing unique</description></item>
</channel></rss>`
  const calls = []
  const result = await searchNativeWeb({
    query: 'demo query',
    maxResults: 4,
    providers: ['bing-rss', 'brave-html', 'duckduckgo-html'],
    endpoints: { 'bing-rss': 'https://bing.test/search', 'brave-html': 'https://brave.test/search', 'duckduckgo-html': 'https://duck.test/html/' },
    fetchImpl: async (url, options) => {
      calls.push(String(url))
      if (String(url).includes('bing.test')) {
        assert.equal(options.method, 'GET')
        assert.equal(options.headers.referer, 'https://www.bing.com/')
        assert.match(String(url), /format=rss/)
        return { ok: true, status: 200, text: async () => bingMerge }
      }
      if (String(url).includes('brave.test')) throw new Error('brave unavailable')
      return { ok: true, status: 200, text: async () => page }
    },
  })
  assert.deepEqual(result.providers, ['bing-rss', 'duckduckgo-html'])
  assert.deepEqual(result.failedProviders, [{ provider: 'brave-html', code: 'SEARCH_PROVIDER_ERROR' }])
  assert.deepEqual(result.providerHealth.map(({ provider, family, status }) => ({ provider, family, status })), [
    { provider: 'bing-rss', family: 'bing', status: 'healthy' },
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
    providers: ['bing-rss'],
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<rss><channel><item><description>changed shape</description></item></channel></rss>' }),
  })
  assert.equal(drift.providerHealth[0].status, 'parser_drift')
  const blocked = await searchNativeWeb({
    query: 'blocked',
    providers: ['brave-html', 'duckduckgo-html'],
    fetchImpl: async url => String(url).includes('brave') ? ({ ok: false, status: 403, text: async () => '' }) : ({ ok: true, status: 200, text: async () => page }),
  })
  assert.equal(blocked.providerHealth.find(item => item.provider === 'brave-html').status, 'blocked')
})
