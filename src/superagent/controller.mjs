import { realpathSync } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { taskProjection, flushTasks } from '../task/store.mjs'
import { defineJobs, runnableJobs, reservedChildId, bounded, sweepStalls, touchProgress, stalledSeconds, superagentStallConfig } from './state.mjs'
import { persistController, restoreController } from './store.mjs'
import { executorPrompt } from './prompt.mjs'
import { taskMapText } from '../mechanisms/task-map/index.mjs'

const controllers = new WeakMap(), live = new Set(), workers = new Map(), workspaceLocks = new Map()
const snapshotFailures = new WeakSet()
const activeStatuses = new Set(['starting', 'running'])
// Hashing runs on every settle; cap artifact size so a huge file cannot stall
// the controller. Oversized artifacts stay unverified.
const MAX_EVIDENCE_ARTIFACT_BYTES = 8 * 1024 * 1024
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')
function normalizePath(path) {
  if (process.platform !== 'win32') return path
  // GitHub runners and some Windows APIs return extended-length `\\?\` paths.
  // Strip them before comparing, or a valid in-workspace artifact looks absolute.
  if (path.startsWith('\\\\?\\UNC\\')) return ('\\\\' + path.slice(7)).toLowerCase()
  if (path.startsWith('\\\\?\\')) return path.slice(4).toLowerCase()
  return path.toLowerCase()
}
function workspaceKey(cwd) {
  let path
  try { path = realpathSync.native(cwd) } catch { try { path = realpathSync(cwd) } catch { path = resolve(cwd) } }
  return normalizePath(path)
}
export function managedWorker(agent) { return workers.get(agent?.session?.header?.id) }
export function workerBinding(agent) { const b = managedWorker(agent); return b && !b.revoked && b.controller.valid(b.epoch) ? b : undefined }
export function revokeExecutor(sessionId) {
  const binding = workers.get(sessionId)
  if (!binding) return
  binding.revoked = true
  const entry = binding.controller.active.get(binding.jobId)
  entry?.abort.abort(new DOMException('executor preset changed', 'AbortError'))
  void entry?.activation?.dispose().catch(() => {})
}
export function existingController(agent) { return controllers.get(agent) }
/** Snapshot the live queue, restoring persisted work once when a session is reopened. */
export function superagentSnapshot(agent) {
  if (!isPatchworkAgent(agent)) return null
  const existing = controllers.get(agent)
  if (existing) return existing.snapshot()
  if (snapshotFailures.has(agent)) return null
  try {
    // Keep the restored controller so a queue-less session is not rescanned on every poll.
    return new SuperagentController(agent).snapshot()
  } catch { snapshotFailures.add(agent); return null }
}

export class SuperagentController {
  constructor(owner, { persist = persistController, restore = restoreController } = {}) {
    requirePatchworkAgent(owner)
    this.owner = owner; this.persist = persist; this.state = restore(owner)
    this.workspace = workspaceKey(owner.session.header.cwd)
    this.active = new Map(); this.tail = Promise.resolve(); this.pumping = false; this.closed = false
    this.epoch = 0; this.stopping = false; this.persistence = this.state.revision ? 'native' : 'not-saved'
    this.stallThresholdMs = superagentStallConfig().thresholdMs
    // 停滞扫描：活动队列里有作业超阈值无进展时沿阶梯升级。unref 定时器不挂住进程。
    this.stallTimer = setInterval(() => { if (this.valid()) void this.sweep().catch(() => {}) }, Math.min(Math.max(30000, this.stallThresholdMs / 4), 60000))
    this.stallTimer.unref?.()
    controllers.set(owner, this); live.add(this)
  }
  runtime() { return this.owner.ctx.get('subagents') }
  valid(epoch = this.epoch) {
    return !this.closed && !this.stopping && this.persistence !== 'failed' && isPatchworkAgent(this.owner)
      && workspaceKey(this.owner.session.header.cwd) === this.workspace && this.state.status === 'active' && epoch === this.epoch
  }
  serial(work) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next }
  snapshot() {
    return { owner: this.state.owner, revision: this.state.revision, status: this.stopping ? 'paused' : this.state.status,
      concurrency: this.state.concurrency, generation: this.state.generation,
      teardownFailures: this.teardownFailures ?? 0, quarantinedExecutors: [...this.active.values()].filter(entry => entry.quarantined).length,
      jobs: this.state.jobs.map(({ prompt, inputs, ...job }) => ({ ...job, inputCount: inputs.length, stalledSec: stalledSeconds(job) })),
      persistence: this.persistence, channels: ['dsh-session'] }
  }
  async commit(next, epoch = this.epoch) {
    if (epoch !== this.epoch) throw new Error('assignment revoked before persistence')
    try { await this.persist(this.owner, next); this.persistence = 'native' }
    catch (error) { this.persistence = 'failed'; this.revoke(); throw error }
    // A stop may arrive while native flush is pending. Never revive its old generation.
    if (epoch !== this.epoch) throw new Error('assignment revoked during persistence')
    this.state = next
  }
  assertRevision(revision) {
    requirePatchworkAgent(this.owner)
    if (this.closed || this.stopping || this.persistence === 'failed') throw new Error('controller unavailable; inspect recovery state')
    if (revision !== this.state.revision) throw new Error('superagent revision conflict; inspect first')
  }
  assertScope() {
    requirePatchworkAgent(this.owner)
    const task = taskProjection(this.owner)
    const plan = this.owner.ctx.get('planMode')?.get?.(this.owner)
    if (plan?.active || plan?.pending === true) throw new Error('exit native plan mode before scheduling executors')
    if (task?.title && (task.persistence === 'failed' || task.understandingStatus !== 'stated' || ['cancelled', 'superseded'].includes(task.status))) throw new Error('resolve the current task before delegation')
    if (workspaceKey(this.owner.session.header.cwd) !== this.workspace) throw new Error('controller workspace changed')
    return task
  }
  async submit(jobs, revision, options) {
    await this.serial(async () => {
      this.assertRevision(revision); const scope = this.assertScope()
      if (this.owner.session.header.parentSession || managedWorker(this.owner)) throw new Error('only a root Patchwork session can orchestrate')
      const runtime = this.runtime()
      if (!runtime?.startActivation || !runtime.getProvider?.('spawn')?.prepareContinuable || !runtime.drainChildren) throw new Error('native local spawn and selected-child teardown are required')
      if (scope?.title && scope.phase === 'analysis' && jobs.some(j => (j.mode ?? 'write') === 'write')) throw new Error('analysis task cannot delegate writes')
      await this.commit(defineJobs(this.state, jobs, options))
    })
    this.kick(); return this.snapshot()
  }
  release(childId) {
    const locks = workspaceLocks.get(this.workspace)
    locks?.delete(childId); if (!locks?.size) workspaceLocks.delete(this.workspace)
    for (const other of live) if (other !== this && other.workspace === this.workspace) other.kick()
  }
  /** 停滞扫描：超阈值无进展的作业升级（review → blocked），通知父会话后继续派发。 */
  async sweep(now = Date.now()) {
    const threshold = this.stallThresholdMs
    if (!threshold || !this.valid()) return
    const escalated = sweepStalls(this.state, { thresholdMs: threshold, now })
    if (escalated === this.state) return
    const changes = escalated.jobs.filter((job, index) => job !== this.state.jobs[index])
    await this.serial(async () => { await this.commit(escalated) })
    for (const job of changes) this.wake({ kind: 'executor-stalled', jobId: job.id, level: job.stall.level, status: job.status, stalledSec: stalledSeconds(job, now), reason: job.stall.reason })
    this.kick()
  }
  kick() {
    if (!this.valid()) return
    if (this.pumping) { this.kickPending = true; return }
    this.pumping = true
    void this.serial(async () => {
      while (this.valid()) {
        this.assertScope()
        const candidate = runnableJobs(this.state)[0]
        if (!candidate) break
        const lock = workspaceLocks.get(this.workspace)
        if (lock?.size && (candidate.mode === 'write' || [...lock.values()].some(mode => mode === 'write'))) break
        if (this.state.jobs.reduce((n, j) => n + j.attempt, 0) >= this.state.maxAttempts) { void this.pause('attempt budget reached').catch(() => {}); break }
        const epoch = this.epoch, next = structuredClone(this.state), job = next.jobs.find(j => j.id === candidate.id)
        if (job.attempt >= 3) { job.status = 'failed'; next.revision++; await this.commit(next, epoch); continue }
        job.status = 'starting'; job.attempt++; job.childId = reservedChildId(); job.report = null; job.progressAt = new Date().toISOString(); job.stall = null; next.revision++
        const locks = lock ?? new Map(); locks.set(job.childId, job.mode); workspaceLocks.set(this.workspace, locks)
        try {
          await this.commit(next, epoch)
          if (!this.valid(epoch)) { this.release(job.childId); break }
          void this.launch(job, epoch)
        } catch (error) { this.release(job.childId); throw error }
      }
    }).catch(() => { if (!this.stopping) void this.pause('dispatch stopped; inspect queue').catch(() => {}) })
      .finally(() => { this.pumping = false; if (this.kickPending) { this.kickPending = false; this.kick() } })
  }
  async launch(job, epoch) {
    const abort = new AbortController(), entry = { abort, activation: null, timer: null, epoch, childId: job.childId }
    this.active.set(job.id, entry)
    const binding = { controller: this, epoch, jobId: job.id, childId: job.childId, mode: job.mode, latestTask: null, agent: null }
    workers.set(job.childId, binding)
    entry.timer = setTimeout(() => { abort.abort(new DOMException('assignment deadline', 'TimeoutError')); void entry.activation?.dispose().catch(() => {}) }, job.timeoutMs)
    entry.timer.unref?.()
    try {
      const dependencies = job.dependencies.map(id => { const d = this.state.jobs.find(j => j.id === id); return { id, result: d.result } })
      const scope = this.assertScope()
      // 任务锚定地图对子任务同样生效：父会话已启用时复用同一份锚定上下文。
      const map = await taskMapText(this.owner).catch(() => '')
      const text = executorPrompt({ job, scope: { ...scope, map }, dependencies })
      if (!this.valid(epoch)) return
      entry.activation = await this.runtime().startActivation({ provider: 'spawn', childId: job.childId, label: job.title,
        request: { parent: this.owner, cwd: this.owner.session.header.cwd, prompt: [{ type: 'text', text }], maxDepth: this.runtime().resolveMaxDepth?.() ?? 1 },
        signal: abort.signal, delivery: 'caller' })
      if (!this.valid(epoch) || abort.signal.aborted) { await entry.activation.dispose(); return }
      await this.serial(async () => {
        if (!this.valid(epoch)) return
        const next = structuredClone(this.state); next.jobs.find(j => j.id === job.id).status = 'running'; next.revision++; await this.commit(next, epoch)
      })
      const result = await entry.activation.result
      if (binding.agent && isPatchworkAgent(binding.agent)) captureWorkerTask(binding.agent)
      // Native result arrives after the child store has been closed. Its final
      // receipt must be flushed at turn-stopping, while that Session is live.
      const finalTask = binding.agent && !binding.finalFlushed && binding.latestTask
        ? { ...binding.latestTask, persistence: 'unavailable' } : binding.latestTask
      await this.settle(job.id, epoch, binding.revoked ? { stopReason: 'aborted', diagnostic: 'executor preset changed' } : result, finalTask)
    } catch {
      // A failure after native admission (including our own checkpoint flush)
      // must stop that child before releasing its binding or workspace lock.
      binding.revoked = true
      abort.abort(new DOMException('executor dispatch failed', 'AbortError'))
      try { await entry.activation?.dispose() } catch { entry.quarantined = true }
      await this.settle(job.id, epoch, { stopReason: abort.signal.aborted ? 'aborted' : 'error', diagnostic: abort.signal.reason?.name === 'TimeoutError' ? 'assignment timed out' : 'native executor failed; inspect native child' }, null).catch(() => {})
    } finally {
      clearTimeout(entry.timer)
      if (!entry.quarantined) {
        if (this.active.get(job.id) === entry) this.active.delete(job.id)
        if (workers.get(job.childId) === binding) workers.delete(job.childId)
        this.release(job.childId); this.kick()
      }
    }
  }
  async settle(id, epoch, result, task) {
    await this.serial(async () => {
      if (!this.valid(epoch)) return
      const next = structuredClone(this.state), job = next.jobs.find(j => j.id === id)
      const output = (result.output ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n').slice(0, 4000)
      job.result = { stopReason: result.stopReason, summary: output || result.diagnostic || '' }
      const checks = new Map()
      await Promise.all((task?.artifacts ?? []).map(async a => {
        if (a.status !== 'current') { checks.set(a.id, { current: true, hash: null }); return }
        try {
          const s = await stat(a.path)
          const resolved = await realpath(a.path)
          const withinCap = s.size <= MAX_EVIDENCE_ARTIFACT_BYTES
          const current = resolved === a.path && `${s.size}:${s.mtimeMs}:${s.ctimeMs}` === a.stamp && withinCap
          checks.set(a.id, { current, hash: current ? digest(await readFile(a.path)) : null })
        } catch { checks.set(a.id, { current: false, hash: null }) }
      }))
      const artifactsCurrent = task?.artifacts ? [...checks.values()].every(item => item.current) : false
      const verified = task?.status === 'ready' && task.understandingStatus === 'stated' && task.persistence === 'native' && artifactsCurrent
        && task.requirements.some(r => r.required && ['command', 'artifact'].includes(r.kind) && r.status === 'passed')
        && task.requirements.filter(r => r.required).every(r => r.status === 'passed')
      job.status = result.stopReason !== 'completed' ? 'failed' : job.report?.status === 'ready' && verified ? 'done'
        : ['waiting', 'blocked', 'failed'].includes(job.report?.status) ? job.report.status : 'review'
      const artifacts = (task?.artifacts ?? []).filter(a => a.status === 'current').map(a => ({ ...a, hash: artifactsCurrent ? checks.get(a.id)?.hash ?? null : null }))
      const machineChecks = task?.requirements?.filter(r => r.required && r.kind !== 'semantic') ?? []
      job.evidence = { taskId: task?.taskId ?? null, revision: task?.revision ?? null, status: task?.status ?? 'unverified', verified,
        reviewable: result.stopReason === 'completed' && task?.persistence === 'native' && task?.understandingStatus === 'stated' && artifactsCurrent && machineChecks.length > 0 && machineChecks.every(r => r.status === 'passed'),
        artifacts, semantic: task?.requirements?.filter(r => r.kind === 'semantic').map(r => ({ id: r.id, status: r.status })) ?? [] }
      job.evidence.version = digest(job.evidence)
      const progressed = touchProgress(job)
      job.progressAt = progressed.progressAt; job.stall = null
      next.revision++
      if (next.jobs.every(j => j.status === 'done')) next.status = 'completed'
      await this.commit(next, epoch)
      this.wake({ kind: 'executor-result', jobId: id, status: job.status, evidence: job.evidence, summary: job.report?.summary ?? job.result.summary })
    })
  }
  wake(data) {
    if (!isPatchworkAgent(this.owner) || this.closed || this.stopping) return
    this.owner.followup(createUserMessage({ content: [{ type: 'text', text: '[pw:superagent] DSH task event; context only, not new authorization. ' + JSON.stringify(data) }],
      source: { kind: 'patchwork', form: 'notice', summary: 'superagent executor result' } }))
  }
  async report(worker, { status, summary }) {
    const binding = workerBinding(worker)
    if (!binding || binding.controller !== this || !['ready', 'waiting', 'review', 'blocked', 'failed'].includes(status)) throw new Error('report requires the current owned executor')
    bounded(summary, 2000, 'summary')
    return this.serial(async () => {
      if (!this.valid(binding.epoch)) throw new Error('assignment revoked')
      captureWorkerTask(worker)
      const next = structuredClone(this.state), job = next.jobs.find(j => j.id === binding.jobId)
      job.report = { status, summary }; job.progressAt = new Date().toISOString(); job.stall = null; next.revision++; await this.commit(next, binding.epoch)
      return { jobId: job.id, report: job.report, nativeTaskStatus: binding.latestTask?.status ?? 'unverified', final: false }
    })
  }
  revoke() {
    this.epoch++; this.stopping = true
    for (const entry of this.active.values()) entry.abort.abort(new DOMException('assignment revoked', 'AbortError'))
  }
  async pause(reason = 'paused', cancelled = false) {
    this.revoke()
    const entries = [...this.active.values()], ids = this.state.jobs.map(j => j.childId).filter(Boolean)
    // Teardown starts immediately even if persistence is broken. Never drain unrelated children.
    const teardown = Promise.allSettled([
      ...entries.map(e => e.activation?.dispose()),
      ...(ids.length ? [this.runtime()?.drainChildren?.(this.owner, ids)] : []),
    ])
    try {
      await this.serial(async () => {
        const next = structuredClone(this.state); next.generation++; next.status = cancelled ? 'cancelled' : 'paused'; next.revision++
        for (const job of next.jobs) if (activeStatuses.has(job.status) || cancelled && job.status !== 'done') {
          job.status = cancelled ? 'cancelled' : 'blocked'; job.recovery = reason
        }
        this.state = next
        await this.commit(next)
      })
    } finally {
      const stopped = await teardown
      if (stopped.every(result => result.status === 'fulfilled')) {
        for (const [id, entry] of this.active) if (entry.quarantined) {
          this.active.delete(id); workers.delete(entry.childId); this.release(entry.childId)
        }
      }
      this.teardownFailures = stopped.filter(result => result.status === 'rejected').length
      this.stopping = false
    }
    return this.snapshot()
  }
  async retry(id, revision, input) {
    if (input !== undefined) bounded(input, 4000, 'input')
    this.assertRevision(revision)
    const job = this.state.jobs.find(j => j.id === id)
    if (!job || job.status === 'cancelled' || job.attempt >= 3 || !input && ['done', 'starting', 'running'].includes(job.status)) throw new Error('job is not eligible; input may correct an active/completed job, maximum three attempts')
    if (input && job.inputs.length >= 8) throw new Error('job input limit reached')
    await this.pause(input ? 'job corrected; downstream evidence invalidated' : 'retry requested')
    const pausedRevision = this.state.revision
    await this.serial(async () => {
      this.assertRevision(pausedRevision)
      this.assertScope()
      const next = structuredClone(this.state), target = next.jobs.find(j => j.id === id), affected = new Set([id])
      for (let changed = true; changed;) {
        changed = false
        for (const j of next.jobs) if (!affected.has(j.id) && j.dependencies.some(d => affected.has(d))) { affected.add(j.id); changed = true }
      }
      for (const j of next.jobs) if (affected.has(j.id)) { j.status = j.id === id ? 'queued' : j.attempt ? 'blocked' : 'queued'; j.report = null; j.evidence = null; j.result = null; j.recovery = j.id === id ? null : 'upstream changed; retry after review' }
      if (input) target.inputs.push(input)
      for (const j of next.jobs) if (affected.has(j.id)) { j.progressAt = new Date().toISOString(); j.stall = null }
      next.status = 'active'; next.revision++; await this.commit(next)
    })
    this.kick(); return this.snapshot()
  }
  async resume(revision) {
    await this.serial(async () => {
      this.assertRevision(revision); this.assertScope()
      if (this.state.status !== 'paused') throw new Error('only paused queues can resume')
      const next = structuredClone(this.state); next.status = 'active'; next.revision++; await this.commit(next)
    })
    this.kick(); return this.snapshot()
  }
  async review(id, revision, { userConfirmed = false, accept = false, evidenceVersion } = {}) {
    if (!userConfirmed) throw new Error('Explicit user confirmation is required')
    await this.serial(async () => {
      this.assertRevision(revision); this.assertScope()
      const next = structuredClone(this.state), job = next.jobs.find(j => j.id === id)
      if (!job || job.status !== 'review' || !job.evidence?.reviewable || evidenceVersion !== job.evidence.version) throw new Error('Current reviewable evidence version required')
      for (const artifact of accept ? job.evidence.artifacts ?? [] : []) {
        const resolved = normalizePath(await realpath(artifact.path))
        const separator = process.platform === 'win32' ? '\\' : '/'
        const within = resolved === this.workspace || resolved.startsWith(this.workspace + separator)
        if (!within) throw new Error('Artifact is outside the controller workspace')
        const s = await stat(artifact.path)
        if (resolved !== normalizePath(artifact.path) || `${s.size}:${s.mtimeMs}:${s.ctimeMs}` !== artifact.stamp || s.size > MAX_EVIDENCE_ARTIFACT_BYTES || digest(await readFile(artifact.path)) !== artifact.hash) throw new Error('Artifact changed; recheck before accepting')
      }
      job.disposition = { source: 'user-confirmed', accepted: accept === true, evidenceVersion, at: new Date().toISOString() }
      job.progressAt = new Date().toISOString(); job.stall = null
      job.status = accept ? 'done' : 'blocked'; job.recovery = accept ? null : 'User rejected this result; correct and retry'
      next.revision++
      if (next.jobs.every(j => j.status === 'done')) next.status = 'completed'
      await this.commit(next)
    })
    this.kick(); return this.snapshot()
  }
  async reconcile() {
    requirePatchworkAgent(this.owner)
    const catalog = await this.runtime()?.listChildren?.(this.owner.session.header.id)
    const ids = new Set(this.state.jobs.map(j => j.childId))
    return { queue: this.snapshot(), children: (catalog ?? []).filter(c => ids.has(c.id ?? c.sessionId)).map(c => ({ id: c.id ?? c.sessionId, status: c.status ?? null })), policy: 'Uncertain assignments remain blocked; inspect child evidence, then explicitly retry. No automatic replay.' }
  }
  async close(reason) { this.closed = true; clearInterval(this.stallTimer); live.delete(this); try { await this.pause(reason) } finally { controllers.delete(this.owner) } }
}
export function getController(agent, options) { requirePatchworkAgent(agent); return controllers.get(agent) ?? new SuperagentController(agent, options) }
export function captureWorkerTask(agent) {
  const b = workerBinding(agent)
  if (b && isPatchworkAgent(agent)) { b.agent = agent; b.latestTask = taskProjection(agent) }
}
export async function flushWorkerTask(agent) {
  const binding = workerBinding(agent)
  if (!binding) return
  binding.finalFlushed = false
  captureWorkerTask(agent)
  try {
    await flushTasks(agent)
    const sessions = agent.ctx.get('sessions')
    if (!sessions?.flush) return
    await sessions.flush(agent.session)
    if (!workerBinding(agent)) return
    captureWorkerTask(agent); binding.finalFlushed = true
  } catch { /* A failed native flush cannot produce accepted dependency evidence. */ }
}
