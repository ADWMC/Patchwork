import assert from 'node:assert/strict'
import test from 'node:test'
import { rankItems } from '../src/rank.mjs'

test('sorts by score descending', () => assert.deepEqual(rankItems([{ id: 'a', score: 1 }, { id: 'b', score: 3 }]).map(x => x.id), ['b', 'a']))
