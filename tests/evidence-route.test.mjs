import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { scopedAgent } from './helpers/agent.mjs'
import { registerEvidenceRoute, EVIDENCE_ROUTE_PATH } from '../src/retrieval/route.mjs'
import { admitPageEvidence, markEvidenceSent } from '../src/retrieval/evidence.mjs'

test('evidence route compares only two independent sent excerpts', async () => {
  const agent = scopedAgent({ session: { header: { id: 'evidence-route', cwd: process.cwd() } } })
  let route, dispose
  const ctx = { get(name) { return name === 'agents' ? { get(id) { return id === 'evidence-route' ? agent : undefined } } : name === 'webServer' ? { register(value) { route = value.handler; return () => {} } } : undefined }, effect(fn) { dispose = fn() } }
  registerEvidenceRoute(ctx, { token: 'fixture-token' })
  const excerptA = JSON.stringify({ version: '1', note: 'a' }), excerptB = JSON.stringify({ version: '1', note: 'b' })
  const a = admitPageEvidence(agent, { finalUrl: 'https://a.example/item', title: 'A', excerpt: excerptA, contentType: 'application/json' }, 'op-a')
  const b = admitPageEvidence(agent, { finalUrl: 'https://b.example/item', title: 'B', excerpt: excerptB, contentType: 'application/json' }, 'op-b')
  assert.equal(markEvidenceSent(a.id, excerptA), true); assert.equal(markEvidenceSent(b.id, excerptB), true)
  async function call(body, { token = 'fixture-token', session = 'evidence-route' } = {}) {
    const req = new EventEmitter(); Object.assign(req, { url: `${EVIDENCE_ROUTE_PATH}?sessionId=${session}`, method: 'POST', headers: { 'x-patchwork-token': token }, destroy() {} })
    const res = { statusCode: 0, setHeader() {}, end(data) { this.body = JSON.parse(data) } }
    const pending = route(req, res); req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); await pending; return res
  }
  try {
    assert.equal((await call({ action: 'compare', evidenceId: a.id, otherId: b.id, claimKey: 'version' }, { token: 'bad' })).statusCode, 403)
    assert.equal((await call({ action: 'compare', evidenceId: a.id, otherId: b.id, claimKey: 'version' }, { session: 'other' })).statusCode, 403)
    const ok = await call({ action: 'compare', evidenceId: a.id, otherId: b.id, claimKey: 'version' })
    assert.equal(ok.statusCode, 200); assert.equal(ok.body.verification.result, 'supported'); assert.equal(ok.body.verification.claimKey, 'version')
    const same = await call({ action: 'compare', evidenceId: a.id, otherId: a.id, claimKey: 'version' })
    assert.equal(same.statusCode, 400)
  } finally { dispose() }
})
