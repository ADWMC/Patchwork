import { buildStructureWarning, isMutationTool } from '../structure/structure-warning.mjs'
import { isSourcePath } from '../structure/structure-check.mjs'
import { record } from '../ui/mechanism-stats.mjs'
import { EVIDENCE_HINT, noteShellEvidence, sessionKey, shouldHintEvidence } from '../quality/evidence-gate.mjs'

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

function textOf(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter(block => block?.type === 'text')
    .map(block => block.text)
    .join('\n')
}

async function noticeContext(text) {
  const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
  return createUserMessage({
    content: [{ type: 'text', text }],
    // source.kind 必须是生产者自己的名字：session log v4 的写入断言直接拒绝
    // 已退役的 catch-all 'plugin'（SessionFormatError "requires a producer-owned source kind"）。
    source: { kind: 'patchwork', form: 'notice', summary: 'Patchwork notice' },
  })
}

export function registerStructureHook(ctx, config = {}) {
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    try {
      const additional = []
      noteShellEvidence(exec, result)

      if (isMutationTool(exec?.name)) {
        const cwd = exec.agent?.session?.header?.cwd
        const files = pathsIn(exec.arguments)
        if (cwd && files.length) {
          const check = await buildStructureWarning({ cwd, sessionId: exec.agent?.id, files })
          if (check.prompt) {
            record('maintenance', 'structureWarnings')
            additional.push(await noticeContext(check.prompt))
          }
        }
      }

      if (config.evidenceGate !== false && exec?.agent) {
        const key = sessionKey(exec.agent)
        const answer = textOf(result?.content)
        if (answer && shouldHintEvidence(key, answer)) {
          additional.push(await noticeContext(EVIDENCE_HINT))
        }
      }

      if (!additional.length) return decision
      return { ...decision, additionalContexts: [...(decision.additionalContexts || []), ...additional] }
    } catch {
      return decision
    }
  })
}
