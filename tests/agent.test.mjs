import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject, name } from '../src/runtime.mjs'
import { apply as applyBridge, inject as bridgeInject } from '../src/index.mjs'

// 用户配置落在宿主用户数据根下；指到临时目录，测试不读到开发机 ~/.dsh 里的开关。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-agent-home-'))

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
  assert.deepEqual(inject, ['skills', 'commands', 'tools', 'agentPresets'])
  assert.equal(name, 'patchwork-runtime')
  assert.equal(m.commands.registered.name, 'patchwork-review')
})

test('registers expanded DSH skills with catalog-safe descriptions', async () => {
  const m = mockCtx()
  await apply(m.ctx, { skillsMode: 'expanded' })
  const names = m.skills.items.map(s => s.name).sort()
  assert.deepEqual(names, [
    'anti-slop',
    'architecture',
    'code-review',
    'collaborator',
    'debt',
    'debugging',
    'documentation',
    'evidence',
    'improvement',
    'memory',
    'patchwork',
    'retrieval',
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
  const webUi = m.skills.items.find(s => s.name === 'web-ui')
  assert.equal(webUi.resourceBase.kind, 'directory')
  assert.match(webUi.resourceBase.path.replaceAll('\\', '/'), /\/assets\/skills\/web-ui$/)
  for (const name of ['debugging', 'code-review', 'retrieval', 'documentation', 'memory', 'improvement']) {
    assert.equal(m.skills.items.find(s => s.name === name).resourceBase.kind, 'directory')
  }
})

test('default skillsMode retains the seven-skill core catalog', async () => {
  const m = mockCtx()
  await apply(m.ctx)
  assert.deepEqual(m.skills.items.map(s => s.name).sort(), ['anti-slop', 'architecture', 'collaborator', 'evidence', 'patchwork', 'standards', 'web-ui'])
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
  assert.deepEqual([...m.listeners.keys()], ['agent/created', 'agent/disposed', 'agent-preset/selected', 'tools/pre-execute', 'agent/inbox/inserted', 'agent/pre-step', 'tools/result', 'agent/turn-stopping', 'agent/status', 'tools/post-execute'])
})

test('every mechanism the plugin advertises can actually be enabled', async () => {
  const m = mockCtx()
  await apply(m.ctx, {
    actionFusion: true,
    observationPack: true,
    evidencePreservingReducer: true,
    onlineContextCompact: true,
  })
  assert.deepEqual(m.tools.registered.map(d => d.name).sort(), ['obs_recall', 'patchwork_code', 'patchwork_evidence', 'patchwork_fetch', 'patchwork_improvement', 'patchwork_memory', 'patchwork_project_docs', 'patchwork_search', 'patchwork_superagent', 'patchwork_task', 'update_plan'])
  assert.deepEqual([...m.listeners.keys()].sort(), [
    'agent-preset/selected',
    'agent/assistant-stream',
    'agent/created',
    'agent/disposed',
    'agent/inbox/inserted',
    'agent/pre-step',
    'agent/status',
    'agent/turn-stopping',
    'tools/post-execute',
    'tools/pre-execute',
    'tools/result',
  ])
})

test('enabling the reducer registers its projection', async () => {
  const m = mockCtx()
  await apply(m.ctx, { evidencePreservingReducer: true })
  assert.deepEqual([...m.listeners.keys()], ['agent/created', 'agent/disposed', 'agent-preset/selected', 'tools/pre-execute', 'agent/inbox/inserted', 'agent/pre-step', 'tools/result', 'agent/turn-stopping', 'agent/status', 'tools/post-execute'])
})

test('enabling Action Fusion registers its agent hook', async () => {
  const m = mockCtx()
  await apply(m.ctx, { actionFusion: true })
  assert.deepEqual([...m.listeners.keys()].sort(), ['agent-preset/selected', 'agent/created', 'agent/disposed', 'agent/inbox/inserted', 'agent/pre-step', 'agent/status', 'agent/turn-stopping', 'tools/post-execute', 'tools/pre-execute', 'tools/result'])
})

test('enabling ObservationPack registers its projection and recall tool', async () => {
  const m = mockCtx()
  await apply(m.ctx, { observationPack: true })
  assert.deepEqual([...m.listeners.keys()], ['agent/created', 'agent/disposed', 'agent-preset/selected', 'tools/pre-execute', 'agent/inbox/inserted', 'agent/pre-step', 'tools/result', 'agent/turn-stopping', 'agent/status', 'tools/post-execute'])
  assert.deepEqual(m.tools.registered.map(d => d.name), ['patchwork_task', 'patchwork_superagent', 'patchwork_evidence', 'patchwork_search', 'patchwork_fetch', 'patchwork_code', 'patchwork_project_docs', 'patchwork_memory', 'patchwork_improvement', 'obs_recall'])
})

test('profile bridge never registers skills, tools, commands, or model listeners', async () => {
  const m = mockCtx()
  await applyBridge(m.ctx, { actionFusion: true, observationPack: true, evidencePreservingReducer: true, onlineContextCompact: true })
  assert.deepEqual(bridgeInject, ['agents', 'agentPresets'])
  assert.deepEqual(m.skills.items, [])
  assert.deepEqual(m.tools.registered, [])
  assert.equal(m.commands.registered, null)
  assert.equal(m.listeners.size, 0)
  assert.equal(m.sections.length, 0)
})
