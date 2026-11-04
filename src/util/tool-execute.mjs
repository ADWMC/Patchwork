/**
 * DSH 0.2.1-rc.* exposes `tools.execute(exec)` for one typed call.
 * DSH 0.2.2-alpha.* changed it to a batch API:
 * `tools.execute({ calls, agent, signal }) -> { results: [{ callId, result }] }`.
 *
 * Patchwork owns follow-up calls (acceptance checks and fused shell commands),
 * so it needs one wrapper instead of two runtime branches at every call site.
 */
export function usesBatchToolExecution(tools) {
  return typeof tools?.selectExecutor === 'function'
}

export async function executeTool(tools, call) {
  if (!usesBatchToolExecution(tools)) return tools.execute(call)

  const callId = call.callId ?? call.name
  const batch = await tools.execute({
    calls: [{ id: callId, name: call.name, arguments: JSON.stringify(call.arguments ?? {}) }],
    ...(call.agent === undefined ? {} : { agent: call.agent }),
    signal: call.signal ?? new AbortController().signal,
  })
  const settled = batch?.results?.find(item => item.callId === callId) ?? batch?.results?.[0]
  if (!settled?.result) throw new Error(`tool batch returned no result for ${call.name}`)
  return settled.result
}
