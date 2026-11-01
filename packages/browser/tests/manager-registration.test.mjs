import assert from 'node:assert/strict'
import test from 'node:test'
import { createBrowserManager } from '../src/index.mjs'
import { browserClient } from '../src/browser/tool.mjs'
import { isBrowserAgent } from '../src/scope.mjs'
import { scopedAgent } from './helpers/agent.mjs'

test('failed skill registration rolls back authorization, tool and browser client', async () => {
  let registered = false
  const agent = scopedAgent({ session: { header: { id: 'registration-failure', cwd: process.cwd() } }, ctx: {
    tools: { register() { registered = true; return () => { registered = false } } },
    skills: { register() { throw new Error('skill registry failed') } },
  } }, 'standard')
  const ctx = { get: name => name === 'agents' ? { get: () => agent } : undefined }
  const manager = createBrowserManager(ctx)
  assert.throws(() => manager.enable(agent, 'standard'), /skill registry failed/)
  assert.equal(registered, false)
  assert.equal(isBrowserAgent(agent), false)
  assert.equal(browserClient(agent), undefined)
  await manager.dispose()
  assert.equal(manager.status(agent).enabled, false)
})
