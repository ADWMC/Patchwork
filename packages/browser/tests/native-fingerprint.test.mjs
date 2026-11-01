import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserProfiles } from '../src/browser/profiles.mjs'
import { BrowserSession } from '../src/browser/session.mjs'
import { BrowserResources } from '../src/browser/resources.mjs'
import { ComponentInstaller } from '../src/browser/components/installer.mjs'
import { readComponent } from '../src/browser/components/store.mjs'
import { ALIASMODE_BROWSER_VERSION } from '../src/browser/components/catalog.mjs'
import { createNativeIdentity, validateNativeIdentity, nativeLaunchArgs, assertNativeEngineVersion } from '../src/browser/native-identity.mjs'
import { safeBrowserError } from '../src/browser/policy.mjs'
import { scopedAgent } from './helpers/agent.mjs'

const keyProvider = async () => Buffer.alloc(32, 53)
const nativeInput = { name: 'Native A', mode: 'fingerprint', backend: 'aliasmode', persistStorage: true }
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-native-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const agent = scopedAgent({ session: { header: { id: 'native-test' } } })
  const store = new BrowserProfiles(agent, { root, keyProvider, generateFingerprint() { throw new Error('JS generator must not be used') } })
  return { root, agent, store }
}

test('native identity accepts only the pinned schema and positive uint32 seed', () => {
  const identity = createNativeIdentity()
  assert.deepEqual(validateNativeIdentity(identity), identity)
  for (const change of [{ seed: '0' }, { seed: '4294967296' }, { seed: '01' }, { seed: 1 }, { seed: '1 --no-sandbox' }, { platform: 'linux' }, { release: 'latest' }, { schema: 'other' }, { extra: true }]) {
    assert.throws(() => validateNativeIdentity({ ...identity, ...change }), /Invalid or incompatible/)
  }
  assertNativeEngineVersion(ALIASMODE_BROWSER_VERSION)
  assert.throws(() => assertNativeEngineVersion('155.0.8059.84'), /version differs/)
  const profile = { ...nativeInput, engineIdentity: identity, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', screen: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
  assert.ok(nativeLaunchArgs(profile).includes(`--fingerprint=${identity.seed}`))
  assert.ok(nativeLaunchArgs(profile).includes('--fingerprint-noise'))
  for (const deviceScaleFactor of [1, 1.25, 2, 3]) assert.ok(nativeLaunchArgs({ ...profile, deviceScaleFactor }).includes(`--force-device-scale-factor=${deviceScaleFactor}`))
  for (const deviceScaleFactor of [undefined, 0, 3.1, NaN, Infinity, '1 --no-sandbox']) assert.throws(() => nativeLaunchArgs({ ...profile, deviceScaleFactor }), /pixel ratio/)
  for (const change of [{ backend: 'chromium' }, { fingerprint: {} }, { locale: 'en-US --flag' }, { screen: { width: 0, height: 1080 } }]) assert.throws(() => nativeLaunchArgs({ ...profile, ...change }))
  assert.equal(safeBrowserError(new Error(`launch --fingerprint=${identity.seed} --fingerprint-timezone=Asia/Shanghai`)).includes(identity.seed), false)
})

test('native profiles persist seeds, hide them from users/models and keep regional edits stable', async t => {
  const { store, root, agent } = await fixture(t)
  let db = await store.edit({ action: 'createProfile', revision: 0, profile: nativeInput })
  const first = db.profiles.at(-1), raw = await store.get(first.id)
  assert.equal(first.fingerprintKind, 'native-engine'); assert.equal(first.identitySchema, 2)
  for (const output of [db, await store.list(), await store.list({ forUser: true })]) {
    assert.equal(JSON.stringify(output).includes('engineIdentity'), false)
    assert.equal(JSON.stringify(output).includes('"seed"'), false)
  }
  const reloaded = new BrowserProfiles(agent, { root, keyProvider })
  assert.deepEqual((await reloaded.get(first.id)).engineIdentity, raw.engineIdentity)
  db = await store.edit({ action: 'updateProfile', revision: 1, profileId: first.id, profile: { locale: 'en-US', timezoneId: 'America/New_York' } })
  assert.equal(db.profiles.at(-1).fingerprintId, first.fingerprintId)
  assert.equal(db.profiles.at(-1).identityRevision, 1)
  assert.deepEqual((await store.get(first.id)).engineIdentity, raw.engineIdentity)
  db = await store.edit({ action: 'updateProfile', revision: 2, profileId: first.id, profile: { deviceScaleFactor: 2 } })
  assert.notEqual(db.profiles.at(-1).fingerprintId, first.fingerprintId)
  assert.equal(db.profiles.at(-1).identityRevision, 2)
  for (const profile of [{ engineIdentity: raw.engineIdentity }, { seed: '1' }, { mode: 'device' }, { backend: 'chromium' }]) await assert.rejects(store.edit({ action: 'updateProfile', revision: 3, profileId: first.id, profile }), /Unknown|identity kind|native fingerprint mode/)
})

test('replacement does not invoke JS generation, mutate the source or copy encrypted login', async t => {
  const { store, root, agent } = await fixture(t)
  let db = await store.edit({ action: 'createProfile', revision: 0, profile: nativeInput })
  const source = await store.get(db.profiles.at(-1).id)
  const state = { cookies: [{ name: 'login', value: 'source-only' }], origins: [] }
  await store.saveStorage(source, { storageState: async () => state })
  db = await store.edit({ action: 'regenerateProfile', revision: 1, profileId: source.id })
  const replacement = await store.get(db.profiles.at(-1).id)
  assert.notEqual(replacement.id, source.id); assert.notEqual(replacement.engineIdentity.seed, source.engineIdentity.seed)
  assert.equal(await store.readStorage(replacement), undefined)
  assert.deepEqual(await store.readStorage(source), state)
  assert.deepEqual(await store.get(source.id), source)
  const foreign = new BrowserProfiles(scopedAgent({ session: { header: { id: 'other' } } }), { root, keyProvider })
  await assert.rejects(foreign.get(source.id), /does not belong/)
  const session = new BrowserSession(agent, { root, keyProvider }); t.after(() => session.dispose())
  for (const action of ['createProfile', 'updateProfile', 'regenerateProfile', 'deleteProfile']) await assert.rejects(session.action('agent', { action, profileId: source.id, revision: 2, profile: nativeInput }), /requires the user panel/)
})

test('tampered or mixed native databases are refused rather than downgraded', async t => {
  const { store } = await fixture(t)
  await store.edit({ action: 'createProfile', revision: 0, profile: nativeInput })
  const path = join(store.path, 'profiles.json'), original = await readFile(path, 'utf8')
  for (const mutate of [p => { p.engineIdentity.seed = '0' }, p => { p.fingerprint = {} }, p => { p.backend = 'chromium' }]) {
    const db = JSON.parse(original); mutate(db.profiles[0]); await writeFile(path, JSON.stringify(db))
    await assert.rejects(store.list(), /native|Native|Invalid/)
  }
})

// Fake engines below test lifecycle failures only. Real Chromium verification is
// recorded separately and never inferred from these doubles.
function fakeEngine(options, state) {
  const browser = new EventEmitter(), contexts = new Set()
  let connected = true
  state.live++; state.peak = Math.max(state.peak, state.live)
  browser.isConnected = () => connected
  browser.version = () => options.backend === 'aliasmode' ? state.nativeVersion ?? ALIASMODE_BROWSER_VERSION : '156.0.0.0'
  browser.close = async () => { if (!connected) return; for (const c of [...contexts]) await c.close(); connected = false; state.live--; browser.emit('disconnected') }
  browser.newContext = async init => {
    const context = new EventEmitter(), pages = new Set()
    context.initialStorage = structuredClone(init.storageState)
    context.storageState = async () => init.storageState ?? { cookies: [], origins: [] }
    context.route = async () => {}
    context.close = async () => { for (const p of [...pages]) await p.close(); contexts.delete(context); context.emit('close') }
    context.newPage = async () => {
      const page = new EventEmitter(); let url = 'about:blank'
      page.url = () => url; page.viewportSize = () => init.viewport; page.setDefaultTimeout = () => {}
      page.title = async () => 'test'; page.locator = () => ({ ariaSnapshot: async () => 'test' })
      page.goto = async next => { url = next }
      page.close = async () => { pages.delete(page); page.emit('close') }
      pages.add(page); context.emit('page', page); return page
    }
    contexts.add(context); return context
  }
  return browser
}

async function lifecycle(t, { install = true } = {}) {
  const f = await fixture(t)
  if (install) await new ComponentInstaller(f.root, { prepare: async (_, dir) => { await writeFile(join(dir, 'engine.bin'), 'lifecycle-fixture'); return { executable: 'engine.bin' } } }).install('aliasmode')
  const state = { live: 0, peak: 0, calls: [], fail: false, beforeLaunch: null }
  const resources = new BrowserResources(); t.after(() => resources.dispose())
  const session = new BrowserSession(f.agent, { root: f.root, keyProvider, resources, resourcePolicy: { maxInstances: 1 }, launch: async options => {
    state.calls.push(options)
    if (state.fail && options.backend === 'aliasmode') { state.fail = false; throw new Error('injected launch failure --fingerprint=123456789') }
    await state.beforeLaunch?.(options)
    return fakeEngine(options, state)
  } })
  t.after(() => session.dispose())
  const db = await session.profiles.edit({ action: 'createProfile', revision: 0, profile: nativeInput })
  const target = db.profiles.at(-1)
  await session.ensurePage(); await session.page().goto('https://example.com/source')
  return { ...f, session, state, resources, target }
}

test('missing or corrupted components fail preflight without closing the source', async t => {
  const f = await lifecycle(t, { install: false }), source = f.session.page()
  await assert.rejects(f.session.useProfile(f.target.id), /安装/)
  assert.equal(f.session.page(), source); assert.equal(f.state.live, 1)
})

test('integrity mismatch fails preflight without replacing the source engine', async t => {
  const f = await lifecycle(t), source = f.session.page()
  const component = await readComponent(f.root, 'aliasmode')
  await writeFile(component.executable, 'tampered')
  await assert.rejects(f.session.useProfile(f.target.id), /integrity mismatch/)
  assert.equal(f.session.page(), source); assert.equal(f.state.calls.length, 1)
})

test('native switching restarts one process and never applies source storage to the target', async t => {
  const { session, state, resources, target } = await lifecycle(t)
  await session.useProfile(target.id)
  assert.equal(session.profileId, target.id); assert.equal(state.peak, 1); assert.equal(state.live, 1)
  assert.equal(resources.aggregate().running, 1)
  assert.equal(session.context.initialStorage, undefined)
  assert.equal(state.calls.at(-1).nativeProfile.id, target.id)
  await session.useProfile('native')
  assert.equal(session.profileId, 'native'); assert.equal(state.peak, 1)
})

test('failed native launch restores the original identity, URLs and temporary login', async t => {
  const { session, state, target } = await lifecycle(t)
  const storage = { cookies: [{ name: 'login', value: 'temporary-original' }], origins: [] }
  session.context.storageState = async () => storage
  state.fail = true
  await assert.rejects(session.useProfile(target.id), error => /已重新打开原环境/.test(error.message) && !error.message.includes('123456789'))
  assert.equal(session.profileId, 'native'); assert.equal(session.page().url(), 'https://example.com/source')
  assert.deepEqual(session.context.initialStorage, storage)
  assert.equal(state.live, 1); assert.equal(state.peak, 1)
  assert.equal(await session.profiles.readStorage(await session.profiles.get(target.id)), undefined)
})

test('an unqualified native engine version closes the target before rolling back', async t => {
  const { session, state, target, resources } = await lifecycle(t)
  state.nativeVersion = '155.0.8059.84'
  await assert.rejects(session.useProfile(target.id), /已重新打开原环境.*version differs/)
  assert.equal(session.profileId, 'native'); assert.equal(session.page().url(), 'https://example.com/source')
  assert.equal(state.live, 1); assert.equal(state.peak, 1); assert.equal(resources.aggregate().running, 1)
})

test('revocation during native launch closes the late engine and releases all reservations', async t => {
  const { session, agent, state, resources, target } = await lifecycle(t)
  state.beforeLaunch = async options => { if (options.backend === 'aliasmode') agent.selectPreset('standard') }
  await assert.rejects(session.useProfile(target.id), /browser|Browser|authorized|scope|授权/)
  assert.equal(state.live, 0); assert.equal(resources.aggregate().running, 0)
  assert.equal(session.context, null)
})

test('cancellation during native launch cannot report success or reopen the previous engine', async t => {
  const { session, state, resources, target } = await lifecycle(t)
  const controller = new AbortController()
  state.beforeLaunch = async options => { if (options.backend === 'aliasmode') controller.abort(new Error('cancel native switch')) }
  await assert.rejects(session.action('user', { action: 'useProfile', profileId: target.id }, { signal: controller.signal }), /cancel native switch/)
  assert.equal(state.live, 0); assert.equal(resources.aggregate().running, 0)
  assert.equal(state.calls.length, 2); assert.equal(session.context, null)
})

test('double startup failure preserves recovery URLs without a live engine', async t => {
  const { session, state, target, resources } = await lifecycle(t)
  state.beforeLaunch = async () => { throw new Error('all starts failed') }
  await assert.rejects(session.useProfile(target.id), /原环境暂未恢复/)
  assert.deepEqual(session.recoverable, ['https://example.com/source'])
  assert.equal(session.profileId, 'native'); assert.equal(state.live, 0)
  assert.equal(resources.aggregate().running, 0)
})
