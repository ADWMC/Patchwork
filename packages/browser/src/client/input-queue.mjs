export function createInputQueue({ send, identity, onAck = () => {}, onError = () => {}, schedule = callback => setTimeout(callback, 8), cancel = clearTimeout }) {
  const inputId = globalThis.crypto.randomUUID()
  let sequence = 0, pending = [], active, running = false, scheduled, closed = false
  const rejectAll = error => { for (const item of pending.splice(0)) for (const waiter of item.waiters) waiter.reject(error) }
  async function flush() {
    scheduled = null
    if (closed || running || !pending.length) return
    running = true
    const item = active = pending.shift()
    try {
      const current = identity()
      if (!current || item.event.frameId !== current.frameId || item.event.tabId !== current.tabId) throw new Error('画面已变化，请重新操作')
      const event = { ...item.event, focusId: current.focusId }
      const result = await send({ inputId, sequence: ++sequence, events: [event] })
      if (closed) return
      if (result.failed || result.sequence !== sequence) throw new Error(result.reason ?? '输入确认失败，请重新操作')
      onAck(result)
      for (const waiter of item.waiters) waiter.resolve(result)
    } catch (error) {
      for (const waiter of item.waiters) waiter.reject(error)
      rejectAll(error); if (!closed) onError(error)
    } finally { active = null; running = false; if (!closed && pending.length) scheduled = schedule(flush) }
  }
  return {
    push(event) {
      if (closed) return Promise.reject(new Error('Input connection closed'))
      return new Promise((resolve, reject) => {
        if (pending.length >= 64) { reject(new Error('输入过快，请等待当前操作完成')); return }
        const previous = pending.at(-1), same = previous && previous.event.frameId === event.frameId && previous.event.tabId === event.tabId && previous.event.action === event.action
        let merged = false
        if (same && event.action === 'pointer' && event.phase === 'move' && previous.event.phase === 'move') { previous.event = event; merged = true }
        if (same && event.action === 'type' && previous.event.value.length + event.value.length <= 2000) { previous.event.value += event.value; merged = true }
        if (same && event.action === 'scroll' && Math.abs(previous.event.deltaY + event.deltaY) <= 2000 && Math.abs((previous.event.deltaX ?? 0) + (event.deltaX ?? 0)) <= 2000) {
          previous.event.deltaY += event.deltaY; previous.event.deltaX = (previous.event.deltaX ?? 0) + (event.deltaX ?? 0); merged = true
        }
        if (merged) previous.waiters.push({ resolve, reject }); else pending.push({ event: { ...event }, waiters: [{ resolve, reject }] })
        if (!running && !scheduled) scheduled = schedule(flush)
      })
    },
    close() { closed = true; cancel(scheduled); const error = new Error('Input connection closed'); if (active) for (const waiter of active.waiters) waiter.reject(error); rejectAll(error) },
    get pending() { return pending.length + Number(running) },
  }
}
