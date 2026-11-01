import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { compareIdentity } from './identity.mjs'
import { compareClientHints } from './client-hints.mjs'

export async function probeIdentity(context, profile, check) {
  const token = randomUUID()
  let headers = {}
  const server = createServer((req, res) => {
    if (req.url !== `/${token}` && req.url !== `/${token}/headers`) { res.statusCode = 404; res.end(); return }
    headers = req.headers
    if (req.url === `/${token}/headers`) { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end('{}'); return }
    res.setHeader('content-type', 'text/html')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('accept-ch', 'Sec-CH-UA-Full-Version-List, Sec-CH-UA-Platform-Version')
    res.end('<!doctype html><title>Patchwork local environment check</title>')
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  let page
  try {
    check()
    page = await context.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}/${token}`, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const measured = await page.evaluate(async () => {
      const read = w => ({ language: w.navigator.language, languages: [...w.navigator.languages], ua: w.navigator.userAgent, platform: w.navigator.platform, cores: w.navigator.hardwareConcurrency, width: w.screen.width, height: w.screen.height, dpr: w.devicePixelRatio, timezone: w.Intl.DateTimeFormat().resolvedOptions().timeZone, uaData: w.navigator.userAgentData?.toJSON() ?? null })
      const main = read(window)
      if (navigator.userAgentData?.getHighEntropyValues) main.uaData = await navigator.userAgentData.getHighEntropyValues(['fullVersionList', 'platformVersion'])
      await fetch(location.pathname + '/headers', { cache: 'no-store' })
      const frame = document.createElement('iframe'); document.body.append(frame)
      const iframe = read(frame.contentWindow)
      frame.remove()
      const worker = await new Promise(resolve => {
        const blob = URL.createObjectURL(new Blob([`postMessage({ua:navigator.userAgent,language:navigator.language,cores:navigator.hardwareConcurrency,platform:navigator.platform})`], { type: 'text/javascript' }))
        const worker = new Worker(blob)
        const finish = result => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(blob); resolve(result) }
        const timer = setTimeout(() => finish({}), 3000)
        worker.onmessage = event => finish(event.data); worker.onerror = () => finish({})
      })
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#169'; ctx.fillRect(0, 0, 64, 32); ctx.fillStyle = '#fff'; ctx.fillText('Patchwork', 2, 20)
      const pixels = [...ctx.getImageData(0, 0, 64, 32).data]
      const first = canvas.toDataURL(); const second = canvas.toDataURL()
      const blob = await new Promise(resolve => canvas.toBlob(resolve))
      const blobUrl = blob ? await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob) }) : null
      const stablePixels = JSON.stringify(pixels) === JSON.stringify([...ctx.getImageData(0, 0, 64, 32).data])
      let offscreen = null
      if (typeof OffscreenCanvas === 'function') {
        const off = new OffscreenCanvas(32, 32); const oc = off.getContext('2d'); oc.fillRect(0, 0, 32, 32)
        const a = new Uint8Array(await (await off.convertToBlob()).arrayBuffer()); const b = new Uint8Array(await (await off.convertToBlob()).arrayBuffer())
        offscreen = a.length === b.length && a.every((value, i) => b[i] === value)
      }
      return { main, iframe, worker, canvasStable: first === second && stablePixels, blobConsistent: blobUrl === first, offscreen }
    })
    check()
    const expected = { language: profile.locale, width: profile.screen.width, height: profile.screen.height, dpr: profile.deviceScaleFactor, timezone: new Intl.DateTimeFormat('en', { timeZone: profile.timezoneId }).resolvedOptions().timeZone }
    const configuration = compareIdentity(expected, measured.main, { fields: Object.keys(expected) })
    const iframe = compareIdentity(measured.main, measured.iframe, { fields: ['ua', 'language', 'platform', 'cores', 'width', 'height', 'dpr', 'timezone'] })
    const worker = compareIdentity(measured.main, measured.worker, { fields: ['ua', 'language', 'platform', 'cores'] })
    const network = compareIdentity({ ua: measured.main.ua, language: profile.locale }, { ua: headers['user-agent'], language: headers['accept-language']?.split(',')[0] }, { fields: ['ua', 'language'] })
    const rendering = compareIdentity({ canvasStable: true, blobConsistent: true, offscreen: true }, measured, { fields: ['canvasStable', 'blobConsistent', 'offscreen'] })
    const clientHints = compareClientHints(measured.main, headers, context.browser()?.version())
    return { checkedAt: new Date().toISOString(), source: 'session-private-loopback-probe', configuration, iframe, worker, network, rendering, clientHints, coverage: { headers: 'received by loopback HTTP server', clientHints: 'JS and loopback low/high entropy headers compared against each other and actual Chromium version; unavailable fields remain unknown', exitIP: 'unsupported', tls: 'unsupported', webrtc: 'unmeasured', crossOriginIframe: 'unmeasured', workerOffscreenCanvas: 'unmeasured' } }
  } finally { await page?.close().catch(() => {}); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
