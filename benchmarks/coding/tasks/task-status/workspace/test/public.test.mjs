import assert from 'node:assert/strict'
import test from 'node:test'
import { isPassed } from '../src/status.mjs'

test('a successful command passes', () => assert.equal(isPassed({ outcome: 'passed', exitCode: 0, isError: false }), true))
