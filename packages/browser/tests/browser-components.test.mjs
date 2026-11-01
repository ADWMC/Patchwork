import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, symlink, access, cp } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { ComponentInstaller } from '../src/browser/components/installer.mjs'
import { COMPONENTS, camoufoxAsset, aliasmodeAsset } from '../src/browser/components/catalog.mjs'
import { readComponent, readPointer, leaseComponent, guarded, safeRelative, hashFile } from '../src/browser/components/store.mjs'
import { checkedDownloadUrl, downloadFile } from '../src/browser/components/network.mjs'
import { extractZip } from '../src/browser/components/extract.mjs'
import { installerEnvironment, runInstaller } from '../src/browser/components/process.mjs'
import { backendAvailability, launchBackend } from '../src/browser/backends.mjs'
import { BrowserRecorder, recorderAvailability } from '../src/browser/recording.mjs'

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-components-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  let generation = 0
  const installer = new ComponentInstaller(root, { prepare: async (_spec, directory) => {
    await writeFile(join(directory, 'engine.bin'), 'fixture-' + ++generation)
    return { executable: 'engine.bin', provenance: { kind: 'test-fixture' } }
  }, ...options })
  return { root, installer }
}

test('catalog pins component/SDK pairs and all six release assets; no arbitrary component or implicit home', async t => {
  assert.deepEqual(Object.keys(COMPONENTS), ['chromium', 'recorder', 'camoufox', 'aliasmode'])
  assert.match(aliasmodeAsset('win32', 'x64').sha256, /^[a-f0-9]{64}$/)
  assert.equal(aliasmodeAsset('win32', 'x64').bytes, 203519527)
  assert.throws(() => aliasmodeAsset('linux', 'x64'), /Windows x64/)
  assert.throws(() => new ComponentInstaller('.'), /absolute/)
  const { installer } = await fixture(t)
  await assert.rejects(installer.install('../other'), /component/i)
  for (const [platform, arch] of [['win32', 'x64'], ['win32', 'ia32'], ['linux', 'x64'], ['linux', 'arm64'], ['darwin', 'x64'], ['darwin', 'arm64']]) {
    const asset = camoufoxAsset(platform, arch)
    assert.match(asset.url, /v156\.0\.1-beta\.36/); assert.match(asset.sha256, /^[a-f0-9]{64}$/); assert.ok(asset.bytes > 1_000_000)
  }
  const env = { ...process.env }; delete env.DSH_HOME
  assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/browser-components.mjs', import.meta.url)), 'install', 'recorder'], { env, stdio: 'pipe' }), /absolute --home/)
  assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/setup-browser-recorder.mjs', import.meta.url))], { env, stdio: 'pipe' }), /absolute --home/)
  assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/setup-browser-backend.mjs', import.meta.url))], { env, stdio: 'pipe' }), /absolute --home/)
})

test('download, offline install, verify, replacement, rollback, remove and cache cleanup form a complete lifecycle', async t => {
  const { root, installer } = await fixture(t)
  await assert.rejects(installer.install('recorder', { offline: true }), /download first/)
  assert.equal((await installer.download('recorder')).reused, false)
  assert.equal((await installer.download('recorder')).reused, true)
  assert.equal(await readComponent(root, 'recorder'), null)
  await installer.install('recorder', { offline: true })
  const first = await readComponent(root, 'recorder', { verify: true })
  assert.equal((await installer.install('recorder')).reused, true)
  assert.equal((await installer.verify('recorder')).files, 1)
  assert.equal(await installer.cached('recorder'), null)
  await installer.download('recorder'); await installer.install('recorder', { offline: true, replace: true })
  const second = await readComponent(root, 'recorder'); assert.notEqual(first.selection, second.selection)
  await installer.rollback('recorder'); assert.equal((await readComponent(root, 'recorder')).selection, first.selection)
  await installer.rollback('recorder'); assert.equal((await readComponent(root, 'recorder')).selection, second.selection)
  await installer.download('recorder'); await installer.install('recorder', { offline: true, replace: true })
  await assert.rejects(access(first.directory), /ENOENT/)
  await mkdir(join(root, 'profiles/user-data'), { recursive: true }); await writeFile(join(root, 'profiles/user-data/keep'), 'login')
  await installer.remove('recorder'); assert.equal((await readComponent(root, 'recorder')).installed, false)
  await assert.rejects(installer.verify('recorder'), /not installed/)
  assert.equal(await readFile(join(root, 'profiles/user-data/keep'), 'utf8'), 'login')
  await installer.download('recorder'); await installer.cleanCache('recorder'); assert.equal(await installer.cached('recorder'), null)
})

test('failed refresh and cancellation leave the selected version and prior verified download intact', async t => {
  const { root, installer } = await fixture(t)
  await installer.install('chromium'); const pointer = await readPointer(root, 'chromium')
  await installer.download('chromium'); const cached = await installer.cached('chromium')
  const broken = new ComponentInstaller(root, { prepare: async (_s, d) => { await writeFile(join(d, 'partial'), 'partial'); throw new Error('download interrupted') } })
  await assert.rejects(broken.download('chromium', { refresh: true }), /interrupted/)
  assert.deepEqual(await readPointer(root, 'chromium'), pointer)
  assert.deepEqual((await installer.cached('chromium')).manifest, cached.manifest)
  assert.deepEqual((await readdir(join(root, 'component-downloads'))).filter(n => n.startsWith('.staging')), [])
  const controller = new AbortController()
  const cancelled = new ComponentInstaller(root, { signal: controller.signal, prepare: async (_s, d) => { await writeFile(join(d, 'engine.bin'), 'new'); controller.abort(new Error('cancelled')); return { executable: 'engine.bin' } } })
  await assert.rejects(cancelled.download('chromium', { refresh: true }), /cancelled/)
  assert.deepEqual(await readPointer(root, 'chromium'), pointer)
  assert.equal((await installer.verify('chromium')).state, 'verified')
})

test('complete inventories reject modified bytes, added files and mismatched manifests before activation', async t => {
  const { root, installer } = await fixture(t)
  await installer.download('recorder'); let cached = await installer.cached('recorder')
  await writeFile(join(cached.path, 'engine.bin'), 'tampered')
  await assert.rejects(installer.install('recorder', { offline: true }), /integrity mismatch/)
  await installer.download('recorder', { refresh: true }); cached = await installer.cached('recorder')
  await writeFile(join(cached.path, 'extra'), 'x'); await assert.rejects(installer.cached('recorder'), /integrity mismatch/)
  await installer.download('recorder', { refresh: true }); cached = await installer.cached('recorder')
  await writeFile(join(cached.path, 'manifest.json'), JSON.stringify({ ...cached.manifest, driverVersion: '0.0.0' }))
  await assert.rejects(installer.install('recorder', { offline: true }), /catalog/)
  assert.equal(await readComponent(root, 'recorder'), null)
})

test('failure after moving a download restores it without changing the active pointer or leaving a locked installer', async t => {
  const { root, installer } = await fixture(t)
  await installer.install('recorder'); const pointer = await readPointer(root, 'recorder'); await installer.download('recorder')
  const versions = join(root, 'components/recorder/versions'), interrupted = new ComponentInstaller(root)
  interrupted.check = () => { if (readdirSync(versions).length > 1) throw new Error('cancelled after move') }
  await assert.rejects(interrupted.install('recorder', { offline: true, replace: true }), /cancelled after move/)
  assert.deepEqual(await readPointer(root, 'recorder'), pointer)
  assert.ok(await installer.cached('recorder')); assert.equal((await readdir(versions)).length, 1)
  await installer.install('recorder', { offline: true, replace: true }); await installer.verify('recorder')
})

test('successful activation recovers an installer-owned orphan and clean-cache handles interrupted download staging', async t => {
  const { root, installer } = await fixture(t)
  await installer.install('recorder'); const first = await readComponent(root, 'recorder')
  const orphan = join(root, 'components/recorder/versions', randomUUID()); await cp(first.directory, orphan, { recursive: true })
  await installer.download('recorder'); await installer.install('recorder', { offline: true, replace: true })
  await assert.rejects(access(orphan), /ENOENT/); await access(first.directory)
  const staging = join(root, 'component-downloads/.staging-recorder-' + randomUUID()); await mkdir(staging)
  const other = join(root, 'component-downloads/.staging-chromium-' + randomUUID()); await mkdir(other)
  await installer.cleanCache('recorder'); await assert.rejects(access(staging), /ENOENT/); await access(other)
})

test('parallel readers block replacement, rollback and removal without closing or interfering with readers', async t => {
  const { root, installer } = await fixture(t)
  await installer.install('recorder'); await installer.download('recorder')
  const a = await leaseComponent(root, 'recorder'), b = await leaseComponent(root, 'recorder')
  t.after(a); t.after(b)
  for (const action of [() => installer.install('recorder', { offline: true, replace: true }), () => installer.remove('recorder'), () => installer.rollback('recorder')]) await assert.rejects(action(), /正在使用/)
  await a(); await assert.rejects(installer.remove('recorder'), /正在使用/)
  await b(); await installer.install('recorder', { offline: true, replace: true }); await installer.remove('recorder')
})

test('backend and recorder startup failures release runtime leases and tombstones suppress legacy fallback', async t => {
  const { root, installer } = await fixture(t)
  await installer.install('chromium'); assert.equal((await backendAvailability('chromium-portable', root)).installed, true)
  await assert.rejects(launchBackend({ backend: 'chromium-portable', root }), /launch|spawn/i)
  await installer.remove('chromium')
  await installer.install('recorder')
  const component = await readComponent(root, 'recorder'); await writeFile(component.executable, 'tampered')
  await assert.rejects(BrowserRecorder.start({ root, page: () => ({}) }), /integrity/)
  await installer.remove('recorder')
  assert.equal((await recorderAvailability(root)).installed, false)
  assert.equal((await backendAvailability('chromium-portable', root)).installed, false)
})

test('an encoder spawn error releases its process lifetime lease before removal', async t => {
  const { root, installer } = await fixture(t); await installer.install('recorder')
  let recorder
  try { recorder = await BrowserRecorder.start({ root, profiles: { path: root }, page: () => ({ viewportSize: () => ({ width: 320, height: 240 }) }) }) }
  catch (error) { assert.match(error.code, /EFTYPE|ENOEXEC|EACCES/) }
  if (recorder) { assert.notEqual(await recorder.exited, 0); await recorder.stop({ discard: true }) }
  await installer.remove('recorder'); assert.equal((await readdir(root)).some(name => name.startsWith('recording-')), false)
})

test('component boundaries reject traversal and external directory links', async t => {
  for (const path of ['../x', 'a/../x', '/x', 'C:/x', 'a\\..\\x', 'a//x', 'a\u0000b']) assert.throws(() => safeRelative(path), /Unsafe/)
  const { root, installer } = await fixture(t)
  await assert.rejects(guarded(root, join(root, '..', 'outside')), /escapes/)
  const outside = await mkdtemp(join(tmpdir(), 'component-outside-')); t.after(() => rm(outside, { recursive: true, force: true }))
  await symlink(outside, join(root, 'component-downloads'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(installer.download('recorder'), /external link/)
  assert.deepEqual(await readdir(outside), [])
})

const payload = Buffer.from('verified official asset fixture')
const asset = { url: 'https://github.com/daijro/camoufox/releases/download/pin/test.zip', bytes: payload.length, sha256: createHash('sha256').update(payload).digest('hex') }
function response(buffer = payload) { const r = Readable.from([buffer]); r.headers = { 'content-length': String(buffer.length) }; return r }

test('download streams exact bytes and checksum; network interruption retries but integrity mismatch does not', async t => {
  const { root } = await fixture(t), target = join(root, 'asset.zip'); let calls = 0
  await downloadFile(asset, target, { open: async () => { if (++calls === 1) throw new Error('ECONNRESET'); return response() } })
  assert.equal(calls, 2); assert.equal(await hashFile(target), asset.sha256)
  calls = 0
  await assert.rejects(downloadFile({ ...asset, sha256: '0'.repeat(64) }, target, { open: async () => { calls++; return response() } }), /SHA256/)
  assert.equal(calls, 1); assert.equal(await hashFile(target), asset.sha256)
  await assert.rejects(access(target + '.part'), /ENOENT/)
  await assert.rejects(downloadFile(asset, target, { open: async () => response(Buffer.from('wrong-size')) }), /size/)
})

test('cancelled stream removes partial data and preserves the prior complete asset', async t => {
  const { root } = await fixture(t), target = join(root, 'asset.zip'), controller = new AbortController()
  await writeFile(target, 'previous')
  await assert.rejects(downloadFile(asset, target, { signal: controller.signal, open: async () => {
    const stream = new Readable({ read() { this.push(payload.subarray(0, 3)); controller.abort(new Error('cancelled')) } }); stream.headers = {}; return stream
  } }), /abort|cancelled/i)
  assert.equal(await readFile(target, 'utf8'), 'previous'); await assert.rejects(access(target + '.part'), /ENOENT/)
})

test('only pinned HTTPS release hosts can enter the custom downloader', () => {
  for (const url of ['http://github.com/a', 'https://github.com.evil.test/a', 'https://user:pass@github.com/a', 'https://github.com:444/a', 'https://127.0.0.1/a', 'file:///tmp/x']) assert.throws(() => checkedDownloadUrl(url), /origin/)
  assert.equal(checkedDownloadUrl(asset.url), asset.url)
})

// Small stored ZIP fixtures, with real central-directory lengths and CRC32.
function zip(entries) {
  let offset = 0; const local = [], central = []
  for (const [path, value, mode = 0o100644] of entries) {
    const name = Buffer.from(path), body = Buffer.from(value); let crc = 0xffffffff
    for (const b of body) { crc ^= b; for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0) } crc = (crc ^ 0xffffffff) >>> 0
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(body.length, 22); h.writeUInt16LE(name.length, 26)
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(0x0314, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(body.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE((mode << 16) >>> 0, 38); c.writeUInt32LE(offset, 42)
    local.push(h, name, body); central.push(c, name); offset += h.length + name.length + body.length
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, cd, end])
}

test('lazy ZIP extraction writes files without accepting traversal, duplicates, external links or excessive expansion', async t => {
  const { root } = await fixture(t), archive = join(root, 'test.zip')
  await writeFile(archive, zip([['sub/engine', 'binary']])); await extractZip(archive, join(root, 'valid'))
  assert.equal(await readFile(join(root, 'valid/sub/engine'), 'utf8'), 'binary')
  const cases = [
    { entries: [['../outside', 'bad']], error: /invalid|Unsafe/i },
    { entries: [['same', 'a'], ['same', 'b']], error: /EEXIST/ },
    { entries: [['escape', '../../outside', 0o120777]], error: /escapes/ },
    { entries: [['large', '123456789']], options: { maxBytes: 8 }, error: /limits/ },
    { entries: [['a', 'a'], ['b', 'b']], options: { maxEntries: 1 }, error: /limits/ },
  ]
  for (const [i, c] of cases.entries()) { await writeFile(archive, zip(c.entries)); await assert.rejects(extractZip(archive, join(root, 'bad-' + i), c.options), c.error) }
  const controller = new AbortController(); controller.abort(new Error('cancelled'))
  await assert.rejects(extractZip(archive, join(root, 'cancelled'), { signal: controller.signal }), /cancelled/)
})

test('upstream installers inherit no model credentials and keep caches inside the staging directory', async t => {
  const { root } = await fixture(t), previous = process.env.PATCHWORK_MODEL_API_KEY
  process.env.PATCHWORK_MODEL_API_KEY = 'private-sentinel'
  try { const env = installerEnvironment(root, 'http://127.0.0.1:7897'); assert.equal(env.PATCHWORK_MODEL_API_KEY, undefined); assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, join(root, 'cache')); assert.equal(env.HTTPS_PROXY, 'http://127.0.0.1:7897') }
  finally { if (previous === undefined) delete process.env.PATCHWORK_MODEL_API_KEY; else process.env.PATCHWORK_MODEL_API_KEY = previous }
  assert.equal(await runInstaller(['-e', 'process.stdout.write("ok")'], { env: installerEnvironment(root), capture: true }), 'ok')
})

test('cancelling an upstream installer stops its child download worker as well', async t => {
  const { root } = await fixture(t), controller = new AbortController(); let pid
  const script = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000)`
  await assert.rejects(runInstaller(['-e', script], { env: installerEnvironment(root), signal: controller.signal, onProgress(event) { pid = Number(event.message.trim()); controller.abort(new Error('cancelled')) } }), /cancelled/)
  assert.ok(Number.isSafeInteger(pid) && pid > 0)
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
})
