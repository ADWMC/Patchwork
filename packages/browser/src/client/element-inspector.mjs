// One request at a time; keep only the newest point and discard late responses.
export function createElementInspector({ request, onChange, delay = 65 }) {
  let timer, pending, flight, serial = 0, disposed = false
  async function run() {
    timer = undefined
    if (disposed || flight || !pending) return
    const point = pending, version = serial, controller = new AbortController()
    pending = null; flight = controller
    try {
      const result = await request(point, controller.signal)
      if (!disposed && version === serial && !controller.signal.aborted) onChange(result?.inspection ? { ...result.inspection, point } : null)
    } catch { if (!disposed && version === serial) onChange(null) }
    finally {
      if (flight === controller) flight = null
      if (!disposed && pending && !timer) timer = setTimeout(run, delay)
    }
  }
  function clear() {
    serial++; pending = null; clearTimeout(timer); timer = undefined
    flight?.abort(); onChange(null)
  }
  return {
    inspect(point) {
      if (disposed) return
      serial++; pending = point
      // Throttle rather than debounce: moving continuously must still show highlights.
      if (!timer && !flight) timer = setTimeout(run, delay)
    },
    clear,
    dispose() { disposed = true; clear() },
  }
}
