import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectStructure, isInsideWorkspace } from '../src/structure/structure-check.mjs'
import { buildStructureWarning, isMutationTool } from '../src/structure/structure-warning.mjs'

function isolatedState() {
  return join(tmpdir(), `patchwork-state-${Math.random().toString(16).slice(2)}.json`)
}

async function withState(run) {
  const old = process.env.PATCHWORK_HOOK_STATE
  process.env.PATCHWORK_HOOK_STATE = isolatedState()
  try {
    return await run()
  } finally {
    if (old === undefined) delete process.env.PATCHWORK_HOOK_STATE
    else process.env.PATCHWORK_HOOK_STATE = old
  }
}

test('structure hook flags root and vague source names', async () => {
  const result = await inspectStructure({ cwd: process.cwd(), files: ['main_final.cpp', 'src/ok.ts'] })
  assert.equal(result.ok, true)
  assert.deepEqual(result.warnings.map(item => item.code), ['root-source', 'vague-name'])
})

test('files outside the workspace are not this project structure contract', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'patchwork-outside-'))
  const dependency = join(outside, 'index.d.ts')
  await writeFile(dependency, `${'export type X = 1\n'.repeat(900)}`)

  assert.equal(isInsideWorkspace(process.cwd(), dependency), false)
  const result = await inspectStructure({ cwd: process.cwd(), files: [dependency] })
  assert.deepEqual(result.warnings, [])
})

test('reading a large third-party file produces no warning (regression)', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'patchwork-read-'))
  const dependency = join(outside, 'debug_final.d.ts')
  await writeFile(dependency, `${'export type X = 1\n'.repeat(900)}`)

  await withState(async () => {
    const report = await buildStructureWarning({ cwd: process.cwd(), sessionId: 'read-regression', files: [dependency] })
    assert.equal(report.prompt, undefined)
    assert.deepEqual(report.warnings, [])
  })
})

test('only mutating tools can produce a structure check', () => {
  assert.equal(isMutationTool('write'), true)
  assert.equal(isMutationTool('edit'), true)
  assert.equal(isMutationTool('read'), false)
  assert.equal(isMutationTool('grep'), false)
  assert.equal(isMutationTool(undefined), false)
})

test('hook warning prompt is a separate asset', async () => {
  await withState(async () => {
    const result = await buildStructureWarning({
      cwd: process.cwd(),
      sessionId: 'asset-test',
      files: ['debug_final.cpp'],
    })
    assert.match(result.prompt, /职责边界/)
  })
})

test('structure warning prompt repeats every 30 rounds', async () => {
  await withState(async () => {
    const payload = { cwd: process.cwd(), sessionId: 'cooldown-test', files: ['debug_final.cpp'] }
    assert.ok((await buildStructureWarning(payload)).prompt)
    for (let i = 0; i < 28; i++) assert.equal((await buildStructureWarning(payload)).prompt, undefined)
    assert.ok((await buildStructureWarning(payload)).prompt)
  })
})
