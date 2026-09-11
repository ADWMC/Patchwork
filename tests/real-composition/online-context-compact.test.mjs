import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'

// 计划状态落在宿主用户数据根下；指到临时目录，测试不污染真实 ~/.dsh。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-occ-host-'))

const skip = hostAvailable() ? false : 'DSH host packages are not installed'
const SESSION_ID = 'occ-host-session'

const PLAN = [
  { id: 'a', text: 'write the code', status: 'completed' },
  { id: 'b', text: 'run the tests', status: 'in_progress' },
]

const callPlan = (tools, agent, steps, callId = 'call-plan') =>
  tools.execute({
    callId,
    rootCallId: callId,
    name: 'update_plan',
    arguments: { steps },
    agent,
    signal: new AbortController().signal,
  })

test('update_plan is registered and runs through the real tool pipeline', { skip }, async () => {
  const boot = await bootPatchwork({ onlineContextCompact: true })
  try {
    const { createAgent } = await loadDriver()
    const { agent, agentKey, tools } = createAgent({ sessionId: SESSION_ID })

    // agent 作用域解析得到该工具，且它的参数 Schema 要求 steps。
    const definition = tools.get('update_plan', agentKey)
    assert.ok(definition, 'the agent scope must resolve update_plan')
    assert.deepEqual(definition.parameters.required, ['steps'])

    const result = await callPlan(tools, agent, PLAN)
    assert.equal(result.isError, false, 'recording a valid plan must succeed')
    assert.equal(result.value.completed, 1)
    assert.equal(result.value.total, 2)
    assert.match(result.content[0].text, /1\/2 steps completed/)
  } finally {
    await boot.dispose()
  }
})

test('an invalid plan is rejected by the tool rather than accepted quietly', { skip }, async () => {
  const boot = await bootPatchwork({ onlineContextCompact: true })
  try {
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ sessionId: SESSION_ID })
    const result = await callPlan(tools, agent, [{ id: 'a', text: 'x', status: 'done' }])
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, /invalid plan/)
  } finally {
    await boot.dispose()
  }
})

test('the lifecycle listeners are contained when no compaction service exists', { skip }, async () => {
  const boot = await bootPatchwork({ onlineContextCompact: true })
  try {
    const { createAgent, observed } = await loadDriver()
    const { agent, tools } = createAgent({ sessionId: SESSION_ID })
    assert.equal(observed.emitError, undefined, 'creating the agent must not throw')

    await callPlan(tools, agent, PLAN, 'call-plan-2')

    // 没有 compaction 服务、也没有真实 token 计量：这些事件必须被安静吸收。
    boot.ctx.emit('agent/turn-stopping', { agent, turn: 1, signal: new AbortController().signal })
    boot.ctx.emit('agent/status', { agent, status: 'idle' })
    await new Promise(resolve => setTimeout(resolve, 20))

    assert.deepEqual(observed.followups, [], 'nothing may continue the task without a compaction')
  } finally {
    await boot.dispose()
  }
})

test('with the mechanism disabled update_plan does not exist', { skip }, async () => {
  const boot = await bootPatchwork({})
  try {
    const { createAgent } = await loadDriver()
    const { agentKey, tools } = createAgent({ sessionId: SESSION_ID })
    assert.equal(tools.get('update_plan', agentKey), undefined)
  } finally {
    await boot.dispose()
  }
})
