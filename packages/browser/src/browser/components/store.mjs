import { mkdir, readFile, readdir, realpath, lstat, writeFile, rename, rm, readlink } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { acquireLease } from '../lease.mjs'
import { componentSpec } from './catalog.mjs'

const UUID = /^[a-f0-9-]{36}$/
const HASH = /^[a-f0-9]{64}$/
export function inside(root, path) { const p = relative(resolve(root), resolve(path)); return !p || !isAbsolute(p) && p !== '..' && !p.startsWith('../') && !p.startsWith('..\\') }
export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 || /[\x00-\x1f:]/.test(value) || isAbsolute(value) || value.split(/[\\/]/).some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe component path')
  return value.replaceAll('\\', '/')
}
export async function guarded(root, path) {
  if (!inside(root, path)) throw new Error('Component path escapes its isolated root')
  const base = await realpath(root).catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (!base) return path // Read-only lookup before the isolated root exists.
  let current = resolve(path)
  for (;;) {
    try { if (!inside(base, await realpath(current))) throw new Error('Component path follows an external link'); break }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const parent = resolve(current, '..'); if (parent === current) throw new Error('Invalid component root'); current = parent
  }
  return path
}
export async function hashFile(path) { const h = createHash('sha256'); for await (const b of createReadStream(path)) h.update(b); return h.digest('hex') }
export async function atomicJson(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`
  try { await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(temp, path) }
  finally { await rm(temp, { force: true }) }
}
export async function treeFiles(root, { hash = true } = {}) {
  const files = []; let bytes = 0
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), name = relative(root, path).replaceAll('\\', '/')
      if (name === 'manifest.json') continue
      safeRelative(name)
      const info = await lstat(path)
      if (info.isDirectory()) await visit(path)
      else if (info.isSymbolicLink()) {
        await guarded(root, path); const target = await readlink(path)
        if (isAbsolute(target) || !inside(root, resolve(directory, target))) throw new Error('External component link')
        files.push({ path: name, type: 'symlink', target })
      } else if (info.isFile()) { bytes += info.size; files.push({ path: name, type: 'file', size: info.size, ...(hash ? { sha256: await hashFile(path) } : {}) }) }
      else throw new Error('Unsupported component filesystem entry')
      if (files.length > 50000 || bytes > 8 * 1024 ** 3) throw new Error('Component extraction exceeds its limits')
    }
  }
  await visit(root)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

export async function readPointer(root, id) {
  componentSpec(id)
  const path = await guarded(root, join(root, 'components', id, 'current.json'))
  try {
    const data = JSON.parse(await readFile(path, 'utf8'))
    if (data.schema !== 1 || data.current !== null && !UUID.test(data.current) || data.previous !== null && !UUID.test(data.previous)) throw new Error('Invalid component selection')
    return data
  } catch (e) { if (e.code === 'ENOENT') return null; throw e }
}
export async function readComponent(root, id, { verify = false, version } = {}) {
  const spec = componentSpec(id), pointer = await readPointer(root, id)
  if (!pointer) return null // Legacy version-1 installers remain readable separately.
  const selected = version ?? pointer.current
  if (!selected) return { managed: true, installed: false }
  if (!UUID.test(selected)) throw new Error('Invalid component version directory')
  const directory = await guarded(root, join(root, 'components', id, 'versions', selected))
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'))
  if (manifest.schema !== 2 || manifest.id !== id || manifest.driverVersion !== spec.driverVersion || manifest.version !== spec.version || spec.sdkVersion && manifest.sdkVersion !== spec.sdkVersion || manifest.platform !== process.platform || manifest.arch !== process.arch || !Array.isArray(manifest.files) || manifest.files.length > 50000) throw new Error('Component manifest does not match this platform and pinned driver')
  const executable = await guarded(directory, join(directory, safeRelative(manifest.executable)))
  if (!(await lstat(executable)).isFile()) throw new Error('Component executable is missing')
  if (verify) await verifyTree(directory, manifest)
  return { managed: true, installed: true, directory, executable, manifest, selection: selected, previous: pointer.previous }
}
export async function verifyTree(directory, manifest) {
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Missing component integrity inventory')
  for (const item of manifest.files) {
    safeRelative(item.path)
    if (item.type === 'file' && (!HASH.test(item.sha256) || !Number.isSafeInteger(item.size) || item.size < 0)) throw new Error('Invalid component integrity inventory')
    if (!['file', 'symlink'].includes(item.type)) throw new Error('Invalid component entry type')
  }
  const actual = await treeFiles(directory)
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error('Component integrity mismatch; download and reinstall with --replace')
  if (!actual.some(f => f.path === safeRelative(manifest.executable) && f.type === 'file')) throw new Error('Executable missing from component inventory')
}

export async function componentLock(root, id) {
  componentSpec(id)
  await mkdir(root, { recursive: true, mode: 0o700 })
  const directory = await guarded(root, join(root, 'component-locks')); await mkdir(directory, { recursive: true, mode: 0o700 })
  return acquireLease(join(directory, id + '.lock'))
}
// A reader lease is held for the complete browser/encoder process lifetime.
// The mutation gate makes "check readers -> switch/remove" atomic vs startup.
export async function leaseComponent(root, id) {
  const release = await componentLock(root, id)
  try {
    const directory = await guarded(root, join(root, 'component-readers', id)); await mkdir(directory, { recursive: true, mode: 0o700 })
    return await acquireLease(join(directory, randomUUID()))
  } finally { await release() }
}
export async function assertUnused(root, id) {
  const directory = await guarded(root, join(root, 'component-readers', id))
  let names; try { names = await readdir(directory) } catch (e) { if (e.code === 'ENOENT') return; throw e }
  for (const name of names) {
    if (!UUID.test(name)) throw new Error('Unexpected component runtime lease; inspect it before changing components')
    const path = join(directory, name), owner = JSON.parse(await readFile(join(path, 'owner.json'), 'utf8'))
    if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) throw new Error('Invalid component runtime lease')
    try { process.kill(owner.pid, 0); throw new Error('组件正在使用中；请关闭使用它的浏览器或录像后重试') }
    catch (e) { if (e.code !== 'ESRCH') throw e }
    await guarded(root, path); await rm(path, { recursive: true, force: true })
  }
}
