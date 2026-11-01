import { randomUUID } from 'node:crypto'
import { imageSize, digest } from './evidence.mjs'

export async function startScreencast(session, onFrame, onEnd = () => {}) {
  const page = session.page(); const tabId = session.selectedTabId; const epoch = session.epoch
  const viewport = page.viewportSize()
  const cdp = await session.context.newCDPSession(page)
  let ended = false
  const stop = () => {
    if (ended) return
    ended = true
    cdp.removeAllListeners('Page.screencastFrame')
    void cdp.send('Page.stopScreencast').catch(() => {}).finally(() => cdp.detach().catch(() => {}))
    onEnd()
  }
  cdp.on('Page.screencastFrame', event => {
    // Ack promptly; each subscriber retains only its newest frame.
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(stop)
    if (ended || session.ended || session.epoch !== epoch || session.page() !== page) return stop()
    try {
      session.check()
      const image = Buffer.from(event.data, 'base64')
      if (image.length > 8 * 1024 * 1024) throw new Error('Oversized browser stream frame')
      const size = imageSize(image)
      if (size.width !== viewport.width || size.height !== viewport.height) throw new Error('Stream frame dimensions disagree with the viewport')
      const frameId = session.frameToken ??= randomUUID()
      session.frames.set(frameId, { epoch, tabId })
      onFrame({ image, frameId, tabId, epoch, viewport, focusId: session.focusId, capture: { id: randomUUID(), sha256: digest(image), width: size.width, height: size.height, tabId, epoch, capturedAt: new Date().toISOString() } })
    } catch { stop() }
  })
  try {
    // Static pages may only paint once. Skipping that first paint leaves a
    // successfully started stream with no frame until the next interaction.
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 76, maxWidth: viewport.width, maxHeight: viewport.height, everyNthFrame: 1 })
    session.check()
    if (epoch !== session.epoch) throw new Error('Browser changed during stream startup')
    return stop
  } catch (error) { stop(); throw error }
}
