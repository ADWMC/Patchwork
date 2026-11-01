import { Agent, createServer, request as httpRequest } from 'node:http'
import { connect, isIP } from 'node:net'
import { connect as tlsConnect } from 'node:tls'
import { randomUUID } from 'node:crypto'

// Retrieval-only egress. DNS is checked by the owner's public policy, then the
// TCP socket uses that exact IP. Chromium's separate resolver cannot rebind it.
// CONNECT preserves the browser's TLS handshake; no certificate is intercepted.
export async function createPublicNetwork({ authorizeTarget, proxy, maxBytes = 2_000_000, onError = () => {} }) {
  const sockets = new Set(), username = randomUUID(), password = randomUUID()
  const origins = new Set()
  const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
  let ended = false, received = 0
  const upstream = proxy ? new URL(proxy.server) : null
  if (upstream && !['http:', 'https:'].includes(upstream.protocol)) throw new Error('Public browser retrieval supports direct or HTTP(S) proxy egress; configure a supported environment proxy')
  const track = socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {}); return socket }
  const close = () => { ended = true; for (const socket of sockets) socket.destroy(); server.close() }
  const fail = error => { if (!ended) { onError(error); close() } }
  async function tunnel(target) {
    if (ended) throw new Error('Public browser network closed')
    if (!origins.has(target.origin)) { const error = new Error('Public connection was not admitted by the page policy'); error.code = 'UNADMITTED_ORIGIN'; throw error }
    const checked = await authorizeTarget(target.href, false)
    if (ended) throw new Error('Public browser network closed')
    const address = checked.addresses?.find(item => item.family === 4) ?? checked.addresses?.[0]
    if (!address || !isIP(address.address)) throw new Error('Public policy must return a pinned address')
    const host = address.address, port = Number(target.port || (target.protocol === 'https:' ? 443 : 80))
    const socket = track(upstream ? upstream.protocol === 'https:' ? tlsConnect({ host: upstream.hostname, port: Number(upstream.port || 443), servername: upstream.hostname }) : connect({ host: upstream.hostname, port: Number(upstream.port || 80) }) : connect({ host, port }))
    const connected = upstream?.protocol === 'https:' ? 'secureConnect' : 'connect'
    await new Promise((resolve, reject) => { socket.once(connected, resolve); socket.once('error', reject); socket.once('close', () => reject(new Error('Public connection closed'))) })
    socket.setTimeout(15000, () => socket.destroy(new Error('Public connection timed out')))
    if (upstream) {
      const destination = `${isIP(host) === 6 ? `[${host}]` : host}:${port}`
      const credentials = proxy.username ? 'Proxy-Authorization: Basic ' + Buffer.from(`${proxy.username}:${proxy.password ?? ''}`).toString('base64') + '\r\n' : ''
      await new Promise((resolve, reject) => {
        let header = Buffer.alloc(0)
        const onData = chunk => {
          header = Buffer.concat([header, chunk]); const end = header.indexOf('\r\n\r\n')
          if (header.length > 16384) { socket.off('data', onData); return reject(new Error('Oversized proxy response')) }
          if (end < 0) return
          socket.off('data', onData)
          if (!/^HTTP\/1\.[01] 2\d\d /.test(header.toString('latin1'))) return reject(new Error('Configured proxy refused pinned public target'))
          const extra = header.subarray(end + 4); if (extra.length) socket.unshift(extra); resolve()
        }
        socket.on('data', onData); socket.once('error', reject); socket.once('close', () => reject(new Error('Proxy connection closed')))
        socket.write(`CONNECT ${destination} HTTP/1.1\r\nHost: ${destination}\r\n${credentials}\r\n`)
      })
    }
    socket.on('data', chunk => { received += chunk.length; if (received > maxBytes + 65536) fail(new Error('Public browser network response budget exceeded')) })
    return socket
  }
  const server = createServer(async (req, res) => {
    if (req.headers['proxy-authorization'] !== auth) { res.writeHead(407, { 'proxy-authenticate': 'Basic realm="Patchwork retrieval"' }); return res.end() }
    let remote
    try {
      const target = new URL(req.url)
      if (target.protocol !== 'http:' || !['GET', 'HEAD'].includes(req.method)) throw new Error('Unsupported public proxy request')
      remote = await tunnel(target)
      const headers = { ...req.headers, host: target.host }; delete headers['proxy-authorization']; delete headers['proxy-connection']
      const agent = new Agent({ keepAlive: false }); agent.createConnection = () => remote
      const outgoing = httpRequest(target, { method: req.method, headers, agent }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
      outgoing.on('close', () => agent.destroy())
      outgoing.on('error', error => { res.destroy(); fail(error) }); req.on('aborted', () => outgoing.destroy()); outgoing.end()
    } catch (error) { remote?.destroy(); res.destroy(); if (error.code !== 'UNADMITTED_ORIGIN') fail(error) }
  })
  server.on('connection', track)
  server.on('connect', async (req, socket, head) => {
    if (req.headers['proxy-authorization'] !== auth) return socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Patchwork retrieval"\r\nConnection: close\r\n\r\n')
    try {
      const target = new URL('https://' + req.url)
      if (!target.port) target.port = '443'
      const remote = await tunnel(target)
      if (ended || socket.destroyed) return remote.destroy()
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) remote.write(head)
      socket.pipe(remote); remote.pipe(socket); socket.on('close', () => remote.destroy()); remote.on('close', () => socket.destroy())
    } catch (error) { socket.destroy(); if (error.code !== 'UNADMITTED_ORIGIN') fail(error) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return { proxy: { server: `http://127.0.0.1:${server.address().port}`, username, password, bypass: '<-loopback>' }, allow(url) { origins.add(new URL(url).origin) }, close }
}
