import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { scopedAgent } from './helpers/agent.mjs'
import { isPublicAddress, fetchNativePage, fetchPublicResponse } from '../src/retrieval/public-fetch.mjs'
import { proposeMemory, confirmMemory, recallMemory } from '../src/memory/store.mjs'
import { acquireFileLease } from '../src/util/file-lease.mjs'

const lookupImpl = async () => [{ address: '93.184.216.34', family: 4 }]
test('reserved IPv4 and all IPv6 mapped private representations are blocked', () => {
  for (const address of ['::ffff:7f00:1', '::ffff:a00:1', '0:0:0:0:0:ffff:c0a8:1', '::ffff:127.0.0.1', '[::1]', 'ff02::1', '2001:db8::1', '198.18.0.1']) assert.equal(isPublicAddress(address), false, address)
  for (const address of ['1.1.1.1', '2606:4700:4700::1111', '::ffff:101:101']) assert.equal(isPublicAddress(address), true, address)
})
test('each redirect including robots is admitted before transport and uses pinned DNS', async () => {
  for (const robots of [false, true]) {
    let calls = 0
    await assert.rejects(fetchNativePage({ url: 'https://example.com/start', robots, lookupImpl, fetchImpl: async (url, options) => {
      calls++
      assert.equal(options.redirect, 'manual')
      assert.deepEqual(options.approvedAddresses, await lookupImpl())
      return { status: 302, url: String(url), headers: { get: () => 'http://[::ffff:7f00:1]/secret' } }
    } }), { code: 'FETCH_SSRF_BLOCKED' })
    assert.equal(calls, 1)
  }
  let calls = 0
  await assert.rejects(fetchPublicResponse('https://example.com/', { lookupImpl, allowedHosts: ['example.com'], fetchImpl: async url => { calls++; return { status: 302, url: String(url), headers: { get: () => 'https://other.example/' } } } }), { code: 'FETCH_HOST_NOT_ALLOWED' })
  assert.equal(calls, 1)
})
test('memory rejects corruption and revoked queued writes, preserving original bytes', async () => {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-memory-safety-'))
  await mkdir(join(process.env.DSH_HOME, 'patchwork'))
  const path = join(process.env.DSH_HOME, 'patchwork', 'memory.json')
  await writeFile(path, '{damaged')
  const a = scopedAgent({ session: { header: { id: 'a', cwd: process.env.DSH_HOME } } })
  assert.equal((await proposeMemory(a, { key: 'a', value: 'b' })).failureCode, 'MEMORY_DATABASE_INVALID')
  assert.equal(await readFile(path, 'utf8'), '{damaged')
  const pending = proposeMemory(a, { key: 'a', value: 'b' })
  a.selectPreset('standard')
  assert.equal((await pending).failureCode, 'MEMORY_SCOPE_REVOKED')
})
test('lease recovery survives a dead recovery owner and never steals a live lease', async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-lease-')), path = join(root, 'lease')
  for (const lock of [path, `${path}.recovery`]) { await mkdir(lock); await writeFile(join(lock, 'owner.json'), JSON.stringify({ pid: 2147483647, token: lock })) }
  const release = await acquireFileLease(path, { timeoutMs: 500 })
  await assert.rejects(acquireFileLease(path, { timeoutMs: 30, orphanGraceMs: 0 }), { code: 'MEMORY_LOCK_TIMEOUT' })
  await release()
  const second = await acquireFileLease(path); await second()
})
test('cancelled memory execution cannot write even while remaining in Patchwork', async () => {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-memory-abort-'))
  const agent = scopedAgent({ session: { header: { id: 'cancelled-memory', cwd: process.env.DSH_HOME } } }), cancellation = new AbortController()
  const result = proposeMemory(agent, { key: 'must not commit', value: 'cancelled' }, { signal: cancellation.signal })
  cancellation.abort(); assert.equal((await result).failureCode, 'MEMORY_SCOPE_REVOKED')
  assert.equal((await recallMemory(agent)).entries.length, 0)
})
test('namespace quota cannot evict another session and cross-process revisions do not lose writes', async () => {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-memory-concurrent-'))
  const a = scopedAgent({ session: { header: { id: 'protected', cwd: process.env.DSH_HOME } } })
  const record = await proposeMemory(a, { key: 'keep', value: 'confirmed' })
  await confirmMemory(a, record.recordId, record.revision, { userConfirmed: true })
  const childCode = `import { scopedAgent } from ${JSON.stringify(new URL('./helpers/agent.mjs', import.meta.url).href)}; import { proposeMemory } from ${JSON.stringify(new URL('../src/memory/store.mjs', import.meta.url).href)}; const a = scopedAgent({session:{header:{id:process.argv[1],cwd:process.env.DSH_HOME}}}); for(let i=0;i<12;i++) { const r=await proposeMemory(a,{key:String(i),value:'value'}); if(r.status!=='committed') throw new Error(r.failureCode); }`
  await Promise.all(['b', 'c'].map(id => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', childCode, id], { env: process.env, windowsHide: true }); let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk }); child.on('error', reject); child.on('close', code => code ? reject(new Error(stderr)) : resolve())
  })))
  let database = JSON.parse(await readFile(join(process.env.DSH_HOME, 'patchwork', 'memory.json'), 'utf8'))
  assert.equal(database.records.length, 25); assert.equal(database.revision, 26)
  const b = scopedAgent({ session: { header: { id: 'quota', cwd: process.env.DSH_HOME } } })
  for (let i = 0; i < 200; i++) assert.equal((await proposeMemory(b, { key: String(i), value: 'v' })).status, 'committed')
  assert.equal((await proposeMemory(b, { key: 'excess', value: 'v' })).failureCode, 'MEMORY_NAMESPACE_QUOTA')
  assert.equal((await recallMemory(a)).entries[0].value, 'confirmed')
  // A killed owner can be recovered without stealing a live lock.
  const lock = join(process.env.DSH_HOME, 'patchwork', 'memory.json.lock')
  await mkdir(lock); await writeFile(join(lock, 'owner.json'), JSON.stringify({ pid: 2147483647, token: 'dead-owner' }))
  assert.equal((await proposeMemory(a, { key: 'recovered', value: 'yes' })).status, 'committed')
})
