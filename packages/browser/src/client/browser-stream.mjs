// Fetch is intentional: EventSource cannot send the authorization header.
export async function consumeBrowserStream(response, onFrame, signal) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new Error('Browser stream unavailable')
  const reader = response.body.getReader(); const decoder = new TextDecoder()
  let pending = ''
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      if (pending.length > 12 * 1024 * 1024) throw new Error('Oversized browser stream event')
      let boundary
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const event = pending.slice(0, boundary); pending = pending.slice(boundary + 2)
        if (event.includes('event: fallback')) throw new Error('Browser JPEG fallback requested')
        const data = event.split('\n').find(line => line.startsWith('data: '))
        if (!data) continue
        const frame = JSON.parse(data.slice(6))
        const { width, height } = frame.viewport ?? {}
        if (!frame.frameId || !frame.tabId || !Number.isInteger(width) || !Number.isInteger(height) || width < 240 || width > 2560 || height < 240 || height > 1800 || typeof frame.image !== 'string' || frame.image.length > 11 * 1024 * 1024) throw new Error('Invalid browser stream identity')
        const bytes = Uint8Array.from(atob(frame.image), character => character.charCodeAt(0))
        if (!signal.aborted) onFrame({ ...frame, width, height, blob: new Blob([bytes], { type: 'image/jpeg' }) })
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

export function decodeBrowserFrame(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 5 || buffer.byteLength > 9 * 1024 * 1024) throw new Error('Invalid binary browser frame')
  const length = new DataView(buffer).getUint32(0)
  if (length > 64 * 1024 || length + 4 >= buffer.byteLength) throw new Error('Invalid browser frame header')
  const metadata = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, length)))
  const { width, height } = metadata.viewport ?? {}
  if (!metadata.frameId || !metadata.tabId || !Number.isInteger(width) || !Number.isInteger(height) || width < 240 || width > 2560 || height < 240 || height > 1800) throw new Error('Invalid browser frame identity')
  return { ...metadata, width, height, blob: new Blob([new Uint8Array(buffer, 4 + length)], { type: 'image/jpeg' }) }
}

export async function consumeBinaryBrowserStream(path, headers, onFrame, signal) {
  const response = await fetch(path + '&view=stream-ticket', { method: 'POST', headers, signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Browser transport authorization failed')
  const ticket = await response.json()
  if (!ticket.available) throw new Error('Binary browser stream unavailable')
  const url = new URL(ticket.path, location.href); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('sessionId', new URL(path, location.href).searchParams.get('sessionId'))
  if (signal.aborted) return
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url); socket.binaryType = 'arraybuffer'
    let timer = setTimeout(() => { socket.close(); reject(new Error('Browser stream connection timed out')) }, 6000)
    const abort = () => { clearTimeout(timer); socket.close(); resolve() }
    signal.addEventListener('abort', abort, { once: true })
    socket.onopen = () => { if (!signal.aborted) socket.send(JSON.stringify({ ticket: ticket.ticket })); else abort() }
    socket.onmessage = event => { try {
      clearTimeout(timer); timer = null
      if (!signal.aborted) {
        const frame = decodeBrowserFrame(event.data)
        let acknowledged = false
        onFrame({ ...frame, ack: () => { if (!acknowledged && socket.readyState === WebSocket.OPEN && !signal.aborted) { acknowledged = true; socket.send(JSON.stringify({ ack: frame.capture.id })) } } })
      }
    } catch (error) { socket.close(); reject(error) } }
    socket.onerror = () => { socket.close(); reject(new Error('Binary browser stream disconnected')) }
    socket.onclose = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve() }
  })
}
