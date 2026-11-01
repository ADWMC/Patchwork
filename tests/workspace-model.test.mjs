import assert from 'node:assert/strict'
import test from 'node:test'
import { textMatches, workspaceSummary, queueBucket, improvementBucket, evidenceGroups, safePublicLink } from '../src/client/workspace-model.mjs'

test('workspace summary separates required acceptance, queue completion and unknown context', () => {
  assert.deepEqual(workspaceSummary({}), { requirements: 0, passed: 0, review: 0, running: 0, blocked: 0, failures: 0, candidates: 0, tokens: null, window: null })
  const summary = workspaceSummary({ task: { requirements: [{ required: true, status: 'accepted' }, { required: true, status: 'passed' }, { required: true, status: 'unknown' }, { required: false, status: 'passed' }] }, superagent: { jobs: ['done', 'cancelled', 'review', 'running', 'starting', 'blocked', 'waiting', 'failed'].map(status => ({ status })) }, events: [{ outcome: 'failed' }, { outcome: 'unverified' }], improvements: { candidates: [{ decision: 'proposed' }, { applied: true }, { decision: 'revoked' }, { decision: 'rejected' }] }, context: { tokens: 0, window: 1000 } })
  assert.deepEqual(summary, { requirements: 3, passed: 2, review: 1, running: 2, blocked: 3, failures: 1, candidates: 1, tokens: 0, window: 1000 })
  assert.equal(workspaceSummary({ context: { tokens: -1, window: 0 } }).tokens, null)
  assert.equal(workspaceSummary({ context: { tokens: 30, window: NaN } }).window, null)
})

test('queue and improvement facets retain distinctions used for review', () => {
  assert.equal(queueBucket('review'), 'review'); assert.equal(queueBucket('failed'), 'attention')
  assert.equal(queueBucket('waiting'), 'attention'); assert.equal(queueBucket('starting'), 'running')
  assert.equal(queueBucket('done'), 'finished'); assert.equal(queueBucket('cancelled'), 'finished')
  assert.equal(queueBucket('queued'), 'queued'); assert.equal(queueBucket('future-status'), 'queued')
  assert.equal(improvementBucket({ decision: 'proposed' }), 'pending')
  assert.equal(improvementBucket({ decision: 'trial', applied: true }), 'applied')
  assert.equal(improvementBucket({ decision: 'revoked' }), 'revoked')
  assert.equal(improvementBucket({ decision: 'rejected' }), 'rejected')
})

test('literal search and evidence grouping preserve inputs without merging independent calls', () => {
  assert.equal(textMatches('  ExIt 7 ', 'PWSH', ['exit 7', null]), true)
  assert.equal(textMatches('.*', 'exit 7'), false); assert.equal(textMatches('', undefined), true)
  const items = [{ id: 'a', rootCallId: 'root', text: 'one' }, { id: 'b', text: 'two' }, { id: 'c', rootCallId: 'root', text: 'three' }]
  assert.deepEqual(evidenceGroups(items), [{ id: 'root', entries: [items[0], items[2]] }, { id: 'b', entries: [items[1]] }])
  assert.deepEqual(evidenceGroups([]), [])
  assert.equal(items.length, 3)
})

test('source links reject executable schemes, credentials and invalid URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'https://user:password@example.com/', 'not a URL', '/relative', null]) assert.equal(safePublicLink(value), null)
  assert.equal(safePublicLink('https://example.com/a?q=1#excerpt'), 'https://example.com/a?q=1#excerpt')
  assert.equal(safePublicLink('http://example.com'), 'http://example.com/')
})
