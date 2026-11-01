import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, toNamespacedPath } from 'node:path'
import { browserProfilesRoot } from './profiles.mjs'
import { readComponent, leaseComponent } from './components/store.mjs'
import { assertNativeEngineVersion, nativeLaunchArgs } from './native-identity.mjs'

export const BACKENDS = ['chromium', 'chromium-portable', 'camoufox', 'aliasmode']
export const CAMOUFOX_VERSION = '0.5.8'
export const CAMOUFOX_INTEGRITY = 'sha512-GR4EwJdjB8tlo7zt1l+eRxBylFImTLTLz2eL8NmYspMGBZwPYk4o73bNFqltqTMCr2BOYXWUQA7lUI7God9L9A=='
export const CAMOUFOX_DRIVER = '1.62.0'

export async function fileHash(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export function backendCapabilities(id = 'chromium') {
  return {
    id, family: id === 'camoufox' ? 'firefox' : 'chromium',
    driverVersion: id === 'camoufox' ? CAMOUFOX_DRIVER : '1.64.1',
    viewport: true, tabs: true, screenshot: true, stream: id === 'camoufox' ? 'jpeg-poll' : 'cdp-screencast',
    storageEncryption: process.platform === 'win32' ? 'DPAPI + AES-256-GCM' : 'external key + AES-256-GCM',
    fullFingerprint: id === 'aliasmode' ? 'experimental-native-engine' : id === 'camoufox' ? 'unsupported' : 'experimental-js-injection',
    localHealth: true, trace: 'redacted-metadata', video: 'opt-in-sampled-webm',
    upload: 'user-workspace-file', download: 'user-armed-workspace-file',
    networkExitAttestation: 'unsupported', tlsFingerprintAttestation: 'unsupported', anonymityGuarantee: false,
  }
}

export async function backendAvailability(id, root = browserProfilesRoot()) {
  if (id === 'chromium-portable' || id === 'camoufox' || id === 'aliasmode') {
    try {
      const component = await readComponent(root, id === 'chromium-portable' ? 'chromium' : id)
      if (component || id !== 'camoufox') return { installed: Boolean(component?.installed), source: 'isolated-component-installer', binaryAttestation: 'full-file-inventory-checked-on-launch', ...(component?.installed ? { version: component.manifest.version } : { reason: `Run npm run components -- install ${id === 'chromium-portable' ? 'chromium' : id} --home ABS_DSH_HOME; then explicitly select this backend` }) }
    } catch { return { installed: false, reason: 'Component selection or files are invalid; use the unified installer verify/rollback commands' } }
  }
  if (id === 'chromium') {
    const candidates = process.platform === 'win32' ? [join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'), join(process.env.ProgramFiles ?? 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe')] : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']
    const installed = (await Promise.all(candidates.map(path => stat(path).then(info => info.isFile()).catch(() => false)))).some(Boolean)
    return { installed, source: process.platform === 'win32' ? 'system-edge' : 'system-chrome', binaryAttestation: 'system-managed-unverified', ...(!installed ? { reason: 'Install the system Edge/Chrome browser for this platform; the host browser is never attached as a fallback' } : {}) }
  }
  if (id !== 'camoufox') throw new Error('Unsupported browser backend')
  try {
    const manifest = JSON.parse(await readFile(join(root, 'backends/camoufox/manifest.json'), 'utf8'))
    if (manifest.version !== 1 || manifest.sdkVersion !== CAMOUFOX_VERSION || manifest.driverVersion !== CAMOUFOX_DRIVER || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Invalid pinned backend manifest')
    if (!(await stat(manifest.executable)).isFile()) throw new Error('Missing backend executable')
    const require = createRequire(join(root, 'backends/camoufox/package.json'))
    for (const [name, version] of [['camoufox', CAMOUFOX_VERSION], ['playwright-core', CAMOUFOX_DRIVER]]) {
      if (JSON.parse(await readFile(require.resolve(`${name}/package.json`), 'utf8')).version !== version) throw new Error('Missing pinned backend dependency')
    }
    return { installed: true, source: 'isolated-official-sdk', binaryAttestation: 'sha256-checked-on-launch', sdkVersion: manifest.sdkVersion }
  } catch { return { installed: false, reason: 'Run npm run components -- install camoufox --home ABS_DSH_HOME; runtime never downloads components automatically' } }
}

export async function launchBackend({ backend = 'chromium', root = browserProfilesRoot(), nativeProfile, ...options }) {
  if (backend === 'aliasmode') {
    const args = nativeLaunchArgs(nativeProfile)
    return launchLeased(root, 'aliasmode', async () => {
      const component = await readComponent(root, 'aliasmode', { verify: true })
      if (!component?.installed) throw new Error('AliasMode native fingerprint component is not installed; install it explicitly in this instance first')
      const { chromium } = await import('playwright-core')
      const browser = await chromium.launch({ ...options, channel: undefined, executablePath: toNamespacedPath(component.executable), args, headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--password-store=basic', '--use-mock-keychain', '--unsafely-disable-devtools-self-xss-warnings'] })
      try { assertNativeEngineVersion(browser.version()); return browser }
      catch (error) { await browser.close(); throw error }
    })
  }
  if (backend === 'chromium-portable') {
    return launchLeased(root, 'chromium', async () => {
      const component = await readComponent(root, 'chromium', { verify: true })
      if (!component?.installed) throw new Error('Portable Chromium is not installed; use the component installer, or explicitly select the system backend')
      const { chromium } = await import('playwright-core')
      return chromium.launch({ ...options, channel: undefined, executablePath: toNamespacedPath(component.executable), headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--password-store=basic', '--use-mock-keychain', '--unsafely-disable-devtools-self-xss-warnings'] })
    })
  }
  if (backend === 'chromium') {
    const { chromium } = await import('playwright-core')
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await chromium.launch({ ...options, chromiumSandbox: true, ignoreDefaultArgs: ['--password-store=basic', '--use-mock-keychain', '--unsafely-disable-devtools-self-xss-warnings'] }) }
      catch (error) {
        // Only launch is retried: no page/action has been created or replayed.
        if (attempt || !error.message?.startsWith('browserType.launch: Target page, context or browser has been closed')) throw error
      }
    }
  }
  if (backend !== 'camoufox') throw new Error('Unsupported browser backend')
  return launchLeased(root, 'camoufox', async () => {
    const component = await readComponent(root, 'camoufox', { verify: true })
    if (component && !component.installed) throw new Error('Camoufox was removed; install it explicitly before use')
    if (component?.installed) {
      const require = createRequire(join(component.directory, 'package.json'))
      for (const [name, version] of [['camoufox', CAMOUFOX_VERSION], ['playwright-core', CAMOUFOX_DRIVER]]) if (JSON.parse(await readFile(require.resolve(name + '/package.json'), 'utf8')).version !== version) throw new Error('Camoufox component dependency mismatch')
      const sdk = await import(pathToFileURL(require.resolve('camoufox')).href)
      return sdk.Camoufox({ from_options: { executablePath: toNamespacedPath(component.executable), headless: true, env: options.env } })
    }
    const directory = join(root, 'backends/camoufox')
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8').catch(() => { throw new Error('Camoufox is not installed in the isolated backend directory') }))
    if (manifest.version !== 1 || manifest.sdkVersion !== CAMOUFOX_VERSION || manifest.driverVersion !== CAMOUFOX_DRIVER || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Camoufox backend pin mismatch')
    const executablePath = await realpath(manifest.executable)
    if (await fileHash(executablePath) !== manifest.sha256) throw new Error('Camoufox binary SHA256 mismatch; refusing launch')
    const require = createRequire(join(directory, 'package.json'))
    const lock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'))
    if (lock.packages?.['node_modules/camoufox']?.integrity !== CAMOUFOX_INTEGRITY || manifest.lockHash !== await fileHash(join(directory, 'package-lock.json'))) throw new Error('Camoufox dependency lock integrity mismatch')
    for (const [name, version] of [['camoufox', CAMOUFOX_VERSION], ['playwright-core', CAMOUFOX_DRIVER]]) {
      const data = JSON.parse(await readFile(require.resolve(`${name}/package.json`), 'utf8'))
      if (data.version !== version) throw new Error('Camoufox isolated dependency version mismatch')
    }
    const sdk = await import(pathToFileURL(require.resolve('camoufox')).href)
    // Objects stay on their own 1.62 driver; no 1.64 Juggler connection. Explicit
    // launch options avoid SDK downloads, random presets and exit geolocation.
    return sdk.Camoufox({ from_options: { executablePath, headless: true, env: options.env } })
  })
}

async function launchLeased(root, id, launch) {
  const release = await leaseComponent(root, id)
  let releasing
  const finish = () => releasing ??= release()
  try {
    const browser = await launch()
    browser.once('disconnected', () => { void finish().catch(() => {}) })
    const close = browser.close.bind(browser)
    browser.close = async (...args) => { try { return await close(...args) } finally { if (!browser.isConnected()) await finish() } }
    return browser
  } catch (error) { await finish(); throw error }
}
