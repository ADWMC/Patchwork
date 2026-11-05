import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'
import { taskState, transitionTask } from '../../src/task/store.mjs'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-behavior-contract-'))

/**
 * 行为门第二层：契约级行为探针。
 *
 * 第一层（tests/skill-behavior.test.mjs）判定文本遵守与否；本层经真实
 * Loader 组合执行工具契约，断言机器级结果——技能声称的不变量在状态机里
 * 真的成立。这里只收第一层覆盖不到、别处也没有契约测试的行为。
 */

const skip = hostAvailable() ? false : 'DSH host packages are not installed'

test('a correction invalidates the affected requirement evidence instead of carrying it forward', { skip }, async () => {
  const boot = await bootPatchwork({})
  const cwd = await mkdtemp(join(tmpdir(), 'patchwork-correct-work-'))
  try {
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ cwd })
    let n = 0
    const call = (name, args) => tools.execute({ agent, name, arguments: args, callId: `correct-${++n}`, signal: new AbortController().signal })
    await call('patchwork_task', {
      action: 'define', baseRevision: 0, title: '纠正后失效', phase: 'implement',
      requirements: [{ id: 'tests', label: '行为测试', kind: 'command', targets: ['code'] }],
    })
    await call('write', { file_path: join(cwd, 'sum.mjs'), content: 'export const sum = (a, b) => a + b\n' })
    await call('patchwork_task', { action: 'artifact', baseRevision: taskState(agent).revision, id: 'code', path: join(cwd, 'sum.mjs') })
    const passed = await call('patchwork_task', { action: 'check', baseRevision: taskState(agent).revision, id: 'tests', command: "Write-Output 'OK'", description: '首次验收' })
    assert.equal(passed.value.task.status, 'ready')
    assert.equal(passed.value.task.requirements[0].status, 'passed')

    const corrected = await call('patchwork_task', { action: 'correct', baseRevision: taskState(agent).revision, title: '纠正后重新核对', affected: ['tests'] })
    assert.equal(corrected.isError, false)
    const requirement = corrected.value.task.requirements[0]
    assert.equal(requirement.status, 'stale', '纠正必须使旧证据失效，而不是带着通过记录继续')
    assert.equal(corrected.value.task.status, 'partial', '纠正后任务回到部分完成，不得保持 ready')
    assert.equal(corrected.value.task.lastCorrection.affected[0], 'tests')
    assert.equal(requirement.evidence.length, 0, '纠正清空要求上的旧证据，历史收据留在账本')
  } finally { await boot.dispose() }
})

test('a semantic assessment stays unknown even when the model states support; only host review accepts', { skip }, async () => {
  const boot = await bootPatchwork({})
  const cwd = await mkdtemp(join(tmpdir(), 'patchwork-semantic-work-'))
  try {
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ cwd })
    let n = 0
    const call = (name, args) => tools.execute({ agent, name, arguments: args, callId: `semantic-${++n}`, signal: new AbortController().signal })
    await call('patchwork_task', {
      action: 'define', baseRevision: 0, title: '语义验收保持未知', phase: 'verify',
      requirements: [{ id: 'reads-well', label: '文档表达对读者可用', kind: 'semantic' }],
    })
    const supported = await call('patchwork_task', { action: 'assessment', baseRevision: taskState(agent).revision, id: 'reads-well', verdict: 'supported' })
    assert.equal(supported.isError, false)
    assert.equal(supported.value.task.requirements[0].status, 'unknown', '模型自述支持不构成通过')
    assert.equal(supported.value.task.requirements[0].assessment.verdict, 'supported')
    assert.notEqual(supported.value.task.status, 'ready', '语义未知时任务不得 ready')

    const staleBase = await call('patchwork_task', { action: 'assessment', baseRevision: 0, id: 'reads-well', verdict: 'supported' })
    assert.equal(staleBase.isError, true, '过期 baseRevision 必须被拒绝')

    const rejected = await call('patchwork_task', { action: 'check', baseRevision: taskState(agent).revision, id: 'reads-well', command: "Write-Output 'x'" })
    assert.equal(rejected.isError, true, 'semantic 要求不能走 command 验收冒充确定性通过')

    // 宿主确认通道（UI 路由的 task-review 动作）是唯一能把语义要求转成 accepted 的路径。
    transitionTask(agent, { kind: 'user-review', id: 'reads-well', baseRevision: taskState(agent).revision, accept: true, userConfirmed: true, at: new Date().toISOString() })
    const accepted = taskState(agent).requirements[0]
    assert.equal(accepted.status, 'accepted')
    assert.equal(accepted.userAcceptance.source, 'user-confirmed')
    assert.equal(taskState(agent).status, 'ready', '宿主确认后才 ready')

    // 没有宿主确认的 user-review 必须被拒绝，模型不能自封通过。
    assert.throws(
      () => transitionTask(agent, { kind: 'user-review', id: 'reads-well', baseRevision: taskState(agent).revision, accept: true, at: new Date().toISOString() }),
      /user review/,
    )
  } finally { await boot.dispose() }
})
