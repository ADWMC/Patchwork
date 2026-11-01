import { isBrowserAgent } from '../scope.mjs'

export const DEFAULT_RESOURCE_POLICY = Object.freeze({ maxInstances: 2, maxTabs: 8, idleTimeoutMs: 300_000, memoryTargetMiB: 512, autoReclaim: false })
const ranges = { maxInstances: [1, 8], maxTabs: [1, 8], idleTimeoutMs: [30_000, 3_600_000], memoryTargetMiB: [128, 16_384] }
export function resourcePolicy(input = {}) {
  const policy = { ...DEFAULT_RESOURCE_POLICY }
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (input[key] === undefined) continue
    if (!Number.isInteger(input[key]) || input[key] < min || input[key] > max) throw new Error(`Invalid browser resource policy: ${key}`)
    policy[key] = input[key]
  }
  if (input.autoReclaim !== undefined) {
    if (typeof input.autoReclaim !== 'boolean') throw new Error('Invalid browser resource policy: autoReclaim')
    policy.autoReclaim = input.autoReclaim
  }
  return policy
}

// One coordinator per Node host; browser processes/contexts remain Agent-private.
// Aggregate user facts deliberately contain no session ids, paths, URLs or PIDs.
export class BrowserResources {
  constructor({ now = Date.now, intervalMs = 10_000, measure } = {}) {
    this.now = now; this.records = new Map()
    this.sampler = measure
    this.timer = setInterval(() => { void this.sweep().catch(() => {}) }, intervalMs)
    this.timer.unref?.()
  }
  register(session, input) {
    if (this.records.has(session)) return
    const policy = resourcePolicy(input)
    this.records.set(session, { policy, autoReclaim: policy.autoReclaim, state: 'dormant', lastActivityAt: this.now(), viewerUntil: 0, memory: null })
  }
  unregister(session) { const r = this.records.get(session); r?.release?.(); this.records.delete(session) }
  limits() {
    const policies = [...this.records.values()].map(r => r.policy)
    return { maxInstances: Math.min(...policies.map(p => p.maxInstances), 8), memoryTargetMiB: Math.min(...policies.map(p => p.memoryTargetMiB), 16_384) }
  }
  touch(session) { const r = this.records.get(session); if (r) r.lastActivityAt = this.now() }
  view(session) { const r = this.records.get(session); if (r) r.viewerUntil = this.now() + 15_000 }
  setAutoReclaim(session, value) {
    session.check()
    if (typeof value !== 'boolean') throw new Error('autoReclaim must be boolean')
    const r = this.records.get(session); if (!r) throw new Error('Browser resource owner ended')
    r.autoReclaim = value; this.touch(session)
  }
  protection(session, r, { queued = false } = {}) {
    return [session.control === 'user' && 'user-control', (!queued && session.running || session.pendingResourceAction > 0) && 'busy', session.recording && 'recording', session.downloadArm?.until > this.now() && 'download-armed', session.transfers > 0 && 'transfer', (session.streamWatchers?.size || r.viewerUntil > this.now()) && 'viewer'].filter(Boolean)
  }
  eligible(session, r, { idle = true, queued = false } = {}) {
    return r.state === 'active' && r.autoReclaim && isBrowserAgent(session.agent) && !session.ended && !session.ending && !this.protection(session, r, { queued }).length && (!idle || this.now() - r.lastActivityAt >= r.policy.idleTimeoutMs)
  }
  async reclaim(session, { idle = true, reason = 'idle' } = {}) {
    const r = this.records.get(session)
    if (!r || !this.eligible(session, r, { idle })) return false
    return session.enqueue(async () => {
      const allowed = this.records.get(session) === r && this.eligible(session, r, { idle, queued: true })
      if (!allowed) return false
      await session.hibernate(reason); return true
    })
  }
  async sweep() {
    if (this.sweeping) return
    this.sweeping = true
    try { for (const [session, r] of this.records) if (this.eligible(session, r)) await this.reclaim(session) }
    finally { this.sweeping = false }
  }
  aggregate() {
    const records = [...this.records.values()], active = records.filter(r => ['starting', 'active', 'closing'].includes(r.state))
    const measured = active.filter(r => r.memory?.status === 'measured' && this.now() - r.memory.measuredAtMs <= 30_000)
    const privateWorkingSetMiB = measured.reduce((n, r) => n + r.memory.privateWorkingSetMiB, 0)
    const limits = this.limits()
    return { ...limits, running: active.length, measured: measured.length, unmeasured: active.length - measured.length, privateWorkingSetMiB: Math.round(privateWorkingSetMiB * 10) / 10, pressure: measured.length < active.length ? 'unknown' : privateWorkingSetMiB >= limits.memoryTargetMiB ? 'high' : 'normal', budgetKind: 'soft-private-working-set-target' }
  }
  async reserve(session) {
    session.check()
    const r = this.records.get(session)
    if (!r || session.ended || session.ending) throw new Error('Browser resource owner ended')
    if (r.release) throw new Error('Browser resource reservation already exists')
    let total = this.aggregate()
    if (total.running >= total.maxInstances || total.pressure === 'high') {
      const candidates = [...this.records].filter(([owner, record]) => owner !== session && this.eligible(owner, record, { idle: false })).sort((a, b) => a[1].lastActivityAt - b[1].lastActivityAt)
      for (const [owner] of candidates) { await this.reclaim(owner, { idle: false, reason: 'capacity' }); total = this.aggregate(); if (total.running < total.maxInstances && total.pressure !== 'high') break }
    }
    // No await between the final count and reservation: concurrent launches
    // cannot both pass the last slot. No destructive action on protected owners.
    total = this.aggregate()
    session.check()
    if (this.records.get(session) !== r) throw new Error('Browser resource owner ended')
    if (total.running >= total.maxInstances) throw new Error(`浏览器资源上限：本实例最多同时运行 ${total.maxInstances} 个浏览器；请关闭闲置浏览器，或调整资源配置后重新加载`)
    if (total.pressure === 'high') throw new Error('已测浏览器内存超过软预算；请先回收闲置浏览器。不会强制关闭受保护页面')
    r.state = 'starting'; r.memory = null; r.lastActivityAt = this.now()
    let released = false
    const release = () => {
      if (released) return; released = true
      if (r.release === release) { r.release = null; r.state = 'dormant'; r.memory = null }
    }
    r.release = release
    return { release, activate: browser => { if (released) throw new Error('Browser resource reservation expired'); r.state = 'active'; browser.once?.('disconnected', release) } }
  }
  hibernated(session, reason) { const r = this.records.get(session); if (r) { r.state = 'hibernated'; r.lastReclaimedAt = this.now(); r.lastReclaimReason = reason } }
  snapshot(session, { forUser = true } = {}) {
    const r = this.records.get(session)
    if (!r) return { state: 'ended' }
    const reasons = this.protection(session, r)
    const own = { state: r.state, maxTabs: r.policy.maxTabs, idleTimeoutMs: r.policy.idleTimeoutMs, autoReclaim: r.autoReclaim, lastReclaimedAt: r.lastReclaimedAt ?? null, lastReclaimReason: r.lastReclaimReason ?? null, memory: r.memory, protected: reasons.length > 0, protection: reasons }
    return forUser ? { ...own, host: this.aggregate() } : own
  }
  async measure(session) {
    session.check()
    const r = this.records.get(session)
    if (!r) throw new Error('Browser resource owner ended')
    if (r.measurement) return r.measurement
    if (r.memory && this.now() - r.memory.measuredAtMs < 15_000) return r.memory
    r.measurement = (async () => {
      const lease = r.release
      const sampler = this.sampler ?? (await import('./resource-memory.mjs')).measureBrowserMemory
      const result = await sampler(session)
      session.check()
      if (this.records.get(session) !== r || r.release !== lease) throw new Error('Browser changed during memory measurement; retry')
      r.memory = { ...result, measuredAtMs: this.now() }; return r.memory
    })().finally(() => { r.measurement = null })
    return r.measurement
  }
  dispose() { clearInterval(this.timer); this.records.clear() }
}

export function sharedBrowserResources() {
  return globalThis[Symbol.for('@patchwork/browser/resources/v1')] ??= new BrowserResources()
}
