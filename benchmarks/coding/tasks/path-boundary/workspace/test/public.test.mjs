import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { resolveInside } from '../src/safe-path.mjs'

test('resolves a normal child path', () => assert.equal(resolveInside('C:/workspace', 'src/index.mjs'), resolve('C:/workspace', 'src/index.mjs')))
