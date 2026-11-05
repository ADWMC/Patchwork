import { nativeFetch } from './http-client.mjs'
import { assertPublicTarget, fetchPublicResponse } from './public-fetch.mjs'
import { parseBingRss, parseBraveResults, parseDuckDuckGoResults, providerParsers } from './provider-parsers.mjs'
import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_RESPONSE_BYTES = 2_000_000
const MAX_QUERY_LENGTH = 512
const MAX_SNIPPET_CHARS = 600
const USER_AGENT = 'Patchwork-native-search/0.3'

const PROVIDERS = Object.freeze({
  'bing-rss': { endpoint: 'https://www.bing.com/search', queryKey: 'q', params: { format: 'rss', count: '12' }, family: 'bing', kind: 'html', headers: { referer: 'https://www.bing.com/' } },
  'brave-html': { endpoint: 'https://search.brave.com/search', queryKey: 'q', family: 'brave', kind: 'html' },
  'duckduckgo-html': { endpoint: 'https://html.duckduckgo.com/html/', queryKey: 'q', params: { kp: '1' }, family: 'duckduckgo', kind: 'html' },
  'uapis-keyless': { endpoint: 'https://uapis.cn/api/v1/search/aggregate', family: 'uapis', kind: 'json' },
  'tavily-keyless': { endpoint: 'https://api.tavily.com/search', family: 'tavily', kind: 'json', headers: { 'x-tavily-access-mode': 'keyless' } },
})

export class NativeSearchError extends Error {
  constructor(message, code = 'SEARCH_PROVIDER_ERROR', details = {}) {
    super(message)
    this.name = 'NativeSearchError'
    this.code = code
    Object.assign(this, details)
  }
}

export function validateQuery(query) {
  const normalized = String(query ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) throw new NativeSearchError('query is required', 'SEARCH_INVALID_QUERY')
  if (normalized.length > MAX_QUERY_LENGTH) throw new NativeSearchError(`query exceeds ${MAX_QUERY_LENGTH} characters`, 'SEARCH_INVALID_QUERY')
  return normalized
}

function boundedLimit(maxResults) {
  return Math.max(1, Math.min(12, Math.trunc(Number(maxResults) || 8)))
}

function boundedText(value, limit) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function combinedSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(Math.max(1000, Math.min(30000, Math.trunc(Number(timeoutMs) || 15000))))
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function responseText(response) {
  if (!response?.ok) throw new NativeSearchError(`search provider returned HTTP ${response?.status ?? 'unknown'}`, 'SEARCH_PROVIDER_HTTP', { status: response?.status })
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new NativeSearchError('search provider response exceeded the bounded response size', 'SEARCH_RESPONSE_TOO_LARGE')
  return text
}

function jsonProviderBody(provider, query, maxResults) {
  if (provider === 'tavily-keyless') return JSON.stringify({ query, max_results: maxResults, include_answer: false })
  return JSON.stringify({ query })
}

function jsonProviderSources(payload, maxResults) {
  const raw = Array.isArray(payload?.results) ? payload.results : []
  const sources = []
  for (const item of raw) {
    const url = typeof item?.url === 'string' ? item.url.trim() : ''
    const title = boundedText(item?.title, 300) || url
    const snippet = boundedText(item?.snippet ?? item?.content, MAX_SNIPPET_CHARS)
    if (!url) continue
    sources.push({ title, url, ...(snippet ? { snippet } : {}) })
    if (sources.length >= maxResults) break
  }
  return { sources, truncated: raw.length > sources.length }
}

/** POST a keyless JSON search endpoint behind the same public-target guards as the HTML providers. */
async function searchJsonProvider({ provider, query, maxResults, timeoutMs, signal, fetchImpl, endpoint }) {
  const started = Date.now()
  const definition = PROVIDERS[provider]
  const budgetSignal = combinedSignal(signal, timeoutMs)
  const requestOptions = {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': USER_AGENT, ...(definition.headers ?? {}) },
    body: jsonProviderBody(provider, query, maxResults),
    redirect: 'manual',
    maxRedirects: 0,
    timeoutMs,
    maxBytes: MAX_RESPONSE_BYTES,
    signal: budgetSignal,
  }
  let response
  if (fetchImpl === nativeFetch) {
    // The native path pins DNS to the approved addresses, closing the check-to-request gap.
    let addresses
    const target = await assertPublicTarget(endpoint ?? definition.endpoint, {
      signal: budgetSignal,
      lookupImpl: async (...args) => { addresses = await lookup(...args); return addresses },
    })
    const hostname = target.hostname.replace(/^\[|\]$/g, '')
    addresses ??= [{ address: hostname, family: isIP(hostname) }]
    budgetSignal.throwIfAborted()
    response = await nativeFetch(target, { ...requestOptions, approvedAddresses: addresses })
  } else {
    response = await fetchImpl(endpoint ?? definition.endpoint, requestOptions)
  }
  if (fetchImpl === nativeFetch && response?.url && new URL(response.url).href !== new URL(endpoint ?? definition.endpoint).href) {
    throw new NativeSearchError('transport followed an unapproved redirect', 'SEARCH_PROVIDER_ERROR')
  }
  const text = await responseText(response)
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new NativeSearchError('search provider returned malformed JSON', 'SEARCH_PROVIDER_ERROR')
  }
  const { sources, truncated } = jsonProviderSources(payload, maxResults)
  const elapsedMs = Date.now() - started
  const status = sources.length ? 'healthy' : 'zero_result'
  return { provider, family: definition.family, sources, truncated, elapsedMs,
    health: { provider, family: definition.family, status, resultCount: sources.length, elapsedMs } }
}

function providerUrl(provider, query, endpoint) {
  const definition = PROVIDERS[provider]
  if (!definition) throw new NativeSearchError(`unknown native search provider: ${provider}`, 'SEARCH_UNKNOWN_PROVIDER')
  const url = new URL(endpoint ?? definition.endpoint)
  url.searchParams.set(definition.queryKey, query)
  for (const [key, value] of Object.entries(definition.params ?? {})) url.searchParams.set(key, value)
  if (provider === 'brave-html') url.searchParams.set('source', 'web')
  return url
}

function normalizeProviderList(providers) {
  const values = Array.isArray(providers) && providers.length ? providers : NATIVE_SEARCH_DEFAULTS.providers
  return [...new Set(values.map(value => String(value).trim()).filter(value => value && PROVIDERS[value]))]
}

async function searchHtmlProvider({ provider, query, maxResults, timeoutMs, signal, fetchImpl, endpoint }) {
  const started = Date.now()
  const definition = PROVIDERS[provider]
  const requester = fetchImpl === nativeFetch ? fetchPublicResponse : fetchImpl
  const response = await requester(providerUrl(provider, query, endpoint), {
    method: 'GET',
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': USER_AGENT, ...(definition.headers ?? {}) },
    timeoutMs,
    signal: combinedSignal(signal, timeoutMs),
  })
  const parser = providerParsers[provider]
  const html = await responseText(response)
  const parsed = parser(html, maxResults)
  const elapsedMs = Date.now() - started
  const parserSignal = provider === 'bing-rss' ? /<item\b/i : provider === 'brave-html' ? /data-type\s*=\s*["']web["']/i : /\bresult__a\b/i
  const status = parsed.results.length ? 'healthy' : parserSignal.test(html) ? 'parser_drift' : 'zero_result'
  return { provider, family: PROVIDERS[provider].family, sources: parsed.results, truncated: parsed.truncated, elapsedMs,
    health: { provider, family: PROVIDERS[provider].family, status, resultCount: parsed.results.length, elapsedMs } }
}

async function searchSingleProvider({ provider, query, maxResults = 8, timeoutMs = 15000, signal, fetchImpl = nativeFetch, endpoint } = {}) {
  const normalized = validateQuery(query)
  const definition = PROVIDERS[provider]
  if (!definition) throw new NativeSearchError(`unknown native search provider: ${provider}`, 'SEARCH_UNKNOWN_PROVIDER')
  if (typeof fetchImpl !== 'function') throw new NativeSearchError('native search has no HTTP client', 'SEARCH_CLIENT_UNAVAILABLE')
  const bounded = boundedLimit(maxResults)
  try {
    if (definition.kind === 'json') return await searchJsonProvider({ provider, query: normalized, maxResults: bounded, timeoutMs, signal, fetchImpl, endpoint })
    return await searchHtmlProvider({ provider, query: normalized, maxResults: bounded, timeoutMs, signal, fetchImpl, endpoint })
  } catch (error) {
    if (error instanceof NativeSearchError) {
      if (!error.provider) error.provider = provider
      if (!error.family) error.family = definition.family
      throw error
    }
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw new NativeSearchError('native search was cancelled or timed out', error.name === 'AbortError' ? 'SEARCH_ABORTED' : 'SEARCH_TIMEOUT', { provider, family: definition.family })
    throw new NativeSearchError('native search provider request failed', 'SEARCH_PROVIDER_ERROR', { provider, family: definition.family })
  }
}

/** Search DuckDuckGo directly for callers that need a stable single-provider result. */
export async function searchDuckDuckGo({ query, maxResults = 8, timeoutMs = 15000, signal, fetchImpl = nativeFetch, endpoint } = {}) {
  const result = await searchSingleProvider({ provider: 'duckduckgo-html', query, maxResults, timeoutMs, signal, fetchImpl, endpoint })
  return { provider: result.provider, query: validateQuery(query), sources: result.sources, truncated: result.truncated, elapsedMs: result.elapsedMs, health: result.health }
}

export async function searchBing({ query, maxResults = 8, timeoutMs = 15000, signal, fetchImpl = nativeFetch, endpoint } = {}) {
  const result = await searchSingleProvider({ provider: 'bing-rss', query, maxResults, timeoutMs, signal, fetchImpl, endpoint })
  return { provider: result.provider, query: validateQuery(query), sources: result.sources, truncated: result.truncated, elapsedMs: result.elapsedMs, health: result.health }
}

export async function searchBrave({ query, maxResults = 8, timeoutMs = 15000, signal, fetchImpl = nativeFetch, endpoint } = {}) {
  const result = await searchSingleProvider({ provider: 'brave-html', query, maxResults, timeoutMs, signal, fetchImpl, endpoint })
  return { provider: result.provider, query: validateQuery(query), sources: result.sources, truncated: result.truncated, elapsedMs: result.elapsedMs, health: result.health }
}

function queryTerms(query) {
  return [...new Set(String(query).toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [])]
}

function relevanceScore(source, terms) {
  if (!terms.length) return 0
  const haystack = `${source.title} ${source.snippet ?? ''}`.toLowerCase()
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) / terms.length
}

function mergeProviderResults(providerResults, maxResults, query) {
  const limit = boundedLimit(maxResults)
  const terms = queryTerms(query)
  const candidates = new Map()
  const weights = { 'brave-html': 1.1, 'bing-rss': 0.9, 'duckduckgo-html': 0.85, 'tavily-keyless': 1.0, 'uapis-keyless': 0.95 }
  for (const [providerIndex, provider] of providerResults.entries()) {
    for (const [rank, source] of provider.sources.entries()) {
      const existing = candidates.get(source.url)
      const rankScore = (weights[provider.provider] ?? 0.8) / (rank + 1)
      const relevance = relevanceScore(source, terms)
      const score = rankScore + relevance * 2
      if (existing) {
        existing.score += score + 0.75
        existing.providers += 1
        existing.relevance = Math.max(existing.relevance, relevance)
        if (!existing.source.snippet && source.snippet) existing.source = { ...existing.source, snippet: source.snippet }
      } else {
        candidates.set(source.url, { source, score, providers: 1, relevance, providerIndex, rank })
      }
    }
  }
  const all = [...candidates.values()]
  const relevant = all.filter(item => item.relevance > 0)
  return (relevant.length ? relevant : all)
    .sort((a, b) => b.score - a.score || b.providers - a.providers || a.providerIndex - b.providerIndex || a.rank - b.rank)
    .slice(0, limit)
    .map(item => item.source)
}

/** Query independent public HTML providers in parallel and merge unique results by rank. */
export async function searchNativeWeb({ query, maxResults = 8, timeoutMs = 15000, signal, fetchImpl = nativeFetch, providers, endpoints = {} } = {}) {
  const normalized = validateQuery(query)
  if (typeof fetchImpl !== 'function') throw new NativeSearchError('native search has no HTTP client', 'SEARCH_CLIENT_UNAVAILABLE')
  const selected = normalizeProviderList(providers)
  if (!selected.length) throw new NativeSearchError('native search has no enabled providers', 'SEARCH_NO_PROVIDERS')
  const started = Date.now()
  const settled = await Promise.allSettled(selected.map(provider => searchSingleProvider({
    provider,
    query: normalized,
    maxResults: boundedLimit(maxResults),
    timeoutMs,
    signal,
    fetchImpl,
    endpoint: endpoints[provider],
  })))
  const successful = settled.flatMap(item => item.status === 'fulfilled' ? [item.value] : [])
  const failedProviders = settled.flatMap((item, index) => item.status === 'rejected' ? [{ provider: selected[index], code: item.reason?.code ?? 'SEARCH_PROVIDER_ERROR' }] : [])
  const providerHealth = settled.map((item, index) => {
    if (item.status === 'fulfilled') return item.value.health
    const error = item.reason
    const status = error?.code === 'SEARCH_PROVIDER_HTTP' && [401, 403, 429, 503].includes(error?.status) ? 'blocked' : 'transport_error'
    return { provider: selected[index], family: PROVIDERS[selected[index]].family, status, resultCount: 0, code: error?.code ?? 'SEARCH_PROVIDER_ERROR' }
  })
  if (signal?.aborted || failedProviders.some(item => item.code === 'SEARCH_ABORTED')) {
    throw new NativeSearchError('native search was cancelled or timed out', 'SEARCH_ABORTED', { failedProviders, providerHealth })
  }
  if (!successful.length) throw new NativeSearchError('all native search providers failed', 'SEARCH_ALL_PROVIDERS_FAILED', { failedProviders, providerHealth })
  const sources = mergeProviderResults(successful, maxResults, normalized)
  return {
    provider: 'patchwork-native-multi',
    providers: successful.map(item => item.provider),
    failedProviders,
    providerHealth,
    query: normalized,
    queryFingerprint: createHash('sha256').update(normalized).digest('hex'),
    sources,
    truncated: successful.some(item => item.truncated) || successful.some(item => item.sources.length > sources.length),
    elapsedMs: Date.now() - started,
  }
}

export const NATIVE_SEARCH_DEFAULTS = Object.freeze({
  providers: ['bing-rss', 'brave-html', 'uapis-keyless', 'tavily-keyless', 'duckduckgo-html'],
  maxResults: 8,
  timeoutMs: 15000,
})

export { parseBingRss, parseBraveResults, parseDuckDuckGoResults }
