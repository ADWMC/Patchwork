import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, loadDriver, hostAvailable } from './harness.mjs'
import { transitionTask, taskState } from '../../src/task/store.mjs'
import { createFusedDefinition } from '../../src/mechanisms/action-fusion/fused-tool.mjs'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-task-compose-'))
test('native dispatcher checks task scope, runs real acceptance and revokes stolen tools', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork({ actionFusion: true, observationPack: true })
  const cwd = await mkdtemp(join(tmpdir(), 'patchwork-task-work-'))
  try {
    const { createAgent, selectPreset } = await loadDriver()
    const { agent, tools } = createAgent({ cwd })
    const standard = createAgent({ preset: 'standard', cwd, sessionId: 'other' }).agent
    let n = 0
    const call = (name, args) => tools.execute({ agent, name, arguments: args, callId: `task-${++n}`, signal: new AbortController().signal })
    assert.equal(tools.get('patchwork_task', standard), undefined)
    await call('patchwork_task', { action: 'define', baseRevision: 0, title: 'Native task', phase: 'plan', requirements: [{ id: 'test', label: 'Test exit', kind: 'command' }] })
    const denied = await call('write', { file_path: join(cwd, 'code.js'), content: 'wrong stage' })
    assert.equal(denied.isError, true)
    const write = await call('write', { file_path: join(cwd, 'plan.md'), content: '# Plan' })
    assert.equal(write.isError, false)
    assert.equal(await readFile(join(cwd, 'plan.md'), 'utf8'), '# Plan')
    const checked = await call('patchwork_task', { action: 'check', baseRevision: taskState(agent).revision, id: 'test', tool: 'pwsh', command: "Write-Output 'REAL_TASK_OK'", description: 'Real acceptance command' })
    assert.equal(checked.isError, false)
    assert.equal(checked.value.task.status, 'ready')
    const revision = taskState(agent).revision
    const handoff = await call('patchwork_task', { action: 'handoff' })
    assert.equal(handoff.isError, false)
    assert.equal(handoff.value.handoff.requirements[0].id, 'test')
    assert.equal(handoff.value.handoff.requirements[0].evidence[0].callId, checked.value.receipt.callId)
    assert.equal(handoff.value.handoff.authority.includes('grant no host permissions'), true)
    assert.equal(JSON.stringify(handoff.value.handoff).length <= 8000, true)
    assert.equal(taskState(agent).revision, revision)
    const stolen = tools.get('patchwork_task', agent)
    selectPreset(agent, 'standard')
    await assert.rejects(stolen.execute({ action: 'inspect' }, { agent }), /Patchwork/)
    await assert.rejects(stolen.execute({ action: 'handoff' }, { agent }), /Patchwork/)
    assert.equal(tools.get('patchwork_task', agent), undefined)
    selectPreset(agent, 'patchwork')
    assert.ok(tools.get('patchwork_task', agent))
    assert.equal(taskState(agent).status, 'ready')
  } finally { await boot.dispose() }
})
test('AF reports a completed mutation and skipped follow-up after revision change', async () => {
  const { scopedAgent } = await import('../helpers/agent.mjs')
  const agent = scopedAgent({ session: { header: { id: 'af-revision', cwd: process.cwd() } } })
  let ran = false
  const fused = createFusedDefinition({ original: { name: 'write', output: { schema: {}, render: () => [] },
    execute() { transitionTask(agent, { kind: 'incoming', eventId: 'correction', sourceKind: 'user' }); return { written: true } } },
  runThenRun() { ran = true } })
  const result = await fused.execute({ file_path: 'x', then_run: { command: 'exit 0' } }, { agent })
  assert.equal(result.mutation.written, true); assert.equal(result.thenRun.status, 'skipped'); assert.equal(ran, false)
})

test('documented executor acceptance calls run through the native dispatcher and require registration first', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork({}), cwd = await mkdtemp(join(tmpdir(), 'patchwork-brief-example-'))
  try {
    const { createAgent } = await loadDriver(), { agent, tools } = createAgent({ cwd })
    const reference = await readFile(new URL('../../assets/skills/patchwork/references/superagent.md', import.meta.url), 'utf8')
    const example = reference.match(/```json\n([\s\S]*?)\n```/)[1].split('\n').map(line => JSON.parse(line))
    const path = join(cwd, 'notes.txt')
    await writeFile(path, example[2].rules.anchors[0], 'utf8')
    example[1].path = path
    let n = 0
    const call = args => tools.execute({ agent, name: 'patchwork_task', arguments: args, callId: `example-${++n}`, signal: new AbortController().signal })
    assert.equal((await call(example[0])).isError, false)
    const missing = await call({ ...example[2], baseRevision: taskState(agent).revision })
    assert.equal(missing.isError, true)
    for (const args of example.slice(1)) {
      assert.equal(args.baseRevision, taskState(agent).revision)
      assert.equal((await call(args)).isError, false)
    }
    assert.equal(taskState(agent).status, 'ready')
    await writeFile(path, 'changed to invalid content', 'utf8')
    const stale = await call({ ...example[2], baseRevision: taskState(agent).revision })
    assert.equal(stale.isError, true)
    assert.notEqual(taskState(agent).status, 'ready')
  } finally { await boot.dispose() }
})

test('standalone read-only shell invalidates artifacts but direct command acceptance keeps them current', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork({}), cwd = await mkdtemp(join(tmpdir(), 'patchwork-shell-evidence-'))
  try {
    const { createAgent } = await loadDriver(), { agent, tools } = createAgent({ cwd })
    const path = join(cwd, 'target.mjs')
    await writeFile(path, 'export const value = 1\n', 'utf8')
    let n = 0
    const call = (name, args) => tools.execute({ agent, name, arguments: args, callId: `shell-evidence-${++n}`, signal: new AbortController().signal })
    const task = args => call('patchwork_task', { ...args, baseRevision: taskState(agent).revision })
    assert.equal((await task({ action: 'define', title: 'Shell evidence', phase: 'implement', requirements: [{ id: 'tests', label: 'Run actual command', kind: 'command', targets: ['code'] }] })).isError, false)
    assert.equal((await task({ action: 'artifact', id: 'code', path })).isError, false)
    const original = await readFile(path, 'utf8')
    assert.equal((await call('pwsh', { command: "Write-Output 'READ_ONLY_PROBE'", description: 'Read-only standalone probe' })).isError, false)
    assert.equal(await readFile(path, 'utf8'), original)
    assert.equal(taskState(agent).artifacts[0].status, 'changed')
    const check = { action: 'check', id: 'tests', tool: 'pwsh', command: "Write-Output 'ACCEPTANCE_PROBE'", description: 'Execute command inside acceptance' }
    const stale = await task(check)
    assert.equal(stale.isError, true)
    assert.match(stale.content[0].text, /check executes its own command/)
    assert.equal((await task({ action: 'artifact', id: 'code', path })).isError, false)
    const accepted = await task(check)
    assert.equal(accepted.isError, false)
    assert.equal(accepted.value.receipt.outcome, 'passed')
    assert.equal(accepted.value.task.status, 'ready')
    assert.equal(taskState(agent).artifacts[0].status, 'current')
  } finally { await boot.dispose() }
})
