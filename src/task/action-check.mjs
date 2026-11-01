import { realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { isPatchworkAgent } from '../scope.mjs'
import { taskState, transitionTask } from './store.mjs'

const prepared = new WeakMap()
const checking = new WeakMap()
export const SHELL_TOOLS = new Set(['pwsh', 'bash', 'shell', 'run_tests'])
const mutations = new Set(['write', 'edit'])
export function inside(root, target) {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))
}
/** Resolve junctions/symlinks, including a not-yet-created file's nearest parent. */
export async function canonicalPath(path) {
  let current = resolve(path), suffix = []
  for (;;) {
    try { return resolve(await realpath(current), ...suffix.reverse()) }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
      const parent = dirname(current)
      if (parent === current) throw error
      suffix.push(relative(parent, current)); current = parent
    }
  }
}
export function checkingTask(agent, callId) { return checking.get(agent) === callId }
export async function withTaskCheck(agent, callId, work) {
  if (checking.has(agent)) throw new Error('another task check is running')
  checking.set(agent, callId)
  try { return await work() } finally { checking.delete(agent) }
}
export function taskRevision(agent) { return taskState(agent)?.revision ?? null }
export function assertTaskRevision(agent, revision) {
  if (revision !== taskRevision(agent)) throw new Error('task changed; follow-up was not executed')
}
export async function inspectAction(exec, mode = 'structured') {
  const state = taskState(exec.agent)
  if (!state) return { reason: 'Patchwork agent required' }
  if (exec.name === 'patchwork_task') return {}
  const mutates = mutations.has(exec.name)
  if ((mutates || SHELL_TOOLS.has(exec.name)) && ['cancelled', 'superseded'].includes(state.status)) return { reason: 'task cancelled or superseded' }
  if ((mutates || SHELL_TOOLS.has(exec.name)) && state.persistence === 'failed') return { reason: 'task persistence degraded' }
  if (mode === 'strict' && !['write', 'edit', 'read', 'glob', 'grep', 'skill', 'list_skills', 'working_directory'].includes(exec.name)) return { reason: 'strict policy: unsupported effect channel; not an OS sandbox' }
  if (!mutates) return {}
  if (!state.title) return { reason: 'register current task before structured mutation' }
  if (state.title && state.understandingStatus === 'unassessed') return { reason: 'restate the current task after new input before mutation' }
  if (state.understandingStatus === 'needs-clarification') return { reason: 'resolve task clarification before mutation' }
  const path = exec.arguments?.file_path
  if (!state.workspace || typeof path !== 'string' || !path) return { reason: 'structured mutation requires a workspace and file_path' }
  const target = await canonicalPath(resolve(state.workspace, path))
  const root = await canonicalPath(state.workspace)
  if (!inside(root, target)) return { reason: 'write target outside task workspace' }
  for (const ref of state.references) if (inside(await canonicalPath(ref), target)) return { reason: 'reference target is read-only' }
  if (state.phase === 'analysis') return { reason: 'declared analysis phase is read-only' }
  if (state.phase === 'plan' && !target.toLowerCase().endsWith('.md')) return { reason: 'declared plan phase permits Markdown artifacts only' }
  return { target }
}
export function registerActionChecks(ctx, config = {}) {
  const mode = config.taskPolicyMode === 'strict' ? 'strict' : 'structured'
  const owned = new Map()
  function activate(agent) {
    if (!isPatchworkAgent(agent)) { owned.get(agent)?.(); owned.delete(agent); return }
    taskState(agent).policy = mode === 'strict' ? 'strict-known-tools-not-os-sandbox' : typeof agent.ctx?.tools?.guard === 'function' ? 'structured-tools-only' : 'pre-execute-only'
    if (owned.has(agent) || typeof agent.ctx?.tools?.guard !== 'function') return
    owned.set(agent, agent.ctx.tools.guard(exec => {
      if (!isPatchworkAgent(exec.agent)) return 'Patchwork composition changed'
      const snapshot = prepared.get(exec)
      if (!snapshot) return 'task action preparation missing'
      if (snapshot.args !== JSON.stringify(exec.arguments)) return 'tool arguments changed after policy inspection'
      if (snapshot.revision !== taskRevision(exec.agent)) return 'task revision changed before dispatch'
      return snapshot.reason
    }))
  }
  ctx.on('agent/created', ({ agent }) => activate(agent))
  ctx.on('agent/disposed', ({ agent }) => { owned.get(agent)?.(); owned.delete(agent) })
  ctx.on('agent-preset/selected', id => { const agent = ctx.get?.('agents')?.get?.(id); if (agent) activate(agent) })
  ctx.effect?.(() => () => { for (const dispose of owned.values()) dispose?.(); owned.clear() }, 'patchwork: task guards')
  ctx.on('tools/pre-execute', async (exec, next) => {
    const gate = await next()
    if (!isPatchworkAgent(exec.agent) || gate.kind !== 'allow') return gate
    const args = JSON.stringify(exec.arguments)
    const revision = taskRevision(exec.agent)
    const check = await inspectAction(exec, mode)
    if (revision !== taskRevision(exec.agent)) check.reason = 'task changed during policy inspection'
    if (!check.reason && taskState(exec.agent)?.title && (mutations.has(exec.name) || (SHELL_TOOLS.has(exec.name) && !checkingTask(exec.agent, exec.callId)))) {
      // Conservative: arbitrary shell effects cannot be inferred from syntax.
      transitionTask(exec.agent, { kind: 'invalidate' })
    }
    prepared.set(exec, { ...check, revision: taskRevision(exec.agent), args })
    return check.reason ? { kind: 'deny', reason: check.reason } : gate
  })
}
