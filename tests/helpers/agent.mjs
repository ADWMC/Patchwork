// Explicit host-registry fixture. Tests must opt into Patchwork; absent or
// forged session metadata never grants the capability.
export function scopedAgent(agent = {}, preset = 'patchwork') {
  const ctx = agent.ctx ?? {}
  const originalGet = ctx.get?.bind(ctx)
  let current = preset
  const registry = { composedPreset: candidate => candidate === ctx ? current : undefined }
  ctx.get = name => name === 'agentPresets' ? registry : originalGet?.(name)
  agent.ctx = ctx
  agent.session ??= { header: { id: 'fixture-session' } }
  agent.session.header.id ??= agent.id ?? 'fixture-session'
  return Object.assign(agent, { selectPreset: value => { current = value } })
}
