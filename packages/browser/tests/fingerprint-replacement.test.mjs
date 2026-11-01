import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserProfiles } from '../src/browser/profiles.mjs'
import { BrowserSession } from '../src/browser/session.mjs'
import { scopedAgent } from './helpers/agent.mjs'

const keyProvider = async () => Buffer.alloc(32, 31)
async function fixture(t, id = 'fingerprint-replacement') {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-fingerprint-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const agent = scopedAgent({ session: { header: { id } } })
  return { root, agent, store: new BrowserProfiles(agent, { root, keyProvider }) }
}

test('new fingerprint is a distinct profile and never copies the source login state', async t => {
  const { store } = await fixture(t)
  let db = await store.edit({ action: 'createProfile', revision: 0, profile: { name: '保留原环境', mode: 'fingerprint', persistStorage: true } })
  const previous = await store.get(db.profiles.at(-1).id)
  const storage = { cookies: [{ name: 'login', value: 'private', domain: 'localhost', path: '/' }], origins: [] }
  await store.saveStorage(previous, { storageState: async () => storage })
  const replacement = structuredClone(previous.fingerprint)
  replacement.fingerprint.navigator.hardwareConcurrency = previous.fingerprint.fingerprint.navigator.hardwareConcurrency + 1
  store.generateFingerprint = () => structuredClone(replacement)
  const release = await store.lease(previous.id)
  try { db = await store.edit({ action: 'regenerateProfile', profileId: previous.id, revision: 1 }) } finally { await release() }
  const next = db.profiles.at(-1)
  assert.notEqual(next.id, previous.id)
  assert.notEqual(next.fingerprintId, db.profiles[1].fingerprintId)
  assert.deepEqual(await store.get(previous.id), previous)
  assert.deepEqual(await store.readStorage(previous), storage)
  assert.equal(await store.readStorage(await store.get(next.id)), undefined)
  assert.equal(next.fingerprint, undefined)
  assert.equal(next.fingerprintBrowserMajor > 0, true)
})

test('a repeated sample, foreign profile or stale revision cannot fake a successful replacement', async t => {
  const { store } = await fixture(t)
  const db = await store.edit({ action: 'createProfile', revision: 0, profile: { name: 'stable', mode: 'fingerprint' } })
  const previous = await store.get(db.profiles.at(-1).id)
  store.generateFingerprint = () => structuredClone(previous.fingerprint)
  await assert.rejects(store.edit({ action: 'regenerateProfile', profileId: previous.id, revision: 1 }), /没有生成不同/)
  await assert.rejects(store.edit({ action: 'regenerateProfile', profileId: previous.id, revision: 0 }), /changed/)
  await assert.rejects(store.edit({ action: 'regenerateProfile', profileId: 'foreign', revision: 1 }), /does not belong/)
  const after = await store.list()
  assert.equal(after.revision, 1)
  assert.equal(after.profiles.length, 2)
  assert.deepEqual(await store.get(previous.id), previous)
})

test('device replacement changes actual environment settings and native mode cannot claim a random identity', async t => {
  const { store, root, agent } = await fixture(t)
  let db = await store.edit({ action: 'createProfile', revision: 0, profile: { name: '设备', mode: 'device' } })
  const old = db.profiles.at(-1)
  store.generateFingerprint = () => ({ fingerprint: { screen: { width: old.screen.width === 2560 ? 1920 : 2560, height: 1800, devicePixelRatio: old.deviceScaleFactor === 2 ? 1 : 2 } } })
  db = await store.edit({ action: 'regenerateProfile', profileId: old.id, revision: 1 })
  const next = db.profiles.at(-1)
  assert.notEqual(next.fingerprintId, old.fingerprintId)
  assert.notDeepEqual([next.screen, next.deviceScaleFactor], [old.screen, old.deviceScaleFactor])
  db = await store.edit({ action: 'createProfile', revision: 2, profile: { name: 'native', mode: 'native' } })
  await assert.rejects(store.edit({ action: 'regenerateProfile', profileId: db.profiles.at(-1).id, revision: 3 }), /原生环境/)
  const session = new BrowserSession(agent, { root, keyProvider })
  try { await assert.rejects(session.action('agent', { action: 'regenerateProfile', profileId: old.id, revision: 3 }), /requires the user panel/) } finally { await session.dispose() }
})
