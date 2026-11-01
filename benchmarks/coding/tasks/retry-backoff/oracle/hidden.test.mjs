import assert from 'node:assert/strict'
import test from 'node:test'
import { retry } from '../src/retry.mjs'

test('zero retries still performs the initial attempt', async () => {
  let calls = 0
  await assert.rejects(retry(async () => { calls += 1; throw Error('fail') }, { retries: 0 }), /fail/)
  assert.equal(calls, 1)
})

test('retries are additional attempts and waits use one-based failure count', async () => {
  let calls = 0; const waits = []
  const value = await retry(async () => { calls += 1; if (calls < 3) throw Error('temporary'); return 'ok' }, { retries: 2, wait: async attempt => waits.push(attempt) })
  assert.equal(value, 'ok'); assert.equal(calls, 3); assert.deepEqual(waits, [1, 2])
})
