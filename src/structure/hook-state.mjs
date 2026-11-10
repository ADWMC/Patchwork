import { readFile, writeFile } from 'node:fs/promises'

// Both structure hints share one bounded JSON state file. Serialize the whole
// read-modify-write inside this process so concurrent sessions cannot drop
// each other's cooldown counters.
const queues = new Map()

export function withHookState(path, work) {
  const previous = queues.get(path) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    let state = {}
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed
    } catch {
      // First run or unreadable state: start empty.
    }
    const result = await work(state)
    try { await writeFile(path, JSON.stringify(state)) } catch { /* Cooldown state is advisory. */ }
    return result
  })
  const tail = next.catch(() => {})
  queues.set(path, tail)
  void tail.finally(() => { if (queues.get(path) === tail) queues.delete(path) })
  return next
}
