import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'
import { runtimeSnapshot } from '../../src/ui/runtime-state.mjs'
import { sessionRoot } from '../../src/mechanisms/observation-pack/index.mjs'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-scope-host-'))

test('native registries isolate the complete catalog and revoke it on recompose', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork({ actionFusion: true, observationPack: true, onlineContextCompact: true, evidencePreservingReducer: true, skillsMode: 'expanded' })
  try {
    const { createAgent, selectPreset } = await loadDriver()
    const { agent: standard, tools } = createAgent({ sessionId: 'standard-A', preset: 'standard' })
    const { agent: patchwork } = createAgent({ sessionId: 'patchwork-B', preset: 'patchwork' })
    const skills = boot.ctx.get('skills'), commands = boot.ctx.get('commands')
    const view = async agent => ({
      tools: tools.schemas(agent).map(s => s.name),
      fused: Boolean(tools.get('write', agent).parameters.properties.then_run),
      skills: (await skills.list({ cwd: process.cwd(), scope: agent })).map(s => s.name),
      commands: commands.list(agent).map(c => c.name),
    })
    const before = await view(standard), active = await view(patchwork)
    assert.equal(before.fused, false)
    assert.equal(before.tools.includes('obs_recall'), false)
    assert.equal(before.tools.includes('update_plan'), false)
    assert.equal(before.tools.includes('patchwork_improvement'), false)
    assert.equal(before.tools.includes('patchwork_superagent'), false)
    assert.deepEqual(before.skills, [])
    assert.equal(before.commands.includes('patchwork-review'), false)
    assert.equal(before.commands.includes('patchwork-superagent'), false)
    assert.equal(active.fused, true)
    assert.equal(active.tools.includes('obs_recall'), true)
    assert.equal(active.tools.includes('update_plan'), true)
    assert.equal(active.tools.includes('patchwork_improvement'), true)
    assert.equal(active.tools.includes('patchwork_superagent'), true)
    assert.equal(active.tools.includes('patchwork_memory'), true)
    assert.equal(active.skills.length, 13)
    assert.deepEqual([...runtimeSnapshot('patchwork-B').skills.names].sort(), [...active.skills].sort())
    assert.equal(runtimeSnapshot('patchwork-B').skills.mode, 'expanded')
    assert.equal(runtimeSnapshot('patchwork-B').skills.bodies, 'on-demand')
    assert.equal(JSON.stringify(runtimeSnapshot('patchwork-B').skills).includes('content'), false)
    assert.equal(active.commands.includes('patchwork-review'), true)
    assert.equal(active.commands.includes('patchwork-superagent'), true)
    const webUi = await skills.get('web-ui', { cwd: process.cwd(), scope: patchwork })
    assert.equal(webUi.resourceBase.kind, 'directory')
    await access(join(webUi.resourceBase.path, 'references', 'design-contract.md'))
    await access(join(webUi.resourceBase.path, 'references', 'review-route.md'))
    await access(join(webUi.resourceBase.path, 'references', 'color-decision.md'))
    assert.equal(await skills.get('web-ui', { cwd: process.cwd(), scope: standard }), undefined)
    for (const name of ['debugging', 'code-review', 'retrieval', 'documentation', 'memory', 'improvement']) {
      const skill = await skills.get(name, { cwd: process.cwd(), scope: patchwork })
      assert.equal(skill.resourceBase.kind, 'directory')
      assert.equal(await skills.get(name, { cwd: process.cwd(), scope: standard }), undefined)
    }

    const result = await tools.execute({ agent: standard, name: 'pwsh', callId: 'standard-long', rootCallId: 'standard-long',
      arguments: { command: "1..2000 | ForEach-Object { 'all tests pass ' + $_ }", description: 'Foreign session isolation probe' }, signal: new AbortController().signal })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes('2000'))
    assert.deepEqual(result.additionalContexts ?? [], [])
    assert.equal(runtimeSnapshot('standard-A'), null)
    await assert.rejects(access(sessionRoot('standard-A')))

    const improvement = tools.get('patchwork_improvement', patchwork)
    const superagent = tools.get('patchwork_superagent', patchwork)
    const memory = await tools.execute({ agent: patchwork, name: 'patchwork_memory', callId: 'memory-output-contract', rootCallId: 'memory-output-contract', arguments: { action: 'propose', key: 'native-output', value: 'Verify host schema and rendered memory IDs' }, signal: new AbortController().signal })
    assert.equal(memory.isError, false)
    assert.equal(memory.value.status, 'committed')
    assert.ok(memory.content.some(item => item.type === 'text' && item.text.includes(memory.value.recordId)))
    assert.ok(improvement)
    assert.ok(superagent)
    await tools.execute({ agent: patchwork, name: 'pwsh', callId: 'real-receipt', rootCallId: 'real-receipt', arguments: { command: 'exit 7', description: 'Synthetic failure through the real host tool' }, signal: new AbortController().signal })
    const incident = await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'improvement-incident', rootCallId: 'improvement-incident',
      arguments: { action: 'incident', kind: 'failure', sourceReceiptIds: ['real-receipt'], trigger: 'real host failure', actionText: 'retain evidence' }, signal: new AbortController().signal })
    assert.equal(incident.isError, false)
    assert.equal(incident.value.status, 'committed')

    const stolen = tools.get('obs_recall', patchwork)
    selectPreset(patchwork, 'standard')
    assert.deepEqual(await view(patchwork), before)
    assert.equal(await skills.get('web-ui', { cwd: process.cwd(), scope: patchwork }), undefined)
    assert.equal(await skills.get('memory', { cwd: process.cwd(), scope: patchwork }), undefined)
    await assert.rejects(improvement.execute({ action: 'list' }, { agent: patchwork }), /Patchwork agent preset/)
    await assert.rejects(superagent.execute({ action: 'inspect' }, { agent: patchwork }), /Patchwork agent preset/)
    await assert.rejects(stolen.execute({ id: 'obs_' + 'a'.repeat(24) }, { agent: patchwork }), /Patchwork agent preset/)
    selectPreset(patchwork, 'patchwork')
    assert.deepEqual(await view(patchwork), active)
    assert.deepEqual(await view(standard), before)
  } finally { await boot.dispose() }
})
