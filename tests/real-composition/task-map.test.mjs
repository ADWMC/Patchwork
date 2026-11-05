import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'
import { taskMapText } from '../../src/mechanisms/task-map/index.mjs'
import { taskState } from '../../src/task/store.mjs'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-taskmap-compose-'))

/**
 * 任务锚定地图的组合层：地图内容由 define 声明的引用与登记产物决定，
 * correct 改变锚点后同一会话拿到新地图。注入与再注入的 notice 管线在
 * index.mjs，与 handoff 同款；此处验证锚定语义本身。
 */

const skip = hostAvailable() ? false : 'DSH host packages are not installed'

test('the map follows task anchors and rebuilds when a correction moves them', { skip }, async () => {
  const boot = await bootPatchwork({ taskMap: true })
  const cwd = await mkdtemp(join(tmpdir(), 'patchwork-taskmap-work-'))
  try {
    await writeFile(join(cwd, 'math.mjs'), 'export const add = (a, b) => a + b\n', 'utf8')
    await writeFile(join(cwd, 'text.mjs'), 'export const shout = value => String(value).toUpperCase()\n', 'utf8')
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ cwd })
    let n = 0
    const call = (name, args) => tools.execute({ agent, name, arguments: args, callId: `map-${++n}`, signal: new AbortController().signal })

    assert.equal(await taskMapText(agent), '', '没有任务时没有地图')
    await call('patchwork_task', {
      action: 'define', baseRevision: 0, title: '锚定地图', phase: 'implement',
      references: [join(cwd, 'math.mjs')],
      requirements: [{ id: 'build', label: '构建通过', kind: 'command' }],
    })
    const first = await taskMapText(agent)
    assert.match(first, /math\.mjs（add@1/)
    assert.ok(!first.includes('text.mjs'), '未声明的文件不进锚点')

    await call('patchwork_task', { action: 'correct', baseRevision: taskState(agent).revision, references: [join(cwd, 'text.mjs')] })
    const second = await taskMapText(agent)
    assert.match(second, /text\.mjs（shout@1/)
    assert.ok(!second.includes('math.mjs'), '纠正移走锚点后旧锚点不再出现')

    await call('patchwork_task', { action: 'cancel', baseRevision: taskState(agent).revision })
    assert.equal(await taskMapText(agent), '', '任务取消后地图不再注入')
  } finally { await boot.dispose() }
})
