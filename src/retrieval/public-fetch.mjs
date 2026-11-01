import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { nativeFetch } from './http-client.mjs'

const MAX_URL_LENGTH = 4096
const MAX_RESPONSE_BYTES = 2_000_000
const MAX_EXCERPT_CHARS = 12_000
const USER_AGENT = 'Patchwork-native-fetch/0.3'

export const NATIVE_FETCH_DEFAULTS = Object.freeze({
  timeoutMs: 15_000,
  maxBytes: MAX_RESPONSE_BYTES,
  maxChars: 6_000,
  maxRedirects: 5,
  robots: true,
  allowedHosts: [],
})

export class NativeFetchError extends Error {
  constructor(message, code = 'FETCH_ERROR', details = {}) {
    super(message)
    this.name = 'NativeFetchError'
    this.code = code
    Object.assign(this, details)
  }
}

function boundedNumber(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback
}

function combinedSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(Math.max(1000, Math.min(30_000, Math.trunc(Number(timeoutMs) || NATIVE_FETCH_DEFAULTS.timeoutMs))) )
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export function normalizeFetchUrl(value) {
  if (!(typeof value === 'string' || value instanceof URL) || (typeof value === 'string' && value.length > MAX_URL_LENGTH)) throw new NativeFetchError('url is required and bounded', 'FETCH_INVALID_URL')
  let url
  try { url = value instanceof URL ? new URL(value.href) : new URL(value.trim()) } catch { throw new NativeFetchError('url is invalid', 'FETCH_INVALID_URL') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new NativeFetchError('only http and https URLs are supported', 'FETCH_INVALID_URL')
  if (url.username || url.password) throw new NativeFetchError('URLs with embedded credentials are not allowed', 'FETCH_INVALID_URL')
  if (!url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) throw new NativeFetchError('local hostnames are not allowed', 'FETCH_SSRF_BLOCKED')
  url.hash = ''
  return url
}

function ipv4Private(value) {
  const parts = value.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) || (a === 192 && b === 168) || a >= 224
}

function ipv6Private(value) {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('2001:db8:')) return true
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return Boolean(mapped && ipv4Private(mapped[1]))
}

export function isPublicAddress(value) {
  const kind = isIP(value)
  return kind === 4 ? !ipv4Private(value) : kind === 6 ? !ipv6Private(value) : false
}

function hostAllowed(hostname, allowedHosts = []) {
  const configured = Array.isArray(allowedHosts) ? allowedHosts.map(value => String(value).trim().toLowerCase()).filter(Boolean) : []
  if (!configured.length) return true
  const host = hostname.toLowerCase()
  return configured.some(pattern => pattern === host || (pattern.startsWith('*.') && (host === pattern.slice(2) || host.endsWith(`.${pattern.slice(2)}`))))
}

export async function assertPublicTarget(url, { allowedHosts = [], lookupImpl = lookup } = {}) {
  const target = normalizeFetchUrl(url)
  if (!hostAllowed(target.hostname, allowedHosts)) throw new NativeFetchError('host is outside the configured fetch scope', 'FETCH_HOST_NOT_ALLOWED', { url: target.href })
  if (isIP(target.hostname)) {
    if (!isPublicAddress(target.hostname)) throw new NativeFetchError('private or reserved address is not allowed', 'FETCH_SSRF_BLOCKED')
    return target
  }
  let addresses
  try { addresses = await lookupImpl(target.hostname, { all: true, verbatim: true }) } catch { throw new NativeFetchError('host DNS lookup failed', 'FETCH_DNS_FAILED') }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new NativeFetchError('host resolves to a private or reserved address', 'FETCH_SSRF_BLOCKED')
  return target
}

function decodeEntities(value) {
  return String(value ?? '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits))).replace(/&#x([\da-f]+);/gi, (_, digits) => String.fromCodePoint(parseInt(digits, 16)))
}

function htmlToMarkdown(html, maxChars) {
  let value = String(html ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/<\s*(script|style|noscript|template|svg|canvas)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(value)?.[1]
  value = value.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n${'#'.repeat(Number(level))} ${text}\n`)
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(?:p|div|section|article|li|tr|blockquote|pre|main|header|footer)>/gi, '\n')
    .replace(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, '$3 ($2)')
    .replace(/<[^>]+>/g, ' ')
  value = decodeEntities(value).replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const truncated = value.length > maxChars
  return { title: decodeEntities(title ? title.replace(/<[^>]+>/g, ' ') : '').replace(/\s+/g, ' ').trim(), excerpt: truncated ? `${value.slice(0, maxChars)}\n[… excerpt truncated …]` : value, truncated }
}

function parseRobots(text, target) {
  const groups = []
  let active = false
  let rules = []
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.split('#')[0].trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (key === 'user-agent') {
      if (active && rules.length) groups.push(rules)
      active = value === '*' || value.toLowerCase() === USER_AGENT.toLowerCase()
      rules = active ? [] : rules
    } else if (key === 'disallow' && active && value) rules.push(value)
  }
  if (active && rules.length) groups.push(rules)
  const path = `${target.pathname}${target.search}`
  return !groups.flat().some(rule => path.startsWith(rule))
}

async function responseBody(response, maxBytes) {
  if (!response?.ok) throw new NativeFetchError(`fetch returned HTTP ${response?.status ?? 'unknown'}`, 'FETCH_HTTP_ERROR', { status: response?.status })
  if (response.body?.getReader) {
    const reader = response.body.getReader()
    const chunks = []
    let bytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = Buffer.from(value)
        bytes += chunk.length
        if (bytes > maxBytes) {
          try { await reader.cancel() } catch { /* bounded failure remains authoritative */ }
          throw new NativeFetchError('fetch response exceeded the bounded size', 'FETCH_RESPONSE_TOO_LARGE')
        }
        chunks.push(chunk)
      }
    } catch (error) {
      if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') throw new NativeFetchError('fetch was cancelled', 'FETCH_ABORTED')
      if (error?.name === 'TimeoutError') throw new NativeFetchError('fetch timed out', 'FETCH_TIMEOUT')
      throw error
    } finally { reader.releaseLock?.() }
    return Buffer.concat(chunks).toString('utf8')
  }
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new NativeFetchError('fetch response exceeded the bounded size', 'FETCH_RESPONSE_TOO_LARGE')
  return text
}

async function checkRobots(target, { fetchImpl, timeoutMs, signal, lookupImpl, allowedHosts, maxRedirects }) {
  const robotsUrl = new URL('/robots.txt', target.origin)
  await assertPublicTarget(robotsUrl, { allowedHosts, lookupImpl })
  let response
  try {
    response = await fetchImpl(robotsUrl, { method: 'GET', headers: { accept: 'text/plain', 'user-agent': USER_AGENT }, timeoutMs, maxRedirects, signal: combinedSignal(signal, timeoutMs) })
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') throw new NativeFetchError('fetch was cancelled', 'FETCH_ABORTED')
    if (error?.name === 'TimeoutError' || error?.code === 'SEARCH_TIMEOUT') throw new NativeFetchError('fetch timed out', 'FETCH_TIMEOUT')
    if (error?.code === 'SEARCH_RESPONSE_TOO_LARGE') throw new NativeFetchError('fetch response exceeded the bounded size', 'FETCH_RESPONSE_TOO_LARGE')
    throw new NativeFetchError('robots.txt could not be fetched', 'FETCH_ROBOTS_UNAVAILABLE')
  }
  await assertPublicTarget(response?.url || robotsUrl, { allowedHosts, lookupImpl })
  if (response?.status === 404) return { checked: true, allowed: true, source: robotsUrl.href }
  if (!response?.ok) throw new NativeFetchError('robots.txt could not be fetched', 'FETCH_ROBOTS_UNAVAILABLE', { status: response?.status })
  const text = await responseBody(response, 200_000)
  if (!parseRobots(text, target)) throw new NativeFetchError('robots.txt disallows this URL', 'FETCH_ROBOTS_DENIED', { robotsUrl: robotsUrl.href })
  return { checked: true, allowed: true, source: robotsUrl.href }
}

export async function authorizeBrowserTarget(url, { document = true, allowedHosts = [], lookupImpl = lookup, fetchImpl = nativeFetch, robots = true, timeoutMs = 15000, signal } = {}) {
  let addresses
  const target = await assertPublicTarget(url, { allowedHosts, lookupImpl: async (...args) => { addresses = await lookupImpl(...args); return addresses } })
  addresses ??= [{ address: target.hostname, family: isIP(target.hostname) }]
  const robotsInfo = document && robots ? await checkRobots(target, { fetchImpl, timeoutMs, maxRedirects: 5, signal, lookupImpl, allowedHosts }) : { checked: false, allowed: true }
  return { url: target.href, robots: robotsInfo, addresses }
}

export async function fetchNativePage({ url, maxChars = NATIVE_FETCH_DEFAULTS.maxChars, maxBytes = NATIVE_FETCH_DEFAULTS.maxBytes, timeoutMs = NATIVE_FETCH_DEFAULTS.timeoutMs, maxRedirects = NATIVE_FETCH_DEFAULTS.maxRedirects, allowedHosts = NATIVE_FETCH_DEFAULTS.allowedHosts, robots = true, signal, fetchImpl = nativeFetch, lookupImpl = lookup } = {}) {
  const target = await assertPublicTarget(url, { allowedHosts, lookupImpl })
  const boundedChars = boundedNumber(maxChars, NATIVE_FETCH_DEFAULTS.maxChars, 256, MAX_EXCERPT_CHARS)
  const boundedBytes = boundedNumber(maxBytes, NATIVE_FETCH_DEFAULTS.maxBytes, 1024, MAX_RESPONSE_BYTES)
  const boundedTimeout = boundedNumber(timeoutMs, NATIVE_FETCH_DEFAULTS.timeoutMs, 1000, 30_000)
  const boundedRedirects = boundedNumber(maxRedirects, NATIVE_FETCH_DEFAULTS.maxRedirects, 0, 10)
  const robotsInfo = robots ? await checkRobots(target, { fetchImpl, timeoutMs: boundedTimeout, maxRedirects: boundedRedirects, signal, lookupImpl, allowedHosts }) : { checked: false, allowed: true }
  let response
  try {
    response = await fetchImpl(target, { method: 'GET', headers: { accept: 'text/html,text/plain,application/xhtml+xml,application/json', 'user-agent': USER_AGENT }, timeoutMs: boundedTimeout, maxRedirects: boundedRedirects, signal: combinedSignal(signal, boundedTimeout) })
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') throw new NativeFetchError('fetch was cancelled', 'FETCH_ABORTED')
    if (error?.name === 'TimeoutError' || error?.code === 'SEARCH_TIMEOUT') throw new NativeFetchError('fetch timed out', 'FETCH_TIMEOUT')
    if (error?.code === 'SEARCH_RESPONSE_TOO_LARGE') throw new NativeFetchError('fetch response exceeded the bounded size', 'FETCH_RESPONSE_TOO_LARGE')
    throw new NativeFetchError('fetch transport failed', 'FETCH_TRANSPORT_ERROR')
  }
  const finalTarget = await assertPublicTarget(response?.url || target.href, { allowedHosts, lookupImpl })
  const contentType = String(response?.headers?.get?.('content-type') ?? response?.headers?.['content-type'] ?? 'text/html').toLowerCase()
  if (!/(text\/html|application\/xhtml\+xml|text\/plain|application\/json)/i.test(contentType)) throw new NativeFetchError('content type is not a supported text document', 'FETCH_UNSUPPORTED_CONTENT_TYPE')
  const text = await responseBody(response, boundedBytes)
  const markdown = htmlToMarkdown(text, boundedChars)
  if (!markdown.excerpt) throw new NativeFetchError('fetch returned no readable text', 'FETCH_EMPTY_CONTENT')
  return {
    url: target.href,
    finalUrl: finalTarget.href,
    status: response?.status ?? 200,
    contentType: contentType.split(';', 1)[0],
    title: markdown.title || finalTarget.hostname,
    excerpt: markdown.excerpt,
    truncated: markdown.truncated,
    robots: robotsInfo,
    retrievedAt: new Date().toISOString(),
    trust: 'external-untrusted',
  }
}
