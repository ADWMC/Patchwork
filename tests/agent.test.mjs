import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject, name } from '../src/index.mjs'

test('patchwork agent registers its maintainability prompt', () => {
  const sections = []
  const commands = { register: def => commands.registered = def }
  apply({
    systemPrompt: { section: value => sections.push(value) },
    commands,
    on() {},
  })

  assert.deepEqual(inject, ['systemPrompt', 'commands'])
  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, name)
  assert.equal(sections[0].order, 50)
  assert.match(sections[0].text, /主人翁心态/)
  assert.match(sections[0].text, /最小正确改动/)
  assert.equal(commands.registered.name, 'patchwork-review')
})

test('patchwork agent registers a non-blocking DSH post-execute hook', async () => {
  const listeners = new Map()
  const ctx = {
    systemPrompt: { section() {} },
    commands: { register() {} },
    on(event, listener) { listeners.set(event, listener) },
  }
  apply(ctx)
  assert.equal(typeof listeners.get('tools/post-execute'), 'function')

  const original = { kind: 'accept' }
  const decision = await listeners.get('tools/post-execute')(
    { name: 'read', arguments: {}, agent: undefined },
    { isError: false },
    async () => original,
  )
  assert.equal(decision, original)
})

test('every mechanism is off unless configuration enables it', () => {
  const listeners = new Map()
  apply({
    systemPrompt: { section() {} },
    commands: { register() {} },
    on(event, listener) { listeners.set(event, listener) },
  })
  assert.deepEqual([...listeners.keys()], ['tools/post-execute'])
})

test('enabling an unavailable mechanism fails loudly instead of being skipped', () => {
  const ctx = {
    systemPrompt: { section() {} },
    commands: { register() {} },
    on() {},
  }
  assert.throws(() => apply(ctx, { observationPack: true }), /observationPack is enabled but/)
  assert.throws(() => apply(ctx, { evidencePreservingReducer: true }), /evidencePreservingReducer is enabled but/)
  assert.throws(() => apply(ctx, { onlineContextCompact: true }), /onlineContextCompact is enabled but/)
})
