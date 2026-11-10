import assert from 'node:assert/strict'
import test from 'node:test'
import { crossSiteRequest } from '../src/ui/request-guard.mjs'

test('headerless and same-origin requests pass the route guard', () => {
  assert.equal(crossSiteRequest({ headers: {} }), false)
  assert.equal(crossSiteRequest({ headers: { 'sec-fetch-site': 'same-origin' } }), false)
  assert.equal(crossSiteRequest({ headers: { 'sec-fetch-site': 'none' } }), false)
  assert.equal(crossSiteRequest({ headers: { origin: 'http://localhost:3000', host: 'localhost:3000' } }), false)
})

test('cross-site request metadata is rejected', () => {
  assert.equal(crossSiteRequest({ headers: { 'sec-fetch-site': 'cross-site' } }), true)
  assert.equal(crossSiteRequest({ headers: { origin: 'https://evil.example', host: 'localhost:3000' } }), true)
  assert.equal(crossSiteRequest({ headers: { origin: 'not-a-url' } }), true)
})
