// Explicit isolated acceptance: no model credentials, host browser or main DSH.
// node packages/browser/tests/interaction.acceptance.mjs --component-root ABS --dsh-source ABS --output ABS
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir, cpus } from 'node:os'
import { dirname, join, isAbsolute } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { bootPatchwork, loadDriver } from '../../../tests/real-composition/harness.mjs'
import { browserClient } from '../src/browser/tool.mjs'
import { registerBrowserRoute, BROWSER_ROUTE_PATH } from '../src/browser/route.mjs'
import { browserRetrieve } from '../../../src/retrieval/browser-bridge.mjs'
import { registerRetrievalTools } from '../../../src/retrieval/tool.mjs'

const argv = process.argv.slice(2), option = name => argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined
const componentRoot = option('--component-root'), dshSource = option('--dsh-source'), output = option('--output')
const publicUrl = option('--public-url'), publicProxy = option('--public-proxy')
const screenshotDir = option('--screenshot-dir')
if (![componentRoot, dshSource, output].every(value => value && isAbsolute(value))) throw new Error('Explicit absolute --component-root, --dsh-source and --output are required')
if (screenshotDir && !isAbsolute(screenshotDir)) throw new Error('--screenshot-dir must be absolute')
const work = await mkdtemp(join(tmpdir(), 'patchwork-interaction-')), root = join(work, 'browser')
const previousHome = process.env.DSH_HOME; process.env.DSH_HOME = work
const packageRoot = fileURLToPath(new URL('../', import.meta.url)), require = createRequire(new URL('../package.json', import.meta.url))
const token = randomUUID(), routes = new Map(), upgrades = new Map(), cleanups = [], connections = new Set()
let allowUpgrade = true, agent, second, ca, cb, probe, boot, viewerContext, viewer, engine, page
const report = { schema: 1, date: new Date().toISOString(), status: 'running', hostBrowserUsed: false, mainDshModified: false, fullDshClient: false, realDshToolRegistry: true, realHostPrimitives: true, modelRequests: 0, viewer: 'private Playwright context; Browser plugin unavailable', cpu: cpus()[0]?.model, platform: process.platform, checks: [], measurements: {}, consoleErrors: [] }
const addChecks=report.checks.push.bind(report.checks);report.checks.push=(...items)=>{console.log('PASS',...items);return addChecks(...items)}
const fixture = `<!doctype html><meta charset="utf-8"><title>交互验收</title><style>body{margin:0;font:16px Arial}header{height:160px;position:sticky;top:0;background:#fff;z-index:2;padding:12px;box-sizing:border-box}input[type=text]{width:300px;height:32px}input[type=range]{width:300px}#color{position:fixed;right:0;top:0;width:32px;height:32px;background:rgb(20,80,160);z-index:9}#horizontal{width:400px;overflow:auto;white-space:nowrap;height:30px}#horizontal>span{display:inline-block;width:1800px}li{height:26px}#double{position:absolute;left:700px;top:70px}</style><div id=color></div><header><label>设备名称<input type=text id=name aria-label="设备名称" oninput="color.style.background='rgb('+(20+this.value.length*11%210)+',80,160)'"></label><label><input type=checkbox aria-label="省电模式">省电模式</label><label>方案<select aria-label="运行方案"><option value=eco>节能</option><option value=comfort>舒适</option></select></label><br><input type=range aria-label="亮度" min=0 max=100 value=20><div id=horizontal><span>横向内容</span></div><button id=double ondblclick="this.dataset.count=Number(this.dataset.count||0)+1">双击测试</button></header><main><p id=delayed>准备就绪</p><ul>${Array.from({ length: 2000 }, (_, i) => `<li>第 ${i + 1} 行 <button>操作 ${i + 1}</button></li>`).join('')}</ul></main><script>window.animation=false;let n=0;function animate(){if(window.animation)color.style.background='rgb('+(20+(n++*11)%210)+',80,160)';requestAnimationFrame(animate)}requestAnimationFrame(animate)</script>`
let uiBundle
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'), route = routes.get(url.pathname)
    if (route) return await route(req, res)
    res.setHeader('cache-control', 'no-store')
    if (url.pathname === '/fixture') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(fixture) }
    if (url.pathname === '/slow') return // Closed by the explicit navigation-cancel test.
    if (url.pathname === '/ui.js' || url.pathname === '/ui.css') { res.setHeader('content-type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); return res.end(uiBundle.find(file => file.path.endsWith(url.pathname.slice(1)))?.contents ?? '') }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/ui.css"><script type="application/json" data-patchwork-browser>${JSON.stringify({ token, browserPath: BROWSER_ROUTE_PATH })}</script><div class="pw-panel" style="height:100vh"><div class="pw-panel-inner" id=root></div></div><script type=module src="/ui.js"></script>`)
  } catch (error) { res.statusCode = 500; res.end(error.message) }
})
server.on('connection', socket => { connections.add(socket); socket.on('close', () => connections.delete(socket)) })
server.on('upgrade', (req, socket, head) => { const handler = upgrades.get(new URL(req.url, 'http://localhost').pathname); if (allowUpgrade && handler) handler(req, socket, head); else socket.end('HTTP/1.1 503 Unavailable\r\nConnection: close\r\n\r\n') })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`, url = origin + '/fixture'
let calls = 0
async function tool(owner, args, { fail = false } = {}) {
  const id = `interaction-${++calls}`, result = await owner.tools.execute({ agent: owner.agent, name: 'patchwork_browser', callId: id, rootCallId: id, arguments: args, signal: new AbortController().signal })
  const text = result.content.filter(item => item.type === 'text').map(item => item.text).join('\n')
  if (!fail) assert.equal(result.isError, false, text)
  return { result, text, observationId: text.match(/Observation: ([a-f0-9-]+)/)?.[1] }
}
const refFor = (snapshot, name) => snapshot.text.split('\n').find(line => line.startsWith('@e') && line.includes(`"name":"${name}"`))?.split(' ')[0]
async function until(test, timeout = 7000) { const end = performance.now() + timeout; while (performance.now() < end) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 15)) } throw new Error('Acceptance condition timed out') }
async function imageReady() { await viewer.locator('.pw-browser-page img').waitFor(); await viewer.waitForFunction(() => { const img = document.querySelector('.pw-browser-page img'); return img?.naturalWidth > 0 }); }
async function remotePoint(selector, fraction = 0.5) {
  const box = await page.locator(selector).boundingBox(), image = await viewer.locator('.pw-browser-page img').boundingBox(), size = page.viewportSize()
  return { x: image.x + (box.x + box.width * fraction) * image.width / size.width, y: image.y + (box.y + box.height / 2) * image.height / size.height }
}
try {
  const probeUrl = new URL('./helpers/native-probe-plugin.mjs', import.meta.url).href
  boot = await bootPatchwork({ root, componentRoot }, { pluginEntry: probeUrl }); probe = await import(probeUrl)
  const driver = await loadDriver(), run = randomUUID().slice(0, 8)
  agent = driver.createAgent({ id: `interaction-a-${run}`, sessionId: `interaction-a-${run}`, cwd: work, preset: 'patchwork' })
  second = driver.createAgent({ id: `interaction-b-${run}`, sessionId: `interaction-b-${run}`, cwd: work, preset: 'standard' })
  assert.equal(second.tools.schemas(second.agent).some(item => item.name === 'patchwork_browser'), false)
  probe.manager.enable(agent.agent, 'patchwork'); ca = browserClient(agent.agent)
  const profile = (await ca.action({ action: 'createProfile', revision: 0, profile: { name: '验收临时身份', backend: 'aliasmode', mode: 'fingerprint' } })).profiles.at(-1)
  await ca.action({ action: 'useProfile', profileId: profile.id }); await ca.action({ action: 'control', control: 'agent' })
  await tool(agent, { action: 'navigate', url, interactive: true })
  engine = probe.engines.findLast(item => item.profileId === profile.id).browser; page = engine.contexts()[0].pages()[0]; report.engine = engine.version()
  let observed = await tool(agent, { action: 'snapshot', interactive: true, maxElements: 20, maxChars: 3000 })
  const nameRef = refFor(observed, '设备名称'), checkRef = refFor(observed, '省电模式'), optionRef = refFor(observed, '运行方案')
  assert.ok(nameRef && checkRef && optionRef, observed.text)
  const batch = await tool(agent, { action: 'batch', observationId: observed.observationId, steps: [{ action: 'fill', ref: nameRef, value: 'Agent 批量表单' }, { action: 'check', ref: checkRef, checked: true }, { action: 'selectOption', ref: optionRef, value: 'comfort' }], interactive: true })
  assert.match(batch.text, /"completed":3/); assert.equal(await page.getByLabel('设备名称').inputValue(), 'Agent 批量表单'); assert.equal(await page.getByLabel('运行方案').inputValue(), 'comfort')
  const stale = await tool(agent, { action: 'fill', ref: nameRef, observationId: observed.observationId, value: 'must not apply' }, { fail: true }); assert.equal(stale.result.isError, true)
  const read = await tool(agent, { action: 'read', maxChars: 400 }); assert.ok(read.text.includes('"truncated":true'))
  await page.evaluate(() => setTimeout(() => document.querySelector('#delayed').textContent = '条件已就绪', 100))
  await tool(agent, { action: 'wait', wait: { text: '条件已就绪', timeoutMs: 3000 } })
  observed = await tool(agent, { action: 'snapshot', interactive: true }); await tool(agent, { action: 'hover', ref: refFor(observed, '双击测试'), observationId: observed.observationId })
  observed = await tool(agent, { action: 'snapshot', interactive: true }); await tool(agent, { action: 'scrollTo', ref: refFor(observed, '操作 8'), observationId: observed.observationId })
  await page.evaluate(() => { scrollTo(0, 0); document.querySelector('#name').value = ''; document.querySelector('#color').style.background = 'rgb(20,80,160)'; document.cookie='private_login=must-not-leak;path=/';localStorage.setItem('private_login','must-not-leak') })
  report.checks.push('real DSH schema/execution: compact refs, 3-step form batch, stale ref rejection, bounded read, condition wait, hover and scrollTo')

  // Use a second isolated context as the viewer, never the user's browser.
  viewerContext = await engine.newContext({ viewport: { width: 1360, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] }); viewer = await viewerContext.newPage()
  viewer.on('pageerror', error => report.consoleErrors.push(error.message))
  report.transport={opened:0,closed:0,received:0,acks:0,sseRequests:0,jpegRequests:0}
  viewer.on('websocket',socket=>{report.transport.opened++;socket.on('close',()=>report.transport.closed++);socket.on('framereceived',()=>report.transport.received++);socket.on('framesent',event=>{if(String(event.payload).includes('"ack"'))report.transport.acks++})})
  viewer.on('request',request=>{if(request.url().includes('view=stream')&&!request.url().includes('ticket'))report.transport.sseRequests++;if(request.url().includes('view=frame'))report.transport.jpegRequests++})
  const primitiveRoot = join(dshSource, 'packages/client/ui-primitives/src'), themeRoot = join(dshSource, 'packages/client/ui-theme/src/styles')
  const primitives = ['Button', 'Input', 'Menu', 'Switch', 'Tooltip', 'DisclosureRow'].map(name => `export {${name}} from ${JSON.stringify(join(primitiveRoot, name + '.tsx'))}`).join('\n')
  const built = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{BrowserPanel}from${JSON.stringify(join(packageRoot,'src/client/BrowserPanel.jsx'))};import{BROWSER_CSS}from${JSON.stringify(join(packageRoot,'src/client/styles.mjs'))};${['base.css','design-platform.css','gradient-shadow-text.css'].map(name=>`import ${JSON.stringify(join(themeRoot,name))};`).join('')}const style=document.createElement('style');style.textContent=BROWSER_CSS;document.head.append(style);window.setSession=id=>render(id);function render(id){createRootOnce??=createRoot(document.querySelector('#root'));createRootOnce.render(<React.StrictMode><BrowserPanel sessionId={id}/></React.StrictMode>)}let createRootOnce;render(${JSON.stringify(agent.agent.session.header.id)});document.body.style.margin='0';`, resolveDir: packageRoot, loader: 'jsx', sourcefile: 'acceptance.jsx' }, outfile: join(work, 'ui.js'), bundle: true, platform: 'browser', format: 'esm', target: 'es2022', jsx: 'automatic', write: false, alias: { react: dirname(require.resolve('react/package.json')), 'react-dom': dirname(require.resolve('react-dom/package.json')), clsx: require.resolve('clsx') }, plugins: [{ name: 'real-dsh-primitives', setup(b) { b.onResolve({ filter: /^@deepseek-ai\/dsh-client-ui-primitives$/ }, () => ({ path: 'primitives', namespace: 'host' })); b.onLoad({ filter: /.*/, namespace: 'host' }, () => ({ contents: primitives, loader: 'tsx', resolveDir: primitiveRoot })) } }], logLevel: 'warning' })
  uiBundle = built.outputFiles
  const facade = { get(name) { return name === 'webServer' ? { register({ path, handler }) { routes.set(path, handler); return () => routes.delete(path) }, registerUpgrade({ path, handler }) { upgrades.set(path, handler); return () => upgrades.delete(path) } } : name === 'agents' ? { get(id) { return [agent, second].find(owner => owner.agent.session.header.id === id)?.agent } } : undefined }, effect(fn) { cleanups.push(fn()) } }
  registerBrowserRoute(facade, { token, manager: probe.manager })
  await viewer.goto(origin); await imageReady()
  await until(() => viewer.locator('.pw-browser-status').innerText().then(text => text.includes('Agent 可操作')))
  await viewer.getByRole('button', { name: '接管浏览器', exact: true }).click(); await imageReady()
  await until(() => viewer.locator('.pw-browser-status').innerText().then(text => text.includes('你在操作')))
  let point = await remotePoint('#name'); await viewer.mouse.click(point.x, point.y)
  const inputProxy = viewer.getByLabel('网页键盘输入'); await inputProxy.focus(); await viewer.keyboard.type('abcdefghijkl', { delay: 8 })
  await until(() => page.getByLabel('设备名称').inputValue().then(value => value === 'abcdefghijkl'))
  await viewer.getByLabel('网页键盘输入').evaluate(element => { element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' })) })
  await until(() => page.getByLabel('设备名称').inputValue().then(value => value.endsWith('中文')))
  await viewer.getByLabel('网页键盘输入').evaluate(element => { const data = new DataTransfer(); data.setData('text/plain', '粘贴'); element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data })) })
  await until(() => page.getByLabel('设备名称').inputValue().then(value => value.endsWith('中文粘贴')))
  report.checks.push('real rendered BrowserPanel with DSH controls/tokens under React StrictMode: private binary stream, manual typing, composition commit once, explicit paste')

  // Time the actually decoded JPEG pixel, not the input ACK.
  await viewer.evaluate(() => { window.visibleFrames=[];document.querySelector('.pw-browser-page img').addEventListener('load',()=>window.visibleFrames.push(performance.now())) })
  const latencies = []
  for (let i = 0; i < 100; i++) {
    const length = (await page.getByLabel('设备名称').inputValue()).length + 1
    const elapsed = await viewer.evaluate(async ({ expected }) => {
      const input=document.querySelector('[aria-label="网页键盘输入"]'), image=document.querySelector('.pw-browser-page img'), start=performance.now();const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d')
      const shown=()=>{c.drawImage(image,image.naturalWidth-16,16,1,1,0,0,1,1);const rgb=c.getImageData(0,0,1,1).data;return Math.abs(rgb[0]-expected)<9&&Math.abs(rgb[1]-80)<9&&Math.abs(rgb[2]-160)<9}
      const waiting=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{image.removeEventListener('load',check);reject(Error('Input-to-display timed out'))},4000);const check=()=>{if(shown()){clearTimeout(timer);image.removeEventListener('load',check);resolve(performance.now()-start)}};image.addEventListener('load',check)})
      const data=new DataTransfer();data.setData('text/plain','x');input.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:data}));return waiting
    }, { expected: 20 + length * 11 % 210 })
    latencies.push(Number(elapsed.toFixed(1)))
  }
  const sorted = [...latencies].sort((a,b)=>a-b); report.measurements.inputToDisplayedJpegMs = { sampleCount:latencies.length,samples: latencies, median: sorted[Math.floor(sorted.length/2)], p95: sorted[Math.ceil(sorted.length*.95)-1], maximum:sorted.at(-1),pageRows: 2000, includesHttpAndJpegDecode: true, compositionViaSyntheticEvents: true }
  console.log('MEASURE input',JSON.stringify({...report.measurements.inputToDisplayedJpegMs,samples:undefined}),JSON.stringify(report.transport))
  point = await remotePoint('input[type=range]', 0.2); const end = await remotePoint('input[type=range]', 0.8)
  await viewer.mouse.move(point.x,point.y);await viewer.mouse.down();await viewer.mouse.move(end.x,end.y,{steps:12});await viewer.mouse.up()
  await until(() => page.getByLabel('亮度').inputValue().then(value=>Number(value)>65))
  point = await remotePoint('#double'); await viewer.mouse.dblclick(point.x,point.y,{delay:70}); await until(()=>page.locator('#double').getAttribute('data-count').then(value=>value==='1'))
  point = await remotePoint('#horizontal'); await viewer.mouse.move(point.x,point.y); await viewer.mouse.wheel(250,0); await until(()=>page.locator('#horizontal').evaluate(element=>element.scrollLeft>0))
  report.checks.push('real pointer capture: range drag, exactly one double-click and horizontal wheel')
  await page.evaluate(()=>{window.animation=true}); await viewer.evaluate(()=>{window.visibleFrames=[];window.framesStart=performance.now()})
  point=await remotePoint('#double'); await viewer.mouse.move(point.x,point.y)
  for(let i=0;i<30;i++){await viewer.mouse.wheel(0,30);await new Promise(resolve=>setTimeout(resolve,70))}
  report.measurements.displayFps = await viewer.evaluate(()=>({displayedFrames:window.visibleFrames.length,elapsedMs:Math.round(performance.now()-window.framesStart),fps:Number((window.visibleFrames.length*1000/(performance.now()-window.framesStart)).toFixed(1))}))
  console.log('MEASURE display',JSON.stringify(report.measurements.displayFps),JSON.stringify(report.transport))
  report.transportDuringInteraction={...report.transport}
  assert.ok(report.measurements.inputToDisplayedJpegMs.p95<=200,'Input-to-display P95 exceeded the local 200ms target')
  assert.ok(report.measurements.displayFps.fps>=15,'Displayed scrolling FPS did not reach the initial 15 FPS target')
  assert.equal(report.transport.closed,0,'Normal control/input unexpectedly restarted binary transport')
  await page.evaluate(()=>{window.animation=false;scrollTo(0,0)})
  // Static content must not force a transport reconnect after three seconds.
  let sockets = 0; viewer.on('websocket',()=>sockets++);await new Promise(resolve=>setTimeout(resolve,3500));assert.equal(sockets,0)
  await viewer.getByRole('button',{name:'展开浏览器',exact:true}).click();assert.equal(await viewer.locator('.pw-browser-expanded').count(),1);await viewer.keyboard.press('Escape');assert.equal(await viewer.locator('.pw-browser-expanded').count(),0)
  await viewer.getByRole('button',{name:'浏览器菜单',exact:true}).click();await viewer.getByRole('menuitem',{name:'画面原始尺寸 100%',exact:true}).click();assert.match(await viewer.locator('.pw-browser-page').getAttribute('style'),/1280px/)
  await viewer.evaluate(()=>document.body.setAttribute('data-ds-dark-theme',''));report.darkToken = await viewer.locator('.pw-browser').evaluate(element=>getComputedStyle(element).backgroundColor)
  report.checks.push('displayed-frame FPS measured during real scrolling; static stream stays connected, expand/Escape, 100% zoom and host dark tokens')

  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true })
    await viewer.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
    await viewer.screenshot({ path: join(screenshotDir, 'desktop-light.png') })
    await viewer.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    await viewer.screenshot({ path: join(screenshotDir, 'desktop-dark.png') })
    await viewer.getByRole('button', { name: '浏览器菜单', exact: true }).click()
    await viewer.getByRole('menuitem', { name: '画面适应宽度', exact: true }).click()
    await viewer.setViewportSize({ width: 420, height: 900 })
    await imageReady()
    await viewer.screenshot({ path: join(screenshotDir, 'narrow-dark.png') })
    report.visualViewportChecks = await viewer.evaluate(() => ({ width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, panelWidth: Math.round(document.querySelector('.pw-browser').getBoundingClientRect().width) }))
    assert.ok(report.visualViewportChecks.documentWidth <= 420, 'Narrow browser panel overflows the document')
    await viewer.setViewportSize({ width: 1360, height: 1000 })
  }

  // Public retrieval transport mechanics use controlled loopback fixtures ONLY
  // with an explicit test policy; production public/robots guards are unit tested.
  await viewer.getByRole('button',{name:'恢复 Agent',exact:true}).click();await until(()=>ca.status().then(status=>status.control==='agent'))
  const prior = await ca.status(), beforeContexts = engine.contexts().length
  const policy = async target => ({url:String(target),robots:{checked:true,allowed:true},addresses:[{address:'127.0.0.1',family:4}]})
  const publicResult = await browserRetrieve(agent.agent,{url,authorizeTarget:policy,maxChars:400,waitText:'准备就绪'})
  assert.equal(publicResult.transport,'browser');assert.ok(publicResult.excerpt.length<=400);assert.equal(engine.contexts().length,beforeContexts);assert.equal((await ca.status()).selectedTabId,prior.selectedTabId)
  assert.equal(await page.evaluate(()=>localStorage.getItem('private_login')),'must-not-leak')
  await assert.rejects(browserRetrieve(agent.agent,{url,authorizeTarget:policy,maxBytes:1024}),/budget|closed|interrupted/)
  await until(()=>Promise.resolve(engine.contexts().length===beforeContexts))
  const rejecting=async target=>{if(String(target).endsWith('/fixture'))throw Error('robots policy test denial');return policy(target)}
  await assert.rejects(browserRetrieve(agent.agent,{url,authorizeTarget:rejecting}),/robots policy/)
  const controller=new AbortController(), inFlight=browserRetrieve(agent.agent,{url,authorizeTarget:policy,waitText:'never visible',signal:controller.signal}).then(()=>null,error=>error)
  await until(()=>Promise.resolve(engine.contexts().length>beforeContexts));controller.abort();assert.ok(await inFlight);await until(()=>Promise.resolve(engine.contexts().length===beforeContexts));assert.equal(engine.contexts().length,beforeContexts)
  const takeover=browserRetrieve(agent.agent,{url,authorizeTarget:policy,waitText:'never visible'}).then(()=>null,error=>error)
  await until(()=>Promise.resolve(engine.contexts().length>beforeContexts));const started=performance.now();await ca.action({action:'control',control:'user'});assert.ok(await takeover);await until(()=>Promise.resolve(engine.contexts().length===beforeContexts));report.measurements.retrievalTakeoverMs=Math.round(performance.now()-started);assert.equal(engine.contexts().length,beforeContexts)
  await ca.action({action:'control',control:'agent'})
  const waiting=browserRetrieve(agent.agent,{url,authorizeTarget:policy,waitText:'never visible'}).then(()=>null,error=>error)
  await until(()=>Promise.resolve(engine.contexts().some(context=>context!==viewerContext&&context!==page.context()&&context.pages().some(current=>current.url()===url))))
  const waitingStart=performance.now();await ca.action({action:'control',control:'user'});assert.ok(await waiting);await until(()=>Promise.resolve(engine.contexts().length===beforeContexts));report.measurements.retrievalWaitingTakeoverMs=Math.round(performance.now()-waitingStart)
  report.checks.push('same private engine retrieval renders in disposable context; bounded output, unchanged selected tab and login, policy denial, abort and immediate user takeover cleanup')

  // Cancellation bypasses the serial navigation queue.
  const navigating=ca.action({action:'navigate',url:origin+'/slow'}).then(()=>null,error=>error)
  await until(()=>ca.status().then(status=>status.loading));assert.equal((await ca.cancel()).cancelled,true);assert.ok(await navigating)
  await ca.action({action:'navigate',url});await viewer.reload();await imageReady()
  allowUpgrade=false;await viewer.reload();await imageReady();await until(()=>viewer.locator('.pw-browser-status span').first().getAttribute('data-state').then(()=>true))
  // Inspect actual transport requests rather than tooltip text.
  let sse=false;viewer.on('response',response=>{if(response.url().includes('view=stream')&&!response.url().includes('ticket'))sse=response.headers()['content-type']?.includes('text/event-stream')||sse})
  await viewer.reload();await imageReady();await until(()=>Promise.resolve(sse));allowUpgrade=true
  const oldFrame=await ca.frame();await ca.action({action:'navigate',url:url+'?new-document'});await assert.rejects(ca.input({inputId:randomUUID(),sequence:1,events:[{action:'pointer',phase:'down',x:1,y:1,frameId:oldFrame.frameId,tabId:oldFrame.tabId}]}),/画面|frame|页面/)
  await viewer.evaluate(id=>window.setSession(id),second.agent.session.header.id);await until(()=>viewer.locator('[role=alert]').innerText().then(text=>text.includes('尚未授权')));assert.equal(await viewer.locator('.pw-browser-page img').count(),0)
  assert.equal(second.tools.schemas(second.agent).some(item=>item.name==='patchwork_browser'),false)
  report.checks.push('navigation cancellation, authenticated SSE fallback, stale coordinate rejection and switching to ungranted session clears pixels/tools')
  if(publicUrl){
    // Optional real public HTTP(S), through the actual Patchwork tool registry.
    // Credentials are never loaded or needed. Network outage fails this mode.
    await viewerContext.close();viewerContext=null;viewer=null
    const oldProxy={HTTPS_PROXY:process.env.HTTPS_PROXY,HTTP_PROXY:process.env.HTTP_PROXY}
    try{
      if(publicProxy){process.env.HTTPS_PROXY=publicProxy;process.env.HTTP_PROXY=publicProxy}
      const status=await ca.status()
      const profile=(await ca.action({action:'createProfile',revision:status.revision,profile:{name:'公网验收临时身份',backend:'aliasmode',mode:'fingerprint',...(publicProxy?{proxy:{server:publicProxy}}:{})}})).profiles.at(-1)
      await ca.action({action:'close'});await ca.action({action:'useProfile',profileId:profile.id});await ca.action({action:'control',control:'agent'})
      registerRetrievalTools(agent.agent.ctx,{nativeSearch:false,nativeFetchAllowedHosts:[new URL(publicUrl).hostname]})
      assert.equal(second.tools.schemas(second.agent).some(item=>item.name==='patchwork_fetch'),false)
      const id='public-'+randomUUID(),started=performance.now()
      const result=await agent.tools.execute({agent:agent.agent,name:'patchwork_fetch',callId:id,rootCallId:id,arguments:{url:publicUrl,transport:'browser',maxChars:600},signal:new AbortController().signal})
      const text=result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n')
      assert.equal(result.isError,false,text);assert.match(text,/HTTP 200/);assert.match(text,/robots=allowed/)
      report.publicInternet={status:'passed',url:publicUrl,elapsedMs:Math.round(performance.now()-started),tool:'patchwork_fetch',transport:'browser',excerptCharacters:text.length,hostAndRobotsPolicy:'production',upstreamProxy:Boolean(publicProxy)}
      report.checks.push('actual Patchwork fetch schema/execute through the optional native browser: public HTTPS, production DNS/host/robots policy and pinned HTTP proxy CONNECT')
    }finally{for(const[key,value]of Object.entries(oldProxy)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
  }
  assert.deepEqual(report.consoleErrors,[]);report.nativeToolCalls=calls;report.status='passed'
} catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;console.error('FAIL',error.stack)
  report.renderer=await viewer?.evaluate(()=>({status:document.querySelector('.pw-browser-status')?.textContent,error:document.querySelector('[role=alert]')?.textContent,image:[...document.querySelectorAll('.pw-browser-page img')].map(img=>({complete:img.complete,width:img.naturalWidth,srcPresent:img.hasAttribute('src')})),focused:document.activeElement?.getAttribute('aria-label')})).catch(()=>null)
  report.remote=await page?.evaluate(()=>({value:document.querySelector('#name')?.value,focus:document.activeElement?.getAttribute('aria-label'),scrollX:document.querySelector('#horizontal')?.scrollLeft})).catch(()=>null)
}
finally{
  await viewerContext?.close().catch(()=>{});for(const cleanup of cleanups.reverse())await cleanup?.();await probe?.manager?.dispose();await boot?.dispose();for(const socket of connections)socket.destroy();await new Promise(resolve=>server.close(resolve));await rm(work,{recursive:true,force:true,maxRetries:5,retryDelay:100});if(previousHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previousHome
  report.remainingEngines=probe?.engines.filter(item=>item.browser.isConnected()).length??0;report.temporaryDataRemoved=true;await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
}
