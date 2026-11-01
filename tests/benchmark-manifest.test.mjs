import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const benchmark = join(root, '..', 'benchmarks', 'patchwork')
const manifest = JSON.parse(await readFile(join(benchmark, 'manifest.json'), 'utf8'))

test('Patchwork benchmark manifest is complete and shell-free', async () => {
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.tasks.length, 16)
  const suiteIds = new Set(manifest.suites.map(suite => suite.id))
  const taskIds = new Set()
  for (const relative of manifest.tasks) {
    const task = JSON.parse(await readFile(join(benchmark, relative), 'utf8'))
    assert.equal(task.schemaVersion, 1)
    assert.ok(!taskIds.has(task.id), `duplicate task ${task.id}`)
    taskIds.add(task.id)
    assert.ok(suiteIds.has(task.suite))
    assert.ok(task.oracle.commands.length > 0)
    for (const command of task.oracle.commands) {
      assert.equal(typeof command.program, 'string')
      assert.ok(Array.isArray(command.args))
      assert.ok(!command.args.some(arg => /(^|\s)(cmd|powershell|pwsh|sh|bash)(\s|$)/i.test(arg)))
      assert.ok(!JSON.stringify(command).match(/(?:\bsk-[A-Za-z0-9]{12,}\b|api[_-]?key\s*[:=]|\btoken\s*[:=])/i), `secret-like value in ${task.id}`)
    }
  }
  assert.deepEqual(new Set([...taskIds]), new Set(manifest.suites.flatMap(suite => suite.taskIds)))
})
