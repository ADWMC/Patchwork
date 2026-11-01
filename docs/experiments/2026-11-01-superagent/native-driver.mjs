// Official CLI + native agents/subagents/persistence + real configured model.
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { existingController, managedWorker } from '../../../src/superagent/controller.mjs'
import { restoreController } from '../../../src/superagent/store.mjs'

const host = createRequire(join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh/package.json'))
const { createUserMessage } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-llm')).href)
const { installModelSelection } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-agent')).href)
export const name = 'patchwork-native-superagent-smoke'
export const inject = ['agents', 'sessions', 'agentPresets', 'agentDefaultModel', 'subagents']
export function apply(ctx) { void run(ctx).catch(error => { console.error(error.stack); ctx.get('appExit')(1) }) }
async function run(ctx) {
  await ctx.get('loader').await()
  const selection = ctx.get('agentDefaultModel').currentSelection(), started = Date.now()
  const { agent } = await ctx.get('agents').create({ sessionId: `session-${randomUUID()}`, meta: { cwd: process.cwd(), agentPreset: 'patchwork' },
    agentOptions: { provider: selection.provider, model: selection.model }, setup: async agentCtx => {
      await ctx.get('agentPresets').mount(agentCtx, 'patchwork')
      installModelSelection(agentCtx, { current: selection, assembled: undefined })
    } })
  // A separate live root with no Patchwork composition must never see our tools.
  const { agent: ordinary } = await ctx.get('agents').create({ sessionId: `session-${randomUUID()}`, meta: { cwd: process.cwd() },
    agentOptions: { provider: selection.provider, model: selection.model }, setup: async agentCtx => { installModelSelection(agentCtx, { current: selection, assembled: undefined }) } })
  const ordinaryToolsBefore = ordinary.ctx.tools.schemas(ordinary).map(s => s.name)
  const requests = [], children = [], finals = []
  const unsubs = [
    ctx.on('agent/request', (payload, next) => { requests.push({ id: payload.agent.session.header.id, at: Date.now() - started }); return next() }),
    ctx.on('agent/created', ({ agent: child }) => { if (managedWorker(child)) children.push(child) }),
    ctx.on('agent/turn-stopping', ({ agent: child }) => { if (managedWorker(child)) finals.push({ id: child.session.header.id, seq: child.session.seq }) }),
  ]
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true; agent.cancel({ kind: 'hook', reason: 'isolated Superagent smoke deadline' })
    void existingController(agent)?.pause('smoke deadline', true).catch(() => {})
  }, 660000)
  agent.followup(createUserMessage({ content: [{ type: 'text', text: await readFile(process.env.SOL_TASK_FILE, 'utf8') }], source: { kind: 'user' } }))
  await agent.whenIdle()
  // Children continue after the initiating parent turn. Wait for actual native work,
  // not only the first parent idle, and allow each bounded result notice to finish.
  for (;;) {
    const c = existingController(agent)
    if (timedOut || !c) break
    if (!c.active.size && !c.pumping && !c.state.jobs.some(j => ['queued', 'starting', 'running'].includes(j.status))) break
    if (!c.active.size && !c.pumping && c.state.jobs.some(j => ['review', 'waiting', 'blocked', 'failed'].includes(j.status))) break
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  await agent.whenIdle(); clearTimeout(timeout)
  const c = existingController(agent), queue = c?.snapshot() ?? null
  const catalog = await ctx.get('subagents').listChildren(agent.session.header.id)
  let faultProbe = null
  if (queue?.status === 'completed') {
    const persist = c.persist
    let injected = false
    c.persist = async (owner, next) => {
      if (next.jobs.some(j => j.id === 'fault-probe' && j.status === 'running')) {
        injected = true; throw new Error('isolated injected running-checkpoint failure')
      }
      return persist(owner, next)
    }
    try {
      await c.submit([{ id: 'fault-probe', title: 'Native cancellation fault probe', mode: 'read', timeoutMs: 10000,
        prompt: 'Read alpha.txt only. Do not edit, use shell or delegate. This isolated lifecycle probe will cancel the assignment.' }], c.state.revision)
      const until = Date.now() + 20000
      while (Date.now() < until && (!injected || c.active.size || c.pumping)) await new Promise(resolve => setTimeout(resolve, 50))
      const childId = c.state.jobs.find(j => j.id === 'fault-probe')?.childId
      faultProbe = { injected, childId, failClosed: c.persistence === 'failed', noActiveAssignment: c.active.size === 0,
        nativeChildReleased: Boolean(childId) && !ctx.get('agents').get(childId) }
    } finally { c.persist = persist; await c.pause('fault probe concluded') }
  }
  const restored = c ? restoreController(agent) : null
  const recoveryProbe = restored ? { fromNativeCheckpoint: true, status: restored.status,
    historicalPassesRequireReview: restored.jobs.filter(j => j.id !== 'fault-probe').every(j => j.status === 'review'),
    uncertainAssignmentBlocked: restored.jobs.find(j => j.id === 'fault-probe')?.status === 'blocked' } : null
  const sessions = [agent, ...children], events = []
  for (const a of sessions) {
    if (a === agent) await ctx.get('sessions').flush(a.session)
    events.push({ id: a.session.header.id, parent: a.session.header.parentSession ?? null,
      events: Array.from({ length: a.session.seq }, (_, i) => a.session.eventAt(i)) })
  }
  const ordinaryToolsAfter = ordinary.ctx.tools.schemas(ordinary).map(s => s.name)
  for (const off of unsubs) off()
  const result = { schema: 1, sessionId: agent.session.header.id, elapsedMs: Date.now() - started, requests, queue, faultProbe, recoveryProbe, timedOut, finals,
    catalog, ordinaryIsolation: !ordinaryToolsBefore.includes('patchwork_superagent') && JSON.stringify(ordinaryToolsBefore) === JSON.stringify(ordinaryToolsAfter), events }
  await writeFile(process.env.SOL_RESULT_FILE, JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ sessionId: result.sessionId, elapsedMs: result.elapsedMs, requests: requests.length, queueStatus: queue?.status, ordinaryIsolation: result.ordinaryIsolation }))
  await c?.close('smoke complete')
  ctx.get('appExit')(queue?.status === 'completed' && result.ordinaryIsolation && !timedOut ? 0 : 1)
}
