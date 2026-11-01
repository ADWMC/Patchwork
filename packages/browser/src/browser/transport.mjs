import { randomBytes } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'

export function encodeBrowserFrame(frame) {
  const { image, ...metadata } = frame
  const header = Buffer.from(JSON.stringify(metadata))
  if (header.length > 64 * 1024 || image.length > 8 * 1024 * 1024) throw new Error('Oversized browser frame')
  const size = Buffer.allocUnsafe(4); size.writeUInt32BE(header.length)
  return Buffer.concat([size, header, image])
}

// A transport owns pixels only. Browser input remains ordered and authenticated
// by the HTTP input endpoint; this never exposes an upstream CDP connection.
export function registerBrowserTransport(server, path, resolve) {
  if (typeof server?.registerUpgrade !== 'function') return { issue: () => ({ available: false }), dispose() {} }
  const tickets = new Map(), sockets = new Set()
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false })
  const valid = owner => {
    const next = resolve(owner.id)
    return next?.agent === owner.agent && next?.client === owner.client
  }
  const unregister = server.registerUpgrade({ path, handler(req, socket, head) {
    let id
    try {
      if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host || sockets.size >= 16) throw new Error('Forbidden origin')
      id = new URL(req.url, 'http://localhost').searchParams.get('sessionId')
      if (!resolve(id)) throw new Error('Browser access required')
    } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return }
    wss.handleUpgrade(req, socket, head, ws => {
      sockets.add(ws)
      let owner, stop, latest, scheduled, awaiting, lastSent = 0, closing = false, alive = true
      const finish = () => {
        if (closing) return
        closing = true; clearTimeout(authTimeout); clearTimeout(scheduled); clearInterval(heartbeat)
        latest = null; stop?.(); sockets.delete(ws); ws.terminate()
      }
      const authTimeout = setTimeout(finish, 5000)
      const heartbeat = setInterval(() => {
        if (owner && !valid(owner) || !alive) return finish()
        alive = false; if (ws.readyState === WebSocket.OPEN) ws.ping()
      }, 10_000)
      const flush = () => {
        scheduled = null
        if (closing || !owner || !valid(owner)) return finish()
        if (!latest || awaiting) return
        if (ws.bufferedAmount > 512 * 1024) { scheduled = setTimeout(flush, 33); return }
        const frame = latest; latest = null; lastSent = performance.now(); awaiting = frame.capture.id
        try { ws.send(encodeBrowserFrame(frame), { binary: true }, error => { if (error) finish() }) } catch { finish() }
      }
      ws.on('pong', () => { alive = true })
      ws.on('error', finish); ws.on('close', finish)
      ws.on('message', async (data, binary) => {
        if (binary || data.length > 1024) return finish()
        let message
        try { message = JSON.parse(data.toString()) } catch { return finish() }
        if (owner) {
          if (!valid(owner) || !awaiting || message.ack !== awaiting) return finish()
          awaiting = null
          if (latest && !scheduled) scheduled = setTimeout(flush, Math.max(0, 33 - (performance.now() - lastSent)))
          return
        }
        const ticket = message.ticket
        const pending = tickets.get(ticket); tickets.delete(ticket)
        if (!pending || pending.expires < Date.now() || pending.id !== id || !valid(pending)) return finish()
        owner = pending; clearTimeout(authTimeout)
        try {
          const release = await owner.client.stream(frame => {
            if (closing || !valid(owner)) return finish()
            latest = frame
            if (!scheduled && !awaiting) scheduled = setTimeout(flush, Math.max(0, 33 - (performance.now() - lastSent)))
          }, finish)
          if (closing) release(); else stop = release
        } catch { finish() }
      })
    })
  } })
  return {
    issue(id) {
      const owner = resolve(id)
      if (!owner) throw new Error('Browser access required')
      for (const [ticket, value] of tickets) if (value.expires < Date.now() || !valid(value)) tickets.delete(ticket)
      if (tickets.size >= 64) throw new Error('Too many pending browser connections')
      const ticket = randomBytes(32).toString('base64url'), expires = Date.now() + 10_000
      tickets.set(ticket, { ...owner, id, expires })
      return { available: true, path, ticket, expires }
    },
    dispose() { unregister?.(); tickets.clear(); for (const ws of sockets) ws.terminate(); sockets.clear(); wss.close() },
  }
}
