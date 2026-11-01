export const PATCHWORK_PRESET = 'patchwork'

// Use the host registry and its own scope implementation. A header, cwd,
// display name or request boolean is not proof of the current composition.
export function isPatchworkAgent(agent) {
  if (!agent?.ctx || !agent.session?.header?.id) return false
  try {
    return agent.ctx.get?.('agentPresets')?.composedPreset(agent.ctx) === PATCHWORK_PRESET
  } catch { return false }
}

export function requirePatchworkAgent(agent) {
  if (!isPatchworkAgent(agent)) throw new Error('Patchwork requires the Patchwork agent preset')
  return agent
}

export function resolvePatchworkAgent(ctx, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256) return undefined
  const agent = ctx.get?.('agents')?.get?.(sessionId)
  return agent?.session?.header?.id === sessionId && isPatchworkAgent(agent) ? agent : undefined
}
