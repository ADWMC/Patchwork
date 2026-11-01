import test from 'node:test'
import assert from 'node:assert/strict'
import { compareIdentity, preserveDeviceLocale } from '../src/browser/identity.mjs'
import { compareClientHints } from '../src/browser/client-hints.mjs'

test('Client Hints compare JS brands and entropy against received headers and actual engine version', () => {
  const main = { ua: 'Mozilla/5.0 Chrome/155.0.0.0', uaData: { brands: [{ brand: 'Chromium', version: '155' }], fullVersionList: [{ brand: 'Chromium', version: '155.0.8059.85' }], mobile: false, platform: 'Windows', platformVersion: '10.0.0' } }
  const headers = { 'sec-ch-ua': '"Chromium";v="155"', 'sec-ch-ua-full-version-list': '"Chromium";v="155.0.8059.85"', 'sec-ch-ua-platform': '"Windows"', 'sec-ch-ua-platform-version': '"10.0.0"', 'sec-ch-ua-mobile': '?0' }
  assert.equal(compareClientHints(main, headers, '155.0.8059.85').status, 'match')
  assert.equal(compareClientHints(main, { ...headers, 'sec-ch-ua-platform': '"Linux"' }, '155.0.8059.85').status, 'mismatch')
  assert.equal(compareClientHints(main, headers, '156.0.0.0').status, 'mismatch')
  assert.equal(compareClientHints({ ...main, uaData: null }, {}, '155.0.8059.85').status, 'unknown')
  assert.equal(compareClientHints(main, { ...headers, 'sec-ch-ua-full-version-list': undefined }, '155.0.8059.85').status, 'unknown')
})

test('zero measured identity fields are unknown, never a match', () => {
  assert.equal(compareIdentity().status, 'unknown')
  assert.deepEqual(compareIdentity({}, { platform: 'Win32' }).counts, { match: 0, mismatch: 0, unknown: 1, unsupported: 0 })
  assert.equal(compareIdentity({ platform: 'Win32' }, {}).status, 'unknown')
  assert.equal(compareIdentity({ platform: 'Win32' }, { platform: 'Win32' }).status, 'match')
  assert.equal(compareIdentity({ platform: 'Win32' }, { platform: 'MacIntel' }).status, 'mismatch')
})

test('partial and unsupported identity measurements remain visible', () => {
  const result = compareIdentity({ platform: 'Win32', memory: 8 }, { platform: 'Win32' }, { fields: ['platform', 'memory', 'webrtc'], unsupported: ['webrtc'] })
  assert.equal(result.status, 'unknown')
  assert.deepEqual(result.counts, { match: 1, mismatch: 0, unknown: 1, unsupported: 1 })
})

test('locale changes preserve device data and do not mutate the prior identity', () => {
  const sample = { fingerprint: { navigator: { language: 'zh-CN', languages: ['zh-CN'], hardwareConcurrency: 8 }, screen: { width: 1920 }, videoCard: { renderer: 'device' }, canvas: { seed: 42 } }, headers: { 'Accept-Language': 'zh-CN' } }
  const updated = preserveDeviceLocale(sample, 'en-US')
  assert.deepEqual(updated.fingerprint.screen, sample.fingerprint.screen)
  assert.deepEqual(updated.fingerprint.canvas, sample.fingerprint.canvas)
  assert.equal(updated.fingerprint.navigator.hardwareConcurrency, 8)
  assert.deepEqual(updated.fingerprint.navigator.languages, ['en-US', 'en'])
  assert.equal(sample.fingerprint.navigator.language, 'zh-CN')
})
