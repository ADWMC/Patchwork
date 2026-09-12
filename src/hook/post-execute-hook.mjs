import { buildStructureWarning, isMutationTool } from '../structure/structure-warning.mjs'
import { isSourcePath } from '../structure/structure-check.mjs'
import { record } from '../ui/mechanism-stats.mjs'

/**
 * 只从「会改动文件」的工具参数里取路径。读取不属于结构检查的范围：
 * 读一个第三方大文件不应产生「请拆分文件」的建议。
 */
function pathsIn(value, result = []) {
  if (typeof value === 'string' && isSourcePath(value) && (value.includes('/') || value.includes('\\'))) result.push(value)
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

export function registerStructureHook(ctx) {
  ctx.on('tools/post-execute', async (exec, _result, next) => {
    const decision = await next()
    try {
      if (!isMutationTool(exec?.name)) return decision
      const cwd = exec.agent?.session?.header?.cwd
      const files = pathsIn(exec.arguments)
      if (!cwd || !files.length) return decision
      const check = await buildStructureWarning({ cwd, sessionId: exec.agent?.id, files })
      if (!check.prompt) return decision
      // 面板第三屏的「维护提醒」计数：告警内容只进会话上下文，这里只留一个可数的事实。
      record('maintenance', 'structureWarnings')
      const context = await warningContext(check.prompt)
      return { ...decision, additionalContexts: [...(decision.additionalContexts || []), context] }
    } catch {
      return decision
    }
  })
}
