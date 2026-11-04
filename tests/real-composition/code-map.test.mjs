import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, loadDriver, hostAvailable } from './harness.mjs'

test('native composition exposes patchwork_code and returns a bounded workspace map', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork({ codeEnabled: true })
  const cwd = await mkdtemp(join(tmpdir(), 'patchwork-code-compose-'))
  try {
    await mkdir(join(cwd, 'src'))
    await writeFile(join(cwd, 'src', 'service.mjs'), 'export function handle() { return 1 }\n')
    await writeFile(join(cwd, 'src', 'service.test.mjs'), 'import { handle } from "./service.mjs"\nhandle()\n')
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ cwd })
    assert.ok(tools.get('patchwork_code', agent))
    assert.ok(tools.get('patchwork_project_docs', agent))
    const result = await tools.execute({ agent, name: 'patchwork_code', arguments: { action: 'map' }, callId: 'code-map-1', signal: new AbortController().signal })
    assert.equal(result.isError, false, JSON.stringify(result.content))
    assert.match(result.value.text, /src\/service\.mjs/)
    assert.equal(result.value.status, 'ok')
    assert.equal(typeof result.value.cache, 'string')
  } finally { await boot.dispose() }
})

test('native composition validates opt-in workspace graph output schemas', { skip: !hostAvailable() }, async () => {
  const boot = await bootPatchwork({ codeEnabled: true })
  const cwd = await mkdtemp(join(tmpdir(), 'patchwork-code-graph-compose-'))
  try {
    await writeFile(join(cwd, 'chain.mjs'), 'export function helper(v) { return v }\nexport function addChain(v) { return helper(v) }\nexport function runChain() { return addChain(2) }\n')
    await writeFile(join(cwd, 'chain.test.mjs'), "import { runChain } from './chain.mjs'\nrunChain()\n")
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ cwd })
    let n = 0
    const call = (arguments_) => tools.execute({ agent, name: 'patchwork_code', arguments: arguments_, callId: `graph-${++n}`, signal: new AbortController().signal })
    const enabled = await call({ action: 'graph-enable' })
    assert.equal(enabled.isError, false, JSON.stringify(enabled.content))
    const started = await call({ action: 'graph-start' })
    assert.equal(started.isError, false, JSON.stringify(started.content))
    assert.equal(started.value.started, true)
    const callers = await call({ action: 'callers', symbol: 'addChain' })
    assert.equal(callers.isError, false, JSON.stringify(callers.content))
    assert.ok(callers.value.callers.some(item => item.name === 'runChain'))
    const callees = await call({ action: 'callees', symbol: 'addChain' })
    assert.equal(callees.isError, false, JSON.stringify(callees.content))
    assert.ok(callees.value.callees.some(item => item.name === 'helper'))
    const impact = await call({ action: 'impact', symbol: 'addChain' })
    assert.equal(impact.isError, false, JSON.stringify(impact.content))
    assert.ok(impact.value.impacted.some(item => item.name === 'runChain'))
    const affected = await call({ action: 'affected', files: ['chain.mjs'] })
    assert.equal(affected.isError, false, JSON.stringify(affected.content))
    assert.ok(affected.value.tests.includes('chain.test.mjs'))
  } finally { await boot.dispose() }
})
