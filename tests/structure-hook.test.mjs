import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectStructure } from '../src/structure-hook.mjs'

test('structure hook flags root and vague source names', async () => {
  const result = await inspectStructure({ cwd: process.cwd(), files: ['main_final.cpp', 'src/ok.ts'] })
  assert.equal(result.ok, true)
  assert.deepEqual(result.warnings.map(item => item.code), ['root-source', 'vague-name'])
})

test('structure warning prompt repeats every 30 rounds', async () => {
  const state = join(await mkdtemp(join(tmpdir(), 'patchwork-')), 'state.json')
  const old = process.env.PATCHWORK_HOOK_STATE
  process.env.PATCHWORK_HOOK_STATE = state
  try {
    const payload = { cwd: process.cwd(), sessionId: 'cooldown-test', files: ['debug_final.cpp'] }
    assert.ok((await inspectStructure(payload)).prompt)
    for (let i = 0; i < 28; i++) assert.equal((await inspectStructure(payload)).prompt, undefined)
    assert.ok((await inspectStructure(payload)).prompt)
  } finally {
    if (old === undefined) delete process.env.PATCHWORK_HOOK_STATE
    else process.env.PATCHWORK_HOOK_STATE = old
  }
})
