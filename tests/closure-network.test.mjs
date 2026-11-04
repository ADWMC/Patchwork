import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer as httpServer } from 'node:http'
import { createServer as httpsServer } from 'node:https'
import { connect } from 'node:net'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const transport = new URL('../src/retrieval/http-client.mjs', import.meta.url).href
const keyPath = fileURLToPath(new URL('./fixtures/tls/pinned.test.key.pem', import.meta.url))
const certPath = fileURLToPath(new URL('./fixtures/tls/pinned.test.cert.pem', import.meta.url))
// The TLS identity is a local, test-only fixture and is not stored in Git. Run
// `openssl req -x509 -newkey rsa:2048 -nodes -keyout pinned.test.key.pem -out pinned.test.cert.pem -days 2 -subj /CN=pinned.test`
// inside tests/fixtures/tls to enable these loopback transport tests.
const tls = (await existsSync(keyPath)) && (await existsSync(certPath)) ? { key: await readFile(keyPath), cert: await readFile(certPath) } : null
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(https?|all|no)_proxy$/i.test(key)))
async function serve(t, server) {
  const sockets = new Set()
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)) })
  return server.address().port
}
async function childFetch(url, { proxy, approved = '127.0.0.1' } = {}) {
  const code = `import { nativeFetch } from ${JSON.stringify(transport)}; try {const r=await nativeFetch(${JSON.stringify(url)},{approvedAddresses:[{address:${JSON.stringify(approved)},family:4}],redirect:'manual',timeoutMs:10000,headers:{accept:'text/plain'}});console.log(JSON.stringify({status:r.status,location:r.headers.get('location'),body:await r.text()}));}catch(e){console.log(JSON.stringify({error:e.code??e.name,message:e.message}));}`
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { windowsHide: true, env: { ...cleanEnv, NODE_EXTRA_CA_CERTS: certPath, CURL_CA_BUNDLE: certPath, ...(proxy ? { HTTPS_PROXY: proxy } : {}) } })
    let stdout = '', stderr = ''
    child.stdout.on('data', bytes => { stdout += bytes }); child.stderr.on('data', bytes => { stderr += bytes })
    child.on('error', reject); child.on('close', code => { try { if (code) throw new Error(stderr); resolve(JSON.parse(stdout)) } catch (error) { reject(error) } })
  })
}
// Only ephemeral loopback servers are contacted. Public admission tests are
// separate: this tests the lower transport's destination/Host/TLS contract.
test('real TLS sockets pin the approved IP, retain SNI/Host and never follow a redirect', { skip: !tls }, async t => {
  const requests = []
  const server = httpsServer({ key: tls.key, cert: tls.cert }, (req, res) => {
    requests.push({ path: req.url, host: req.headers.host, sni: req.socket.servername })
    if (req.url === '/redirect') { res.writeHead(302, { location: 'https://elsewhere.invalid/private' }); res.end('moved') }
    else res.end('pinned transport')
  })
  const port = await serve(t, server)
  assert.equal((await childFetch(`https://pinned.test:${port}/`)).body, 'pinned transport')
  assert.deepEqual(requests[0], { path: '/', host: `pinned.test:${port}`, sni: 'pinned.test' })
  const moved = await childFetch(`https://pinned.test:${port}/redirect`)
  assert.equal(moved.status, 302); assert.equal(requests.length, 2)
  assert.ok((await childFetch(`https://wrong.test:${port}/`)).error, 'pinned IP must not disable hostname verification')
})
test('real curl proxy CONNECT uses approved IP and keeps end-to-end TLS identity', { skip: !tls }, async t => {
  let targetHost, targetSni
  const origin = httpsServer({ key: tls.key, cert: tls.cert }, (req, res) => { targetHost = req.headers.host; targetSni = req.socket.servername; res.end('proxy pinned') })
  const originPort = await serve(t, origin), destinations = []
  const proxy = httpServer()
  proxy.on('connect', (req, socket, head) => {
    destinations.push(req.url)
    // The fixture will not connect to any destination other than its own server.
    if (req.url !== `127.0.0.1:${originPort}`) return socket.destroy()
    const upstream = connect(originPort, '127.0.0.1', () => { socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head); socket.pipe(upstream).pipe(socket) })
    upstream.on('error', () => socket.destroy()); socket.on('close', () => upstream.destroy())
  })
  const proxyPort = await serve(t, proxy)
  const result = await childFetch(`https://pinned.test:${originPort}/`, { proxy: `http://127.0.0.1:${proxyPort}` })
  assert.equal(result.body, 'proxy pinned', JSON.stringify(result))
  assert.deepEqual(destinations, [`127.0.0.1:${originPort}`]); assert.equal(targetHost, `pinned.test:${originPort}`); assert.equal(targetSni, 'pinned.test')
})
