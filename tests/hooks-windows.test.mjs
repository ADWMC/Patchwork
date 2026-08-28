import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'tests/fixtures/patchwork-hooks.json'), 'utf8'))
const hooks = Object.values(config.hooks).flat().flatMap(entry => entry.hooks)

test('hook commands are shell-agnostic and point at shipped scripts', () => {
  assert.ok(hooks.length > 0)
  for (const hook of hooks) {
    assert.match(hook.command, /^node\s+/)
    assert.doesNotMatch(hook.command, /(^|\s)exec\s|&&|\|\||>\/dev\/null|2>&1/)
    const match = hook.command.match(/hooks[\\/]([\w.-]+\.m?js)/)
    assert.ok(match)
    assert.equal(existsSync(join(root, 'hooks', match[1])), true)
  }
})

test('hook exits when stdin stays open', async () => {
  const child = spawn(process.execPath, [join(root, 'hooks/patchwork-hook.mjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const output = []
  child.stdout.on('data', chunk => output.push(chunk))
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('hook remained blocked on open stdin'))
    }, 2000)
    child.once('error', reject)
    child.once('exit', value => {
      clearTimeout(timeout)
      resolve(value)
    })
  })

  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(Buffer.concat(output).toString()), { ok: true, event: null })
})

test('hook consumes JSON input and emits structured output', async () => {
  const child = spawn(process.execPath, [join(root, 'hooks/patchwork-hook.mjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const chunks = []
  child.stdout.on('data', chunk => chunks.push(chunk))
  child.stdin.end(JSON.stringify({ event: 'SessionStart' }))
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('hook did not finish')), 2000)
    child.once('error', reject)
    child.once('exit', value => {
      clearTimeout(timeout)
      resolve(value)
    })
  })
  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), { ok: true, event: 'SessionStart' })
})
