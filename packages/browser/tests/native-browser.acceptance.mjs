// Explicit source-checkout acceptance. Never downloads or uses the host browser.
// node packages/browser/tests/native-browser.acceptance.mjs --home ABS_ISOLATED_HOME --output ABS_REPORT
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { bootPatchwork, loadDriver } from '../../../tests/real-composition/harness.mjs'
import { browserClient } from '../src/browser/tool.mjs'
import { readComponent } from '../src/browser/components/store.mjs'
import { BrowserProfiles } from '../src/browser/profiles.mjs'
import { ALIASMODE_BROWSER_VERSION } from '../src/browser/components/catalog.mjs'
const args = process.argv.slice(2)
const home = args[args.indexOf('--home') + 1], output = args[args.indexOf('--output') + 1]
if (!args.includes('--home') || !args.includes('--output') || !isAbsolute(home) || !isAbsolute(output)) throw new Error('Explicit absolute --home and --output are required')
const root = join(home, 'patchwork/browser')
process.env.DSH_HOME = home
assert.ok((await readComponent(root, 'aliasmode', { verify: true }))?.installed, 'Explicitly install the pinned AliasMode component first')
const probeUrl = new URL('./helpers/native-probe-plugin.mjs', import.meta.url).href
const report = { schema: 1, date: new Date().toISOString(), realDshRegistries: true, fullDshClient: false, modelRequests: 0, hostBrowserUsed: false, platform: process.platform, checks: [], unmeasured: ['exit-IP', 'TLS', 'WebRTC', 'cross-origin iframe', 'service worker', 'external anti-bot acceptance'] }
const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8'); res.setHeader('cache-control', 'no-store')
  res.end('<!doctype html><meta charset="utf-8"><title>家电验收</title><label>设备名称<input aria-label="设备名称"></label><label><input type="checkbox" aria-label="省电模式">省电模式</label><button aria-label="客厅灯" aria-pressed="false" onclick="this.setAttribute(\'aria-pressed\',this.getAttribute(\'aria-pressed\')===\'true\'?\'false\':\'true\')">客厅灯</button>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/appliance`
let boot, probe
let calls = 0
async function tool(owner, action) {
  const id = `native-${++calls}`
  const result = await owner.tools.execute({ agent: owner.agent, name: 'patchwork_browser', callId: id, rootCallId: id, arguments: action, signal: new AbortController().signal })
  assert.equal(result.isError, false, JSON.stringify(result))
  const text = result.content.filter(x => x.type === 'text').map(x => x.text).join('\n')
  return { text, observationId: text.match(/Observation: ([a-f0-9-]+)/)?.[1] }
}
const activeContext = id => probe.engines.findLast(x => x.profileId === id && x.browser.isConnected()).browser.contexts()[0]
async function measure(page) {
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 120
    const c = canvas.getContext('2d'), g = c.createLinearGradient(0, 0, 320, 120)
    g.addColorStop(0, '#139a81'); g.addColorStop(1, '#f94c71'); c.fillStyle = g; c.fillRect(0, 0, 320, 120)
    c.font = '21px Arial'; c.fillStyle = '#112358'; c.fillText('Patchwork native identity 012345', 7, 48); c.beginPath(); c.arc(112.5, 80.25, 29.75, 0, Math.PI * 1.7); c.fill()
    const gl = document.createElement('canvas').getContext('webgl'), ext = gl.getExtension('WEBGL_debug_renderer_info')
    return { ua: navigator.userAgent, uaData: await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'fullVersionList']), platform: navigator.platform, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, language: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, screen: [screen.width, screen.height, devicePixelRatio], gpu: [gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)], canvas: canvas.toDataURL() }
  })
  result.canvas = createHash('sha256').update(result.canvas).digest('hex')
  return result
}
async function login(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('native-qa', 1); r.onupgradeneeded = () => r.result.createObjectStore('login'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const idb = await new Promise((resolve, reject) => { const r = db.transaction('login').objectStore('login').get('marker'); r.onsuccess = () => resolve(r.result ?? null); r.onerror = () => reject(r.error) })
    db.close(); return { cookie: document.cookie, local: localStorage.getItem('marker'), idb }
  })
}
try {
  boot = await bootPatchwork({ root }, { pluginEntry: probeUrl }); probe = await import(probeUrl)
  const driver = await loadDriver(), run = randomUUID().slice(0, 8)
  const a = driver.createAgent({ id: `native-a-${run}`, sessionId: `native-a-${run}`, preset: 'standard', cwd: home })
  const b = driver.createAgent({ id: `native-b-${run}`, sessionId: `native-b-${run}`, preset: 'standard', cwd: home })
  assert.equal(a.tools.schemas(a.agent).some(x => x.name === 'patchwork_browser'), false)
  probe.manager.enable(a.agent, 'standard')
  assert.equal(b.tools.schemas(b.agent).some(x => x.name === 'patchwork_browser'), false)
  probe.manager.enable(b.agent, 'standard')
  const ca = browserClient(a.agent), cb = browserClient(b.agent)
  const first = (await ca.action({ action: 'createProfile', revision: 0, profile: { name: '原生 A', backend: 'aliasmode', mode: 'fingerprint', persistStorage: true } })).profiles.at(-1)
  const second = (await cb.action({ action: 'createProfile', revision: 0, profile: { name: '原生 B', backend: 'aliasmode', mode: 'fingerprint' } })).profiles.at(-1)
  await ca.action({ action: 'useProfile', profileId: first.id }); await ca.action({ action: 'control', control: 'agent' }); await tool(a, { action: 'navigate', url })
  await cb.action({ action: 'useProfile', profileId: second.id }); await cb.action({ action: 'control', control: 'agent' }); await tool(b, { action: 'navigate', url })
  let pageA = activeContext(first.id).pages()[0], pageB = activeContext(second.id).pages()[0]
  report.engine = (await ca.status()).engineVersion; assert.equal(report.engine, ALIASMODE_BROWSER_VERSION)
  const baseline = await measure(pageA), baselineB = await measure(pageB)
  report.checks.push('real DSH tool registry requires explicit per-session authorization; two private native engines coexist')
  let observed = await tool(a, { action: 'snapshot' })
  await tool(a, { action: 'fill', target: { by: 'label', value: '设备名称' }, observationId: observed.observationId, value: '客厅主灯' })
  observed = await tool(a, { action: 'snapshot' })
  await tool(a, { action: 'check', target: { by: 'role', value: 'checkbox', name: '省电模式' }, observationId: observed.observationId, checked: true })
  assert.equal(await pageA.getByLabel('设备名称').inputValue(), '客厅主灯'); assert.equal(await pageA.getByLabel('省电模式').isChecked(), true)
  assert.equal(await pageB.getByLabel('设备名称').inputValue(), '')
  await pageA.evaluate(async () => {
    document.cookie = 'native_qa=source;path=/'; localStorage.setItem('marker', 'source')
    const db = await new Promise(resolve => { const r = indexedDB.open('native-qa', 1); r.onupgradeneeded = () => r.result.createObjectStore('login'); r.onsuccess = () => resolve(r.result) })
    await new Promise(resolve => { const tx = db.transaction('login', 'readwrite'); tx.objectStore('login').put('source', 'marker'); tx.oncomplete = resolve }); db.close()
  })
  const originalLogin = await login(pageA)
  assert.equal((await login(pageB)).local, null)
  await ca.action({ action: 'health' }); report.health = (await ca.status()).health
  for (const field of ['configuration', 'iframe', 'worker', 'network', 'clientHints', 'rendering']) assert.equal(report.health[field].status, 'match', field)
  const frame = await ca.frame(); assert.ok(frame.image.length > 100)
  const streamed = await new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No native CDP frame')), 10000)
    let stop
    try { stop = await ca.stream(value => { clearTimeout(timer); resolve(value); queueMicrotask(() => stop?.()) }, () => {}); } catch (e) { clearTimeout(timer); reject(e) }
    if (stop) setTimeout(stop, 1000).unref()
  })
  assert.ok(streamed.image.length > 100)
  report.checks.push('real DSH fill/check, session DOM and cookie/localStorage/IndexedDB isolation, health, screenshot and CDP stream')
  const next = (await ca.action({ action: 'regenerateProfile', profileId: first.id, revision: 1 })).profiles.at(-1)
  assert.equal((await ca.status()).profileId, first.id); assert.deepEqual(await measure(pageA), baseline)
  await ca.action({ action: 'useProfile', profileId: next.id }); await ca.action({ action: 'navigate', url })
  pageA = activeContext(next.id).pages()[0]; const changed = await measure(pageA)
  assert.notEqual(changed.canvas, baseline.canvas, 'Different seed must change actual Canvas output')
  assert.deepEqual(await login(pageA), { cookie: '', local: null, idb: null })
  assert.deepEqual(await measure(pageB), baselineB)
  report.checks.push('regeneration leaves source live; use restarts its process, changes actual Canvas output and starts with empty login; second session remains unchanged')
  await ca.action({ action: 'useProfile', profileId: first.id }); await ca.action({ action: 'navigate', url })
  pageA = activeContext(first.id).pages()[0]
  assert.deepEqual(await measure(pageA), baseline, 'Same identity must survive engine restart')
  assert.deepEqual(await login(pageA), originalLogin)
  report.checks.push('same seed survives process restart with identical measured identity/Canvas and restores opted-in encrypted cookies/localStorage/IndexedDB')
  probe.failNextLaunch()
  await assert.rejects(ca.action({ action: 'useProfile', profileId: next.id }), /已重新打开原环境/)
  pageA = activeContext(first.id).pages()[0]
  assert.equal(pageA.url(), url); assert.deepEqual(await measure(pageA), baseline); assert.deepEqual(await login(pageA), originalLogin)
  assert.deepEqual(await measure(pageB), baselineB)
  assert.equal(probe.peakEngines, 2); assert.equal(probe.resources.aggregate().running, 2)
  const privateStore = new BrowserProfiles(a.agent, { root }), raw = await privateStore.get(first.id)
  assert.equal(JSON.stringify(await ca.status()).includes(raw.engineIdentity.seed), false)
  await ca.action({ action: 'control', control: 'agent' })
  assert.equal((await tool(a, { action: 'profiles' })).text.includes(raw.engineIdentity.seed), false)
  report.checks.push('injected target startup failure restores old URL, identity and login; no third process; seed absent from user and model outputs')
  await probe.manager.disable(a.agent)
  assert.equal(browserClient(a.agent), undefined); assert.equal(a.tools.schemas(a.agent).some(x => x.name === 'patchwork_browser'), false)
  await assert.rejects(ca.action({ action: 'profiles' }), /authorized|browser|Browser|授权/)
  assert.deepEqual(await measure(pageB), baselineB)
  report.checks.push('revoking one session removes its tool and process; the other session remains usable')
  report.measurements = { original: baseline, replacement: changed, secondSession: baselineB }
  report.nativeToolCalls = calls; report.peakEngines = probe.peakEngines; report.status = 'passed'
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1 }
finally {
  await probe?.manager?.dispose(); await boot?.dispose()
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
  report.remainingEngines = probe?.engines.filter(x => x.browser.isConnected()).length ?? 0
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
