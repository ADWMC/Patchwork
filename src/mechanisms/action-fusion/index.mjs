import { createFusedDefinition } from './fused-tool.mjs'
import { hashFile, targetUnchanged, yieldToHost } from './mutation-guard.mjs'
import { record } from '../../ui/mechanism-stats.mjs'

const FUSABLE_TOOLS = ['write', 'edit']
const SHELL_TOOLS = ['pwsh', 'bash']

function textOf(content) {
  return (content ?? [])
    .filter(block => block?.type === 'text')
    .map(block => block.text)
    .join('\n')
}

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
  const registeredAgents = new WeakSet()

  ctx.on('agent/created', ({ agent }) => {
    if (!agent || registeredAgents.has(agent)) return
    registeredAgents.add(agent)

    const tools = agent.ctx?.tools
    if (!tools) {
      warn('the agent context exposes no tools service; leaving write/edit untouched')
      return
    }
    const shellName = SHELL_TOOLS.find(name => tools.get(name, agent))
    if (!shellName) {
      warn('no shell tool (pwsh or bash) is visible; leaving write/edit untouched')
      return
    }

    for (const name of FUSABLE_TOOLS) {
      const original = tools.get(name, agent)
      if (!original) continue
      try {
        tools.register(
          createFusedDefinition({
            original,
            runThenRun: request =>
              runThenRun({ tools, shellName, agent, ...request }),
          }),
        )
      } catch (error) {
        // 注册失败只让这个机制失效，不能让 agent 发布失败。
        warn(`could not shadow ${name}: ${messageOf(error)}`)
      }
    }
  })
}

function warn(reason) {
  // 不在 agent/created 里抛错：同步监听器失败会否决 agent 发布，
  // 对一个非关键机制来说爆炸半径过大。改为记录并保持原生行为。
  console.warn(`[patchwork] Action Fusion is enabled but inactive: ${reason}`)
}

async function runThenRun({ tools, shellName, agent, command, filePath, exec }) {
  const before = await hashFile(filePath)
  await yieldToHost()
  if (!(await targetUnchanged(filePath, before))) {
    return { status: 'skipped', reason: 'target-changed', command }
  }

  try {
    const result = await tools.execute({
      callId: `${exec.callId}:then_run`,
      rootCallId: exec.rootCallId,
      name: shellName,
      arguments: { command },
      agent,
      signal: exec.signal,
      parent: exec.token,
    })
    const output = textOf(result.content)
    // 一次真正被合并执行的调用：这就是本机制省下的那一次模型往返。
    record('actionFusion', 'fusedCalls')
    record('actionFusion', 'savedRequests')
    record('actionFusion', 'fusedCommandBytes', Buffer.byteLength(output, 'utf8'))
    return result.isError
      ? { status: 'failed', command, output, reason: result.error?.message ?? 'command failed' }
      : { status: 'succeeded', command, output }
  } catch (error) {
    return { status: 'failed', command, output: '', reason: messageOf(error) }
  }
}
