import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import WebSocket from 'ws'
import { encodeBrowserFrame, registerBrowserTransport } from '../src/browser/transport.mjs'
import { decodeBrowserFrame } from '../src/client/browser-stream.mjs'

function frame(id) { return { image: Buffer.from([255, 216, 255, 217]), frameId: 'frame', tabId: 'tab', epoch: 2, viewport: { width: 1280, height: 800 }, capture: { id } } }
test('binary frames preserve document identity and reject malformed lengths', () => {
  const encoded = encodeBrowserFrame(frame('one')), buffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
  const decoded = decodeBrowserFrame(buffer)
  assert.equal(decoded.frameId, 'frame'); assert.equal(decoded.blob.size, 4)
  assert.throws(() => decodeBrowserFrame(new ArrayBuffer(4)), /Invalid/)
  const corrupt = new ArrayBuffer(10); new DataView(corrupt).setUint32(0, 90000)
  assert.throws(() => decodeBrowserFrame(corrupt), /header/)
})

test('binary transport binds single-use tickets to the owner and sends latest frames only after display ACK', async () => {
  const http = createServer(), owner = { agent: {}, client: {} }, path = '/browser/stream'
  let route, produce, ends = 0, streams = 0
  owner.client.stream = async (onFrame, onEnd) => { streams++; produce = onFrame; return () => { ends++; onEnd() } }
  const transport = registerBrowserTransport({ registerUpgrade(value) { route = value; return () => {} } }, path, id => id === 'owner' ? owner : null)
  http.on('upgrade', (req, socket, head) => route.handler(req, socket, head))
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${http.address().port}`, url = origin.replace('http:', 'ws:') + path + '?sessionId=owner'
  const sockets = []
  try {
    const ticket = transport.issue('owner'), ws = new WebSocket(url, { origin }); sockets.push(ws)
    const received = []; ws.on('message', data => received.push(data))
    await once(ws, 'open'); ws.send(JSON.stringify({ ticket: ticket.ticket }))
    await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(streams, 1)
    produce(frame('first')); await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(received.length, 1)
    produce(frame('old')); produce(frame('latest')); await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(received.length, 1)
    ws.send(JSON.stringify({ ack: 'first' })); await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(received.length, 2)
    const data = received[1]; assert.equal(decodeBrowserFrame(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)).capture.id, 'latest')
    const replay = new WebSocket(url, { origin }); sockets.push(replay); await once(replay, 'open')
    replay.send(JSON.stringify({ ticket: ticket.ticket })); await once(replay, 'close'); assert.equal(streams, 1)
    ws.send(JSON.stringify({ ack: 'wrong-frame' })); await once(ws, 'close'); assert.equal(ends, 1)
    const unauthorized = new WebSocket(url, { origin: 'https://unrelated.example' }); sockets.push(unauthorized)
    const [error] = await once(unauthorized, 'error'); assert.match(error.message, /403/)
  } finally { for (const ws of sockets) ws.terminate(); transport.dispose(); await new Promise(resolve => http.close(resolve)) }
})

test('old hosts explicitly report binary transport unavailable', () => {
  const transport = registerBrowserTransport({}, '/browser', () => null)
  assert.deepEqual(transport.issue('x'), { available: false }); transport.dispose()
})
