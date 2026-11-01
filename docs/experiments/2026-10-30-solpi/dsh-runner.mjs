// Isolated experiment driver. Loaded by the official DSH CLI, not a mock agent.
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const host = createRequire(join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh/package.json'))
const { createUserMessage } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-llm')).href)
const { installModelSelection } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-agent')).href)
export const name = 'patchwork-sol-experiment'
export const inject = ['agents', 'sessions', 'agentPresets', 'agentDefaultModel']

export function apply(ctx) {
  void run(ctx).catch(error => {
    console.error(error.stack)
    ctx.get('appExit')(1)
  })
}

async function run(ctx) {
  await ctx.get('loader').await()
  const selection = ctx.get('agentDefaultModel').currentSelection()
  const sessionId = `session-${randomUUID()}`
  const { agent } = await ctx.get('agents').create({
    sessionId,
    meta: { cwd: process.cwd(), agentPreset: 'patchwork' },
    agentOptions: { provider: selection.provider, model: selection.model },
    setup: async agentCtx => {
      await ctx.get('agentPresets').mount(agentCtx, 'patchwork')
      installModelSelection(agentCtx, { current: selection, assembled: undefined })
    },
  })
  const task = await readFile(process.env.SOL_TASK_FILE, 'utf8')
  const started = Date.now()
  const compactionProbes = []
  if (process.env.SOL_EMPTY_PROBE === '1') {
    const service = ctx.get('agentPresets').serviceFor(agent, 'compaction')
    const result = await service.compactNow(agent, new AbortController().signal)
    compactionProbes.push({ action: 'fresh-session', outcome: result == null ? 'noop' : 'compacted' })
  }
  const calls = []
  const stop = ctx.on('agent/request', (payload, next) => {
    if (payload.agent === agent) calls.push({ at: Date.now() - started })
    return next()
  })
  const timeoutMs = Number(process.env.SOL_TIMEOUT_MS ?? 240000)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 900000) throw new Error('SOL_TIMEOUT_MS must be 1000..900000')
  const timeout = setTimeout(() => { agent.cancel({ kind: 'hook', reason: 'isolated experiment timeout' }); }, timeoutMs)
  agent.followup(createUserMessage({ content: [{ type: 'text', text: task }], source: { kind: 'user' } }))
  await agent.whenIdle()
  if (process.env.SOL_COMPACT_PROBE === '1') {
    const service = ctx.get('agentPresets').serviceFor(agent, 'compaction')
    for (const action of ['cancelled', 'compact', 'repeat']) {
      const controller = new AbortController()
      if (action === 'cancelled') controller.abort(new DOMException('experiment cancellation', 'AbortError'))
      const before = ctx.get('tokenMeter').measure(agent.session).totalTokens
      try {
        const result = await service.compactNow(agent, controller.signal)
        compactionProbes.push({ action, outcome: result == null ? 'noop' : 'compacted', before, after: ctx.get('tokenMeter').measure(agent.session).totalTokens })
      } catch (error) {
        compactionProbes.push({ action, outcome: 'error', code: error.code, name: error.name, message: error.message })
      }
    }
  }
  if (process.env.SOL_FOLLOWUP_FILE) {
    const content = await readFile(process.env.SOL_FOLLOWUP_FILE, 'utf8')
    agent.followup(createUserMessage({ content: [{ type: 'text', text: content }], source: { kind: 'user' } }))
    await agent.whenIdle()
  }
  clearTimeout(timeout)
  stop()
  await ctx.get('sessions').flush(agent.session)
  const events = Array.from({ length: agent.session.seq }, (_, seq) => agent.session.eventAt(seq))
  const summary = {
    sessionId, preset: ctx.get('agentPresets').composedPreset(agent.ctx),
    elapsedMs: Date.now() - started, requests: calls.length,
    compactionProbes,
    events,
  }
  await writeFile(process.env.SOL_RESULT_FILE, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ sessionId, preset: summary.preset, requests: calls.length, elapsedMs: summary.elapsedMs }))
  ctx.get('appExit')(events.findLast(event => event.type === 'turn/end')?.data?.reason?.kind === 'completed' ? 0 : 1)
}
