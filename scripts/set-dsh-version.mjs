#!/usr/bin/env node
/**
 * Re-pin the development host packages to one published DSH version.
 *
 *   node scripts/set-dsh-version.mjs 0.2.2-alpha.3 --dry-run
 *   node scripts/set-dsh-version.mjs 0.2.2-alpha.3 --install
 *
 * This is for the compatibility lane and local migration checks. It changes
 * manifests and the lockfile; production compatibility is declared by
 * `engines.dsh`, not by these devDependencies.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const root = resolve(import.meta.dirname, '..')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    install: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
})
const version = positionals[0]
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Usage: node scripts/set-dsh-version.mjs <exact-dsh-version> [--install] [--dry-run]')

const manifest = JSON.parse(execSync(`npm view @deepseek-ai/dsh-agent-preset@${version} peerDependencies dependencies --json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const exact = range => {
  if (typeof range !== 'string' || !range.trim()) throw new Error(`DSH ${version} declares no usable dependency range`)
  const value = range.trim().replace(/^[~^]/, '')
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)) throw new Error(`Cannot pin ${range}`)
  return value
}
const cordis = exact(manifest.peerDependencies?.['@deepseek-ai/cordis'])
const schemastery = exact(manifest.dependencies?.['@deepseek-ai/schemastery'])
const executorAvailable = (() => {
  try {
    execSync(`npm view @deepseek-ai/dsh-tool-executor-native@${version} version`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

function update(path, apply) {
  const file = join(root, path)
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  for (const key of Object.keys(pkg.devDependencies ?? {})) {
    if (key.startsWith('@deepseek-ai/dsh-')) pkg.devDependencies[key] = version
  }
  if (path === 'package.json' && executorAvailable) pkg.devDependencies['@deepseek-ai/dsh-tool-executor-native'] = version
  else delete pkg.devDependencies['@deepseek-ai/dsh-tool-executor-native']
  if (pkg.devDependencies?.['@deepseek-ai/cordis']) pkg.devDependencies['@deepseek-ai/cordis'] = cordis
  if (pkg.dependencies?.['@deepseek-ai/schemastery']) pkg.dependencies['@deepseek-ai/schemastery'] = schemastery
  if (apply) writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  return pkg
}

const rootPkg = update('package.json', !values['dry-run'])
const browserPkg = update('packages/browser/package.json', !values['dry-run'])
console.log(JSON.stringify({
  version,
  cordis,
  schemastery,
  applied: !values['dry-run'],
  codingAgent: { dshDevDependencies: Object.keys(rootPkg.devDependencies).filter(key => key.startsWith('@deepseek-ai/dsh-')).length, engines: rootPkg.engines },
  browser: { dshDevDependencies: Object.keys(browserPkg.devDependencies).filter(key => key.startsWith('@deepseek-ai/dsh-')).length, engines: browserPkg.engines },
}, null, 2))

if (values.install && !values['dry-run']) {
  execSync('pnpm install --no-frozen-lockfile', { cwd: root, stdio: 'inherit' })
}
