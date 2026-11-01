import assert from 'node:assert/strict'
import test from 'node:test'
import { redactRecord } from '../src/redact.mjs'

test('redacts a top-level token and keeps ordinary fields', () => assert.deepEqual(redactRecord({ token: 'x', status: 'ok' }), { token: '[REDACTED]', status: 'ok' }))
