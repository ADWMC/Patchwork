import { createFusedDefinition } from './fused-tool.mjs'
import { hashFile, targetUnchanged, yieldToHost } from './mutation-guard.mjs'
import { record } from '../../ui/mechanism-stats.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../../scope.mjs'
import { logDiagnostic } from '../../logging/session-log.mjs'
import { assertTaskRevision, taskRevision } from '../../task/action-check.mjs'
import { executeTool } from '../../util/tool-execute.mjs'
import { textOf } from '../../util/content-blocks.mjs'

const FUSABLE_TOOLS = ['write', 'edit']
const SHELL_TOOLS = ['pwsh', 'bash']

// Agent-local shadows outlive a standing-composition context unless explicitly
// disposed. Track their owners so preset switches revoke the exact registrations.
const registeredAgents = new WeakMap()

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 注册 Action Fusion：在 agent 作用域遮蔽原生 `write`/`edit`，使其可以
 * 在同一次调用里追加一条跟进命令。
 *
 * 必须注册到 `agent.ctx` 而不是插件所在的 profile 根：原生 `write`/`edit` 由
 * agent preset 注册在更近的作用域，DSH 里近者胜，注册在根会被反过来遮蔽。
 */
export function registerActionFusion(ctx) {
  const owned = new Set()
  function release(agent) {
    const registration = registeredAgents.get(agent)
    if (!registration) return
    for (const dispose of registration.disposers) dispose?.()
    registration.owned.delete(agent)
    registeredAgents.delete(agent)
  }
  function activate(agent) {
    if (!isPatchworkAgent(agent)) { if (agent) release(agent); return }
    if (registeredAgents.has(agent)) return

    const tools = agent.ctx?.tools
    if (!tools) {
      logDiagnostic(ctx, agent, { mechanism: 'af', event: 'inactive', level: 'warn', reason: 'no-tools' })
      return
    }
    const shellName = SHELL_TOOLS.find(name => tools.get(name, agent))
    if (!shellName) {
      logDiagnostic(ctx, agent, { mechanism: 'af', event: 'inactive', level: 'warn', reason: 'no-shell' })
      return
    }

    const disposers = []
    for (const name of FUSABLE_TOOLS) {
      const original = tools.get(name, agent)
      if (!original) continue
      try {
        disposers.push(tools.register(
          createFusedDefinition({
            original,
            runThenRun: request =>
              runThenRun({ ctx, tools: request.exec.agent.ctx.tools, shellName, agent: request.exec.agent, ...request }),
          }),
        ))
      } catch (error) {
        // 注册失败只让这个机制失效，不能让 agent 发布失败。
        logDiagnostic(ctx, agent, { mechanism: 'af', event: 'inactive', level: 'warn', reason: 'shadow-failed', error })
      }
    }
    registeredAgents.set(agent, { disposers, owned })
    owned.add(agent)
  }
  ctx.on('agent/created', ({ agent }) => activate(agent))
  ctx.on('agent/disposed', ({ agent }) => release(agent))
  // Native blank-session recompose changes scope ancestry, but registrations
  // on agent.ctx would otherwise outlive the old preset. Revoke them at once.
  ctx.on('agent-preset/selected', sessionId => {
    const agent = ctx.get?.('agents')?.get?.(sessionId)
    if (agent) activate(agent)
  })
  ctx.effect?.(() => () => { for (const agent of [...owned]) release(agent) }, 'patchwork: fused tools lifetime')
}

async function runThenRun({ ctx, tools, shellName, agent, command, filePath, exec }) {
  requirePatchworkAgent(agent)
  const revision = taskRevision(agent)
  const before = await hashFile(filePath)
  await yieldToHost()
  if (!(await targetUnchanged(filePath, before))) {
    logDiagnostic(ctx, exec, { mechanism: 'af', event: 'skipped', reason: 'target-changed', command })
    return { status: 'skipped', reason: 'target-changed', command }
  }
  // The mutation has already completed. Recheck after every async file read,
  // and preserve its receipt if a correction or preset switch revokes follow-up.
  try { requirePatchworkAgent(agent); assertTaskRevision(agent, revision) }
  catch {
    logDiagnostic(ctx, exec, { mechanism: 'af', event: 'skipped', reason: 'task-changed', command })
    return { status: 'skipped', reason: 'mutation completed; task or Patchwork scope changed before follow-up', command }
  }

  try {
    const started = Date.now()
    logDiagnostic(ctx, exec, { mechanism: 'af', event: 'start', reason: 'enabled', command })
    const result = await executeTool(tools, {
      callId: `${exec.callId}:then_run`,
      rootCallId: exec.rootCallId,
      name: shellName,
      arguments: { description: 'Run follow-up verification after the file change', command },
      agent,
      signal: exec.signal,
      parent: exec.token,
    })
    const output = textOf(result.content)
    const value = result.value
    const exitCode = Number.isInteger(value?.exitCode) ? value.exitCode : null
    const failed = Boolean(result.isError || value?.timedOut || value?.aborted || (exitCode !== null && exitCode !== 0))
    const succeeded = !failed && exitCode === 0
    logDiagnostic(ctx, exec, { mechanism: 'af', event: failed ? 'failure' : 'success', level: failed ? 'warn' : 'info',
      reason: failed ? 'command-failed' : succeeded ? 'command-succeeded' : 'command-unverified', command, exitCode,
      resultBytes: Buffer.byteLength(output, 'utf8'), elapsedMs: Date.now() - started })
    // This is an observed fused execution, not a measured counterfactual saving.
    record('actionFusion', 'fusedCalls')
    record('actionFusion', failed ? 'failedCalls' : succeeded ? 'succeededCalls' : 'unverifiedCalls')
    if (succeeded && (!exec.rootCallId || exec.rootCallId === exec.callId)) record('actionFusion', 'successfulRootFusions')
    record('actionFusion', 'fusedCommandBytes', Buffer.byteLength(output, 'utf8'))
    return failed
      ? { status: 'failed', command, output, exitCode, reason: result.error?.message ?? (value?.timedOut ? 'command timed out' : value?.aborted ? 'command aborted' : `command exited ${exitCode}`) }
      : { status: succeeded ? 'succeeded' : 'unverified', command, output, exitCode }
  } catch (error) {
    logDiagnostic(ctx, exec, { mechanism: 'af', event: 'failure', level: 'warn', reason: 'command-failed', command, error })
    return { status: 'failed', command, output: '', reason: messageOf(error) }
  }
}
