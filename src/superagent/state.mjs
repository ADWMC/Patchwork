import { randomUUID } from 'node:crypto'

export const SUPERAGENT_RECORD = 'plugin:patchwork/superagent'
export const MAX_JOBS = 24
export const STATES = ['queued', 'starting', 'running', 'waiting', 'review', 'blocked', 'failed', 'cancelled', 'done']
/** 停滞判定只看“活动中的作业”：终态与排队等待不算无进展。 */
const LIVE_STALL_STATES = new Set(['starting', 'running', 'waiting', 'review'])
export const STALL_LEVELS = { none: 0, review: 1, blocked: 2 }
export function bounded(value, max, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must be nonempty and at most ${max} characters`)
  return value
}
export function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,96}$/.test(value)) throw new Error('invalid job id')
  return value
}
export function initialSuperagent(owner) {
  return { schema: 1, owner, revision: 0, generation: 0, status: 'idle', concurrency: 2, maxAttempts: 48, jobs: [] }
}
export function defineJobs(state, jobs, { concurrency = state.concurrency } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('concurrency must be 1..4')
  if (!Array.isArray(jobs) || !jobs.length || state.jobs.length + jobs.length > MAX_JOBS) throw new Error(`a run supports at most ${MAX_JOBS} jobs`)
  const next = structuredClone(state)
  for (const input of jobs) {
    const id = identifier(input.id)
    if (next.jobs.some(j => j.id === id)) throw new Error('duplicate job id')
    const dependencies = input.dependencies ?? []
    if (!Array.isArray(dependencies) || dependencies.length > 8 || new Set(dependencies).size !== dependencies.length) throw new Error('invalid job dependencies')
    dependencies.forEach(identifier)
    const timeoutMs = input.timeoutMs ?? 300000
    if (input.mode !== undefined && !['read', 'explore', 'write'].includes(input.mode)) throw new Error('mode must be read, explore or write')
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 900000) throw new Error('timeoutMs must be 1000..900000')
    next.jobs.push({ id, title: bounded(input.title, 160, 'title'), prompt: bounded(input.prompt, 8000, 'prompt'), dependencies,
      timeoutMs, mode: input.mode === 'write' ? 'write' : input.mode === 'explore' ? 'explore' : 'read', status: 'queued', attempt: 0, childId: null, result: null, report: null, inputs: [], progressAt: new Date().toISOString(), stall: null })
  }
  for (const job of next.jobs) if (job.dependencies.some(id => id === job.id || !next.jobs.some(j => j.id === id))) throw new Error('missing or self job dependency')
  const visiting = new Set(), visited = new Set()
  function visit(job) {
    if (visiting.has(job.id)) throw new Error('cyclic job dependencies')
    if (visited.has(job.id)) return
    visiting.add(job.id)
    job.dependencies.forEach(id => visit(next.jobs.find(j => j.id === id)))
    visiting.delete(job.id); visited.add(job.id)
  }
  next.jobs.forEach(visit)
  next.concurrency = concurrency; next.status = 'active'; next.revision++
  return next
}
export function runnableJobs(state) {
  if (state.status !== 'active') return []
  const slots = Math.max(0, state.concurrency - state.jobs.filter(j => ['starting', 'running'].includes(j.status)).length)
  const running = state.jobs.filter(j => ['starting', 'running'].includes(j.status))
  if (running.some(j => j.mode === 'write')) return []
  const candidates = state.jobs.filter(j => j.status === 'queued' && j.dependencies.every(id => state.jobs.find(x => x.id === id)?.status === 'done'))
  if (!slots) return []
  if (!running.length && candidates[0]?.mode === 'write') return [candidates[0]]
  return candidates.filter(j => j.mode !== 'write').slice(0, slots)
}
export function reservedChildId() { return `session-pw-${randomUUID()}` }

/** 停滞阈值由配置注入（毫秒；<=0 关闭扫描）。默认 10 分钟，与社区实现的量级一致。 */
let stallThresholdMs = 600000
export function setSuperagentStallConfig(thresholdMs) {
  stallThresholdMs = Number.isFinite(thresholdMs) && thresholdMs > 0 ? Math.floor(thresholdMs) : 0
}
export function superagentStallConfig() { return { thresholdMs: stallThresholdMs } }

/** 作业有任何推进（派发、回报、补充输入、评审）时调用：刷新进度并清除停滞标记。 */
export function touchProgress(job, at = new Date().toISOString()) {
  if (!job) return job
  return { ...job, progressAt: at, stall: null }
}

export function stalledSeconds(job, now = Date.now()) {
  if (!job?.progressAt) return 0
  const started = Date.parse(job.progressAt)
  if (!Number.isFinite(started)) return 0
  return Math.max(0, Math.floor((now - started) / 1000))
}

/**
 * 停滞扫描（纯函数）：超过阈值无进展的作业沿阶梯升级——
 * 一级升 review（需要评审才能继续），二级升 blocked（需要干预）。
 * 进度恢复（touchProgress 后 stall 已清）的作业不会被重复升级；
 * 终态与排队作业不参与判定。返回新 state，无变化时返回原对象。
 */
export function sweepStalls(state, { thresholdMs, now = Date.now(), nowIso = new Date(now).toISOString() } = {}) {
  if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) return state
  let changed = false
  const jobs = state.jobs.map(job => {
    if (!LIVE_STALL_STATES.has(job.status)) return job
    const idle = now - Date.parse(job.progressAt ?? nowIso)
    if (!Number.isFinite(idle) || idle <= thresholdMs) return job
    const level = (job.stall?.level ?? STALL_LEVELS.none) + 1
    if (level > STALL_LEVELS.blocked) return job
    changed = true
    const escalated = level === STALL_LEVELS.review
      ? { ...job, status: 'review', stall: { level, since: job.stall?.since ?? nowIso, reason: `no progress for ${Math.floor(idle / 1000)}s` } }
      : { ...job, status: 'blocked', stall: { level, since: job.stall?.since ?? nowIso, reason: `still stalled after escalation` } }
    return escalated
  })
  if (!changed) return state
  return { ...state, jobs, revision: state.revision + 1 }
}

export function restoreSuperagent(input, owner) {
  if (input?.schema !== 1 || input.owner !== owner || !Number.isSafeInteger(input.revision) || input.revision < 0
    || !Number.isSafeInteger(input.generation) || input.generation < 0 || !Array.isArray(input.jobs) || input.jobs.length > MAX_JOBS) throw new Error('invalid superagent checkpoint')
  let next = initialSuperagent(owner)
  if (input.jobs.length) next = defineJobs(next, input.jobs, { concurrency: input.concurrency })
  next.revision = input.revision; next.generation = input.generation + 1; next.status = 'paused'
  next.jobs = next.jobs.map((j, i) => {
    const prior = input.jobs[i]
    if (!STATES.includes(prior.status) || !Number.isSafeInteger(prior.attempt) || prior.attempt < 0 || prior.attempt > 3) throw new Error('invalid persisted assignment')
    if (prior.childId !== null && !/^session-pw-[a-f0-9-]{36}$/.test(prior.childId)) throw new Error('invalid persisted child id')
    if (!Array.isArray(prior.inputs) || prior.inputs.length > 8 || prior.inputs.some(s => typeof s !== 'string' || s.length > 4000)) throw new Error('invalid persisted job inputs')
    return { ...j, attempt: prior.attempt, childId: prior.childId, inputs: [...prior.inputs],
      status: ['starting', 'running'].includes(prior.status) ? 'blocked' : prior.status === 'done' ? 'review' : prior.status,
      result: prior.result ? { stopReason: bounded(prior.result.stopReason, 40, 'stopReason'), summary: String(prior.result.summary ?? '').slice(0, 4000) } : null,
      evidence: prior.evidence && typeof prior.evidence.version === 'string' && Array.isArray(prior.evidence.artifacts) && prior.evidence.artifacts.length <= 24 ? structuredClone(prior.evidence) : null,
      disposition: null,
      report: null, recovery: ['starting', 'running', 'done'].includes(prior.status) ? 'recovered; inspect original child and current artifacts before explicit review or retry; no automatic replay' : null }
  })
  return next
}
