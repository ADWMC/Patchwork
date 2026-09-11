import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('the committed client bundle matches its source', () => {
  // 浏览器半边是构建产物且必须随包发布，所以「产物是否落后」本身是一个缺陷。
  const output = execFileSync(process.execPath, [join(root, 'scripts', 'build-client.mjs'), '--check'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.match(output, /is up to date/)
})

test('the client bundle is a module-loader payload that exports apply and inject', async () => {
  const bundle = await readFile(join(root, 'lib', 'client.js'), 'utf8')
  assert.match(bundle, /window\.__ModuleLoader__\.load\(/)
  assert.match(bundle, /id: "@patchwork\/coding-agent"/)
  assert.match(bundle, /factory: \(require\) =>/)
  // 宿主侧的共享依赖必须保持外置，由加载器的 require 提供。
  assert.match(bundle, /require\("react"\)/)
  assert.match(bundle, /apply: \(\) => apply/)
  assert.match(bundle, /inject: \(\) => inject/)
  // 三个 seat 名一个都不能少，否则标签只注册一半。
  assert.match(bundle, /ctx\.sidebarRightTabs\.register/)
  assert.match(bundle, /sidebar\.right\.pane\.tab/)
  assert.match(bundle, /sidebar\.right\.pane\.tab\.title/)
})
