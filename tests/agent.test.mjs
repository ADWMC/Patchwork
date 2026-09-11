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

  assert.deepEqual(inject, ['systemPrompt', 'commands', 'tools'])
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

test('every mechanism the plugin advertises can actually be enabled', () => {
  const definitions = []
  const listeners = new Map()
  apply(
    {
      systemPrompt: { section() {} },
      commands: { register() {} },
      tools: { register: definition => definitions.push(definition) },
      on(event, listener) { listeners.set(event, listener) },
    },
    {
      actionFusion: true,
      observationPack: true,
      evidencePreservingReducer: true,
      onlineContextCompact: true,
    },
  )
  assert.deepEqual(definitions.map(definition => definition.name).sort(), ['obs_recall', 'update_plan'])
  assert.deepEqual([...listeners.keys()].sort(), [
    'agent/created',
    'agent/request',
    'agent/status',
    'agent/turn-stopping',
    'tools/post-execute',
  ])
})

test('enabling the reducer registers its projection', () => {
  const listeners = new Map()
  apply(
    {
      systemPrompt: { section() {} },
      commands: { register() {} },
      on(event, listener) { listeners.set(event, listener) },
    },
    { evidencePreservingReducer: true },
  )
  assert.deepEqual([...listeners.keys()], ['tools/post-execute'])
})

test('enabling Action Fusion registers its agent hook', () => {
  const listeners = new Map()
  apply(
    {
      systemPrompt: { section() {} },
      commands: { register() {} },
      on(event, listener) { listeners.set(event, listener) },
    },
    { actionFusion: true },
  )
  assert.deepEqual([...listeners.keys()].sort(), ['agent/created', 'tools/post-execute'])
})

test('enabling ObservationPack registers its projection and recall tool', () => {
  const listeners = new Map()
  const tools = []
  apply(
    {
      systemPrompt: { section() {} },
      commands: { register() {} },
      tools: { register: definition => tools.push(definition) },
      on(event, listener) { listeners.set(event, listener) },
    },
    { observationPack: true },
  )
  assert.deepEqual([...listeners.keys()], ['tools/post-execute'])
  assert.deepEqual(tools.map(definition => definition.name), ['obs_recall'])
})
