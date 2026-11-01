import { mkdir, readFile, readdir, rename, rm } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import { acquireLease } from '../lease.mjs'
import { COMPONENTS, componentSpec } from './catalog.mjs'
import { guarded, atomicJson, treeFiles, verifyTree, readComponent, readPointer, componentLock, assertUnused, safeRelative } from './store.mjs'
import { provision, provisionPlan } from './provision.mjs'

export class ComponentInstaller {
  constructor(root, { onProgress = () => {}, signal, proxy, prepare = provision } = {}) {
    if (!isAbsolute(root)) throw new Error('Component root must be absolute')
    if (proxy) { const u = new URL(proxy); if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Proxy requires HTTP(S)') }
    Object.assign(this, { root, onProgress, signal, proxy, prepare })
  }
  check() { this.signal?.throwIfAborted() }
  async initialize() { this.check(); await mkdir(this.root, { recursive: true, mode: 0o700 }) }
  async downloadLock(id) {
    componentSpec(id); await this.initialize()
    const path = await guarded(this.root, join(this.root, 'component-locks')); await mkdir(path, { recursive: true, mode: 0o700 })
    return acquireLease(join(path, id + '.download.lock'), { check: () => this.check() })
  }
  async plan(id) {
    const spec = componentSpec(id)
    return { id, name: spec.name, version: spec.version, platform: process.platform, arch: process.arch, ...(await provisionPlan(spec, this.root, this)), activeInstallationChanged: false }
  }
  async list() {
    return Promise.all(Object.keys(COMPONENTS).map(async id => {
      try {
        const current = await readComponent(this.root, id)
        return { id, name: COMPONENTS[id].name, installed: current?.installed ?? false, ...(current?.installed ? { version: current.manifest.version, previousAvailable: Boolean(current.previous), files: current.manifest.files.length, bytes: current.manifest.files.reduce((n, f) => n + (f.size ?? 0), 0) } : {}), legacyPossible: !current, integrity: 'not-sampled-use-verify' }
      } catch (e) { return { id, installed: false, error: e.message } }
    }))
  }
  async cached(id) {
    const path = await guarded(this.root, join(this.root, 'component-downloads', id))
    try {
      const manifest = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8')), spec = componentSpec(id)
      if (manifest.schema !== 2 || manifest.id !== id || manifest.version !== spec.version || manifest.driverVersion !== spec.driverVersion || spec.sdkVersion && manifest.sdkVersion !== spec.sdkVersion || manifest.platform !== process.platform || manifest.arch !== process.arch) throw new Error('Cached component does not match this platform and catalog')
      await verifyTree(path, manifest); return { path, manifest }
    } catch (e) { if (e.code === 'ENOENT') return null; throw e }
  }
  async download(id, { refresh = false } = {}) {
    const spec = componentSpec(id), release = await this.downloadLock(id)
    let temporary
    try {
      if (!refresh) { const cached = await this.cached(id); if (cached) return { id, state: 'downloaded', reused: true, version: cached.manifest.version } }
      const parent = await guarded(this.root, join(this.root, 'component-downloads')); await mkdir(parent, { recursive: true, mode: 0o700 })
      temporary = join(parent, '.staging-' + id + '-' + randomUUID()); await mkdir(temporary, { mode: 0o700 })
      this.onProgress({ stage: 'preparing', component: id })
      const built = await this.prepare(spec, temporary, this)
      this.check(); safeRelative(built.executable)
      this.onProgress({ stage: 'verifying', component: id })
      const manifest = { schema: 2, id, version: spec.version, driverVersion: spec.driverVersion, ...(spec.sdkVersion ? { sdkVersion: spec.sdkVersion } : {}), platform: process.platform, arch: process.arch, executable: built.executable, provenance: built.provenance, files: await treeFiles(temporary), preparedAt: new Date().toISOString() }
      await verifyTree(temporary, manifest); await atomicJson(join(temporary, 'manifest.json'), manifest); this.check()
      const target = await guarded(this.root, join(parent, id)), old = join(parent, '.previous-' + id + '-' + randomUUID())
      let previous = false
      try { await rename(target, old); previous = true } catch (e) { if (e.code !== 'ENOENT') throw e }
      try { await rename(temporary, target); temporary = null } catch (e) { if (previous) await rename(old, target); throw e }
      if (previous) await rm(old, { recursive: true, force: true })
      return { id, state: 'downloaded', reused: false, version: manifest.version, bytes: manifest.files.reduce((n, f) => n + (f.size ?? 0), 0) }
    } finally { try { if (temporary) await rm(temporary, { recursive: true, force: true }) } finally { await release() } }
  }
  async install(id, { offline = false, replace = false } = {}) {
    componentSpec(id); this.check()
    if (!replace) {
      const current = await readComponent(this.root, id, { verify: true })
      if (current?.installed) return { id, state: 'installed', reused: true, version: current.manifest.version }
    }
    if (!await this.cached(id)) {
      if (offline) throw new Error('No verified downloaded component is available; run download first')
      await this.download(id)
    }
    const releaseDownload = await this.downloadLock(id)
    let release, destination, cachePath, committed = false
    try {
      release = await componentLock(this.root, id); await assertUnused(this.root, id); this.check()
      const cached = await this.cached(id)
      if (!cached) throw new Error('Downloaded component was consumed by another installation; retry')
      const pointer = await readPointer(this.root, id)
      if (pointer?.current && !replace) { await readComponent(this.root, id, { verify: true }); return { id, state: 'installed', reused: true } }
      const base = await guarded(this.root, join(this.root, 'components', id)), versions = await guarded(this.root, join(base, 'versions'))
      await mkdir(versions, { recursive: true, mode: 0o700 })
      const selected = randomUUID(); destination = join(versions, selected)
      cachePath = cached.path
      await rename(cached.path, destination)
      this.check()
      await atomicJson(join(base, 'current.json'), { schema: 1, current: selected, previous: pointer?.current ?? null })
      committed = true
      await this.pruneVersions(id, [selected, pointer?.current])
      return { id, state: 'installed', version: cached.manifest.version, previousAvailable: Boolean(pointer?.current), directory: destination }
    } finally {
      // Preserve a verified download if cancellation happens before selection.
      try { if (destination && !committed) await rename(destination, cachePath).catch(e => { if (e.code !== 'ENOENT') throw e }) }
      finally { try { await release?.() } finally { await releaseDownload() } }
    }
  }
  async verify(id) {
    const release = await componentLock(this.root, id)
    try { const value = await readComponent(this.root, id, { verify: true }); if (!value?.installed) throw new Error('Component is not installed by the unified installer'); return { id, state: 'verified', files: value.manifest.files.length, version: value.manifest.version } }
    finally { await release() }
  }
  async rollback(id) {
    const release = await componentLock(this.root, id)
    try {
      await assertUnused(this.root, id); this.check()
      const pointer = await readPointer(this.root, id)
      if (!pointer?.previous) throw new Error('No previous component version is available')
      await readComponent(this.root, id, { version: pointer.previous, verify: true }); this.check()
      await atomicJson(join(this.root, 'components', id, 'current.json'), { schema: 1, current: pointer.previous, previous: pointer.current })
      return { id, state: 'rolled-back' }
    } finally { await release() }
  }
  async remove(id) {
    const release = await componentLock(this.root, id)
    try {
      await assertUnused(this.root, id); this.check()
      const pointer = await readPointer(this.root, id)
      if (!pointer) return { id, state: 'not-installed', legacyUntouched: true }
      await atomicJson(join(this.root, 'components', id, 'current.json'), { schema: 1, current: null, previous: null })
      for (const selected of new Set([pointer.current, pointer.previous].filter(Boolean))) await rm(await guarded(this.root, join(this.root, 'components', id, 'versions', selected)), { recursive: true, force: true })
      await this.pruneVersions(id, [])
      return { id, state: 'removed', legacyUntouched: true }
    } finally { await release() }
  }
  async cleanCache(id) {
    componentSpec(id); const release = await this.downloadLock(id)
    try {
      this.check()
      const parent = await guarded(this.root, join(this.root, 'component-downloads'))
      const names = await readdir(parent).catch(e => { if (e.code === 'ENOENT') return []; throw e })
      const leftovers = new RegExp('^\\.(?:staging|previous)-' + id + '-[a-f0-9-]{36}$')
      for (const name of names) if (name === id || leftovers.test(name)) await rm(await guarded(this.root, join(parent, name)), { recursive: true, force: true })
      return { id, state: 'download-cache-removed' }
    }
    finally { await release() }
  }
  // The caller holds the mutation gate and has checked for running readers.
  // Recover only installer-owned orphan versions, never user profile trees.
  async pruneVersions(id, keep) {
    const directory = await guarded(this.root, join(this.root, 'components', id, 'versions'))
    for (const name of await readdir(directory)) {
      if (!/^[a-f0-9-]{36}$/.test(name) || keep.includes(name)) continue
      try {
        const path = await guarded(this.root, join(directory, name)), manifest = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8'))
        if (manifest.schema === 2 && manifest.id === id) await rm(path, { recursive: true, force: true })
      } catch { this.onProgress({ stage: 'cleanup-warning', component: id, message: 'A stale component version could not be pruned; the selected installation is valid' }) }
    }
  }
}
