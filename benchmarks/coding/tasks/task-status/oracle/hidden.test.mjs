import assert from 'node:assert/strict'
import test from 'node:test'
import { isPassed } from '../src/status.mjs'

test('dispatch success with failed process does not pass', () => assert.equal(isPassed({ outcome: 'failed', exitCode: 7, isError: false }), false))
test('unknown and cancelled outcomes do not pass even with exit zero', () => {
  assert.equal(isPassed({ outcome: 'unknown', exitCode: 0, isError: false }), false)
  assert.equal(isPassed({ outcome: 'cancelled', exitCode: 0, isError: false }), false)
})
