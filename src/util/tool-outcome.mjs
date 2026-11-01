/** Tool execution success is distinct from a command's process exit status. */
export function commandFailed(result, text = '') {
  const value = result?.value
  const followup = value?.thenRun
  if (result?.isError || value?.timedOut || value?.aborted) return true
  if (Number.isInteger(value?.exitCode) && value.exitCode !== 0) return true
  if (followup?.status === 'failed') return true
  if (Number.isInteger(followup?.exitCode) && followup.exitCode !== 0) return true
  // Compatibility with rendered-only results. Inspect only the host's trailing marker.
  const marker = text.trimEnd().match(/\[exit code:\s*(-?\d+)\]$/i)
  return Boolean(marker && Number(marker[1]) !== 0)
}

/** Explicit positive process evidence; absence of failure is not success. */
export function commandOutcome(result) {
  const value = result?.value?.thenRun ?? result?.value
  const text = (result?.content ?? []).filter(b => b?.type === 'text').map(b => b.text).join('\n')
  const marker = text.trimEnd().match(/\[exit code:\s*(-?\d+)\]$/i)
  const exitCode = Number.isInteger(value?.exitCode) ? value.exitCode : marker ? Number(marker[1]) : null
  const cancelled = value?.aborted || result?.error?.code === 'ABORTED'
  return { exitCode, outcome: cancelled ? 'cancelled' : commandFailed(result, text) ? 'failed' : ['skipped', 'unverified'].includes(value?.status) ? 'unknown' : exitCode === 0 ? 'passed' : 'unknown' }
}
