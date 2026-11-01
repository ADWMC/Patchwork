import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'
import { createBrowserManager } from '../../packages/browser/src/index.mjs'
import { browserClient } from '../../packages/browser/src/browser/tool.mjs'

const home = await mkdtemp(join(tmpdir(), 'patchwork-browser-resource-host-'))
process.env.DSH_HOME = home
after(() => rm(home, { recursive: true, force: true }))

test('native DSH composition passes browser resource policy, isolates standard sessions and revokes old clients', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork()
  const manager = createBrowserManager(boot.ctx, { maxInstances: 1, maxTabs: 3, idleTimeoutMs: 60000, memoryTargetMiB: 256, autoReclaim: false })
  try {
    const { createAgent, selectPreset } = await loadDriver()
    const { agent, tools } = createAgent({ sessionId: 'resource-native-a', preset: 'patchwork' })
    const { agent: standard } = createAgent({ sessionId: 'resource-native-standard', preset: 'standard' })
    assert.equal(tools.schemas(standard).some(tool => tool.name === 'patchwork_browser'), false)
    assert.equal(browserClient(standard), undefined)
    assert.equal(tools.schemas(agent).some(tool => tool.name === 'patchwork_browser'), false)
    manager.enable(agent, 'patchwork')
    assert.equal(tools.schemas(agent).some(tool => tool.name === 'patchwork_browser'), true)
    manager.enable(standard, 'standard')
    assert.equal(tools.schemas(standard).some(tool => tool.name === 'patchwork_browser'), true)
    assert.equal(tools.schemas(standard).some(tool => tool.name === 'patchwork_memory'), false)
    const client = browserClient(agent), status = await client.status()
    assert.equal(status.resources.host.maxInstances, 1); assert.equal(status.resources.host.memoryTargetMiB, 256)
    assert.equal(status.resources.maxTabs, 3); assert.equal(status.resources.idleTimeoutMs, 60000); assert.equal(status.resources.autoReclaim, false)
    assert.equal(status.resources.host.running, 0)
    await client.action({ action: 'resourceMode', autoReclaim: true }); assert.equal((await client.status()).resources.autoReclaim, true)
    selectPreset(agent, 'standard')
    await assert.rejects(client.action({ action: 'resourceMode', autoReclaim: false }), /browser access/i)
    await assert.rejects(client.status(), /browser access/i)
    await manager.disable(agent)
    manager.enable(agent, 'standard')
    await assert.rejects(client.status(), /ended/)
    assert.equal(tools.schemas(agent).some(tool => tool.name === 'patchwork_browser'), true)
    await manager.disable(agent)
    assert.equal(tools.schemas(agent).some(tool => tool.name === 'patchwork_browser'), false)
    assert.equal(tools.schemas(standard).some(tool => tool.name === 'patchwork_browser'), true)
    assert.equal((await browserClient(standard).status()).resources.host.running, 0)
  } finally { await manager.dispose(); await boot.dispose() }
})

test('native DSH composition can disable browser registration without disabling other Patchwork tools', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork()
  const manager = createBrowserManager(boot.ctx)
  try {
    const { createAgent } = await loadDriver(), { agent, tools } = createAgent({ sessionId: 'resource-native-disabled', preset: 'patchwork' })
    const names = tools.schemas(agent).map(tool => tool.name)
    assert.equal(names.includes('patchwork_browser'), false); assert.equal(browserClient(agent), undefined)
    assert.equal(names.includes('patchwork_task'), true); assert.equal(names.includes('patchwork_memory'), true)
  } finally { await manager.dispose(); await boot.dispose() }
})
