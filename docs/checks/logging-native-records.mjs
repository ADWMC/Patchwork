// Native Session API probe only: no running agent, model call or DSH_HOME writes.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const host = createRequire(join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh/package.json'))
const { Session, appendPluginRecord, pluginRecordOf } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-session')).href)
assert.equal(typeof appendPluginRecord, 'function')
assert.equal(typeof pluginRecordOf, 'function')
const session = Session.create('patchwork-isolated-log-probe')
const before = session.deriveMessages()
const data = { version: 1, mechanism: 'occ', event: 'decision', reason: 'horizon-unavailable' }
const seq = appendPluginRecord(session, 'plugin:patchwork/audit', data)
assert.deepEqual(session.deriveMessages(), before)
assert.equal(session.eventAt(seq).ignorable, true)
assert.deepEqual(pluginRecordOf(session.eventAt(seq)).data, data)
const restored = Session.create('patchwork-isolated-log-restore', session.snapshotEvents())
assert.deepEqual(pluginRecordOf(restored.eventAt(seq)).data, data)
assert.deepEqual(restored.deriveMessages(), before)
console.log(JSON.stringify({
  date: '2026-10-30',
  probe: 'installed DSH native in-memory Session; not disk/export/authorization end-to-end',
  recordType: 'plugin:patchwork/audit',
  ignorable: true,
  modelContextUnchanged: true,
  snapshotRestorePreservesRecord: true,
  mainDshTouched: false,
  runtimeLoggingIntegrationImplemented: false,
}, null, 2))
