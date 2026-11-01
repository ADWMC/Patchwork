import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { registerMemoryTool } from '../src/memory/tool.mjs'
import { memorySnapshot, proposeMemory } from '../src/memory/store.mjs'

async function fixture(id) {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-memory-tool-'))
  let tool, dispose
  const ctx = { tools: { register(value) { tool = value } }, effect(fn) { dispose = fn() } }
  const agent = scopedAgent({ ctx, session: { header: { id, cwd: process.env.DSH_HOME } } })
  registerMemoryTool(ctx)
  return { agent, tool, dispose }
}
test('memory tool renders usable IDs and recalled content; list metadata stays bounded and searchable', async () => {
  const f = await fixture('render-memory')
  const proposed = await f.tool.execute({ action: 'propose', key: 'delivery', value: 'Run the required checks' }, { agent: f.agent })
  assert.match(f.tool.output.render({}, proposed)[0].text, new RegExp(proposed.recordId))
  await f.tool.execute({ action: 'confirm', id: proposed.recordId, expectedRevision: proposed.revision }, { agent: f.agent, userConfirmed: true })
  const recalled = await f.tool.execute({ action: 'recall' }, { agent: f.agent })
  assert.match(f.tool.output.render({}, recalled)[0].text, /Run the required checks/)
  for (let i = 0; i < 8; i++) await proposeMemory(f.agent, { key: `bounded-${i}`, value: 'do not inject this value during list' })
  const list = await f.tool.execute({ action: 'list' }, { agent: f.agent })
  assert.equal(list.status, 'indexed'); assert.equal(list.entries.length, 5); assert.equal(list.hasMore, true)
  assert.equal(list.entries.some(entry => 'value' in entry), false)
  assert.equal(list.entries.some(entry => 'changes' in entry || 'sources' in entry), false)
  assert.equal(list.nextOffset, 5)
  const next = await f.tool.execute({ action: 'list', offset: list.nextOffset }, { agent: f.agent })
  assert.equal(new Set([...list.entries, ...next.entries].map(entry => entry.id)).size, 9)
  assert.equal(next.nextOffset, null)
  const detail = await f.tool.execute({ action: 'inspect', id: proposed.recordId }, { agent: f.agent })
  assert.equal(detail.record.value, 'Run the required checks')
  assert.equal((await f.tool.execute({ action: 'list', query: 'delivery' }, { agent: f.agent })).entries[0].id, proposed.recordId)
  f.dispose()
})
test('disposing a registered memory tool aborts its queued write and its retained reference', async () => {
  const f = await fixture('dispose-memory')
  const pending = f.tool.execute({ action: 'propose', key: 'late', value: 'must not commit' }, { agent: f.agent })
  f.dispose()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(memorySnapshot(f.agent).entries.length, 0)
  await assert.rejects(f.tool.execute({ action: 'list' }, { agent: f.agent }), { name: 'AbortError' })
})
