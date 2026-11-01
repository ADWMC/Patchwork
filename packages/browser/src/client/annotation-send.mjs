// Resolve only the selected session's native conversation capability.
export function annotationSender(ctx, sessionId) {
  if (!sessionId) return undefined
  const scoped = ctx.sessions.scope?.(sessionId)
  const conversation = scoped?.get?.('conversation')
  if (typeof conversation?.send !== 'function') return undefined
  return text => conversation.send(text)
}
