import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import { MAX_OUTPUT_TOKENS, REDUCER_TIMEOUT_MS } from './config.mjs'

export const PLUGIN_NAME = 'patchwork-agent'

/**
 * reducer 走哪条路由：配置显式给出 provider/model 时用它，否则回退到宿主的
 * 默认模型选择。凭证与 baseUrl 全部由宿主适配器管理，插件不接触。
 *
 * 用 `ctx.get()` 而不是 `ctx.agentDefaultModel`：本机制是可选开关，不该把
 * 「宿主必须有默认模型服务」变成整个插件的加载前提。
 */
export function resolveRoute(ctx, config = {}) {
  if (config?.reducerProvider && config?.reducerModel) {
    return { provider: config.reducerProvider, model: config.reducerModel }
  }
  try {
    const selection = ctx.get?.('agentDefaultModel')?.currentSelection?.()
    if (selection?.provider && selection?.model) return { provider: selection.provider, model: selection.model }
  } catch {
    // 宿主没有默认模型服务时按路由不可用处理
  }
  return undefined
}

/**
 * 发起一次独立的 reducer 模型调用。
 *
 * 两条失败路径都必须捕获：适配器/派发失败表现为**抛出**，而带内终止
 * （`finish.kind` 为 `aborted`/`error`）不会抛。只处理其中一条会让失败的
 * 调用被当成有效输出。
 */
export async function callReducer(llm, { route, system, userText, signal, sessionId }) {
  if (!llm) return { ok: false, reason: 'llm-service-unavailable' }
  if (!route) return { ok: false, reason: 'reducer-route-unavailable' }

  const timeout = AbortSignal.timeout(REDUCER_TIMEOUT_MS)
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout
  const assembler = new BlockAssembler()

  try {
    const stream = llm.stream({
      provider: route.provider,
      model: route.model,
      system,
      messages: [
        createUserMessage({
          content: [{ type: 'text', text: userText }],
          source: { kind: 'plugin', plugin: PLUGIN_NAME, form: 'notice', summary: 'Evidence-Preserving Reducer request' },
        }),
      ],
      maxTokens: MAX_OUTPUT_TOKENS,
      signal: composed,
      sessionId,
    })
    for await (const chunk of stream) assembler.push(chunk)
  } catch (error) {
    return { ok: false, reason: `model-call-exception: ${error?.message ?? error}` }
  }

  const finish = assembler.finish
  if (finish?.kind !== 'stop' && finish?.kind !== 'max-tokens') {
    return { ok: false, reason: `model-call-${finish?.kind ?? 'unknown'}` }
  }

  const text = assembler.blocks()
    .filter(block => block?.type === 'text')
    .map(block => block.text)
    .join('')
  return { ok: true, text, usage: assembler.usage, model: route.model, provider: route.provider }
}
