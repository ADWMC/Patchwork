import https from 'node:https'
import { createRequire } from 'node:module'
import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'

export function checkedDownloadUrl(value) {
  const u = new URL(value)
  const allowed = ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' || !allowed.includes(u.hostname)) throw new Error('Download origin is outside the pinned official release hosts')
  return u.href
}

export async function openDownload(url, { proxy, signal, redirects = 0 } = {}) {
  checkedDownloadUrl(url); signal?.throwIfAborted()
  if (redirects > 5) throw new Error('Too many download redirects')
  let agent
  if (proxy) {
    const p = new URL(proxy)
    if (!['http:', 'https:'].includes(p.protocol)) throw new Error('Download proxy must use HTTP or HTTPS')
    const { HttpsProxyAgent } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle')
    agent = new HttpsProxyAgent(p.href)
  }
  try {
    const response = await new Promise((resolve, reject) => {
      const request = https.get(url, { agent, signal, timeout: 30000, headers: { 'user-agent': 'Patchwork-component-installer/1', 'accept-encoding': 'identity' } }, resolve)
      request.once('timeout', () => request.destroy(new Error('Download connection timed out')))
      request.once('error', reject)
    })
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      response.resume(); agent?.destroy()
      return openDownload(new URL(response.headers.location, url).href, { proxy, signal, redirects: redirects + 1 })
    }
    if (response.statusCode !== 200) { response.resume(); throw new Error(`Official asset returned HTTP ${response.statusCode}`) }
    response.once('close', () => agent?.destroy())
    return response
  } catch (error) { agent?.destroy(); throw error }
}

export async function downloadFile(asset, destination, { proxy, signal, onProgress = () => {}, open = openDownload } = {}) {
  checkedDownloadUrl(asset.url)
  const timeout = AbortSignal.timeout(20 * 60_000), combined = signal ? AbortSignal.any([timeout, signal]) : timeout
  const partial = destination + '.part'
  for (let attempt = 0; attempt < 3; attempt++) {
    combined.throwIfAborted()
    let bytes = 0, last = 0
    try {
      const response = await open(asset.url, { proxy, signal: combined })
      if (response.headers?.['content-length'] && Number(response.headers['content-length']) !== asset.bytes) { response.destroy(); throw new Error('Official asset size differs from the pinned release') }
      const digest = createHash('sha256')
      const meter = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length
        if (bytes > asset.bytes) return callback(new Error('Download exceeds the pinned asset size'))
        digest.update(chunk)
        if (Date.now() - last > 500) { onProgress({ stage: 'download', bytes, total: asset.bytes }); last = Date.now() }
        callback(null, chunk)
      } })
      await pipeline(response, meter, createWriteStream(partial, { flags: 'w', mode: 0o600 }), { signal: combined })
      if (bytes !== asset.bytes || digest.digest('hex') !== asset.sha256) throw new Error('Official asset SHA256 or size mismatch')
      await rename(partial, destination); onProgress({ stage: 'download', bytes, total: asset.bytes })
      return { bytes, sha256: asset.sha256 }
    } catch (error) {
      await rm(partial, { force: true })
      if (attempt === 2 || combined.aborted || /mismatch|pinned/.test(error.message)) throw error
      onProgress({ stage: 'retry', attempt: attempt + 2 })
    }
  }
}
