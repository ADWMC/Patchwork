import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedAgent } from './helpers/agent.mjs'
import { matchesUiWork, registerUiGuidance } from '../src/skills/ui-guidance.mjs'

function incoming(id, text, kind = 'user') {
  return { id, source: { kind }, content: [{ type: 'text', text }] }
}

test('UI guidance matches work, not research or backend tasks', () => {
  assert.equal(matchesUiWork('制作可离线打开的家居控制页面'), true)
  assert.equal(matchesUiWork('审查 React 控制面板的布局'), true)
  assert.equal(matchesUiWork('去调研 UI skill 并总结来源'), false)
  assert.equal(matchesUiWork('修复后端 API 重试'), false)
})

test('bundled guidance is scoped to Patchwork UI turns and deduplicated', async () => {
  let hook
  registerUiGuidance({ on: (name, fn) => { if (name === 'agent/pre-step') hook = fn } }, {}, 'TEST WEB UI BODY')
  assert.equal(typeof hook, 'function')
  const patchwork = scopedAgent({ session: { header: { id: 'pw' } } })
  const standard = scopedAgent({ session: { header: { id: 'std' } } }, 'standard')
  const next = async () => ({ kind: 'enter', messages: [] })
  const task = incoming('u1', '制作 HTML 控制面板')
  const first = await hook({ agent: patchwork, messages: [task] }, next)
  assert.equal(first.messages.length, 1)
  assert.equal(first.messages[0].source.kind, 'patchwork')
  assert.match(first.messages[0].content[0].text, /TEST WEB UI BODY/)
  assert.equal((await hook({ agent: patchwork, messages: [task] }, next)).messages.length, 0)
  assert.equal((await hook({ agent: standard, messages: [task] }, next)).messages.length, 0)
  assert.equal((await hook({ agent: patchwork, messages: [incoming('u2', '调研 UI skill')] }, next)).messages.length, 0)
  assert.equal((await hook({ agent: patchwork, messages: [incoming('u3', '制作 HTML 控制面板', 'patchwork')] }, next)).messages.length, 0)
  patchwork.selectPreset('standard')
  assert.equal((await hook({ agent: patchwork, messages: [incoming('u4', '制作 HTML 控制面板')] }, next)).messages.length, 0)
  patchwork.selectPreset('patchwork')
  assert.equal((await hook({ agent: patchwork, messages: [incoming('u5', '制作 HTML 控制面板')] }, next)).messages.length, 1)
})

test('disabled skill pack emits no UI guidance', () => {
  let called = false
  registerUiGuidance({ on: () => { called = true } }, { skillsEnabled: false })
  assert.equal(called, false)
})

test('bundled UI guidance exposes review and color routes only to Patchwork work', async () => {
  let hook
  registerUiGuidance({ on: (name, fn) => { if (name === 'agent/pre-step') hook = fn } })
  const next = async () => ({ kind: 'enter', messages: [] })
  const task = incoming('color-1', '设计 Web UI 的浅色和暗色配色')
  const patchwork = scopedAgent({ session: { header: { id: 'color-pw' } } })
  const standard = scopedAgent({ session: { header: { id: 'color-std' } } }, 'standard')
  const active = await hook({ agent: patchwork, messages: [task] }, next)
  assert.match(active.messages[0].content[0].text, /references\/review-route\.md/)
  assert.match(active.messages[0].content[0].text, /references\/color-decision\.md/)
  assert.equal((await hook({ agent: standard, messages: [task] }, next)).messages.length, 0)
})
