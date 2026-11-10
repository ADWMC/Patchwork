/** Combine a caller signal with a bounded timeout. */
export function combinedSignal(signal, timeoutMs, { min = 1000, max = 30000, fallback = 15000 } = {}) {
  const timeout = AbortSignal.timeout(Math.max(min, Math.min(max, Math.trunc(Number(timeoutMs) || fallback))))
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}
