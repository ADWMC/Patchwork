import assert from 'node:assert/strict'
import test from 'node:test'
import { retry } from '../src/retry.mjs'

test('a retry can recover after one failure', async () => {
  let calls = 0
  const value = await retry(async () => { calls += 1; if (calls === 1) throw Error('temporary'); return 'ok' }, { retries: 1 })
  assert.equal(value, 'ok')
})
