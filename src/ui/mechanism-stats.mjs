/**
 * 机制自身的计数器：每个机制在真正动手时记一笔，供看板回答「它到底省了什么」。
 *
 * 进程内、纯计数、不落盘。它不是遥测：数据只注入到本机页面里给自己看。
 */
const counters = new Map()

export function record(mechanism, field, value = 1) {
  if (!Number.isFinite(value) || value === 0) return
  const key = `${mechanism}\u0000${field}`
  counters.set(key, (counters.get(key) ?? 0) + value)
}

export function snapshot() {
  const out = {}
  for (const [key, value] of counters) {
    const [mechanism, field] = key.split('\u0000')
    if (!out[mechanism]) out[mechanism] = {}
    out[mechanism][field] = value
  }
  return out
}

export function reset() {
  counters.clear()
}
