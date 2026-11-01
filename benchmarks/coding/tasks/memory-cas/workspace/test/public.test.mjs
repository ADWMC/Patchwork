import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryStore } from '../src/store.mjs'

test('accepts the current revision', () => { const store = new MemoryStore(); assert.equal(store.put('a', 0).revision, 1) })
