import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPublicTarget, fetchNativePage, NativeFetchError } from '../src/retrieval/public-fetch.mjs'

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]
const response = (body, { contentType = 'text/html; charset=utf-8', status = 200, url = 'https://example.com/docs' } = {}) => ({
  ok: status >= 200 && status < 300, status, url,
  headers: { get: key => key.toLowerCase() === 'content-type' ? contentType : undefined },
  text: async () => body,
})

test('public fetch parses a bounded HTML page and checks robots', async () => {
  const calls = []
  const result = await fetchNativePage({
    url: 'https://example.com/docs#fragment', lookupImpl: publicLookup, maxChars: 256,
    fetchImpl: async url => {
      calls.push(String(url))
      return String(url).endsWith('/robots.txt') ? response('User-agent: *\nAllow: /', { contentType: 'text/plain', url: String(url) }) : response('<title>Docs</title><h1>Heading</h1><p>' + 'Readable content that is longer than the limit. '.repeat(12) + '</p>')
    },
  })
  assert.equal(result.url, 'https://example.com/docs')
  assert.equal(result.title, 'Docs')
  assert.equal(result.robots.checked, true)
  assert.equal(result.truncated, true)
  assert.match(result.excerpt, /Heading/)
  assert.equal(calls.length, 2)
})

test('public fetch rejects local, private and unapproved targets', async () => {
  await assert.rejects(assertPublicTarget('http://127.0.0.1:8080/', { lookupImpl: publicLookup }), error => error.code === 'FETCH_SSRF_BLOCKED')
  await assert.rejects(assertPublicTarget('https://example.com/', { allowedHosts: ['docs.example.com'], lookupImpl: publicLookup }), error => error.code === 'FETCH_HOST_NOT_ALLOWED')
  await assert.rejects(assertPublicTarget('https://private.example/', { lookupImpl: async () => [{ address: '10.0.0.4' }] }), error => error.code === 'FETCH_SSRF_BLOCKED')
  await assert.rejects(assertPublicTarget('https://user:pass@example.com/', { lookupImpl: publicLookup }), error => error.code === 'FETCH_INVALID_URL')
})

test('robots denial, unsupported content and bounded response have machine codes', async () => {
  const deny = await fetchNativePage({ url: 'https://example.com/secret', lookupImpl: publicLookup, fetchImpl: async url => String(url).endsWith('/robots.txt') ? response('User-agent: *\nDisallow: /secret', { contentType: 'text/plain', url: String(url) }) : response('<p>secret</p>') })
    .then(() => null, error => error)
  assert.equal(deny.code, 'FETCH_ROBOTS_DENIED')
  await assert.rejects(fetchNativePage({ url: 'https://example.com/file', robots: false, lookupImpl: publicLookup, fetchImpl: async () => response('binary', { contentType: 'application/pdf' }) }), error => error.code === 'FETCH_UNSUPPORTED_CONTENT_TYPE')
  await assert.rejects(fetchNativePage({ url: 'https://example.com/large', robots: false, maxBytes: 1024, lookupImpl: publicLookup, fetchImpl: async () => response('x'.repeat(2048)) }), error => error.code === 'FETCH_RESPONSE_TOO_LARGE')
})

test('redirects are rechecked against the fetch scope and cancellation is preserved', async () => {
  await assert.rejects(fetchNativePage({ url: 'https://example.com/start', robots: false, allowedHosts: ['example.com'], lookupImpl: publicLookup, fetchImpl: async () => response('<p>redirect</p>', { url: 'https://evil.example/final' }) }), error => error.code === 'FETCH_HOST_NOT_ALLOWED')
  await assert.rejects(fetchNativePage({ url: 'https://example.com/slow', robots: false, lookupImpl: publicLookup, fetchImpl: async () => { const error = new Error('cancel'); error.name = 'AbortError'; throw error } }), error => error instanceof NativeFetchError && error.code === 'FETCH_ABORTED')
})
