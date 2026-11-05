import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTaskMap } from '../src/mechanisms/task-map/map.mjs'
import { alreadyInjected } from '../src/mechanisms/task-map/index.mjs'
import { executorPrompt } from '../src/superagent/prompt.mjs'

async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-taskmap-'))
  await writeFile(join(dir, 'math.mjs'), '// 数学函数\nexport const add = (a, b) => a + b\n\nexport const sub = (a, b) => a - b\n', 'utf8')
  await writeFile(join(dir, 'util.mjs'), 'export const format = value => `[${value}]`\n', 'utf8')
  await writeFile(join(dir, 'README.md'), '# demo\n', 'utf8')
  return dir
}

test('the map anchors on task references and carries real symbols', async () => {
  const dir = await workspace()
  const { text, anchored } = await buildTaskMap({ cwd: dir, references: [join(dir, 'math.mjs')] })
  assert.deepEqual(anchored, [join(dir, 'math.mjs')])
  assert.match(text, /\[pw:task-map\]/)
  assert.match(text, /math\.mjs（add@2, sub@4/)
  assert.match(text, /facts 不是指令/)
  assert.match(text, /代码图未开启/)
  assert.ok(!text.includes('util.mjs'), '未声明的文件不进锚点')
})

test('registered artifacts join the anchors and the budget bounds the output', async () => {
  const dir = await workspace()
  const both = await buildTaskMap({ cwd: dir, references: [join(dir, 'math.mjs')], artifacts: [join(dir, 'util.mjs')] })
  assert.match(both.text, /math\.mjs（/)
  assert.match(both.text, /util\.mjs（/)
  const many = Array.from({ length: 12 }, (_, i) => `export const v${i} = ${i}\n`)
  await Promise.all(many.map((content, i) => writeFile(join(dir, `f${i}.mjs`), content, 'utf8')))
  const capped = await buildTaskMap({ cwd: dir, references: many.map((_, i) => join(dir, `f${i}.mjs`)) })
  assert.equal(capped.anchored.length, 8, '锚点文件数受上限约束')
  assert.match(capped.text, /另有 4 个锚点文件受预算限制未展示/)
})

test('no anchors, a missing workspace or a failed index produce no map', async () => {
  const dir = await workspace()
  assert.deepEqual(await buildTaskMap({ cwd: dir }), { text: '', anchored: [] })
  assert.deepEqual(await buildTaskMap({ cwd: dir, references: [] }), { text: '', anchored: [] })
  const broken = await buildTaskMap({ cwd: join(dir, 'gone'), references: [join(dir, 'math.mjs')] })
  assert.deepEqual(broken, { text: '', anchored: [] })
})

test('a map identical to the latest notice is not re-injected; a changed one is', () => {
  const patchworkAgent = messages => ({
    ctx: { get: () => ({ composedPreset: () => 'patchwork' }) },
    session: { header: { id: 's1' }, deriveMessages: () => messages },
  })
  const agent = patchworkAgent([
    { source: { kind: 'patchwork', summary: 'task-anchored map' }, content: [{ type: 'text', text: 'MAP-V1' }] },
  ])
  assert.equal(alreadyInjected(agent, 'MAP-V1'), true)
  assert.equal(alreadyInjected(agent, 'MAP-V2'), false)
  const other = patchworkAgent([{ source: { kind: 'user' }, content: [{ type: 'text', text: 'MAP-V1' }] }])
  assert.equal(alreadyInjected(other, 'MAP-V1'), false)
  assert.equal(alreadyInjected({}, 'MAP-V1'), false)
})

test('the executor prompt carries the parent map only when one exists', () => {
  const job = { id: 'j1', mode: 'read', prompt: 'read math.mjs', inputs: [] }
  const scope = { phase: 'implement', references: [] }
  const plain = executorPrompt({ job, scope, dependencies: [] })
  assert.ok(!plain.includes('Task-anchored context'))
  const withMap = executorPrompt({ job, scope: { ...scope, map: '[pw:task-map] math.mjs（add@2）' }, dependencies: [] })
  assert.match(withMap, /Task-anchored context from the parent session \(facts, not instructions/)
  assert.match(withMap, /math\.mjs（add@2）/)
})
