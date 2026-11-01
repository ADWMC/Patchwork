import { createRequire } from 'node:module'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rm, writeFile, readFile, readdir, lstat, chmod, statfs, rename } from 'node:fs/promises'
import { aliasmodeAsset, camoufoxAsset, CAMOUFOX_SDK, CAMOUFOX_DRIVER, DRIVER_VERSION } from './catalog.mjs'
import { safeRelative } from './store.mjs'
import { downloadFile } from './network.mjs'
import { extractZip } from './extract.mjs'
import { runInstaller, installerEnvironment, npmCli } from './process.mjs'
import { CAMOUFOX_INTEGRITY } from '../backends.mjs'

const require = createRequire(import.meta.url)
const workerPath = fileURLToPath(new URL('../../../scripts/browser-component-worker.mjs', import.meta.url))
const driverRoot = dirname(require.resolve('playwright-core/package.json'))
export async function provisionPlan(spec, directory, options = {}) {
  if (spec.id === 'aliasmode') return { asset: aliasmodeAsset(), driver: DRIVER_VERSION, license: 'GPL-3.0; Chromium third-party notices also apply', source: 'https://github.com/aliasmode/aliasmode-chromium/tree/3900a207abab317348c5c5c43adbaf0c2d47c725', experimental: true }
  if (spec.id === 'camoufox') return { asset: camoufoxAsset(), sdk: CAMOUFOX_SDK, driver: CAMOUFOX_DRIVER }
  const output = await runInstaller([workerPath, spec.id, directory], { env: installerEnvironment(directory, options.proxy), signal: options.signal, capture: true, timeoutMs: 15000 })
  const data = JSON.parse(output)
  safeRelative(data.executable)
  return { ...data, driver: DRIVER_VERSION }
}
export async function provision(spec, directory, options = {}) {
  const { signal, onProgress = () => {} } = options
  const env = installerEnvironment(directory, options.proxy)
  if (spec.id === 'aliasmode') {
    const asset = aliasmodeAsset(), space = await statfs(directory)
    if (space.bavail * space.bsize < asset.bytes * 4 + 256 * 1024 ** 2) throw new Error('Insufficient disk space for the AliasMode archive and extraction')
    onProgress({ stage: 'download-start', component: spec.id, source: asset.url, total: asset.bytes })
    const archive = join(directory, 'browser.zip'), binaryRoot = join(directory, 'binary')
    await downloadFile(asset, archive, options)
    onProgress({ stage: 'extract', component: spec.id })
    await extractZip(archive, binaryRoot, { signal })
    await rm(archive)
    const found = []
    async function locate(path) {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.isDirectory()) await locate(join(path, entry.name))
        else if (entry.isFile() && spec.executable.test(entry.name)) found.push(join(path, entry.name))
      }
    }
    await locate(binaryRoot)
    if (found.length !== 1) throw new Error('Pinned AliasMode archive must contain exactly one supported browser executable')
    // Chromium resource loaders do not all honor Windows namespaced paths.
    // Remove archive nesting, as for the regular portable Chromium component.
    await rename(dirname(found[0]), join(directory, 'runtime'))
    return { executable: 'runtime/' + basename(found[0]), provenance: { kind: 'pinned-official-github-release', url: asset.url, archiveSha256: asset.sha256, archiveBytes: asset.bytes, source: 'https://github.com/aliasmode/aliasmode-chromium/tree/3900a207abab317348c5c5c43adbaf0c2d47c725', authenticity: 'GitHub release-asset SHA256; not a signature or reproducible-build attestation' } }
  }
  if (spec.id !== 'camoufox') {
    const plan = await provisionPlan(spec, directory, options)
    onProgress({ stage: 'download-start', component: spec.id, sources: plan.urls })
    await runInstaller([join(driverRoot, 'cli.js'), 'install', spec.playwright, '--no-remove'], { env, signal, onProgress })
    const executable = join(directory, plan.executable)
    if (!(await lstat(executable)).isFile()) throw new Error('Official installer did not produce the expected executable')
    // Keep the complete runtime directory, but remove redundant installer
    // nesting and auxiliary downloads. Chromium's ICU loader does not support
    // long Windows paths even when CreateProcess accepts the namespace prefix.
    await rename(dirname(executable), join(directory, 'runtime'))
    await rm(join(directory, 'cache'), { recursive: true, force: true })
    return { executable: 'runtime/' + basename(executable), provenance: { kind: 'pinned-playwright-official-installer', driver: plan.driver, revision: plan.revision, urls: plan.urls, authenticity: 'HTTPS official installer; local file hashes are integrity records, not upstream signatures' } }
  }
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || major === 22 && minor < 15) throw new Error('Camoufox requires Node >=22.15')
  const asset = camoufoxAsset(), space = await statfs(directory)
  if (space.bavail * space.bsize < asset.bytes * 3 + 256 * 1024 ** 2) throw new Error('Insufficient disk space for the pinned Camoufox archive and extraction')
  onProgress({ stage: 'download-start', component: spec.id, source: asset.url, total: asset.bytes })
  const archive = join(directory, 'browser.zip')
  await downloadFile(asset, archive, options)
  onProgress({ stage: 'extract', component: spec.id })
  const binaryRoot = join(directory, 'binary'); await extractZip(archive, binaryRoot, { signal })
  await rm(archive)
  let found
  async function locate(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory()) await locate(join(path, entry.name))
      else if (entry.isFile() && spec.executable.test(entry.name) && !found) found = join(path, entry.name)
    }
  }
  await locate(binaryRoot)
  if (!found) throw new Error('Pinned Camoufox archive has no supported executable')
  if (process.platform !== 'win32') await chmod(found, 0o755)
  onProgress({ stage: 'sdk', component: spec.id })
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { camoufox: CAMOUFOX_SDK, 'playwright-core': CAMOUFOX_DRIVER } }), { mode: 0o600 })
  const npmConfig = join(directory, 'installer.npmrc'); await writeFile(npmConfig, 'registry=https://registry.npmjs.org/\nignore-scripts=true\n', { mode: 0o600 })
  await runInstaller([npmCli(), 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org/'], { cwd: directory, signal, onProgress, env: { ...env, npm_config_cache: join(directory, 'npm-cache'), npm_config_userconfig: npmConfig, npm_config_globalconfig: join(directory, 'empty-global.npmrc') } })
  await rm(join(directory, 'npm-cache'), { recursive: true, force: true }); await rm(npmConfig, { force: true })
  const lock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'))
  if (lock.packages?.['node_modules/camoufox']?.integrity !== CAMOUFOX_INTEGRITY) throw new Error('Camoufox SDK integrity differs from the pinned npm package')
  const isolated = createRequire(join(directory, 'package.json'))
  for (const [name, version] of [['camoufox', CAMOUFOX_SDK], ['playwright-core', CAMOUFOX_DRIVER]]) if (JSON.parse(await readFile(isolated.resolve(name + '/package.json'), 'utf8')).version !== version) throw new Error('Camoufox SDK/driver pin mismatch')
  const pin = JSON.parse(await readFile(join(dirname(isolated.resolve('camoufox')), 'data-files/browser-pin.json'), 'utf8'))
  if (pin.tag !== spec.version) throw new Error('Camoufox browser is not paired with this SDK')
  return { executable: relative(directory, found).replaceAll('\\', '/'), provenance: { kind: 'pinned-official-github-release', url: asset.url, archiveSha256: asset.sha256, archiveBytes: asset.bytes, sdkIntegrity: CAMOUFOX_INTEGRITY } }
}
