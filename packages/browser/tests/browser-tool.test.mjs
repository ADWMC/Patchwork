import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedAgent } from './helpers/agent.mjs'
import { PATCHWORK_BROWSER_TOOL, registerBrowserTool } from '../src/browser/tool.mjs'
import { registerBrowserRoute } from '../src/browser/route.mjs'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { browserClient } from '../src/browser/tool.mjs'
import { BrowserProfiles, resolvedProxy } from '../src/browser/profiles.mjs'
import { readFile, readdir, rm } from 'node:fs/promises'
import { after } from 'node:test'
import { BrowserSession } from '../src/browser/session.mjs'
import { imageSize } from '../src/browser/evidence.mjs'
const keyProvider = async () => Buffer.alloc(32, 17)

function fixture() {
  const listeners = new Map()
  const agents = new Map()
  const launches = []
  const launchOptions = []
  const root = mkdtempSync(join(tmpdir(), 'patchwork-browser-unit-'))
  after(async () => { for (const agent of agents.values()) await listeners.get('agent/disposed')?.({ agent }); await rm(root, { recursive: true, force: true }) })
  let definition
  const ctx = {
    tools: { register(value) { definition = value } },
    on(name, listener) { listeners.set(name, listener) },
    get(name) {
      if (name === 'agents') return { get: id => agents.get(id) }
      if (name === 'attachments') return { saveImage: async () => ({ attachmentId: 'image-1', mediaType: 'image/png', bytes: 4, width: 1, height: 1 }) }
    },
  }
  registerBrowserTool(ctx, { root, keyProvider, launch: async options => {
    launchOptions.push(options)
    const browser = {
      closed: false,
      contexts: [],
      version: () => '156.0.0.0',
      async newContext(options) {
        const context = new EventEmitter()
        context.options = options
        context.pages = []
        context.route = async () => {}
        context.close = async () => { for (const page of [...context.pages]) await page.close() }
        context.storageState = async () => ({ cookies: [], origins: [] })
        context.newPage = async () => {
        const page = Object.assign(new EventEmitter(), {
          current: 'about:blank',
          size: { width: 1280, height: 800 },
          url() { return this.current },
          viewportSize() { return this.size },
          async title() { return this.current },
          locator() { return { ariaSnapshot: async () => this.current, click: async () => {}, fill: async () => {}, press: async () => {} } },
          mainFrame() { return this },
          async goto(url) { this.current = url; this.emit('framenavigated', this) },
          async reload() {},
          async setViewportSize(value) { this.size = value },
          async screenshot(options) {
            if (options.type === 'png') assert.equal(options.quality, undefined)
            const data = options.type === 'png' ? Buffer.alloc(24) : Buffer.alloc(13)
            if (options.type === 'png') { Buffer.from([137,80,78,71,13,10,26,10]).copy(data); data.writeUInt32BE(this.size.width,16); data.writeUInt32BE(this.size.height,20) }
            else { Buffer.from([255,216,255,192,0,9,8]).copy(data); data.writeUInt16BE(this.size.height,7); data.writeUInt16BE(this.size.width,9) }
            return data
          },
          mouse: { click: async () => {}, wheel: async () => {} },
          keyboard: { insertText: async () => {}, press: async () => {} },
          async goBack() {},
          async goForward() {},
          setDefaultTimeout() {},
          async close() { this.emit('close') },
        })
        context.pages.push(page)
        context.emit('page', page)
        return page
        }
        this.contexts.push(context)
        return context
      },
      async close() { this.closed = true },
    }
    launches.push(browser)
    return browser
  } })
  const agent = id => {
    const value = scopedAgent({ session: { header: { id } } })
    agents.set(id, value)
    return value
  }
  const call = (owner, args) => definition.execute(args, { agent: owner, signal: new AbortController().signal })
  return { agent, call, definition, listeners, launches, launchOptions, agents, root }
}

test('browser state belongs to one Patchwork Agent and is closed on preset switch', async () => {
  const { agent, call, definition, listeners, launches, launchOptions } = fixture()
  assert.equal(definition.name, PATCHWORK_BROWSER_TOOL)
  const first = agent('first')
  const second = agent('second')
  const standard = agent('standard')
  standard.selectPreset('standard')
  await assert.rejects(call(standard, { action: 'snapshot' }), /browser access/i)
  const previousKey = process.env.PATCHWORK_STEPFUN_KEY
  process.env.PATCHWORK_STEPFUN_KEY = 'unit-test-secret'
  try {
    await call(first, { action: 'navigate', url: 'https://example.com/first' })
    await call(second, { action: 'navigate', url: 'https://example.com/second' })
  } finally {
    if (previousKey === undefined) delete process.env.PATCHWORK_STEPFUN_KEY
    else process.env.PATCHWORK_STEPFUN_KEY = previousKey
  }
  assert.equal((await call(first, { action: 'snapshot' })).url, 'https://example.com/first')
  assert.equal((await call(second, { action: 'snapshot' })).url, 'https://example.com/second')
  assert.equal(launches.length, 2)
  assert.equal(launchOptions[0].env.PATCHWORK_STEPFUN_KEY, undefined)
  assert.equal(launchOptions[0].headless, true)
  const shot = await call(first, { action: 'screenshot' })
  assert.equal(definition.output.render({}, shot)[1].type, 'image')
  first.selectPreset('standard')
  await listeners.get('agent-preset/selected')('first')
  assert.equal(launches[0].closed, true)
  await assert.rejects(call(first, { action: 'snapshot' }), /browser access/i)
  assert.equal(launches[1].closed, false)
  await listeners.get('agent/disposed')({ agent: second })
  assert.equal(launches[1].closed, true)
})

test('multi-tab browser has stable ids, owner checks, a tab limit and no duplicate initial page', async () => {
  const f = fixture()
  const a = f.agent('tabs-a')
  const b = f.agent('tabs-b')
  const first = await f.call(a, { action: 'newTab', url: 'https://example.com/first' })
  assert.equal(first.tabs.length, 1)
  const firstId = first.selectedTabId
  const second = await f.call(a, { action: 'newTab', url: 'https://example.com/second' })
  assert.equal(second.tabs.length, 2)
  assert.notEqual(second.selectedTabId, firstId)
  await f.call(a, { action: 'selectTab', tabId: firstId })
  assert.equal((await f.call(a, { action: 'snapshot' })).url, 'https://example.com/first')
  await assert.rejects(f.call(b, { action: 'selectTab', tabId: firstId }), /does not belong/)
  assert.equal(f.launches.length, 1)
  for (let i = 2; i < 8; i++) await f.call(a, { action: 'newTab' })
  await assert.rejects(f.call(a, { action: 'newTab' }), /At most 8/)
  await f.call(a, { action: 'closeTab', tabId: firstId })
  assert.equal((await f.call(a, { action: 'tabs' })).tabs.length, 7)
})

test('user takeover blocks every Agent write, leaves observations available and requires user resume', async () => {
  const f = fixture()
  const agent = f.agent('control-a')
  await f.call(agent, { action: 'navigate', url: 'https://example.com/' })
  const client = browserClient(agent)
  await client.action({ action: 'control', control: 'user' })
  for (const action of ['navigate', 'click', 'fill', 'press', 'resize', 'reload', 'back', 'forward', 'close', 'newTab', 'selectTab', 'closeTab', 'useProfile']) {
    await assert.rejects(f.call(agent, { action }), /用户接管/)
  }
  for (const action of ['snapshot', 'screenshot', 'tabs', 'profiles']) assert.equal((await f.call(agent, { action })).control, 'user')
  await assert.rejects(f.call(agent, { action: 'control', control: 'agent' }), /Unsupported/)
  await client.action({ action: 'control', control: 'agent' })
  assert.equal((await f.call(agent, { action: 'navigate', url: 'https://example.com/resumed' })).url, 'https://example.com/resumed')
})

test('frame metadata binds clicks to the actual tab and rejects stale viewport and navigation input', async () => {
  const f = fixture()
  const agent = f.agent('frames-a')
  await f.call(agent, { action: 'navigate', url: 'https://example.com/' })
  const client = browserClient(agent)
  let frame = await client.frame()
  assert.deepEqual(imageSize(frame.image), frame.viewport)
  await client.action({ action: 'clickPoint', x: 20, y: 30, tabId: frame.tabId, frameId: frame.frameId })
  await assert.rejects(client.action({ action: 'type', value: 'wrong', tabId: frame.tabId, frameId: frame.frameId }), /输入焦点已变化/)
  assert.equal((await client.status()).control, 'user')
  await client.action({ action: 'control', control: 'agent' })
  frame = await client.frame()
  for (let i = 0; i < 10; i++) assert.equal((await client.frame()).frameId, frame.frameId)
  await f.call(agent, { action: 'resize', width: 800, height: 600 })
  await assert.rejects(client.action({ action: 'clickPoint', x: 20, y: 30, tabId: frame.tabId, frameId: frame.frameId }), /画面已变化/)
  frame = await client.frame()
  await client.action({ action: 'control', control: 'agent' })
  await f.call(agent, { action: 'navigate', url: 'https://example.com/changed' })
  await assert.rejects(client.action({ action: 'type', value: 'wrong', tabId: frame.tabId, frameId: frame.frameId }), /画面已变化/)
  frame = await client.frame()
  await assert.rejects(client.action({ action: 'key', value: 'Enter', tabId: 'another-tab', frameId: frame.frameId }), /画面已变化/)
})

test('profile storage is session-private, revision checked and sanitized for Agent output', async () => {
  const f = fixture()
  const agent = f.agent('profiles-a')
  const other = f.agent('profiles-b')
  f.listeners.get('agent/created')({ agent })
  const client = browserClient(agent)
  assert.equal((await client.status()).profiles.length, 1)
  assert.equal(f.launches.length, 0)
  await assert.rejects(readdir(f.root).then(items => { if (!items.length) throw new Error('empty') }), /empty/)
  const result = await client.action({ action: 'createProfile', revision: 0, profile: { name: '独立工作环境', persistStorage: true, proxy: { server: 'http://localhost:7897', usernameEnv: 'PATCHWORK_PROXY_USER', passwordEnv: 'PATCHWORK_PROXY_PASSWORD' } } })
  const id = result.profiles.at(-1).id
  const list = await f.call(agent, { action: 'profiles' })
  assert.deepEqual(list.profiles.at(-1).proxy, { configured: true })
  assert.equal(JSON.stringify(list).includes('PATCHWORK_PROXY'), false)
  assert.equal((await f.call(other, { action: 'profiles' })).profiles.length, 1)
  await assert.rejects(f.call(other, { action: 'useProfile', profileId: id }), /does not belong/)
  await assert.rejects(client.action({ action: 'deleteProfile', profileId: id, revision: 0 }), /changed/)
  assert.equal((await client.status()).revision, 1)
  await assert.rejects(client.action({ action: 'createProfile', revision: 1, profile: { name: 'bad', proxy: { server: 'http://user:secret@localhost:7897' } } }), /without embedded credentials/)
  await assert.rejects(client.action({ action: 'createProfile', revision: 1, profile: { name: 'bad', fingerprint: 'untrusted' } }), /Unknown/)
})

test('saved cookies/local storage/IndexedDB are bounded, opt-in and removed when disabled', async () => {
  const f = fixture()
  const a = f.agent('storage-a')
  const store = new BrowserProfiles(a, { root: f.root, keyProvider })
  let database = await store.edit({ action: 'createProfile', revision: 0, profile: { name: 'login', persistStorage: true } })
  const id = database.profiles.at(-1).id
  const profile = await store.get(id)
  const storage = { cookies: [{ name: 'private', value: 'private-cookie', domain: 'example.com', path: '/' }], origins: [{ origin: 'https://example.com', localStorage: [{ name: 'key', value: 'value' }], indexedDB: [] }] }
  await store.saveStorage(profile, { storageState: async options => { assert.equal(options.indexedDB, true); return storage } })
  assert.deepEqual(await store.readStorage(profile), storage)
  const other = new BrowserProfiles(f.agent('storage-b'), { root: f.root, keyProvider })
  await assert.rejects(other.get(id), /does not belong/)
  await store.edit({ action: 'updateProfile', profileId: id, revision: 1, profile: { persistStorage: false } })
  await assert.rejects(readFile(store.storagePath(id)), { code: 'ENOENT' })
  await store.saveStorage(profile, { storageState: async () => { throw new Error('must not save') } })
  assert.equal(await store.readStorage(await store.get(id)), undefined)
  database = await store.edit({ action: 'updateProfile', profileId: id, revision: 2, profile: { persistStorage: true } })
  await assert.rejects(store.saveStorage(await store.get(id), { storageState: async () => ({ cookies: [], origins: ['x'.repeat(2 * 1024 * 1024)] }) }), /size limit/)
  assert.equal(database.revision, 3)
})

test('device profiles retain a stable identity and full fingerprint incompatibility preserves existing tabs', async () => {
  const f = fixture()
  const a = f.agent('device-a')
  await f.call(a, { action: 'navigate', url: 'https://example.com/keep' })
  const client = browserClient(a)
  const result = await client.action({ action: 'createProfile', revision: 0, profile: { name: 'device', mode: 'device', colorScheme: 'light', locale: 'en-US', timezoneId: 'America/New_York' } })
  const device = result.profiles.at(-1)
  assert.equal((await client.status()).profiles.at(-1).fingerprintId, device.fingerprintId)
  await client.action({ action: 'useProfile', profileId: device.id })
  const options = f.launches[0].contexts.at(-1).options
  assert.equal(options.locale, 'en-US')
  assert.equal(options.colorScheme, 'light')
  assert.equal(options.userAgent, undefined)
  await client.action({ action: 'navigate', url: 'https://example.com/keep' })
  const fp = await client.action({ action: 'createProfile', revision: 1, profile: { name: 'strict', mode: 'fingerprint' } })
  await assert.rejects(client.action({ action: 'useProfile', profileId: fp.profiles.at(-1).id }), /不兼容/)
  assert.equal((await client.status()).url, 'https://example.com/keep')
  assert.equal((await client.status()).profileId, device.id)
  assert.equal(f.launches[0].contexts.at(-1).options.userAgent, undefined)
})

test('browser operations serialize across the tool and panel and a failed operation does not block the queue', async () => {
  const f = fixture()
  const a = f.agent('queue-a')
  await f.call(a, { action: 'newTab' })
  const client = browserClient(a)
  const page = f.launches[0].contexts[0].pages[0]
  const original = page.goto.bind(page)
  let finish
  let started
  const start = new Promise(resolve => { started = resolve })
  page.goto = async url => { started(); await new Promise(resolve => { finish = resolve }); return original(url) }
  const first = f.call(a, { action: 'navigate', url: 'https://example.com/serialized' })
  await start
  let completed = false
  const second = client.action({ action: 'control', control: 'user' }).then(value => { completed = true; return value })
  assert.equal(completed, false)
  finish()
  assert.equal((await first).control, 'user')
  assert.equal((await second).control, 'user')
  await assert.rejects(client.action({ action: 'unknown' }), /Unsupported/)
  assert.equal((await client.action({ action: 'control', control: 'agent' })).control, 'agent')
})

test('proxy credentials resolve only inside the backend and reject unsupported schemes', async () => {
  const f = fixture()
  const store = new BrowserProfiles(f.agent('proxy-default-ports'), { root: f.root, keyProvider })
  for (const [revision, server, expected] of [[0, 'http://localhost:80', 'http://localhost'], [1, 'https://localhost:443', 'https://localhost']]) {
    const database = await store.edit({ action: 'createProfile', revision, profile: { name: `proxy ${revision}`, proxy: { server } } })
    assert.equal(database.profiles.at(-1).proxy.server, expected)
  }
  for (const server of ['ftp://localhost:21', 'socks5://localhost', 'http://localhost/path']) {
    await assert.rejects(store.edit({ action: 'createProfile', revision: 2, profile: { name: 'invalid proxy', proxy: { server } } }), /Proxy requires/)
  }
  const prior = process.env.PATCHWORK_TEST_PROXY_PASSWORD
  process.env.PATCHWORK_TEST_PROXY_PASSWORD = 'never-return-this'
  try {
    assert.equal(resolvedProxy({ proxy: { server: 'http://127.0.0.1:8888', passwordEnv: 'PATCHWORK_TEST_PROXY_PASSWORD' } }).password, 'never-return-this')
    assert.throws(() => resolvedProxy({ proxy: { server: 'http://127.0.0.1:8888', usernameEnv: 'PATCHWORK_NONEXISTENT_VAR_123' } }), /not configured/)
  } finally { if (prior === undefined) delete process.env.PATCHWORK_TEST_PROXY_PASSWORD; else process.env.PATCHWORK_TEST_PROXY_PASSWORD = prior }
})

test('cancellation during browser launch closes late resources and never navigates', async () => {
  const f = fixture()
  const agent = f.agent('cancel-during-launch')
  let release
  let started
  const ready = new Promise(resolve => { started = resolve })
  let closed = false
  const session = new BrowserSession(agent, { root: f.root, launch: async () => {
    started()
    await new Promise(resolve => { release = resolve })
    return { version: () => '156.0.0.0', close: async () => { closed = true }, newContext: async () => ({ route: async () => {}, on() {}, close: async () => {}, newPage: async () => { throw new Error('Cancelled launch must not create a page') } }) }
  } })
  const controller = new AbortController()
  const operation = session.action('agent', { action: 'newTab', url: 'https://example.com' }, { signal: controller.signal })
  await ready
  controller.abort(new Error('cancelled by user'))
  release()
  await assert.rejects(operation, /cancelled by user/)
  assert.equal(closed, true)
  assert.equal(session.browser, null)
  await session.dispose()
})

test('idle authorized disposal saves opt-in login state once and does not return it to the model', async () => {
  const f = fixture()
  const agent = f.agent('graceful-dispose')
  f.listeners.get('agent/created')({ agent })
  const client = browserClient(agent)
  const database = await client.action({ action: 'createProfile', revision: 0, profile: { name: 'saved', persistStorage: true } })
  const id = database.profiles.at(-1).id
  await client.action({ action: 'useProfile', profileId: id })
  await client.action({ action: 'navigate', url: 'https://example.com/' })
  const storage = { cookies: [{ name: 'session', value: 'private-login-cookie' }], origins: [] }
  let writes = 0
  f.launches[0].contexts[0].storageState = async () => { writes++; return storage }
  assert.equal(JSON.stringify(await f.call(agent, { action: 'profiles' })).includes('private-login-cookie'), false)
  await f.listeners.get('agent/disposed')({ agent })
  assert.equal(writes, 1)
  const store = new BrowserProfiles(agent, { root: f.root, keyProvider })
  assert.deepEqual(await store.readStorage(await store.get(id)), storage)
})

test('receipts distinguish unasserted actions and mismatches; repeated no progress is visible without recording input', async () => {
  const f = fixture(); const agent = f.agent('receipts')
  await assert.rejects(f.call(agent, { action: 'navigate', url: 'https://example.com', expected: {} }), /measurable/)
  assert.equal(f.launches.length, 0)
  await f.call(agent, { action: 'navigate', url: 'https://example.com' })
  let result
  for (let i = 0; i < 3; i++) result = await f.call(agent, { action: 'fill', selector: '#private', value: 'never-log-me' })
  assert.equal(result.receipt.noProgress, true)
  assert.equal(result.receipt.postcondition.status, 'unasserted')
  result = await f.call(agent, { action: 'snapshot', expected: { urlIncludes: '/missing' } })
  assert.equal(result.receipt.postcondition.status, 'mismatch')
  const trace = await f.call(agent, { action: 'trace' })
  assert.equal(JSON.stringify(trace.trace).includes('never-log-me'), false)
  const shot = await f.call(agent, { action: 'screenshot' })
  assert.equal(shot.receipt.capture.width, 1280)
  assert.match(shot.receipt.capture.sha256, /^[a-f0-9]{64}$/)
  f.launches[0].contexts[0].pages[0].screenshot = async () => Buffer.from('broken-image')
  await assert.rejects(f.call(agent, { action: 'screenshot' }), /invalid screenshot/)
})

test('private keyboard focus lease and system clipboard guards hold across navigation', async () => {
  const f = fixture(); const agent = f.agent('focus')
  await f.call(agent, { action: 'newTab' }); const client = browserClient(agent)
  let frame = await client.frame()
  await client.action({ action: 'clickPoint', x: 1, y: 1, tabId: frame.tabId, frameId: frame.frameId })
  frame = await client.frame()
  const focusId = (await client.status()).focusId
  await assert.rejects(client.action({ action: 'type', value: 'secret', ...frame, focusId: 'wrong' }), /焦点/)
  await client.action({ action: 'type', value: 'text', frameId: frame.frameId, tabId: frame.tabId, focusId })
  await assert.rejects(client.action({ action: 'key', value: 'Control+v', frameId: frame.frameId, tabId: frame.tabId, focusId }), /剪贴板/)
  await client.action({ action: 'navigate', url: 'https://example.com' })
  await assert.rejects(client.action({ action: 'type', value: 'secret', frameId: frame.frameId, tabId: frame.tabId, focusId }), /画面已变化/)
})

test('tab suspension and explicit restoration retain identity and takeover', async () => {
  const f = fixture(); const agent = f.agent('suspend')
  await f.call(agent, { action: 'newTab', url: 'https://example.com/page' })
  const client = browserClient(agent); const id = (await client.status()).selectedTabId
  await client.action({ action: 'suspendTab', tabId: id })
  let status = await client.status(); assert.equal(status.active, false); assert.equal(status.tabs[0].state, 'suspended')
  await client.action({ action: 'resumeTab', tabId: id })
  status = await client.status(); assert.equal(status.selectedTabId, id); assert.equal(status.control, 'user'); assert.equal(status.url, 'https://example.com/page')
})

test('two authorized viewers share one CDP stream without interrupting each other', async () => {
  const f = fixture(); const agent = f.agent('stream-viewers')
  await f.call(agent, { action: 'newTab', url: 'https://example.com' })
  const context = f.launches[0].contexts[0], cdp = new EventEmitter(), commands = []
  cdp.send = async name => { commands.push(name) }; cdp.detach = async () => {}
  context.newCDPSession = async () => cdp
  const client = browserClient(agent); let first = 0, second = 0
  const stopFirst = await client.stream(() => { first++ })
  const stopSecond = await client.stream(() => { second++ })
  const data = (await context.pages[0].screenshot({ type: 'jpeg' })).toString('base64')
  cdp.emit('Page.screencastFrame', { sessionId: 1, data })
  assert.equal(first, 1); assert.equal(second, 1)
  stopFirst(); cdp.emit('Page.screencastFrame', { sessionId: 2, data })
  assert.equal(first, 1); assert.equal(second, 2)
  assert.equal(commands.filter(value => value === 'Page.startScreencast').length, 1)
  assert.equal(commands.includes('Page.stopScreencast'), false)
  stopSecond(); assert.equal(commands.filter(value => value === 'Page.stopScreencast').length, 1)
})

test('visible browser route shares only the owning Patchwork Agent page', async () => {
  const fixtureState = fixture()
  const a = fixtureState.agent('browser-route-a')
  const b = fixtureState.agent('browser-route-b')
  const ordinary = fixtureState.agent('browser-route-ordinary')
  ordinary.selectPreset('standard')
  fixtureState.listeners.get('agent/created')({ agent: a })
  fixtureState.listeners.get('agent/created')({ agent: b })
  let route
  const routeCtx = {
    get: key => key === 'webServer' ? { register: entry => { route = entry; return () => {} } } : key === 'agents' ? { get: id => fixtureState.agents.get(id) } : undefined,
    effect: callback => { routeCtx.dispose = callback() },
  }
  registerBrowserRoute(routeCtx, { token: 'browser-route-token' })
  async function request(id, { method = 'GET', token = 'browser-route-token', view = '', body } = {}) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    req.method = method
    req.headers = { 'x-patchwork-token': token }
    req.url = `/?sessionId=${id}${view ? `&view=${view}` : ''}`
    const result = { headers: {}, statusCode: 0, setHeader(name, value) { this.headers[name] = value }, end(value) { this.body = value } }
    await route.handler(req, result)
    return { status: result.statusCode, headers: result.headers, body: result.headers['content-type'] === 'image/jpeg' ? result.body : result.body ? JSON.parse(result.body) : null }
  }
  try {
    assert.equal((await request('browser-route-a', { token: 'wrong' })).status, 403)
    assert.equal((await request('browser-route-ordinary')).status, 403)
    assert.equal((await request('browser-route-a')).body.active, false)
    const opened = await request('browser-route-a', { method: 'POST', body: { action: 'navigate', url: 'https://example.com/a', width: 640, height: 700 } })
    assert.equal(opened.body.url, 'https://example.com/a')
    assert.deepEqual(opened.body.viewport, { width: 640, height: 700 })
    assert.equal((await request('browser-route-b', { method: 'POST', body: { action: 'navigate', url: 'https://example.com/b' } })).body.url, 'https://example.com/b')
    assert.equal((await request('browser-route-a')).body.url, 'https://example.com/a')
    assert.equal((await request('browser-route-a', { view: 'frame' })).headers['content-type'], 'image/jpeg')
    const page = fixtureState.launches[0].contexts[0].pages[0]
    page.screenshot = async () => { a.selectPreset('standard'); throw new Error('capture lost authorization during await') }
    const revokedCapture = await request('browser-route-a', { view: 'frame' })
    assert.equal(revokedCapture.status, 403)
    assert.equal(revokedCapture.body.reason, 'browser-access-required')
    a.selectPreset('standard')
    await fixtureState.listeners.get('agent-preset/selected')('browser-route-a')
    assert.equal((await request('browser-route-a', { view: 'frame' })).status, 403)
    assert.equal((await request('browser-route-b')).body.url, 'https://example.com/b')
  } finally {
    await fixtureState.listeners.get('agent/disposed')({ agent: b })
    routeCtx.dispose()
  }
})
