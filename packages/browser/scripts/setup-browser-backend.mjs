import { parseArgs } from 'node:util'
import { mkdir, readFile, writeFile, rename, rm, realpath } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import { installerEnvironment, runInstaller, npmCli } from '../src/browser/components/process.mjs'
import { fileHash, CAMOUFOX_VERSION, CAMOUFOX_DRIVER, CAMOUFOX_INTEGRITY } from '../src/browser/backends.mjs'
import { acquireLease } from '../src/browser/lease.mjs'

// Legacy manual-binary import only; prefer the unified components CLI.
const { values } = parseArgs({ options: { home: { type: 'string' }, backend: { type: 'string' }, executable: { type: 'string' }, sha256: { type: 'string' }, source: { type: 'string' } } })
const home = values.home ?? process.env.DSH_HOME
if (!home || !isAbsolute(home)) throw new Error('Specify an absolute --home or explicit DSH_HOME; prefer npm run components -- install camoufox --home ABS_DSH_HOME')
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || major === 22 && minor < 15) throw new Error('The optional Camoufox SDK requires Node >=22.15')
if (values.backend !== 'camoufox' || !values.executable || !/^[a-f0-9]{64}$/.test(values.sha256 ?? '')) throw new Error('Usage: node scripts/setup-browser-backend.mjs --backend camoufox --executable ABS_PATH --sha256 VERIFIED_HASH [--source ORIGIN_URL]')
const executable = await realpath(values.executable)
if (await fileHash(executable) !== values.sha256) throw new Error('Binary hash does not match the supplied verification record')
const parent = join(home, 'patchwork/browser/backends')
await mkdir(parent, { recursive: true, mode: 0o700 })
const release = await acquireLease(join(parent, 'camoufox.install.lock'))
const staging = join(parent, `camoufox.staging-${randomUUID()}`)
const target = join(parent, 'camoufox')
try {
  try { await readFile(join(target, 'manifest.json')); throw new Error('Backend already installed; retain it for rollback before replacing it') } catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(staging, { mode: 0o700 })
  await writeFile(join(staging, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { camoufox: CAMOUFOX_VERSION, 'playwright-core': CAMOUFOX_DRIVER } }), { mode: 0o600 })
  const controller = new AbortController(), abort = () => controller.abort(new Error('Installation cancelled'))
  process.once('SIGINT', abort); process.once('SIGTERM', abort)
  try { await runInstaller([npmCli(), 'install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: staging, signal: controller.signal, env: installerEnvironment(staging), onProgress: event => console.error(JSON.stringify(event)) }) }
  finally { process.off('SIGINT', abort); process.off('SIGTERM', abort) }
  const lockHash = await fileHash(join(staging, 'package-lock.json'))
  const lock = JSON.parse(await readFile(join(staging, 'package-lock.json'), 'utf8'))
  if (lock.packages?.['node_modules/camoufox']?.integrity !== CAMOUFOX_INTEGRITY) throw new Error('Camoufox package integrity differs from the pinned npm distribution')
  await writeFile(join(staging, 'manifest.json'), JSON.stringify({ version: 1, sdkVersion: CAMOUFOX_VERSION, driverVersion: CAMOUFOX_DRIVER, executable, sha256: values.sha256, source: values.source ?? 'operator-supplied', lockHash, installedAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
  await rename(staging, target)
  console.log('Isolated Camoufox SDK installed. Binary integrity is checked at launch; site compatibility remains unverified.')
} finally { try { await rm(staging, { recursive: true, force: true }) } finally { await release() } }
