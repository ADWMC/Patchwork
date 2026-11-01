import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const benchmark = join(root, '..', 'benchmarks', 'coding')
const manifest = JSON.parse(await readFile(join(benchmark, 'manifest.json'), 'utf8'))

test('coding benchmark manifest is complete and secret-free', async () => {
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.taskCount, 8)
  assert.equal(manifest.tasks.length, manifest.taskCount)
  const ids = new Set()
  for (const relative of manifest.tasks) {
    const taskRoot = join(benchmark, relative, '..')
    const task = JSON.parse(await readFile(join(benchmark, relative), 'utf8'))
    assert.equal(task.schemaVersion, 1)
    assert.ok(!ids.has(task.id), `duplicate task ${task.id}`)
    ids.add(task.id)
    assert.equal(task.workspace, 'workspace')
    assert.ok(task.issue.length > 0)
    assert.ok(task.acceptance.public.includes('node --test'))
    assert.ok(task.acceptance.hidden.includes('oracle/hidden.test.mjs'))
    assert.ok(task.allowedPaths.length > 0)
    assert.ok(task.marketing.length > 0)
    for (const relativePath of ['issue.md', 'workspace', 'solution', 'oracle']) {
      await stat(join(taskRoot, relativePath))
    }
    const source = JSON.stringify(task)
    assert.doesNotMatch(source, /(?:sk-[A-Za-z0-9]{12,}|api[_-]?key\s*[:=]|\btoken\s*[:=])/i)
    assert.doesNotMatch(source, /(?:^|[;&|])\s*(?:cmd|powershell|pwsh|sh|bash)(?:\s|$)/i)
  }
  assert.equal(ids.size, manifest.taskCount)
})

test('coding benchmark task directories contain one public test and one hidden test', async () => {
  for (const relative of manifest.tasks) {
    const taskRoot = join(benchmark, relative, '..')
    const publicTest = join(taskRoot, 'workspace', 'test', 'public.test.mjs')
    const hiddenTest = join(taskRoot, 'oracle', 'hidden.test.mjs')
    assert.ok((await readFile(publicTest, 'utf8')).length > 0)
    assert.ok((await readFile(hiddenTest, 'utf8')).length > 0)
    const solutionEntries = await readdir(join(taskRoot, 'solution', 'src'))
    assert.ok(solutionEntries.length > 0)
  }
})
