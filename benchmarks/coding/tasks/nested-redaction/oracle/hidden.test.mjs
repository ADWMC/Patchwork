import assert from 'node:assert/strict'
import test from 'node:test'
import { redactRecord } from '../src/redact.mjs'

test('redacts nested objects and arrays case-insensitively', () => {
  assert.deepEqual(redactRecord({ headers: { Authorization: 'Bearer x' }, values: [{ apiKey: 'k', ok: 1 }], nested: { Secret: 's' } }), { headers: { Authorization: '[REDACTED]' }, values: [{ apiKey: '[REDACTED]', ok: 1 }], nested: { Secret: '[REDACTED]' } })
})
