import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedAgent } from './helpers/agent.mjs'
import { grantBrowserAccess, isBrowserAgent, requireBrowserAgent, resolveBrowserAgent } from '../src/scope.mjs'
import { observedLocator } from '../src/browser/locator.mjs'
import { BrowserSession } from '../src/browser/session.mjs'

test('all modes require an explicit grant tied to the real composition and workspace', () => {
  const a = scopedAgent({ session: { header: { id: 'a', cwd: 'workspace-a' } } }, 'standard')
  const b = scopedAgent({ session: { header: { id: 'b' } } }, 'standard')
  assert.equal(isBrowserAgent(a), false)
  const revoke = grantBrowserAccess(a)
  assert.equal(isBrowserAgent(a), true)
  assert.equal(isBrowserAgent(b), false)
  assert.equal(isBrowserAgent({ session: { header: { id: 'a', agentPreset: 'patchwork' } } }), false)
  a.session.header.cwd = 'workspace-b'
  assert.throws(() => requireBrowserAgent(a), /access/)
  a.session.header.cwd = 'workspace-a'; a.selectPreset('ptc')
  assert.equal(isBrowserAgent(a), false)
  grantBrowserAccess(a); revoke()
  assert.equal(isBrowserAgent(a), true, 'old revocation cannot revoke a newer grant')
  const ctx = { get: () => ({ get: id => id === 'a' ? a : b }) }
  assert.equal(resolveBrowserAgent(ctx, 'b'), undefined)
  assert.equal(resolveBrowserAgent(ctx, 'a'), a)
})

test('semantic actions reject stale observations before locating and reject missing or ambiguous targets', async () => {
  let calls = 0, count = 1
  const locator = { count: async () => count }
  const page = { getByRole: () => { calls++; return locator } }
  const args = { target: { by: 'role', value: 'button', name: '保存' }, observationId: 'current' }
  await assert.rejects(observedLocator(page, { ...args, observationId: 'old' }, 'current'), /expired/)
  assert.equal(calls, 0)
  assert.equal(await observedLocator(page, args, 'current'), locator)
  count = 2; await assert.rejects(observedLocator(page, args, 'current'), /ambiguous/)
  count = 0; await assert.rejects(observedLocator(page, args, 'current'), /disappeared/)
  await assert.rejects(observedLocator(page, { ...args, selector: 'button' }, 'current'), /either/)
})

test('takeover or revocation while counting a locator prevents the delayed Agent click', async () => {
  const agent = scopedAgent({ session: { header: { id: 'locator-checkpoint' } } })
  const session = new BrowserSession(agent)
  let complete, started
  const counting = new Promise(resolve => { started = resolve })
  const page = { getByText: () => ({ count: () => { started(); return new Promise(resolve => { complete = resolve }) } }) }
  session.tabs.set('a', { page }); session.selectedTabId = 'a'; session.observationId = 'current'
  const pending = session.locator(page, { target: { by: 'text', value: '开灯' }, observationId: 'current' }, 'agent')
  await counting; session.control = 'user'; complete(1)
  await assert.rejects(pending, /接管/)
  session.control = 'agent'
  const revoke = session.locator(page, { target: { by: 'text', value: '开灯' }, observationId: 'current' }, 'agent')
  await Promise.resolve(); agent.selectPreset('standard'); complete(1)
  await assert.rejects(revoke, /access/)
})
