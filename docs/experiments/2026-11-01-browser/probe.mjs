import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { browserClient } from '../../../src/browser/tool.mjs'

const host = createRequire(join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh/package.json'))
const { installModelSelection } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-agent')).href)

export const name = 'patchwork-browser-probe'
export const inject = ['agents', 'agentPresets', 'agentDefaultModel', 'tools']

export function apply(ctx) {
  void run(ctx).catch(error => {
    console.error(error.stack)
    ctx.get('appExit')(1)
  })
}

async function run(ctx) {
  await ctx.get('loader').await()
  const selection = ctx.get('agentDefaultModel').currentSelection()
  const create = async preset => {
    const { agent } = await ctx.get('agents').create({
      sessionId: `browser-probe-${randomUUID()}`,
      meta: { cwd: process.cwd(), ...(preset === 'patchwork' ? { agentPreset: preset } : {}) },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: async agentCtx => {
        if (preset === 'patchwork') await ctx.get('agentPresets').mount(agentCtx, preset)
        installModelSelection(agentCtx, { current: selection, assembled: undefined })
      },
    })
    return agent
  }

  const patchwork = await create('patchwork')
  const secondPatchwork = await create('patchwork')
  const standard = await create('plain')
  const tools = ctx.get('tools')
  const browserTools = agent => tools.schemas(agent).map(item => item.name).filter(name => name === 'patchwork_browser')
  const scoped = { patchwork: browserTools(patchwork), secondPatchwork: browserTools(secondPatchwork), standard: browserTools(standard) }
  const preOpenClient = Boolean(browserClient(patchwork))
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    const label = req.url?.includes('second') ? 'Second session' : req.url?.includes('shared') ? 'Shared page' : 'First session'
    res.end(`<!doctype html><title>${label}</title><button onclick="document.querySelector('output').textContent='Clicked by user'">${label}</button><output></output>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let navigation
  let resize
  let screenshot
  let image
  let localFile
  let outsideFile
  let crossSession
  let sharedBrowser
  try {
    const call = async (agent, name, args) => tools.execute({
      callId: `browser-probe-${randomUUID()}`,
      name,
      arguments: args,
      agent,
      signal: new AbortController().signal,
    })
    const result = await call(patchwork, 'patchwork_browser', { action: 'navigate', url: `http://127.0.0.1:${server.address().port}/first` })
    navigation = { isError: result.isError, content: result.content.map(item => item.text ?? item.type).join('\n').slice(0, 800) }
    const client = browserClient(patchwork)
    const frame = await client?.frame()
    await client?.action({ action: 'clickPoint', x: 20, y: 20, frameId: frame?.frameId, tabId: frame?.tabId })
    const clicked = await call(patchwork, 'patchwork_browser', { action: 'snapshot' })
    await client?.action({ action: 'navigate', url: `http://127.0.0.1:${server.address().port}/shared` })
    const shared = await call(patchwork, 'patchwork_browser', { action: 'snapshot' })
    await client?.action({ action: 'control', control: 'agent' })
    sharedBrowser = { frameIsJpeg: frame?.image?.[0] === 0xff && frame?.image?.[1] === 0xd8, userClickSeenByAgent: clicked.content.some(item => item.text?.includes('Clicked by user')), userNavigationSeenByAgent: shared.content.some(item => item.text?.includes('Shared page')) }
    await client?.action({ action: 'navigate', url: `http://127.0.0.1:${server.address().port}/first` })
    const second = await call(secondPatchwork, 'patchwork_browser', { action: 'navigate', url: `http://127.0.0.1:${server.address().port}/second` })
    const seenByFirst = await call(patchwork, 'patchwork_browser', { action: 'snapshot' })
    crossSession = { secondNavigationError: second.isError, secondError: second.isError ? second.content.map(item => item.text ?? item.type).join('\n').slice(0, 500) : undefined, firstSeesSecond: seenByFirst.content.some(item => item.text?.includes('Second session')), firstStillFirst: seenByFirst.content.some(item => item.text?.includes('First session')) }
    await client?.action({ action: 'control', control: 'agent' })
    const resized = await call(patchwork, 'patchwork_browser', { action: 'resize', width: 390, height: 844 })
    resize = { isError: resized.isError, content: resized.content.map(item => item.text ?? item.type).join('\n').slice(0, 300) }
    const captured = await call(patchwork, 'patchwork_browser', { action: 'screenshot' })
    screenshot = { isError: captured.isError, contentTypes: captured.content.map(item => item.type), content: captured.content.filter(item => item.type === 'text').map(item => item.text).join('\n').slice(0, 300) }
    const closed = await call(patchwork, 'patchwork_browser', { action: 'close' })
    image = { closeError: closed.isError, secondStillSecond: (await call(secondPatchwork, 'patchwork_browser', { action: 'snapshot' })).content.some(item => item.text?.includes('Second session')) }
    const opened = await call(patchwork, 'patchwork_browser', { action: 'navigate', url: pathToFileURL(join(process.cwd(), 'docs/archive/skills-preview/index.html')).href })
    localFile = { isError: opened.isError, fileUrl: opened.value?.url?.startsWith('file:') ?? false }
    const outside = await call(patchwork, 'patchwork_browser', { action: 'navigate', url: pathToFileURL(process.execPath).href })
    outsideFile = { rejected: outside.isError, stillLocal: (await call(patchwork, 'patchwork_browser', { action: 'snapshot' })).value?.url === opened.value?.url }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
  console.log(JSON.stringify({ scoped, preOpenClient, navigation, sharedBrowser, crossSession, resize, screenshot, image, localFile, outsideFile }))
  ctx.get('appExit')(scoped.patchwork.length === 1 && scoped.secondPatchwork.length === 1 && !scoped.standard.length && preOpenClient && !navigation.isError && sharedBrowser.frameIsJpeg && sharedBrowser.userClickSeenByAgent && sharedBrowser.userNavigationSeenByAgent && !crossSession.firstSeesSecond && crossSession.firstStillFirst && !resize.isError && !screenshot.isError && screenshot.contentTypes.includes('image') && !image.closeError && image.secondStillSecond && !localFile.isError && localFile.fileUrl && outsideFile.rejected && outsideFile.stillLocal ? 0 : 1)
}
