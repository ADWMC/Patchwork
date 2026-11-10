import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { requirePatchworkAgent } from '../scope.mjs'
import { canonicalPath, inside, withTaskCheck } from './action-check.mjs'
import { taskState, transitionTask, flushTasks } from './store.mjs'
import { safeLabel, taskId } from './state.mjs'
import { commandOutcome } from '../util/tool-outcome.mjs'
import { executeTool } from '../util/tool-execute.mjs'

export async function artifactStamp(path) {
  const s = await stat(path)
  if (!s.isFile()) throw new Error('artifact must be a file')
  return `${s.size}:${s.mtimeMs}:${s.ctimeMs}`
}

export async function captureVisualReceipt(agent, options = {}) {
  try {
    const { browserClient } = await import('../../packages/browser/src/browser/tool.mjs')
    const client = browserClient(agent)
    if (!client) return { visual: { status: 'skipped', reason: 'browser-not-attached' } }
    if (options.url) await client.action({ action: 'open', url: options.url })
    if (options.viewport) await client.action({ action: 'resize', ...options.viewport })
    const receipt = await client.action({ action: 'screenshot' })
    return { visual: { status: 'passed', screenshotPath: receipt.path } }
  } catch (err) {
    return { visual: { status: 'failed', reason: err.message } }
  }
}
export async function registerArtifact(agent, data, baseRevision) {
  const state = taskState(agent)
  if (!isAbsolute(data.path)) throw new Error('absolute artifact path required')
  const path = await canonicalPath(data.path)
  if (!inside(await canonicalPath(state.workspace), path)) throw new Error('artifact outside workspace')
  const stamp = await artifactStamp(path)
  requirePatchworkAgent(agent)
  const next = transitionTask(agent, { kind: 'artifact', baseRevision, data: { id: data.id, path, stamp, version: randomUUID(), supersedes: data.supersedes } })
  return next
}
async function capture(agent, requirement) {
  const state = taskState(agent), captured = []
  for (const id of requirement.targets) {
    const a = state.artifacts.find(a => a.id === id && a.status === 'current')
    if (!a) throw new Error('artifact id ' + id + ' must be registered and current; inspect targets and use the exact id. Standalone shell calls invalidate registered artifacts: re-register current targets, then call check directly; check executes its own command')
    const stamp = await artifactStamp(a.path)
    if (stamp !== a.stamp) { transitionTask(agent, { kind: 'invalidate', targets: [id] }); throw new Error('artifact changed; register new version') }
    captured.push({ id: a.id, version: a.version, path: a.path, stamp })
  }
  return captured
}
export async function executeAcceptance(agent, args, exec) {
  const before = taskState(agent)
  if (args.baseRevision !== before.revision) throw new Error('task revision conflict')
  const requirement = before.requirements.find(r => r.id === args.id)
  if (!requirement) throw new Error('check.id must be a TOP LEVEL requirement id; inspect available ids: ' + before.requirements.map(r => r.id).join(', '))
  if (before.understandingStatus !== 'stated') throw new Error('state the current task before checking')
  const unit = args.unit ?? 'all'
  if (!requirement.coverage.includes(unit)) throw new Error('unit outside declared acceptance coverage')
  if (requirement.kind === 'semantic') throw new Error('semantic review is not a deterministic pass; use assessment')
  if (requirement.failures >= 3) throw new Error('repeated failure: diagnose/change the affected requirement before retrying')
  const revision = before.revision
  const targets = await capture(agent, requirement)
  if (taskState(agent).revision !== revision) throw new Error('task changed while preparing acceptance')
  let outcome = 'unknown', exitCode = null, result, tool, callId
  if (requirement.kind === 'command') {
    tool = args.tool
    if (!['pwsh', 'bash'].includes(tool) || typeof args.arguments?.command !== 'string' || !args.arguments.command.trim()) throw new Error('use a real host pwsh/bash command')
    callId = `${exec.callId}:check`
    transitionTask(agent, { kind: 'receipt', receipt: { id: randomUUID(), requirementId: requirement.id, revision, unit, kind: 'command',
      outcome: 'unknown', current: true, exitCode: null, tool, callId, targets: targets.map(({ id, version }) => ({ id, version })), at: Date.now() } })
    result = await withTaskCheck(agent, callId, () => executeTool(agent.ctx.tools, {
      callId, rootCallId: exec.rootCallId ?? exec.callId, name: tool,
      arguments: args.arguments, agent, signal: exec.signal, parent: exec.token,
    }))
    ;({ outcome, exitCode } = commandOutcome(result))
  } else {
    if (targets.length !== 1) throw new Error('artifact check requires exactly one target')
    tool = 'artifact-check'; callId = exec.callId
    const rules = args.rules
    if (!rules || (!Number.isInteger(rules.minLength) && !Number.isInteger(rules.maxLength) && !rules.anchors?.length)) throw new Error('declare artifact structure rules')
    if (rules.minLength !== undefined && (!Number.isInteger(rules.minLength) || rules.minLength < 0)) throw new Error('invalid minimum length')
    if (rules.maxLength !== undefined && (!Number.isInteger(rules.maxLength) || rules.maxLength < 0)) throw new Error('invalid maximum length')
    if (rules.anchors !== undefined && (!Array.isArray(rules.anchors) || rules.anchors.length > 24 || rules.anchors.some(x => typeof x !== 'string' || !x || x.length > 160))) throw new Error('invalid structure anchors')
    const s = await stat(targets[0].path)
    if (s.size > 1024 * 1024) throw new Error('artifact check limited to 1MiB UTF-8 files')
    const text = await readFile(targets[0].path, 'utf8')
    outcome = (rules.minLength === undefined || text.length >= rules.minLength) &&
      (rules.maxLength === undefined || text.length <= rules.maxLength) && (rules.anchors ?? []).every(a => text.includes(a)) ? 'passed' : 'failed'
  }
  requirePatchworkAgent(agent)
  let current = taskState(agent).revision === revision
  for (const a of targets) {
    try { if (await artifactStamp(a.path) !== a.stamp) current = false } catch { current = false }
  }
  if (before.instance) outcome = 'unknown' // Declared endpoint is not a verified execution environment.
  let visual = null
  if (args.visual) {
    const v = await captureVisualReceipt(agent, typeof args.visual === 'object' ? args.visual : {})
    visual = v?.visual
  }
  const receipt = { id: randomUUID(), requirementId: requirement.id, revision, unit, kind: requirement.kind,
    outcome, current, exitCode, tool: taskId(tool), callId: safeLabel(callId, 256), instanceId: null,
    targets: targets.map(({ id, version }) => ({ id, version })), at: Date.now(), ...(visual ? { visual } : {}) }
  transitionTask(agent, { kind: 'receipt', receipt })
  if (!current && taskState(agent).revision === revision) transitionTask(agent, { kind: 'invalidate', targets: requirement.targets })
  await flushTasks(agent)
  return { receipt, result }
}
