import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedAgent } from './helpers/agent.mjs'
import { flushRetrieval, recordRetrieval, retrievalSnapshot, RETRIEVAL_RECORD } from '../src/retrieval/ledger.mjs'

test('retrieval ledger stores bounded untrusted source metadata and omits raw query', async () => {
  const agent = scopedAgent({ session: { header: { id: 'ledger-memory' } } })
  const rawQuery = 'private query should never be persisted'
  recordRetrieval(agent, {
    operationId: 'call-ledger', status: 'partial', query: rawQuery, queryFingerprint: 'a'.repeat(64),
    provider: 'patchwork-native-multi', providers: ['bing-html'], failedProviders: [{ provider: 'brave-html', code: 'SEARCH_TIMEOUT' }],
    providerHealth: [{ provider: 'bing-html', family: 'bing', status: 'healthy', resultCount: 1, elapsedMs: 4 }],
    sources: [{ title: 'Example', url: 'https://example.com/a#fragment', snippet: 'x'.repeat(1000) }], resultCount: 1, providerCount: 1, failedProviderCount: 1, elapsedMs: 6,
  })
  await flushRetrieval(agent)
  const snapshot = retrievalSnapshot(agent)
  assert.equal(snapshot.entries.length, 1)
  assert.equal(snapshot.entries[0].status, 'partial')
  assert.equal(snapshot.entries[0].sources[0].url, 'https://example.com/a')
  assert.equal(snapshot.entries[0].sources[0].snippet.length, 600)
  assert.equal('query' in snapshot.entries[0], false)
  assert.equal(JSON.stringify(snapshot).includes(rawQuery), false)
})

test('retrieval ledger rejects non-Patchwork writers and restores native records', async () => {
  class Session {
    constructor() { this.header = { id: 'ledger-native' }; this.events = []; this.seq = 0 }
    eventAt(seq) { return this.events[seq] }
  }
  const api = { Session, appendPluginRecord(session, type, data) { const seq = session.seq++; session.events.push({ type, seq, data, time: Date.now(), ignorable: true }); return seq } }
  const { initializeDiagnostics } = await import('../src/logging/session-log.mjs')
  await initializeDiagnostics(null, { sessionApi: api })
  const agent = scopedAgent({ session: new Session() })
  const standard = scopedAgent({ session: new Session() }, 'standard')
  recordRetrieval(standard, { operationId: 'standard', status: 'retrieved', sources: [{ url: 'https://example.com' }] })
  recordRetrieval(agent, { operationId: 'native', status: 'retrieved', sources: [{ title: 'Example', url: 'https://example.com' }] })
  await flushRetrieval(agent)
  assert.equal(standard.session.seq, 0)
  assert.equal(agent.session.seq, 1)
  assert.equal(agent.session.events[0].type, RETRIEVAL_RECORD)
  assert.equal(retrievalSnapshot(agent).persistence, 'native')
})
