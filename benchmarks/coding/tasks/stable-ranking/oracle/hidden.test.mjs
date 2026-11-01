import assert from 'node:assert/strict'
import test from 'node:test'
import { rankItems } from '../src/rank.mjs'

test('preserves ties and input array', () => {
  const input = [{ id: 'first', score: 2 }, { id: 'low', score: 1 }, { id: 'second', score: 2 }]
  const snapshot = structuredClone(input)
  assert.deepEqual(rankItems(input).map(item => item.id), ['first', 'second', 'low'])
  assert.deepEqual(input, snapshot)
})
