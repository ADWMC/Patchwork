import { initialTask, readTaskCheckpoint, reduceTask, TASK_RECORD } from './state.mjs'
import { nativeSessionApi } from '../logging/session-log.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { statSync, realpathSync } from 'node:fs'
import { registerSourceReceipt } from '../improvement/provenance.mjs'
import { recordIncident, proposeCandidate } from '../improvement/store.mjs'

const states = new WeakMap()
const pending = new WeakMap()
const RESTORE_LIMIT = 5000

export function taskState(agent) {
  if (!isPatchworkAgent(agent)) return null
  const session = agent.session
  if (!states.has(session)) {
    let state = initialTask(session.header.id, session.header.cwd)
    let found = false
    const end = Number.isSafeInteger(session.seq) ? session.seq : 0
    for (let seq = end - 1; seq >= Math.max(0, end - RESTORE_LIMIT); seq--) {
      try {
        const event = session.eventAt(seq)
        if (event?.type !== TASK_RECORD || event.ignorable !== true) continue
        found = true
        if (session.header.parentSession && event.data?.sessionId !== session.header.id) {
          state.source = { kind: 'restored', eventId: 'fork-no-authority' }
          break
        }
        state = readTaskCheckpoint(event.data, session.header.id, session.header.cwd)
        state.persistence = 'native'
        break
      } catch { state.persistence = 'failed'; state.status = 'blocked'; break }
    }
    // A fork may carry facts, but never inherits instance/process authority or ready.
    if (session.header.parentSession) {
      state = reduceTask(state, { kind: 'incoming', eventId: 'fork', sourceKind: 'restored' })
      state.instance = null
    }
    if (!found && end >= RESTORE_LIMIT) { state.persistence = 'failed'; state.status = 'blocked' }
    states.set(session, { state, restored: found, scanLimit: RESTORE_LIMIT })
  }
  return states.get(session).state
}
export function transitionTask(agent, event) {
  requirePatchworkAgent(agent)
  taskState(agent)
  const record = states.get(agent.session)
  if (record.state.persistence === 'failed') throw new Error('task persistence degraded; inspect/recover session before changing task')
  const next = reduceTask(record.state, event)
  if (next === record.state) return record.state
  const data = structuredClone(next)
  if (Buffer.byteLength(JSON.stringify(data)) > 100000) throw new Error('task checkpoint size limit reached')
  record.state = next
  if (event.kind === 'receipt') registerSourceReceipt(agent, { id: event.receipt.id, outcome: event.receipt.outcome, kind: 'acceptance', revision: event.receipt.revision })
  if (event.kind === 'correct' || event.kind === 'candidate' || event.kind === 'incoming' && event.sourceKind === 'user' && next.title) {
    const sourceId = event.kind === 'candidate' ? event.data.sourceReceiptId : `task:${next.taskId}:revision:${next.revision}`
    if (event.kind !== 'candidate') registerSourceReceipt(agent, { id: sourceId, outcome: 'correction', kind: 'task-correction', revision: next.revision })
    const incident = recordIncident(agent, { kind: 'correction', sourceReceiptIds: [sourceId], trigger: event.kind === 'candidate' ? event.data.trigger : '任务收到纠正或新的用户输入；需重新核对当前版本', action: '复核当前版本和逐项验收' })
    if (event.kind === 'candidate' && incident.incident) proposeCandidate(agent, { incidentIds: [incident.incident.id], object: 'rule', trigger: event.data.trigger, hypothesis: event.data.label, changeScope: '当前会话的交付复核提醒', patch: { version: 1, setting: 'verifyBeforeDelivery', value: true } })
  }
  const tail = (pending.get(agent.session) ?? Promise.resolve()).then(() => {
    if (!isPatchworkAgent(agent)) return
    const api = nativeSessionApi(agent.session)
    if (!api) return
    try {
      api.appendPluginRecord(agent.session, TASK_RECORD, data)
      record.state.persistence = 'native'
    } catch { record.state.persistence = 'failed'; record.state.status = 'blocked' }
  })
  pending.set(agent.session, tail.catch(() => { record.state.persistence = 'failed'; record.state.status = 'blocked' }))
  return record.state
}
export async function flushTasks(agent) { await pending.get(agent.session) }
export function taskProjection(agent) {
  const state = taskState(agent)
  if (!state) return null
  const changed = state.artifacts.filter(a => {
    if (a.status !== 'current') return false
    try { const s = statSync(a.path); return realpathSync(a.path) !== a.path || `${s.size}:${s.mtimeMs}:${s.ctimeMs}` !== a.stamp }
    catch { return true }
  }).map(a => a.id)
  if (changed.length && state.persistence !== 'failed') transitionTask(agent, { kind: 'invalidate', targets: changed })
  // Delivery fingerprints are persistence mechanics, not model/UI context.
  const { inputIds: _inputIds, ...projection } = taskState(agent)
  return structuredClone(projection)
}
export function taskSummary(agent) {
  const s = taskProjection(agent)
  if (!s?.title) return '[pw:task] 修改、纠正或逐项验收前用 patchwork_task define 登记对象、阶段与要求；小型只读回答可跳过。模型陈述不授予权限。'
  return `[pw:task] ${s.title}; revision=${s.revision}; phase=${s.phase}; status=${s.status}; understanding=${s.understandingStatus}; ` +
    s.requirements.map(r => `${r.id}:${r.status}`).join(', ') + '. ready仅代表已登记检查；语义评审及未覆盖项须另说明。'
}
