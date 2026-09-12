#!/usr/bin/env node
/**
 * 一条命令完成「打包 → 安装到 profile」：安装步骤数 = 1。
 *
 * 用法：
 *   node scripts/publish.mjs [--profile <name>] [--pack-destination <dir>]
 *
 * 默认把 tarball 打到 ~/.dsh/.tgz-cache 并装进 `web` profile；两条命令合一条，
 * 中间产物路径不再需要人记。tarball 文件名取自 npm pack 的实际输出，不拼版本号。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const root = fileURLToPath(new URL('..', import.meta.url))
const { values } = parseArgs({
  options: {
    profile: { type: 'string', default: 'web' },
    'pack-destination': { type: 'string' },
  },
})

function run(command, args, opts = {}) {
  const options = { cwd: root, encoding: 'utf8', ...opts }
  let result
  if (process.platform === 'win32') {
    // npm/dsh 在 Windows 上是 .cmd 批处理，必须经过 cmd 执行；DEP0190 对
    // 「shell + args 数组」告警（拼接注入），所以这里拼成单条命令行并转义参数。
    const escape = arg => /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
    result = spawnSync([command, ...args].map(escape).join(' '), { ...options, shell: true })
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

const destination = values['pack-destination'] || join(homedir(), '.dsh', '.tgz-cache')
mkdirSync(destination, { recursive: true })

const packed = run('npm', ['pack', '--pack-destination', destination]).stdout.trim().split('\n').pop()
if (!/\.tgz$/.test(packed)) {
  process.stderr.write(`npm pack did not report a tarball name: ${packed}\n`)
  process.exit(1)
}
const tarball = join(destination, packed)

const installed = run('dsh', ['plugin', '--profile', values.profile, 'add', tarball])
process.stdout.write(installed.stdout ?? '')

console.log(`[publish] packed ${tarball}`)
console.log(`[publish] installed into profile '${values.profile}'`)
