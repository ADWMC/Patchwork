import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInside } from '../src/safe-path.mjs'

test('rejects traversal and absolute escapes', () => {
  assert.throws(() => resolveInside('C:/workspace', '../secret.txt'), /PATH_OUTSIDE_ROOT/)
  assert.throws(() => resolveInside('C:/workspace', 'C:/other/file.txt'), /PATH_OUTSIDE_ROOT/)
})

test('allows root itself', () => assert.equal(resolveInside('C:/workspace', '.'), 'C:\\workspace'))
