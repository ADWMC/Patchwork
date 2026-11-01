// Browser access is independent of Patchwork. A grant belongs to one live
// Agent composition and is never inferred from a request flag or session title.
const grants = globalThis[Symbol.for('@patchwork/browser/access/v1')] ??= new WeakMap()

export function browserPreset(agent) {
  try { return agent?.ctx?.get?.('agentPresets')?.composedPreset(agent.ctx) } catch { return undefined }
}

export function grantBrowserAccess(agent) {
  const preset = browserPreset(agent)
  if (!agent?.session?.header?.id || typeof preset !== 'string' || !preset) throw new Error('Browser access requires a live agent composition')
  const grant = { ctx: agent.ctx, sessionId: agent.session.header.id, cwd: agent.session.header.cwd ?? agent.session.meta?.cwd, preset }
  grants.set(agent, grant)
  return () => { if (grants.get(agent) === grant) grants.delete(agent) }
}

export function isBrowserAgent(agent) {
  const grant = agent && grants.get(agent)
  return Boolean(grant && grant.ctx === agent.ctx && grant.sessionId === agent.session?.header?.id && grant.cwd === (agent.session?.header?.cwd ?? agent.session?.meta?.cwd) && grant.preset === browserPreset(agent))
}

export function requireBrowserAgent(agent) {
  if (!isBrowserAgent(agent)) throw new Error('Session browser access is not authorized or its agent composition changed')
  return agent
}

export function resolveBrowserAgent(ctx, id, { authorized = true } = {}) {
  if (typeof id !== 'string' || !id || id.length > 256) return undefined
  const agent = ctx.get?.('agents')?.get?.(id)
  if (agent?.session?.header?.id !== id || !browserPreset(agent)) return undefined
  return !authorized || isBrowserAgent(agent) ? agent : undefined
}
