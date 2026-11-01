import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { scopedAgent } from './helpers/agent.mjs'
import { BrowserProfiles } from '../src/browser/profiles.mjs'
import { sealStorage, openStorage } from '../src/browser/storage-crypto.mjs'
import { acquireLease } from '../src/browser/lease.mjs'
import { BrowserArtifacts } from '../src/browser/artifacts.mjs'
import { compareIdentity, identityId } from '../src/browser/identity.mjs'
import { backendCapabilities, backendAvailability } from '../src/browser/backends.mjs'
import { consumeBrowserStream } from '../src/client/browser-stream.mjs'
import { BrowserSession } from '../src/browser/session.mjs'
import { recorderAvailability, BrowserRecorder } from '../src/browser/recording.mjs'
import { postcondition } from '../src/browser/evidence.mjs'

async function work(t) { const path = await mkdtemp(join(tmpdir(), 'patchwork-browser-security-')); t.after(() => rm(path, { recursive: true, force: true })); return path }
const keyProvider = async () => Buffer.alloc(32, 83)

test('postcondition comparison counts only conditions it actually observes, including after a mismatch', async () => {
  const calls = []
  const page = { url: () => 'https://example.com/', locator: () => ({ isVisible: async () => { calls.push('visible'); return true }, textContent: async () => { calls.push('text'); return 'ready' } }) }
  const result = await postcondition(page, { urlIncludes: 'missing', selector: 'button', visible: true, text: 'ready' })
  assert.deepEqual(result, { status: 'mismatch', compared: 3 })
  assert.deepEqual(calls, ['visible', 'text'])
})

test('storage encryption authenticates ciphertext, profile and session; no plaintext fallback', async () => {
  const key = await keyProvider(); const state = { cookies: [{ name: 'session', value: 'secret-cookie-value' }], origins: [] }
  const sealed = sealStorage(state, key, 'session-a/profile-a')
  assert.equal(JSON.stringify(sealed).includes('secret-cookie-value'), false)
  assert.deepEqual(openStorage(sealed, key, 'session-a/profile-a'), state)
  assert.throws(() => openStorage(sealed, key, 'session-b/profile-a'), /authentication/)
  assert.throws(() => openStorage(sealed, key, 'session-a/profile-b'), /authentication/)
  assert.throws(() => openStorage({ ...sealed, data: Buffer.from('tampered').toString('base64') }, key, 'session-a/profile-a'), /authentication/)
  assert.throws(() => openStorage(sealed, Buffer.alloc(32), 'session-a/profile-a'), /authentication/)
  assert.throws(() => openStorage({ ...sealed, tag: Buffer.from(sealed.tag, 'base64').subarray(0, 12).toString('base64') }, key, 'session-a/profile-a'), /authentication/)
  assert.throws(() => openStorage({ ...sealed, iv: Buffer.alloc(16).toString('base64') }, key, 'session-a/profile-a'), /authentication/)
  assert.throws(() => openStorage({ ...sealed, data: sealed.data + '\n' }, key, 'session-a/profile-a'), /authentication/)
})

test('oversized legacy and encrypted login snapshots are refused before use or migration', async t => {
  const root = await work(t); const store = new BrowserProfiles(scopedAgent({ session: { header: { id: 'storage-size' } } }), { root, keyProvider })
  const database = await store.edit({ action: 'createProfile', revision: 0, profile: { name: 'bounded', persistStorage: true } })
  const profile = await store.get(database.profiles.at(-1).id)
  const state = { cookies: [], origins: [], oversized: 'x'.repeat(2 * 1024 * 1024) }
  await writeFile(store.storagePath(profile.id), JSON.stringify(state))
  await assert.rejects(store.readStorage(profile), /size limit/)
  await assert.rejects(stat(store.encryptedPath(profile.id)), { code: 'ENOENT' })
  await writeFile(store.encryptedPath(profile.id), JSON.stringify(sealStorage(state, await keyProvider(), store.storageAAD(profile.id))))
  await assert.rejects(store.readStorage(profile), /size limit/)
  assert.ok(await stat(store.storagePath(profile.id)))
})

test('legacy opt-in login migrates atomically to encrypted storage; disabling removes both formats', async t => {
  const root = await work(t); const agent = scopedAgent({ session: { header: { id: 'migration' } } })
  const store = new BrowserProfiles(agent, { root, keyProvider })
  const database = await store.edit({ action: 'createProfile', revision: 0, profile: { name: 'migration', persistStorage: true } })
  const profile = await store.get(database.profiles.at(-1).id)
  const state = { cookies: [{ name: 'login', value: 'private-legacy-login' }], origins: [] }
  await writeFile(store.storagePath(profile.id), JSON.stringify(state))
  assert.deepEqual(await store.readStorage(profile), state)
  await assert.rejects(stat(store.storagePath(profile.id)), { code: 'ENOENT' })
  assert.equal((await readFile(store.encryptedPath(profile.id), 'utf8')).includes('private-legacy-login'), false)
  await store.edit({ action: 'updateProfile', revision: 1, profileId: profile.id, profile: { persistStorage: false } })
  await assert.rejects(stat(store.encryptedPath(profile.id)), { code: 'ENOENT' })
})

test('encryption failure preserves legacy state and never writes plaintext as a fallback', async t => {
  const root = await work(t); const agent = scopedAgent({ session: { header: { id: 'encryption-error' } } })
  const store = new BrowserProfiles(agent, { root, keyProvider: async () => { throw new Error('OS encryption unavailable') } })
  const database = await store.edit({ action: 'createProfile', revision: 0, profile: { name: 'fail', persistStorage: true } })
  const profile = await store.get(database.profiles.at(-1).id)
  await writeFile(store.storagePath(profile.id), JSON.stringify({ cookies: [], origins: [] }))
  await assert.rejects(store.readStorage(profile), /unavailable/)
  assert.ok(await stat(store.storagePath(profile.id)))
  await assert.rejects(stat(store.encryptedPath(profile.id)), { code: 'ENOENT' })
})

test('runtime lease rejects another writer and editing, then releases for the next owner', async t => {
  const root = await work(t); const agent = scopedAgent({ session: { header: { id: 'lease' } } })
  const store = new BrowserProfiles(agent, { root, keyProvider })
  const database = await store.edit({ action: 'createProfile', revision: 0, profile: { name: 'exclusive' } })
  const id = database.profiles.at(-1).id
  const release = await store.lease(id)
  await assert.rejects(store.lease(id), /in use/)
  await assert.rejects(store.edit({ action: 'updateProfile', profileId: id, revision: 1, profile: { name: 'other writer' } }), /in use/)
  await release(); const second = await store.lease(id); await second()
  assert.equal((await store.get(id)).name, 'exclusive')
})

test('a dead-process lease and dead recovery guard can be reclaimed; a live owner cannot', async t => {
  const root = await work(t); const path = join(root, 'dead.lock')
  const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']).pid
  for (const directory of [path, `${path}.recovery`]) {
    await mkdir(directory); await writeFile(join(directory, 'owner.json'), JSON.stringify({ pid: dead, token: 'dead' }))
  }
  const release = await acquireLease(path)
  await assert.rejects(acquireLease(path), /in use/)
  await release()
  await assert.rejects(stat(path), { code: 'ENOENT' })
})

test('device identity survives locale edits and advances only for hardware changes', async t => {
  const root = await work(t); const store = new BrowserProfiles(scopedAgent({ session: { header: { id: 'identity' } } }), { root, keyProvider })
  let db = await store.edit({ action: 'createProfile', revision: 0, profile: { name: 'stable', mode: 'fingerprint' } })
  const first = db.profiles.at(-1)
  db = await store.edit({ action: 'updateProfile', profileId: first.id, revision: 1, profile: { locale: 'en-US' } })
  const second = db.profiles.at(-1)
  assert.equal(second.fingerprintId, first.fingerprintId)
  assert.equal(second.identityRevision, first.identityRevision)
  db = await store.edit({ action: 'updateProfile', profileId: first.id, revision: 2, profile: { deviceScaleFactor: 2 } })
  assert.notEqual(db.profiles.at(-1).fingerprintId, first.fingerprintId)
  assert.equal(db.profiles.at(-1).identityRevision, first.identityRevision + 1)
  assert.equal(compareIdentity({ a: 1 }, { a: 1 }, { fields: ['a', 'unsupported'], unsupported: ['unsupported'] }).status, 'unknown')
  assert.equal(identityId({ mode: 'native' }), null)
})

test('artifact export is bounded, hashed, session-namespaced and cancelled before committing revoked data', async t => {
  const root = await work(t); let active = true
  const agent = { session: { header: { id: 'artifact-a', cwd: root } } }
  const artifacts = new BrowserArtifacts(agent, () => { if (!active) throw new Error('revoked') })
  const item = await artifacts.write('delivered', 'trace.json')
  assert.equal(item.bytes, 9); assert.match(item.sha256, /^[a-f0-9]{64}$/)
  assert.equal(await readFile(join(root, item.path), 'utf8'), 'delivered')
  await assert.rejects(artifacts.write('too-large', 'trace.json', 2), /size limit/)
  async function* late() { yield Buffer.from('first'); active = false; yield Buffer.from('secret') }
  await assert.rejects(artifacts.writeStream(late(), 'trace.json', 100), /revoked/)
  assert.equal(artifacts.items.length, 1)
})

test('a download reported failed after its last chunk is never committed or listed', async t => {
  const root = await work(t)
  const session = new BrowserSession(scopedAgent({ session: { header: { id: 'failed-download', cwd: root } } }), { root, keyProvider })
  session.control = 'user'; session.downloadArm = { until: Date.now() + 1000 }
  let deleted = false
  const download = { createReadStream: async () => [Buffer.from('partial-file')], failure: async () => 'interrupted', delete: async () => { deleted = true } }
  await assert.rejects(session.receiveDownload(download), /Download failed/)
  assert.equal(session.artifacts.items.length, 0); assert.equal(deleted, true)
  await session.dispose()
})

test('tab recovery keeps failed and unattempted URLs and does not replay successful ones', async t => {
  const root = await work(t)
  const session = new BrowserSession(scopedAgent({ session: { header: { id: 'recover-failure' } } }), { root, keyProvider })
  session.recoverable = ['https://example.com/one', 'https://example.com/two', 'https://example.com/three']
  session.ensureContext = async () => {}
  const calls = []; let fail = true
  session.newTab = async url => { calls.push(url); if (fail && url.endsWith('two')) throw new Error('offline') }
  await assert.rejects(session.userAction('recoverTabs', {}), /offline/)
  assert.deepEqual(session.recoverable, ['https://example.com/two', 'https://example.com/three'])
  fail = false; await session.userAction('recoverTabs', {})
  assert.deepEqual(calls, ['https://example.com/one', 'https://example.com/two', 'https://example.com/two', 'https://example.com/three'])
  assert.equal(session.recoverable.length, 0); await session.dispose()
})

test('recording reaches its time cap even while the session is busy and has no active page', async t => {
  const root = await work(t)
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const child = new EventEmitter(); child.stdin = new EventEmitter(); let ended = false
  child.stdin.end = () => { ended = true }; child.kill = () => { child.emit('close', 0) }
  const recorder = new BrowserRecorder({ running: true, page: () => null }, root, join(root, 'unused.webm'), child)
  t.mock.timers.tick(15 * 60_000); await Promise.resolve()
  assert.equal(recorder.limitReached, true); assert.equal(ended, true)
  await recorder.stop({ discard: true })
})

test('backend facts expose limits and missing installation without leaking paths', async t => {
  const root = await work(t)
  const capabilities = backendCapabilities('camoufox')
  assert.equal(capabilities.family, 'firefox'); assert.equal(capabilities.driverVersion, '1.62.0')
  assert.equal(capabilities.stream, 'jpeg-poll'); assert.equal(capabilities.anonymityGuarantee, false)
  const result = await backendAvailability('camoufox', root)
  assert.equal(result.installed, false); assert.equal(JSON.stringify(result).includes(root), false)
  for (const id of ['camoufox', 'recorder']) {
    const directory = join(root, 'backends', id); await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({ version: 1, sdkVersion: '0.5.8', driverVersion: id === 'camoufox' ? '1.62.0' : '1.64.1', sha256: 'f'.repeat(64), executable: join(root, 'missing.exe') }))
  }
  assert.equal((await backendAvailability('camoufox', root)).installed, false)
  assert.equal((await recorderAvailability(root)).installed, false)
})

test('authenticated frame stream parser handles split messages and rejects malformed identity', async () => {
  const encoder = new TextEncoder()
  const frame = { frameId: 'f', tabId: 't', viewport: { width: 640, height: 480 }, image: Buffer.from('image').toString('base64') }
  const event = `data: ${JSON.stringify(frame)}\n\n`
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(event.slice(0, 25))); controller.enqueue(encoder.encode(event.slice(25))); controller.close() } }), { headers: { 'content-type': 'text/event-stream' } })
  const received = []; await consumeBrowserStream(response, value => received.push(value), new AbortController().signal)
  assert.equal(received.length, 1); assert.equal(received[0].blob.size, 5)
  const invalid = new Response('data: {"frameId":"f"}\n\n', { headers: { 'content-type': 'text/event-stream' } })
  await assert.rejects(consumeBrowserStream(invalid, () => {}, new AbortController().signal), /identity/)
})
