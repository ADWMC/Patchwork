import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { createRequire } from 'node:module'
import { requireBrowserAgent } from '../scope.mjs'
import { boundedText, dimensions } from './policy.mjs'
import { identityId, preserveDeviceLocale } from './identity.mjs'
import { acquireLease } from './lease.mjs'
import { storageKey, sealStorage, openStorage } from './storage-crypto.mjs'
import { createNativeIdentity, validateNativeIdentity } from './native-identity.mjs'
import { ALIASMODE_BROWSER_VERSION } from './components/catalog.mjs'

export const MAX_PROFILES = 8
const MAX_DATABASE = 512 * 1024
const MAX_STORAGE = 2 * 1024 * 1024
const ID = /^[a-f0-9-]{36}$/
const MODES = ['native', 'device', 'fingerprint']
const nativeProfile = Object.freeze({ id: 'native', name: '临时环境', mode: 'native', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', colorScheme: 'light', viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 }, deviceScaleFactor: 1, persistStorage: false, proxy: null })

export function browserProfilesRoot() {
  return process.env.DSH_HOME ? join(process.env.DSH_HOME, 'patchwork', 'browser') : dshHomePath('patchwork', 'browser')
}

function normalizeProxy(raw) {
  if (raw == null || raw === '') return null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid proxy configuration')
  if (Object.keys(raw).some(key => !['server', 'usernameEnv', 'passwordEnv'].includes(key))) throw new Error('Unknown proxy field')
  let url
  try { url = new URL(boundedText(raw.server, 'Proxy server', 500)) } catch { throw new Error('Invalid proxy server') }
  // URL normalizes explicit HTTP :80 / HTTPS :443 to an empty port.
  if (!['http:', 'https:', 'socks5:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== '/' && url.pathname !== '' || url.search || url.hash || url.protocol === 'socks5:' && !url.port) {
    throw new Error('Proxy requires HTTP(S) host or SOCKS5 host:port without embedded credentials or path')
  }
  const result = { server: url.origin === 'null' ? `socks5://${url.host}` : url.origin }
  for (const key of ['usernameEnv', 'passwordEnv']) {
    if (raw[key]) {
      if (typeof raw[key] !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(raw[key])) throw new Error('Proxy credential references must be environment variable names')
      result[key] = raw[key]
    }
  }
  if (url.protocol === 'socks5:' && (result.usernameEnv || result.passwordEnv)) throw new Error('This Chromium backend does not support SOCKS5 authentication')
  return result
}

function validateProfile(input, previous) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Profile must be an object')
  const keys = ['name', 'mode', 'locale', 'timezoneId', 'colorScheme', 'viewport', 'screen', 'deviceScaleFactor', 'persistStorage', 'proxy', 'backend']
  if (Object.keys(input).some(key => !keys.includes(key))) throw new Error('Unknown browser profile field')
  const merged = { ...nativeProfile, ...previous, ...input }
  const name = boundedText(merged.name?.trim(), 'Profile name', 60)
  if (!MODES.includes(merged.mode)) throw new Error('Unknown browser environment mode')
  const backend = merged.backend ?? 'chromium'
  if (!['chromium', 'chromium-portable', 'camoufox', 'aliasmode'].includes(backend)) throw new Error('Unsupported browser backend')
  if (backend === 'aliasmode' && merged.mode !== 'fingerprint') throw new Error('AliasMode must use native fingerprint mode; choose the system backend for native/device environments')
  if (previous && ((previous.backend === 'aliasmode') !== (backend === 'aliasmode') || previous.mode !== merged.mode)) throw new Error('Changing identity kind requires a new profile with separate login storage')
  if (backend === 'camoufox' && merged.mode === 'fingerprint') throw new Error('Chromium fingerprint samples cannot be applied to Firefox; use a native or device profile')
  let locale
  try { locale = Intl.getCanonicalLocales(boundedText(merged.locale, 'Locale', 40))[0] } catch { throw new Error('Invalid browser locale') }
  try { new Intl.DateTimeFormat(locale, { timeZone: merged.timezoneId }).format() } catch { throw new Error('Invalid browser timezone') }
  if (!['light', 'dark', 'no-preference'].includes(merged.colorScheme)) throw new Error('Invalid browser color scheme')
  if (typeof merged.persistStorage !== 'boolean') throw new Error('persistStorage must be boolean')
  const viewport = dimensions(merged.viewport)
  const screen = dimensions(merged.screen)
  if (screen.width < viewport.width || screen.height < viewport.height) throw new Error('Screen must contain the initial viewport')
  if (!Number.isFinite(merged.deviceScaleFactor) || merged.deviceScaleFactor < 1 || merged.deviceScaleFactor > 3) throw new Error('Device pixel ratio must be 1-3')
  return { name, mode: merged.mode, backend, locale, timezoneId: merged.timezoneId, colorScheme: merged.colorScheme, viewport, screen, deviceScaleFactor: merged.deviceScaleFactor, persistStorage: merged.persistStorage, proxy: normalizeProxy(merged.proxy) }
}

function generateDevice(profile) {
  const { FingerprintGenerator } = createRequire(import.meta.url)('fingerprint-generator')
  const sample = new FingerprintGenerator().getFingerprint({ browsers: [{ name: 'chrome' }], operatingSystems: [process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'], devices: ['desktop'], locales: [profile.locale], screen: { minWidth: profile.viewport.width, minHeight: profile.viewport.height, maxWidth: 2560, maxHeight: 1800 } })
  return sample
}

export function publicProfile(profile) {
  // No raw fingerprint, cookies, storage paths or credential references in model output.
  const { fingerprint, engineIdentity, proxy, ...clean } = profile
  return { ...clean, proxy: proxy ? { configured: true } : null, fingerprintId: identityId(profile), identityRevision: profile.identityRevision ?? 1, identitySchema: engineIdentity ? 2 : 1, ...(profile.mode === 'fingerprint' ? { fingerprintKind: engineIdentity ? 'native-engine' : 'js-injection', fingerprintBrowserMajor: engineIdentity ? Number(ALIASMODE_BROWSER_VERSION.split('.')[0]) : Number(fingerprint?.fingerprint?.navigator?.userAgent?.match(/Chrome\/(\d+)/)?.[1]) || null, ...(engineIdentity ? { engineRelease: engineIdentity.release } : {}) } : {}) }
}

export class BrowserProfiles {
  constructor(agent, { root = browserProfilesRoot(), isActive = () => true, keyProvider = storageKey, generateFingerprint = generateDevice } = {}) {
    this.agent = agent
    this.isActive = isActive
    this.keyProvider = keyProvider
    this.generateFingerprint = generateFingerprint
    this.path = join(root, createHash('sha256').update(agent.session.header.id).digest('hex'))
  }

  check() { requireBrowserAgent(this.agent); if (!this.isActive()) throw new Error('Patchwork browser session ended') }
  storagePath(id) { if (!ID.test(id)) throw new Error('Invalid browser profile id'); return join(this.path, `${id}.storage.json`) }
  encryptedPath(id) { this.storagePath(id); return join(this.path, `${id}.storage.enc.json`) }

  async lease(id) {
    this.check()
    await mkdir(this.path, { recursive: true, mode: 0o700 })
    if (id !== 'native') this.storagePath(id)
    return acquireLease(join(this.path, `${id}.runtime.lock`), { check: () => this.check() })
  }

  async read() {
    this.check()
    let text
    try { text = await readFile(join(this.path, 'profiles.json'), 'utf8') } catch (error) {
      if (error.code === 'ENOENT') return { revision: 0, profiles: [] }
      throw error
    }
    this.check()
    if (Buffer.byteLength(text) > MAX_DATABASE) throw new Error('Browser profiles exceed size limit')
    const data = JSON.parse(text)
    if (data.version !== 1 || !Number.isSafeInteger(data.revision) || !Array.isArray(data.profiles) || data.profiles.length > MAX_PROFILES) throw new Error('Invalid browser profile database')
    for (const profile of data.profiles) {
      if (!ID.test(profile.id)) throw new Error('Invalid browser profile id')
      validateProfile(Object.fromEntries(Object.entries(profile).filter(([key]) => !['id', 'fingerprint', 'engineIdentity', 'identityRevision', 'identitySchema'].includes(key))))
      if (profile.backend === 'aliasmode') {
        validateNativeIdentity(profile.engineIdentity)
        if (profile.fingerprint) throw new Error('Native fingerprint profiles cannot include JS samples')
      } else if (profile.engineIdentity) throw new Error('Native identity belongs only to the AliasMode backend')
    }
    return data
  }

  async list({ forUser = false } = {}) {
    const data = await this.read()
    return { revision: data.revision, profiles: [nativeProfile, ...data.profiles].map(profile => forUser ? { ...publicProfile(profile), proxy: profile.proxy } : publicProfile(profile)) }
  }

  async get(id) {
    if (!id || id === 'native') { this.check(); return { ...nativeProfile } }
    const profile = (await this.read()).profiles.find(item => item.id === id)
    if (!profile) throw new Error('Browser profile does not belong to this session')
    return profile
  }

  async edit({ action, profileId, profile, revision }) {
    return this.locked(async () => {
      const data = await this.read()
      if (!Number.isSafeInteger(revision) || revision !== data.revision) throw new Error('Browser profiles changed; refresh and retry')
      if (action === 'regenerateProfile') {
        if (data.profiles.length >= MAX_PROFILES) throw new Error(`At most ${MAX_PROFILES} browser profiles are allowed; remove an unused profile first`)
        const previous = data.profiles.find(item => item.id === profileId)
        if (!previous) throw new Error('Browser profile does not belong to this session')
        if (previous.mode === 'native') throw new Error('原生环境保留真实设备身份，请新增设备环境或完整指纹环境')
        let next
        for (let attempt = 0; attempt < 8; attempt++) {
          const value = validateProfile({ name: `${previous.name.slice(0, 54)} · 新身份` }, previous)
          if (value.backend === 'aliasmode') value.engineIdentity = createNativeIdentity()
          else {
            const sample = this.generateFingerprint(value)
            if (value.mode === 'fingerprint') value.fingerprint = sample
            else {
              value.screen = { width: sample.fingerprint.screen.width, height: sample.fingerprint.screen.height }
              value.deviceScaleFactor = Math.max(1, Math.min(3, sample.fingerprint.screen.devicePixelRatio))
            }
          }
          if (identityId(value) !== identityId(previous)) { next = value; break }
        }
        if (!next) throw new Error('没有生成不同的设备参数，请调整环境设置后重试；原环境保持不变')
        // A replacement receives a fresh storage namespace. Never combine a new
        // identity with the previous profile's cookies or mutate a running page.
        const id = randomUUID()
        data.profiles.push({ ...next, name: `${previous.name.slice(0, 40)} · 新身份 ${id.slice(0, 6)}`, id, identityRevision: 1, identitySchema: next.engineIdentity ? 2 : 1 })
      } else if (action === 'createProfile') {
        if (data.profiles.length >= MAX_PROFILES) throw new Error(`At most ${MAX_PROFILES} browser profiles are allowed`)
        const value = validateProfile(profile)
        if (value.backend === 'aliasmode') value.engineIdentity = createNativeIdentity()
        else if (value.mode !== 'native') {
          const sample = this.generateFingerprint(value)
          if (value.mode === 'device') {
            if (!Object.hasOwn(profile, 'screen')) value.screen = { width: sample.fingerprint.screen.width, height: sample.fingerprint.screen.height }
            if (!Object.hasOwn(profile, 'deviceScaleFactor')) value.deviceScaleFactor = Math.max(1, Math.min(3, sample.fingerprint.screen.devicePixelRatio))
          } else value.fingerprint = sample
        }
        data.profiles.push({ ...value, id: randomUUID(), identityRevision: 1, identitySchema: value.engineIdentity ? 2 : 1 })
      } else {
        const index = data.profiles.findIndex(item => item.id === profileId)
        if (index < 0) throw new Error('Browser profile does not belong to this session')
        const release = await this.lease(profileId)
        try {
        if (action === 'deleteProfile') {
          await rm(this.storagePath(profileId), { force: true })
          await rm(this.encryptedPath(profileId), { force: true })
          data.profiles.splice(index, 1)
        } else if (action === 'updateProfile') {
          const previous = data.profiles[index]
          const value = validateProfile(profile, previous)
          if (value.backend === 'aliasmode') value.engineIdentity = validateNativeIdentity(previous.engineIdentity)
          let fingerprint = previous.fingerprint
          if (value.mode === 'fingerprint' && value.backend !== 'aliasmode') fingerprint = fingerprint ? preserveDeviceLocale(fingerprint, value.locale) : this.generateFingerprint(value)
          if (!value.persistStorage) {
            await rm(this.storagePath(profileId), { force: true })
            await rm(this.encryptedPath(profileId), { force: true })
          }
          const next = { ...value, id: profileId, ...(value.mode === 'fingerprint' && value.backend !== 'aliasmode' ? { fingerprint } : {}) }
          next.identityRevision = (previous.identityRevision ?? 1) + (identityId(next) === identityId(previous) ? 0 : 1)
          next.identitySchema = value.engineIdentity ? 2 : 1
          data.profiles[index] = next
        } else throw new Error('Unsupported browser profile operation')
        data.revision++
        data.version = 1
        await this.atomicWrite(join(this.path, 'profiles.json'), data, MAX_DATABASE)
        return this.list({ forUser: true })
        } finally { await release() }
      }
      data.revision++
      data.version = 1
      await this.atomicWrite(join(this.path, 'profiles.json'), data, MAX_DATABASE)
      return this.list({ forUser: true })
    })
  }

  async locked(work) {
    this.check()
    await mkdir(this.path, { recursive: true, mode: 0o700 })
    const release = await acquireLease(join(this.path, 'profiles.lock'), { check: () => this.check() })
    try {
      return await work()
    } finally { await release() }
  }

  async atomicWrite(path, value, limit) {
    const text = JSON.stringify(value)
    if (Buffer.byteLength(text) > limit) throw new Error('Browser state exceeds size limit')
    this.check()
    await mkdir(this.path, { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, text, { mode: 0o600, flag: 'wx' })
      this.check()
      await rename(temporary, path)
    } finally { await rm(temporary, { force: true }) }
  }

  async readStorage(profile) {
    if (!profile.persistStorage || profile.id === 'native') return undefined
    this.check()
    let text, legacy = false
    try { text = await readFile(this.encryptedPath(profile.id), 'utf8') } catch (error) {
      if (error.code !== 'ENOENT') throw error
      try { text = await readFile(this.storagePath(profile.id), 'utf8'); legacy = true } catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
    }
    this.check()
    if (Buffer.byteLength(text) > MAX_STORAGE * 2) throw new Error('Browser storage exceeds size limit')
    const key = await this.keyProvider(this.path, () => this.check())
    let state
    try {
      state = legacy ? JSON.parse(text) : openStorage(JSON.parse(text), key, this.storageAAD(profile.id))
      if (!Array.isArray(state?.cookies) || !Array.isArray(state.origins)) throw new Error('Invalid saved browser storage')
      if (Buffer.byteLength(JSON.stringify(state)) > MAX_STORAGE) throw new Error('Browser storage exceeds size limit')
      if (legacy) await this.atomicWrite(this.encryptedPath(profile.id), sealStorage(state, key, this.storageAAD(profile.id)), MAX_STORAGE * 2)
      this.check()
      await rm(this.storagePath(profile.id), { force: true })
    } finally { key.fill(0) }
    if (!Array.isArray(state.cookies) || !Array.isArray(state.origins)) throw new Error('Invalid saved browser storage')
    return state
  }

  async saveStorage(profile, context) {
    if (!profile.persistStorage || profile.id === 'native') return
    // Recheck the current on-disk preference, including concurrent disabling/deletion.
    return this.locked(async () => {
      const current = await this.get(profile.id)
      if (current.persistStorage) {
        const state = await context.storageState({ indexedDB: true })
        if (Buffer.byteLength(JSON.stringify(state)) > MAX_STORAGE) throw new Error('Browser storage exceeds size limit')
        const key = await this.keyProvider(this.path, () => this.check())
        try { await this.atomicWrite(this.encryptedPath(profile.id), sealStorage(state, key, this.storageAAD(profile.id)), MAX_STORAGE * 2); await rm(this.storagePath(profile.id), { force: true }) }
        finally { key.fill(0) }
      }
    })
  }

  storageAAD(id) { return `patchwork/browser/storage/v1/${this.agent.session.header.id}/${id}` }

  async clearStorage(id) { return this.locked(async () => {
    this.check(); await this.get(id)
    const release = await this.lease(id)
    try { await rm(this.storagePath(id), { force: true }); await rm(this.encryptedPath(id), { force: true }); this.check() }
    finally { await release() }
  }) }
}

export function resolvedProxy(profile) {
  if (!profile.proxy) return undefined
  const result = { server: profile.proxy.server }
  for (const [field, ref] of [['username', 'usernameEnv'], ['password', 'passwordEnv']]) {
    const key = profile.proxy[ref]
    if (key) {
      if (!process.env[key]) throw new Error('Proxy credential environment variable is not configured')
      result[field] = process.env[key]
    }
  }
  return result
}
