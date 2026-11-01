import assert from 'node:assert/strict'
import test from 'node:test'
import { annotationSender } from '../src/client/annotation-send.mjs'

test('annotation sender binds native conversation send to the selected session only', async () => {
  const received = []
  const ctx = { sessions: { scope: id => ({ get: name => name === 'conversation' ? { id, async send(text) { received.push({ id: this.id, text }) } } : undefined }) } }
  const a = annotationSender(ctx, 'a'), b = annotationSender(ctx, 'b')
  await b('B feedback'); await a('A feedback')
  assert.deepEqual(received, [{ id: 'b', text: 'B feedback' }, { id: 'a', text: 'A feedback' }])
})

test('missing scoped conversation never falls back to a root conversation', () => {
  const ctx = { sessions: { scope: () => ({ get: () => undefined }) }, conversation: { send() { assert.fail('root conversation used') } } }
  assert.equal(annotationSender(ctx, 'a'), undefined)
  assert.equal(annotationSender(ctx, ''), undefined)
  assert.equal(annotationSender({ sessions: {} }, 'a'), undefined)
})
