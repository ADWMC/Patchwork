import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject, name } from '../src/index.mjs'

test('patchwork agent registers its maintainability prompt', () => {
  const sections = []
  apply({ systemPrompt: { section: value => sections.push(value) } })

  assert.deepEqual(inject, ['systemPrompt'])
  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, name)
  assert.equal(sections[0].order, 50)
  assert.match(sections[0].text, /主人翁心态/)
  assert.match(sections[0].text, /最小正确改动/)
})

test('patchwork agent registers a non-blocking DSH post-execute hook', async () => {
  const listeners = new Map()
  const ctx = {
    systemPrompt: { section() {} },
    on(event, listener) { listeners.set(event, listener) },
  }
  apply(ctx)
  assert.equal(typeof listeners.get('tools/post-execute'), 'function')

  const original = { kind: 'accept' }
  const decision = await listeners.get('tools/post-execute')(
    { arguments: {}, agent: undefined },
    { isError: false },
    async () => original,
  )
  assert.equal(decision, original)
})
