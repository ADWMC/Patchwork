#!/usr/bin/env node
/**
 * 历史文件名：只制作本地 tarball，不发布到 npm。默认不安装到 DSH。
 *
 * 用法：
 *   npm run pack:local -- [--pack-destination <dir>]
 *   显式安装另需 --install --profile <name>，并设置目标 DSH_HOME。
 *
 * 默认 tarball 写入系统临时目录 patchwork-pack。不会隐式选择主 web profile。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { inspectPackage, runNpm } from './package-check.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const { values } = parseArgs({
  options: {
    install: { type: 'boolean', default: false },
    profile: { type: 'string' },
    'pack-destination': { type: 'string' },
  },
})
if (values.install && (!values.profile || !process.env.DSH_HOME)) throw new Error('Installation requires --install --profile NAME and an explicit DSH_HOME; no default profile is modified')
if (values.profile && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(values.profile)) throw new Error('Invalid profile name')
if (values.profile && !values.install) throw new Error('--profile requires --install; omit both for pack-only')

function run(command, args, opts = {}) {
  const options = { cwd: root, encoding: 'utf8', ...opts }
  let result
  if (process.platform === 'win32') {
    // Only the dsh.cmd shim uses cmd; reject its expansion/metacharacter syntax.
    if ([command, ...args].some(arg => /["%!&|<>^()\r\n]/.test(arg))) throw new Error('Use an installation path without shell metacharacters')
    result = spawnSync('cmd.exe', ['/d', '/s', '/c', [command, ...args.map(arg => `"${arg}"`)].join(' ')], { ...options, windowsHide: true })
  } else {
    result = spawnSync(command, args, options)
  }
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
  return result
}

const destination = resolve(values['pack-destination'] || join(tmpdir(), 'patchwork-pack'))
const [dry] = runNpm(['pack', '--dry-run', '--json', '--ignore-scripts'])
inspectPackage(dry)
mkdirSync(destination, { recursive: true })

const [packed] = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', destination])
inspectPackage(packed)
if (!/^[a-zA-Z0-9_.-]+\.tgz$/.test(packed.filename)) {
  process.stderr.write('npm pack did not report a safe tarball name\n')
  process.exit(1)
}
const tarball = join(destination, packed.filename)

if (values.install) {
  const installed = run('dsh', ['plugin', '--profile', values.profile, 'add', tarball])
  process.stdout.write(installed.stdout ?? '')
  console.log(`[install] installed into explicitly selected profile '${values.profile}' in DSH_HOME`)
}

console.log(`[pack] ${tarball} (${packed.size} bytes compressed, dependencies excluded)`)
if (!values.install) console.log('[pack] pack-only; no DSH profile or registry was modified')
