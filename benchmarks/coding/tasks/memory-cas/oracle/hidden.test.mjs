import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryStore } from '../src/store.mjs'

test('rejects stale and future revisions without changing state', () => {
  const store = new MemoryStore(); store.put('a', 0)
  assert.throws(() => store.put('stale', 0), /REVISION_CONFLICT/)
  assert.throws(() => store.put('future', 4), /REVISION_CONFLICT/)
  assert.equal(store.revision, 1)
  assert.equal(store.value, 'a')
})
