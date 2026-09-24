import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject, name } from '../src/index.mjs'

function mockCtx() {
  const sections = []
  const commands = { registered: null, register(def) { commands.registered = def } }
  const skills = {
    items: [],
    register(skill) {
      skills.items.push(skill)
      return () => {}
    },
  }
  const listeners = new Map()
  const tools = { registered: [], register(def) { tools.registered.push(def) } }
  return {
    sections,
    commands,
    skills,
    tools,
    listeners,
    ctx: {
      systemPrompt: { section: v => sections.push(v) },
      commands,
      skills,
      tools,
      on(event, listener) { listeners.set(event, listener) },
    },
  }
}

test('patchwork does not inject any systemPrompt section', async () => {
  const m = mockCtx()
  await apply(m.ctx)
  assert.equal(m.sections.length, 0)
  assert.deepEqual(inject, ['skills', 'commands', 'tools'])
  assert.equal(name, 'patchwork-agent')
  assert.equal(m.commands.registered.name, 'patchwork-review')
})

test('registers seven lean DSH skills with catalog-safe descriptions', async () => {
  const m = mockCtx()
  await apply(m.ctx)
  const names = m.skills.items.map(s => s.name).sort()
  assert.deepEqual(names, [
    'anti-slop',
    'architecture',
    'collaborator',
    'evidence',
    'patchwork',
    'standards',
    'web-ui',
  ])
  for (const skill of m.skills.items) {
    assert.ok(skill.description.length > 20, `${skill.name} description too short`)
    assert.ok(skill.description.length <= 500, `${skill.name} description exceeds DSH catalog cap`)
    assert.ok(skill.content.length < 4000, `${skill.name} body too large: ${skill.content.length}`)
    assert.equal(skill.source, 'runtime', `${skill.name} missing source: skill tool load fails without it`)
    assert.equal(skill.invocation.modelInvocable, true)
  }
})

test('skillsEnabled false skips skill registration', async () => {
  const m = mockCtx()
  await apply(m.ctx, { skillsEnabled: false })
  assert.equal(m.skills.items.length, 0)
})

test('registers a non-blocking DSH post-execute hook', async () => {
  const m = mockCtx()
  await apply(m.ctx)
  assert.equal(typeof m.listeners.get('tools/post-execute'), 'function')
  const original = { kind: 'accept' }
  const decision = await m.listeners.get('tools/post-execute')(
    { name: 'read', arguments: {}, agent: undefined },
    { isError: false },
    async () => original,
  )
  assert.equal(decision, original)
})

test('every mechanism is off unless configuration enables it', async () => {
  const m = mockCtx()
  await apply(m.ctx)
  assert.deepEqual([...m.listeners.keys()], ['tools/post-execute'])
})

test('every mechanism the plugin advertises can actually be enabled', async () => {
  const m = mockCtx()
  await apply(m.ctx, {
    actionFusion: true,
    observationPack: true,
    evidencePreservingReducer: true,
    onlineContextCompact: true,
  })
  assert.deepEqual(m.tools.registered.map(d => d.name).sort(), ['obs_recall', 'update_plan'])
  assert.deepEqual([...m.listeners.keys()].sort(), [
    'agent/created',
    'agent/request',
    'agent/status',
    'agent/turn-stopping',
    'tools/post-execute',
  ])
})

test('enabling the reducer registers its projection', async () => {
  const m = mockCtx()
  await apply(m.ctx, { evidencePreservingReducer: true })
  assert.deepEqual([...m.listeners.keys()], ['tools/post-execute'])
})

test('enabling Action Fusion registers its agent hook', async () => {
  const m = mockCtx()
  await apply(m.ctx, { actionFusion: true })
  assert.deepEqual([...m.listeners.keys()].sort(), ['agent/created', 'tools/post-execute'])
})

test('enabling ObservationPack registers its projection and recall tool', async () => {
  const m = mockCtx()
  await apply(m.ctx, { observationPack: true })
  assert.deepEqual([...m.listeners.keys()], ['tools/post-execute'])
  assert.deepEqual(m.tools.registered.map(d => d.name), ['obs_recall'])
})
