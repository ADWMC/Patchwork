import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { record } from '../../ui/mechanism-stats.mjs'
import { isPatchworkAgent } from '../../scope.mjs'
import { logDiagnostic } from '../../logging/session-log.mjs'
import { taskProjection } from '../../task/store.mjs'
import { buildTaskMap } from './map.mjs'

/**
 * 任务锚定地图的运行时注册。
 *
 * 注入点与任务 handoff 同款：agent/pre-step 的 enter 决策上追加一条
 * patchwork notice。三条纪律照搬 handoff：
 *   1. 有界——文本预算固定，超预算截断；
 *   2. 可再注入——压缩把 notice 摘要掉之后，下次 enter 重新带上；
 *   3. 随任务失效——taskId/revision/锚点集合变化即重建，旧地图不滞留。
 * 进程内缓存最近一次注入文本，避免同一状态每轮重复构建。
 */

const SOURCE_SUMMARY = 'task-anchored map'
const injected = new WeakMap()
let enabled = false

const TERMINAL_STATUSES = new Set(['cancelled', 'superseded'])

function anchorsOf(agent) {
  const task = taskProjection(agent)
  if (!task?.title || TERMINAL_STATUSES.has(task.status)) return null
  const references = (task.references ?? []).filter(item => typeof item === 'string')
  const artifacts = (task.artifacts ?? []).filter(item => item.status === 'current').map(item => item.path)
  return { key: `${task.taskId}:${task.revision}:${[...references, ...artifacts].sort().join('|')}`, references, artifacts }
}

/** 同一份地图已是会话里最新的 patchwork notice 时为真：压缩后可再注入，未变不重复。 */
export function alreadyInjected(agent, text, pending = []) {
  if (!isPatchworkAgent(agent)) return false
  const messages = [...(agent.session.deriveMessages?.() ?? []), ...pending]
  const latest = messages.findLast(message => message.source?.kind === 'patchwork' && message.source?.summary === SOURCE_SUMMARY)
  return latest?.content?.length === 1 && latest.content[0]?.type === 'text' && latest.content[0].text === text
}

/** 供 Superagent 执行器复用的同一份地图；未启用或无锚点时返回空串。 */
export async function taskMapText(agent) {
  if (!enabled || !isPatchworkAgent(agent)) return ''
  const anchors = anchorsOf(agent)
  if (!anchors || (!anchors.references.length && !anchors.artifacts.length)) return ''
  const cached = injected.get(agent.session)
  if (cached && cached.key === anchors.key) return cached.text
  const { text } = await buildTaskMap({ cwd: agent.session.header.cwd, references: anchors.references, artifacts: anchors.artifacts })
  if (!text) return ''
  injected.set(agent.session, { key: anchors.key, text })
  return text
}

export function registerTaskMap(ctx, config = {}) {
  if (config.taskMap === false) return
  enabled = true
  ctx.on('agent/pre-step', async ({ agent, messages }, next) => {
    const decision = await next()
    if (decision.kind !== 'enter' || !isPatchworkAgent(agent)) return decision
    try {
      const anchors = anchorsOf(agent)
      if (!anchors || (!anchors.references.length && !anchors.artifacts.length)) return decision
      const text = await taskMapText(agent)
      if (!text || alreadyInjected(agent, text, messages)) return decision
      record('taskMap', 'injections')
      logDiagnostic(ctx, agent, { mechanism: 'taskMap', event: 'inject', reason: 'task-anchored-map' })
      return { ...decision, messages: [...decision.messages, createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'patchwork', form: 'notice', summary: SOURCE_SUMMARY },
      })] }
    } catch {
      return decision
    }
  })
}
