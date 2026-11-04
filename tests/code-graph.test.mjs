import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { registerCodeTool } from '../src/code/tool.mjs'

async function fixture() {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-code-graph-home-'))
  const root = await mkdtemp(join(tmpdir(), 'patchwork-code-graph-work-'))
  await mkdir(join(root, 'src'))
  await mkdir(join(root, 'test'))
  await writeFile(join(root, 'src', 'math.mjs'), [
    'export function add(a, b) { return helper(a) + b }',
    'function helper(value) { return value }',
    'export function main() { return add(1, 2) }',
  ].join('\n'))
  await writeFile(join(root, 'test', 'math.test.mjs'), "import { add } from '../src/math.mjs'\nadd(2, 3)\n")
  let tool, dispose
  const ctx = { tools: { register(value) { tool = value } }, effect(fn) { dispose = fn() } }
  const agent = scopedAgent({ session: { header: { id: `graph-${Date.now()}`, cwd: root } }, ctx })
  registerCodeTool(ctx)
  return { root, agent, tool, dispose: () => dispose?.() }
}

test('workspace code graph is opt-in, model-startable, and config-backed', async () => {
  const f = await fixture()
  try {
    const status = await f.tool.execute({ action: 'graph-status' }, { agent: f.agent })
    assert.equal(status.status, 'ok'); assert.equal(status.enabled, false); assert.equal(status.started, false); assert.equal(status.configExists, false)
    const disabled = await f.tool.execute({ action: 'callers', symbol: 'add' }, { agent: f.agent })
    assert.equal(disabled.status, 'failed'); assert.equal(disabled.failureCode, 'CODE_GRAPH_DISABLED')
    const enabled = await f.tool.execute({ action: 'graph-enable', maxFiles: 500 }, { agent: f.agent })
    assert.equal(enabled.status, 'ok'); assert.equal(enabled.enabled, true)
    const config = JSON.parse(await readFile(join(f.root, '.patchwork', 'config.json'), 'utf8'))
    assert.equal(config.schemaVersion, 1); assert.equal(config.codeGraph.enabled, true); assert.equal(config.codeGraph.maxFiles, 500)
    const notStarted = await f.tool.execute({ action: 'impact', symbol: 'add' }, { agent: f.agent })
    assert.equal(notStarted.failureCode, 'CODE_GRAPH_NOT_STARTED')
    const started = await f.tool.execute({ action: 'graph-start' }, { agent: f.agent })
    assert.equal(started.status, 'ok'); assert.equal(started.started, true); assert.ok(started.files >= 2)
    const callers = await f.tool.execute({ action: 'callers', symbol: 'add' }, { agent: f.agent })
    assert.equal(callers.status, 'ok'); assert.ok(callers.callers.some(caller => caller.name === 'main'))
    const callees = await f.tool.execute({ action: 'callees', symbol: 'add' }, { agent: f.agent })
    assert.equal(callees.status, 'ok'); assert.ok(callees.callees.some(callee => callee.name === 'helper'))
    const impact = await f.tool.execute({ action: 'impact', symbol: 'add' }, { agent: f.agent })
    assert.equal(impact.status, 'ok'); assert.ok(impact.impacted.some(item => item.name === 'main'))
    const affected = await f.tool.execute({ action: 'affected', files: ['src/math.mjs'] }, { agent: f.agent })
    assert.equal(affected.status, 'ok'); assert.ok(affected.tests.includes('test/math.test.mjs'))
    const stopped = await f.tool.execute({ action: 'graph-stop' }, { agent: f.agent })
    assert.equal(stopped.started, false)
    const afterStop = await f.tool.execute({ action: 'callers', symbol: 'add' }, { agent: f.agent })
    assert.equal(afterStop.failureCode, 'CODE_GRAPH_NOT_STARTED')
  } finally { f.dispose() }
})

test('workspace config excludes are honored and invalid config fails closed', async () => {
  const f = await fixture()
  try {
    await mkdir(join(f.root, 'generated'))
    await writeFile(join(f.root, 'generated', 'hidden.mjs'), 'export function hidden() {}\n')
    await f.tool.execute({ action: 'graph-enable', exclude: ['generated/**'] }, { agent: f.agent })
    await f.tool.execute({ action: 'graph-start' }, { agent: f.agent })
    const search = await f.tool.execute({ action: 'search', query: 'hidden' }, { agent: f.agent })
    assert.equal(search.status, 'ok'); assert.equal(search.matches.some(match => match.path.startsWith('generated/')), false)
    await writeFile(join(f.root, '.patchwork', 'config.json'), '{ bad json')
    const broken = await f.tool.execute({ action: 'graph-status' }, { agent: f.agent })
    assert.equal(broken.status, 'failed'); assert.equal(broken.failureCode, 'CODE_GRAPH_CONFIG_INVALID')
  } finally { f.dispose() }
})
