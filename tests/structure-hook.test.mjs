import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectStructure } from '../src/structure-hook.mjs'

test('structure hook flags root and vague source names', async () => {
  const result = await inspectStructure({ cwd: process.cwd(), files: ['main_final.cpp', 'src/ok.ts'] })
  assert.equal(result.ok, true)
  assert.deepEqual(result.warnings.map(item => item.code), ['root-source', 'vague-name'])
})
