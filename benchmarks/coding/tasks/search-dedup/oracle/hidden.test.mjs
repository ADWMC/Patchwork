import assert from 'node:assert/strict'
import test from 'node:test'
import { dedupeSources } from '../src/dedupe.mjs'

test('normalizes equivalent URLs without changing first-seen order', () => {
  const sources = [{ url: 'HTTPS://Example.TEST/docs/#intro', title: 'first' }, { url: 'https://example.test/docs', title: 'duplicate' }, { url: 'https://other.test/', title: 'other' }, { url: 'https://other.test/#x', title: 'other duplicate' }]
  assert.deepEqual(dedupeSources(sources), [sources[0], sources[2]])
})
