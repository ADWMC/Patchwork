import { isAbsolute, resolve } from 'node:path'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { canonicalPath, inside } from '../task/action-check.mjs'
import { captureWorkerTask, flushWorkerTask, existingController, getController, managedWorker, revokeExecutor } from './controller.mjs'
import { executorReadTools, executorWriteTools, executorShellAllowed } from './prompt.mjs'

// Keep the inherited SoL recall/plan surface and Patchwork's bounded retrieval
// usable; none of these grants a new execution or external delivery channel.
const readTools = new Set(executorReadTools)
const writeTools = new Set(executorWriteTools)

/** Delegated effects may narrow, never enlarge, the current parent's task scope. */
export async function inspectDelegatedAction(exec) {
  const binding = managedWorker(exec.agent)
  if (!binding) return undefined
  const controller = binding.controller
  if (binding.revoked || !controller.valid(binding.epoch) || !isPatchworkAgent(exec.agent)) return 'Superagent assignment revoked'
  let scope
  try { scope = controller.assertScope() } catch { return 'parent task needs recovery or clarification' }
  const name = exec.name, args = exec.arguments ?? {}
  if (name === 'patchwork_superagent') return ['inspect', 'report'].includes(args.action) ? undefined : 'executors cannot control the queue'
  if (name === 'patchwork_task') {
    if (binding.mode !== 'write' && args.action === 'check' && (args.command || args.tool || !args.rules)) return 'read/explore assignments forbid command execution'
    return undefined
  }
  if (!(binding.mode === 'write' ? writeTools : readTools).has(name)) return 'unsupported delegated effect channel; use the parent session'
  if (['pwsh', 'bash'].includes(name) && !executorShellAllowed(scope)) return 'shell cannot preserve the parent phase or read-only references; use structured tools'
  if (name === 'write' || name === 'edit') {
    if (scope?.title && scope.phase === 'analysis') return 'parent analysis phase is read-only'
    if (typeof args.file_path !== 'string' || !isAbsolute(args.file_path)) return 'delegated edits require an absolute file_path'
    const root = await canonicalPath(controller.owner.session.header.cwd), target = await canonicalPath(resolve(root, args.file_path))
    if (!inside(root, target)) return 'delegated write outside parent workspace'
    if (scope?.title && scope.phase === 'plan' && !target.toLowerCase().endsWith('.md')) return 'parent plan phase permits Markdown only'
    for (const ref of scope?.references ?? []) if (inside(await canonicalPath(ref), target)) return 'parent reference is read-only'
  }
  return undefined
}

export function registerSuperagent(ctx) {
  const guards = new Map(), owned = new Set(), prepared = new WeakMap()
  function activate(agent) {
    if (!isPatchworkAgent(agent) || guards.has(agent)) return
    const binding = managedWorker(agent)
    if (binding) binding.agent = agent
    if (typeof agent.ctx?.tools?.guard === 'function') guards.set(agent, agent.ctx.tools.guard(exec => {
      const b = managedWorker(exec.agent)
      if (!b) return undefined
      if (b.revoked || !b.controller.valid(b.epoch) || !isPatchworkAgent(exec.agent)) return 'Superagent assignment revoked'
      const receipt = prepared.get(exec)
      if (!receipt || receipt.epoch !== b.epoch || receipt.args !== JSON.stringify(exec.arguments)) return 'Superagent action preparation missing or changed'
      try { if (receipt.scope !== JSON.stringify(b.controller.assertScope())) return 'parent task changed before dispatch' } catch { return 'parent task changed before dispatch' }
      return receipt.reason
    }))
  }
  ctx.on('agent/created', ({ agent }) => activate(agent))
  ctx.on('tools/pre-execute', async (exec, next) => {
    const gate = await next(), binding = managedWorker(exec.agent)
    if (gate.kind !== 'allow' || !binding) return gate
    const args = JSON.stringify(exec.arguments), epoch = binding.epoch
    let scope
    try { scope = JSON.stringify(binding.controller.assertScope()) } catch { return { kind: 'deny', reason: 'parent task changed before inspection' } }
    const reason = await inspectDelegatedAction(exec)
    const invalid = reason ?? (!binding.controller.valid(epoch) ? 'assignment revoked during inspection' : undefined)
    prepared.set(exec, { args, epoch, reason: invalid, scope })
    return invalid ? { kind: 'deny', reason: invalid } : gate
  })
  ctx.on('tools/result', exec => captureWorkerTask(exec.agent))
  ctx.on('agent/turn-stopping', async ({ agent }) => { await flushWorkerTask(agent) })
  ctx.on('agent/status', ({ agent, status }) => { if (status === 'idle') captureWorkerTask(agent) })
  ctx.on('agent/inbox/inserted', ({ agent, message }) => {
    if (message?.source?.kind === 'patchwork') return
    const c = existingController(agent)
    if (c?.state.status === 'active') void c.pause('new parent input; restate task and resume explicitly').catch(() => {})
  })
  ctx.on('agent-preset/selected', sessionId => {
    const agent = ctx.get?.('agents')?.get?.(sessionId)
    if (!isPatchworkAgent(agent)) revokeExecutor(sessionId)
    for (const c of owned) if (c.owner.session.header.id === sessionId && !isPatchworkAgent(c.owner)) {
      owned.delete(c); void c.close('parent preset changed').catch(() => {})
    }
  })
  ctx.on('agent/disposed', ({ agent }) => {
    captureWorkerTask(agent); guards.get(agent)?.(); guards.delete(agent)
    const c = existingController(agent)
    if (c) { owned.delete(c); void c.close('parent disposed').catch(() => {}) }
  })
  ctx.effect?.(() => () => {
    for (const dispose of guards.values()) dispose(); guards.clear()
    const closing = [...owned].map(c => c.close('Patchwork unloaded')); owned.clear()
    return Promise.allSettled(closing)
  }, 'patchwork: superagent lifecycle')
  ctx.tools.register({
    name: 'patchwork_superagent',
    description: 'DSH-internal Superagent controller: inspect queue/revision, submit explicit local tasks with dependencies, report from owned executor, input correction, retry, pause/resume/cancel, reconcile persisted native children after restart. Jobs use native DSH spawn, inherit permissions/model/preset and return only here. No external channels. Completed model turns are not acceptance. Ordinary small tasks need no queue. Read/explore jobs forbid shell/edits; explore jobs return bounded findings without task acceptance. Maximum 24 jobs, 1..4 slots (default 2), 3 attempts/job; writes serialize within this module/workspace. An uncertain interrupted assignment stays blocked until inspect/retry. Fields are TOP LEVEL.',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['inspect', 'submit', 'report', 'input', 'retry', 'pause', 'resume', 'cancel', 'reconcile'] },
      baseRevision: { type: 'integer' }, id: { type: 'string' }, input: { type: 'string', maxLength: 4000 },
      concurrency: { type: 'integer', minimum: 1, maximum: 4 }, status: { type: 'string', enum: ['ready', 'waiting', 'review', 'blocked', 'failed'] }, summary: { type: 'string', maxLength: 2000 },
      jobs: { type: 'array', maxItems: 24, items: { type: 'object', properties: {
        id: { type: 'string' }, title: { type: 'string', maxLength: 160 }, prompt: { type: 'string', maxLength: 8000 }, mode: { type: 'string', enum: ['read', 'explore', 'write'] },
        dependencies: { type: 'array', maxItems: 8, items: { type: 'string' } }, timeoutMs: { type: 'integer', minimum: 1000, maximum: 900000 },
      }, required: ['id', 'title', 'prompt'], additionalProperties: false } },
    }, required: ['action'], additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      requirePatchworkAgent(exec.agent)
      const binding = managedWorker(exec.agent)
      if (binding) {
        if (!binding.controller.valid(binding.epoch)) throw new Error('assignment revoked')
        if (args.action === 'inspect') return { role: 'executor', jobId: binding.jobId, mode: binding.mode }
        if (args.action === 'report') return binding.controller.report(exec.agent, args)
        throw new Error('executors cannot control the queue')
      }
      if (args.action === 'report') throw new Error('report requires an owned executor')
      const c = getController(exec.agent); owned.add(c)
      if (args.action === 'inspect') return c.snapshot()
      if (args.action === 'reconcile') return c.reconcile()
      c.assertRevision(args.baseRevision)
      if (args.action === 'submit') return c.submit(args.jobs, args.baseRevision, { concurrency: args.concurrency ?? c.state.concurrency })
      if (args.action === 'input') { if (!args.input) throw new Error('input required'); return c.retry(args.id, args.baseRevision, args.input) }
      if (args.action === 'retry') return c.retry(args.id, args.baseRevision)
      if (args.action === 'resume') return c.resume(args.baseRevision)
      if (args.action === 'pause' || args.action === 'cancel') return c.pause(args.action, args.action === 'cancel')
      throw new Error('unknown Superagent action')
    },
  })
  ctx.commands.register({ name: 'patchwork-superagent', description: '查看当前 DSH 主控队列和执行器验收状态', handler({ agent }) {
    const binding = managedWorker(agent)
    requirePatchworkAgent(agent)
    const queue = binding ? { role: 'executor', jobId: binding.jobId } : getController(agent).snapshot()
    if (!binding) owned.add(existingController(agent))
    return { kind: 'success', text: JSON.stringify(queue, null, 2) }
  } })
}
