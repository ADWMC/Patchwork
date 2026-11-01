import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBrowserManager } from '../src/index.mjs'
import { scopedAgent } from './helpers/agent.mjs'
import { isBrowserAgent } from '../src/scope.mjs'

for (const graceful of [true, false]) test(`browser disable saves opt-in storage only on graceful close: ${graceful}`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-browser-disable-'))
  let session, definition, releaseSave, saving
  const savingStarted = new Promise(resolve => { saving = resolve })
  const agent = scopedAgent({ session: { header: { id: 'disable-test', cwd: root } }, ctx: { tools: { register(value) { definition = value; return () => {} } }, skills: { register() { return () => {} } } } }, 'patchwork')
  const manager = createBrowserManager({ get: name => name === 'agents' ? { get: () => agent } : undefined }, {}, { root, keyProvider: async () => Buffer.alloc(32, 21), resources: { register(value) { session = value }, unregister() {} } })
  manager.enable(agent, 'patchwork')
  const result = await session.profiles.edit({ action: 'createProfile', revision: 0, profile: { name: 'Temporary opt-in', mode: 'native', persistStorage: true } })
  session.profileId = result.profiles.find(profile => profile.id !== 'native').id; session.profile = await session.profiles.get(session.profileId)
  session.context = { async storageState() { saving(); await new Promise(resolve => { releaseSave = resolve }); return { cookies: [], origins: [] } }, async close() {} }
  const disabling = manager.disable(agent, { graceful })
  if (graceful) {
    await savingStarted
    await assert.rejects(definition.execute({ action: 'tabs' }, { agent }), /closing/)
    releaseSave()
  }
  await disabling
  assert.equal(Boolean(await stat(session.profiles.encryptedPath(session.profileId)).catch(() => null)), graceful)
  assert.equal(isBrowserAgent(agent), false)
  await manager.dispose()
})
