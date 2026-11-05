import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

const MAX_RESPONSE_BYTES = 2_000_000
const PROXY_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']

function proxyConfigured(target) {
  const noProxy = process.env.NO_PROXY ?? process.env.no_proxy ?? ''
  const host = target.hostname.toLowerCase()
  const bypass = noProxy.split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
  if (bypass.some(pattern => pattern === '*' || pattern === host || (pattern.startsWith('.') && host.endsWith(pattern)))) return false
  return PROXY_KEYS.some(key => Boolean(process.env[key]))
}

function curlBinary() {
  return process.platform === 'win32' ? 'curl.exe' : 'curl'
}

function abortError() {
  const error = new Error('request aborted')
  error.name = 'AbortError'
  error.code = 'ABORT_ERR'
  return error
}

/**
 * Fixed-argv HTTP client. Public callers provide approved addresses and manual
 * redirects; direct sockets and proxy CONNECT both use that pinned destination.
 * No shell is involved and no caller-controlled argument becomes an option.
 * An optional `method`/`body` serves JSON POST endpoints; both default to the
 * original GET behavior.
 */
export function nativeFetch(url, options = {}) {
  const target = new URL(url)
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('only http and https are supported')
  if (options.approvedAddresses?.length && !proxyConfigured(target)) return pinnedRequest(target, options)
  if (!proxyConfigured(target) && typeof globalThis.fetch === 'function') return globalThis.fetch(url, options)
  return curlRequest(url, options)
}

function pinnedRequest(target, options) {
  const address = options.approvedAddresses[0]
  return new Promise((resolve, reject) => {
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      method: options.method ?? 'GET', headers: options.headers, agent: false, signal: options.signal,
      lookup(_host, settings, callback) { callback(null, settings?.all ? [address] : address.address, address.family) },
    }, response => {
      const chunks = []; let bytes = 0
      response.on('data', chunk => {
        bytes += chunk.length
        if (bytes > (options.maxBytes ?? MAX_RESPONSE_BYTES)) response.destroy(Object.assign(new Error('response too large'), { code: 'SEARCH_RESPONSE_TOO_LARGE' }))
        else chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, url: target.href, headers: { get: key => response.headers[key.toLowerCase()] }, text: async () => Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject)
    request.setTimeout(options.timeoutMs ?? 15000, () => request.destroy(Object.assign(new Error('request timeout'), { name: 'TimeoutError' })))
    request.end(options.body)
  })
}

function curlRequest(url, options = {}) {
  const timeoutMs = Math.max(1000, Math.min(30000, Number(options.timeoutMs) || 15000))
  const hasBody = options.body !== undefined && options.body !== null
  const extraHeaders = Object.entries(options.headers ?? {})
    .filter(([key]) => !['accept', 'user-agent'].includes(key.toLowerCase()))
    .flatMap(([key, value]) => ['--header', `${key}: ${value}`])
  const args = [
    // Windows Schannel curl does not consistently honor CURL_CA_BUNDLE itself.
    // Honor an explicit operator trust store without weakening TLS verification.
    ...(process.env.CURL_CA_BUNDLE ? ['--cacert', process.env.CURL_CA_BUNDLE] : []),
    // A request body travels on stdin; argv only ever carries fixed literals.
    ...(hasBody ? ['--request', 'POST', '--data-binary', '@-'] : []),
    ...extraHeaders,
    ...(options.redirect === 'manual' ? [] : ['--location', '--max-redirs', String(Math.max(0, Math.min(10, Number(options.maxRedirects) || 5)))]), '--silent', '--show-error', '--fail-with-body', '--include',
    '--connect-timeout', String(Math.ceil(timeoutMs / 1000)),
    '--max-time', String(Math.ceil(timeoutMs / 1000)),
    '--user-agent', String(options.headers?.['user-agent'] ?? options.headers?.['User-Agent'] ?? 'Patchwork-native-search/0.2'),
    '--header', `Accept: ${options.headers?.accept ?? options.headers?.Accept ?? 'text/html,application/xhtml+xml'}`,
    '--write-out', '\nPATCHWORK_STATUS:%{http_code}\nPATCHWORK_URL:%{url_effective}',
    '--url', url,
  ]
  if (options.approvedAddresses?.length) {
    const target = new URL(url), address = options.approvedAddresses[0].address
    const port = target.port || (target.protocol === 'https:' ? '443' : '80')
    args.unshift('--proxytunnel', '--connect-to', `${target.hostname}:${port}:${address.includes(':') ? `[${address}]` : address}:${port}`)
  }
  return new Promise((resolve, reject) => {
    const child = spawn(curlBinary(), args, { shell: false, windowsHide: true, env: process.env })
    const chunks = []
    let bytes = 0
    let stderr = ''
    let settled = false
    let killTimer
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(killTimer)
      options.signal?.removeEventListener('abort', onAbort)
      callback(value)
    }
    const onAbort = () => { child.kill(); finish(reject, abortError()) }
    if (options.signal?.aborted) return onAbort()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (hasBody) {
      // curl may exit before stdin closes (early failure); EPIPE must not escape.
      child.stdin.on('error', () => {})
      child.stdin.end(options.body)
    }
    child.stdout.on('data', chunk => {
      bytes += chunk.length
      if (bytes > (options.maxBytes ?? MAX_RESPONSE_BYTES) + 65536) {
        child.kill()
        const error = new Error('response exceeds bounded size')
        error.code = 'SEARCH_RESPONSE_TOO_LARGE'
        finish(reject, error)
        return
      }
      chunks.push(chunk)
    })
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString('utf8')).slice(-1000) })
    child.on('error', error => finish(reject, error))
    child.on('close', code => {
      if (settled) return
      const body = Buffer.concat(chunks).toString('utf8')
      const marker = /\nPATCHWORK_STATUS:(\d{3})\nPATCHWORK_URL:(\S+)\s*$/.exec(body)
      const status = marker ? Number(marker[1]) : undefined
      const finalUrl = marker?.[2] || url
      let text = marker ? body.slice(0, marker.index) : body
      const headers = new Map()
      while (/^HTTP\/\S+ \d{3}/.test(text)) {
        const end = text.indexOf('\r\n\r\n')
        if (end < 0) break
        headers.clear()
        for (const line of text.slice(0, end).split('\r\n').slice(1)) { const colon = line.indexOf(':'); if (colon > 0) headers.set(line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim()) }
        text = text.slice(end + 4)
      }
      if (code !== 0 && !(code === 22 && status >= 400)) {
        const error = new Error(stderr || `curl exited with code ${code}`)
        error.code = code === 28 ? 'SEARCH_TIMEOUT' : 'SEARCH_PROVIDER_ERROR'
        finish(reject, error)
        return
      }
      finish(resolve, { ok: status >= 200 && status < 300, status, url: finalUrl, headers: { get: key => headers.get(key.toLowerCase()) }, text: async () => text })
    })
    killTimer = setTimeout(() => { child.kill(); const error = new Error('request timed out'); error.name = 'TimeoutError'; finish(reject, error) }, timeoutMs + 250)
  })
}
