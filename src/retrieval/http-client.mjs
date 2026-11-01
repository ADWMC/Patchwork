import { spawn } from 'node:child_process'

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
 * Fixed-argv public HTTP client. It uses the host's normal fetch when direct
 * access is available and curl's proxy-aware transport when a proxy is set.
 * No shell is involved and no caller-controlled argument becomes an option.
 */
export function nativeFetch(url, options = {}) {
  const target = new URL(url)
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('only http and https are supported')
  if (!proxyConfigured(target) && typeof globalThis.fetch === 'function') return globalThis.fetch(url, options)
  return curlRequest(url, options)
}

function curlRequest(url, options = {}) {
  const timeoutMs = Math.max(1000, Math.min(30000, Number(options.timeoutMs) || 15000))
  const args = [
    '--location', '--max-redirs', String(Math.max(0, Math.min(10, Number(options.maxRedirects) || 5))), '--silent', '--show-error', '--fail-with-body',
    '--connect-timeout', String(Math.ceil(timeoutMs / 1000)),
    '--max-time', String(Math.ceil(timeoutMs / 1000)),
    '--user-agent', String(options.headers?.['user-agent'] ?? options.headers?.['User-Agent'] ?? 'Patchwork-native-search/0.2'),
    '--header', `Accept: ${options.headers?.accept ?? options.headers?.Accept ?? 'text/html,application/xhtml+xml'}`,
    '--write-out', '\nPATCHWORK_STATUS:%{http_code}\nPATCHWORK_URL:%{url_effective}',
    '--url', url,
  ]
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
    child.stdout.on('data', chunk => {
      bytes += chunk.length
      if (bytes > MAX_RESPONSE_BYTES + 128) {
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
      const text = marker ? body.slice(0, marker.index) : body
      if (code !== 0 && !status) {
        const error = new Error(stderr || `curl exited with code ${code}`)
        error.code = code === 28 ? 'SEARCH_TIMEOUT' : 'SEARCH_PROVIDER_ERROR'
        finish(reject, error)
        return
      }
      finish(resolve, { ok: status >= 200 && status < 300, status, url: finalUrl, text: async () => text })
    })
    killTimer = setTimeout(() => { child.kill(); const error = new Error('request timed out'); error.name = 'TimeoutError'; finish(reject, error) }, timeoutMs + 250)
  })
}
