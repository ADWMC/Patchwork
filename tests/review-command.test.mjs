import assert from 'node:assert/strict'
import test from 'node:test'
import { registerReviewCommand, reviewInstruction, submitReview } from '../src/review-command.mjs'

test('review command registers as the user-stance review entry', () => {
  const registered = []
  registerReviewCommand({ commands: { register: def => registered.push(def) } })
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'patchwork-review')
  assert.match(registered[0].description, /用户/)
  assert.match(registered[0].description, /评审/)
})

test('review instruction embeds scope and user-path discipline', () => {
  const scoped = reviewInstruction('src/checkout')
  assert.match(scoped, /用户路径/)
  assert.match(scoped, /src\/checkout/)
  const fallback = reviewInstruction('')
  assert.match(fallback, /未提交的改动/)
})

test('submitReview sends one user message via agent followup', async () => {
  const messages = []
  const result = await submitReview({
    rawInput: '结账流程',
    agent: { followup: message => messages.push(message) },
  })
  assert.equal(result.kind, 'success')
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'user')
  assert.match(messages[0].content[0].text, /结账流程/)
})
