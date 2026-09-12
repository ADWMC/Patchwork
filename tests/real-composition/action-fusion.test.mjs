import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'

const skip = hostAvailable() ? false : 'DSH host packages are not installed'

test('Action Fusion shadows the native write tool inside the agent scope only', { skip }, async () => {
  const { dispose } = await bootPatchwork({ actionFusion: true })
  try {
    const { createAgent } = await loadDriver()
    const { agentKey, tools } = createAgent()

    const native = tools.get('write')
    assert.ok(native, 'dsh-tool-fs must register write on the root scope')
    assert.deepEqual(Object.keys(native.parameters.properties).sort(), ['content', 'file_path'])

    const fused = tools.get('write', agentKey)
    assert.ok(fused, 'the agent scope must resolve a write tool')
    assert.deepEqual(Object.keys(fused.parameters.properties).sort(), ['content', 'file_path', 'then_run'])
    assert.equal(fused.parameters.required.includes('then_run'), false)
    assert.equal(fused.parameters.required.includes('file_path'), true)

    // 遮蔽只作用于 agent 作用域：根层与其它作用域仍是原生定义。
    assert.equal(tools.get('write'), native)
    assert.equal(tools.get('write').parameters.properties.then_run, undefined)
  } finally {
    await dispose()
  }
})

test('the fused definition still writes through the real filesystem service', { skip }, async () => {
  const { dispose } = await bootPatchwork({ actionFusion: true })
  const work = await mkdtemp(join(tmpdir(), 'patchwork-fused-'))
  try {
    const { createAgent } = await loadDriver()
    const { agentKey, tools } = createAgent()
    const fused = tools.get('write', agentKey)

    const target = join(work, 'out.txt')
    const value = await fused.execute(
      { file_path: target, content: 'written by the fused tool\n' },
      { signal: new AbortController().signal, callId: 'call-fused-1' },
    )

    assert.equal(await readFile(target, 'utf8'), 'written by the fused tool\n')
    assert.notEqual(value?.mutation, undefined, 'the native mutation value must be preserved')
    assert.equal(value.thenRun, undefined, 'no then_run was requested')
    assert.match(fused.output.render({}, value)[0].text, /\S/)
  } finally {
    await rm(work, { recursive: true, force: true })
    await dispose()
  }
})

test('with Action Fusion explicitly disabled the agent scope keeps the native write tool', { skip }, async () => {
  // 显式关闭：默认值已改为开启，空配置现在会注册这个机制，所以这个用例必须显式关。
  const { dispose } = await bootPatchwork({ actionFusion: false })
  try {
    const { createAgent } = await loadDriver()
    const { agentKey, tools } = createAgent()
    assert.equal(tools.get('write', agentKey).parameters.properties.then_run, undefined)
  } finally {
    await dispose()
  }
})
