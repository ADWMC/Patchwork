import assert from 'node:assert/strict'
import test from 'node:test'
import { bootPatchwork, loadDriver, hostAvailable } from './harness.mjs'
import { createBrowserManager } from '../../packages/browser/src/index.mjs'

test('optional browser skill uses the authorized Agent scope and disappears on revocation', { skip: !hostAvailable() }, async () => {
  const boot=await bootPatchwork(),manager=createBrowserManager(boot.ctx)
  try {
    const driver=await loadDriver(),a=driver.createAgent({sessionId:'browser-skill-a',preset:'standard'}),b=driver.createAgent({sessionId:'browser-skill-b',preset:'standard'})
    const skill=owner=>boot.ctx.get('skills').get('browser-workspace',{cwd:process.cwd(),scope:owner.agent})
    assert.equal(await skill(a),undefined);manager.enable(a.agent,'standard')
    const definition=await skill(a);assert.ok(definition.content.includes('annotations'));assert.equal(definition.resourceBase.kind,'directory')
    assert.equal(await skill(b),undefined)
    await manager.disable(a.agent);assert.equal(await skill(a),undefined)
    manager.enable(a.agent,'standard');assert.ok(await skill(a))
    driver.selectPreset(a.agent,'patchwork');await manager.disable(a.agent);assert.equal(await skill(a),undefined)
  } finally {await manager.dispose();await boot.dispose()}
})
