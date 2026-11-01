import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const packageRoot = fileURLToPath(new URL('..', import.meta.url))
export function runNpm(args) {
  // npm_execpath may point to pnpm-native.exe when launched by pnpm.
  const cli = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(path => path && /(?:^|[\\/])npm-cli\.js$/i.test(path) && existsSync(path))
  if (!cli) throw new Error('npm CLI not found; run this command through npm run')
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: packageRoot, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || 'npm packaging failed')
  return JSON.parse(result.stdout)
}

export function inspectPackage(pack) {
  const names = new Set(pack.files.map(file => file.path))
  const required = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md', 'src/index.mjs', 'src/runtime.mjs', 'lib/client.js', 'presets/patchwork.patch.yml', 'docs/browser-optional-package-2026-11-01.md', 'docs/browser-runtime-integration-2026-11-01.md', 'src/retrieval/browser-bridge.mjs', 'docs/checks/browser-optional-package-2026-11-01.json']
  required.push('src/task/handoff.mjs', 'docs/superagent-fusion-2026-11-01.md', 'docs/checks/superagent-fusion-2026-11-01.json')
  required.push('src/superagent/index.mjs', 'src/superagent/controller.mjs', 'src/superagent/state.mjs', 'src/superagent/store.mjs', 'src/superagent/prompt.mjs', 'docs/superagent-native-2026-11-01.md', 'docs/checks/superagent-native-2026-11-01.json')
  const missing = required.filter(path => !names.has(path))
  const forbidden = pack.files.filter(({ path }) => /(^|\/)(?:\.git|node_modules|\.dsh[^/]*|\.workbuddy|storages|logs|refs|artifacts|output|screenshots)(\/|$)|(^|\/)(?:\.env(?:\.[^/]*)?|credentials\.json|cookies\.json|storage-state\.json|manifest\.private\.json)$|\.(?:exe|dll|dylib|so|zip|tgz|log|pem|pfx|key)$/i.test(path)).map(file => file.path)
  const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  const browserFiles = [...names].filter(path => /^(?:packages\/browser\/|src\/browser\/|src\/client\/(?:Browser|browser-stream)|scripts\/(?:browser-component|setup-browser))/.test(path))
  const browserDependencies = ['@patchwork/browser', 'playwright-core', 'fingerprint-generator', 'fingerprint-injector', 'yauzl', 'ws'].filter(name => packageJson.dependencies?.[name] || packageJson.optionalDependencies?.[name])
  const browserInClient = /patchwork_browser|pw-browser|data-patchwork-browser|\/api\/plugins\/patchwork-browser/.test(readFileSync(join(packageRoot, 'lib/client.js'), 'utf8'))
  const profile = JSON.parse(readFileSync(join(packageRoot, 'profiles/patchwork/package.json'), 'utf8'))
  const profileMatchesPackage = profile.dependencies['@patchwork/coding-agent'] === packageJson.version
  const noInstallHooks = !['preinstall', 'install', 'postinstall'].some(key => packageJson.scripts?.[key])
  const result = { ok: !missing.length && !forbidden.length && !browserFiles.length && !browserDependencies.length && !browserInClient && profileMatchesPackage && noInstallHooks, package: pack.name, version: pack.version, compressedBytes: pack.size, unpackedBytes: pack.unpackedSize, files: names.size, missing, forbidden, browserFiles, browserDependencies, browserInClient, profileMatchesPackage, noInstallHooks, bundledBrowser: false, dependencyBytesIncluded: false }
  if (!result.ok) throw new Error(`Package preflight failed: ${JSON.stringify(result)}`)
  return result
}
