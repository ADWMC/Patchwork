import { inspectStructure, isSourcePath } from './structure-hook.mjs'

function pathsIn(value, result = []) {
  if (typeof value === 'string' && isSourcePath(value) && (value.includes('/') || value.includes('\\') || /^\.?\.?[\\/]/.test(value))) result.push(value)
  else if (Array.isArray(value)) value.forEach(item => pathsIn(item, result))
  else if (value && typeof value === 'object') Object.values(value).forEach(item => pathsIn(item, result))
  return [...new Set(result)]
}

async function warningContext(text) {
  const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'patchwork-agent', form: 'notice', summary: 'Patchwork structure warning' },
  })
}

export function registerPostExecuteHook(ctx) {
  ctx.on?.('tools/post-execute', async (exec, _result, next) => {
    const decision = await next()
    try {
      const cwd = exec.agent?.session?.header?.cwd
      const files = pathsIn(exec.arguments)
      if (!cwd || !files.length) return decision
      const check = await inspectStructure({ cwd, sessionId: exec.agent?.id, files })
      if (!check.prompt) return decision
      const context = await warningContext(check.prompt)
      return { ...decision, additionalContexts: [...(decision.additionalContexts || []), context] }
    } catch {
      return decision
    }
  })
}
