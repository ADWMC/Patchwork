import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { readObject, writeObject } from '../../util/content-archive.mjs'
import { record } from '../../ui/mechanism-stats.mjs'
import { appendLedger } from './ledger.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../../scope.mjs'
import { commandFailed } from '../../util/tool-outcome.mjs'
import { tailText } from './observation.mjs'
import { logDiagnostic } from '../../logging/session-log.mjs'
import {
  EXCERPT_BYTES,
  HANDLE_PATTERN,
  RECALL_MAX_BYTES,
  contentHashOf,
  countLines,
  handleFor,
  isTextOnly,
  pageText,
  placeholderText,
  shouldPack,
  textOf,
} from './observation.mjs'

export const RECALL_TOOL_NAME = 'obs_recall'

/**
 * 归档落在宿主自己的用户数据根下，因此尊重 `$DSH_HOME`，不硬编码绝对路径。
 * 每个会话一个目录，会话之间互不可见。
 */
export function sessionRoot(sessionId) {
  return dshHomePath('patchwork', 'observation-pack', sessionId)
}

function sessionIdOf(agent) {
  const id = agent?.session?.header?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/** Process-local handle index for the session panel; full content stays on disk. */
const observationViews = new WeakMap()
function observationView(agent) {
  if (!agent?.session) return undefined
  if (!observationViews.has(agent.session)) observationViews.set(agent.session, new Map())
  return observationViews.get(agent.session)
}
export function observationSnapshot(agent) {
  if (!isPatchworkAgent(agent)) return []
  const view = observationView(agent)
  if (!view) return []
  return [...view.values()].slice(-50).reverse()
}

/**
 * 注册 ObservationPack：把超大纯文本结果换成内容寻址句柄，原文归档，
 * 再由 `obs_recall` 按字节精确召回。
 *
 * 只改变模型侧投影，规范值（程序可见的 `value`）保持不动。任何一步失败都
 * 原样返回上游决定：观察证据不能因为本机制出错而丢失。
 */
export function registerObservationPack(ctx) {
  registerRecallTool(ctx)

  ctx.on('tools/post-execute', async (exec, result, next) => {
    // 先让下游（含原生 dsh-spill-policy 的 prepend 监听器）完成，再变换结果，
    // 这样两者是组合关系而不是互相覆盖。
    const decision = await next()
    if (!isPatchworkAgent(exec?.agent)) return decision
    try {
      return await replaceWithHandle(ctx, exec, result, decision)
    } catch (error) {
      logDiagnostic(ctx, exec, { mechanism: 'op', event: 'failure', level: 'warn', reason: 'archive-failed', error })
      return decision
    }
  })
}

async function replaceWithHandle(ctx, exec, result, decision) {
  if (decision.kind !== 'accept') return decision
  // Recall is already bounded and must reach the model verbatim. Packing it
  // again would replace the requested page with another handle indefinitely.
  if (exec.name === RECALL_TOOL_NAME) return decision
  // A bounded recovery snapshot is operational context, not a bulk observation.
  // In particular, UTF-16-bounded Chinese text can exceed the byte threshold.
  if (exec.name === 'patchwork_task' && exec.arguments?.action === 'handoff') return decision
  const sessionId = sessionIdOf(exec.agent)
  if (!sessionId) return decision

  const content = decision.content ?? result.content
  if (!isTextOnly(content)) return decision

  const body = textOf(content)
  const buffer = Buffer.from(body, 'utf8')
  if (!shouldPack({ isError: commandFailed(result, body), content, byteLength: buffer.length })) return decision

  const handle = handleFor(exec.name, exec.callId, contentHashOf(body))
  const root = sessionRoot(sessionId)
  await writeObject(root, handle, body)
  const lineCount = countLines(buffer)
  if (!isPatchworkAgent(exec.agent)) return decision
  try { await appendLedger(root, {
    kind: 'placeholder',
    handle,
    tool: exec.name,
    callId: exec.callId,
    rootCallId: exec.rootCallId ?? exec.callId,
    bytes: buffer.length,
    lines: lineCount,
  }, { authorize: () => isPatchworkAgent(exec.agent) }) } catch (error) {
    logDiagnostic(ctx, exec, { mechanism: 'op', event: 'failure', level: 'warn', reason: 'state-update-failed', error })
  }
  if (!isPatchworkAgent(exec.agent)) return decision
  logDiagnostic(ctx, exec, { mechanism: 'op', event: 'packed', reason: 'packed', handle, source: contentHashOf(body), sourceBytes: buffer.length, lines: lineCount })
  const view = observationView(exec.agent)
  if (view) {
    view.set(handle, { handle, tool: exec.name, callId: exec.callId, bytes: buffer.length, lines: lineCount, at: new Date().toISOString(), head: pageText(buffer, 0, { maxBytes: EXCERPT_BYTES }).chunk })
    if (view.size > 50) view.delete(view.keys().next().value)
  }
  record('observationPack', 'packedResults')
  record('observationPack', 'packedBytes', buffer.length)

  return {
    ...decision,
    content: [
      {
        type: 'text',
        text: placeholderText({
          handle,
          byteLength: buffer.length,
          lineCount,
          excerpt: pageText(buffer, 0, { maxBytes: EXCERPT_BYTES }).chunk,
          tailExcerpt: tailText(buffer),
        }),
      },
    ],
  }
}

function registerRecallTool(ctx) {
  ctx.tools.register({
    name: RECALL_TOOL_NAME,
    description:
      'Recall an exact page of a large tool result that was archived behind an observation handle. Returns the requested byte range verbatim plus the offset to continue from. Set maxBytes for a smaller bounded page.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The obs_ handle shown in the placeholder.' },
        offset: { type: 'number', description: 'Byte offset to start from; omit or 0 for the beginning.' },
        maxBytes: { type: 'number', description: `Optional byte limit for this page, bounded 1..${RECALL_MAX_BYTES}; omit for the normal page.` },
      },
      required: ['id'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          offset: { type: 'number' },
          nextOffset: { type: 'number' },
          done: { type: 'boolean' },
          chunk: { type: 'string' },
        },
        required: ['id', 'offset', 'nextOffset', 'done', 'chunk'],
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: renderPage(value) }],
    },
    async execute(args, exec) {
      requirePatchworkAgent(exec?.agent)
      const sessionId = sessionIdOf(exec.agent)
      if (!sessionId) throw new Error('obs_recall requires a session')

      const id = String(args?.id ?? '')
      if (!HANDLE_PATTERN.test(id)) throw new Error(`not an observation handle: ${id}`)
      const offset = Number.isFinite(args?.offset) ? Math.max(0, Math.trunc(args.offset)) : 0
      const maxBytes = Number.isFinite(args?.maxBytes) ? Math.max(1, Math.min(RECALL_MAX_BYTES, Math.trunc(args.maxBytes))) : RECALL_MAX_BYTES

      const buffer = await readObject(sessionRoot(sessionId), id)
      requirePatchworkAgent(exec.agent)
      const page = pageText(buffer, offset, { maxBytes })
      try { await appendLedger(sessionRoot(sessionId), { kind: 'recall', handle: id, offset, nextOffset: page.nextOffset, callId: exec.callId, rootCallId: exec.rootCallId ?? exec.callId }, { authorize: () => isPatchworkAgent(exec.agent) }) }
      catch (error) { logDiagnostic(ctx, exec, { mechanism: 'op', event: 'failure', level: 'warn', reason: 'state-update-failed', error }) }
      requirePatchworkAgent(exec.agent)
      logDiagnostic(ctx, exec, { mechanism: 'op', event: 'recall', reason: 'recalled', handle: id, offset, nextOffset: page.nextOffset, resultBytes: Buffer.byteLength(page.chunk) })
      const view = observationView(exec.agent)
      const item = view?.get(id)
      if (item) item.recalledAt = new Date().toISOString()
      return { id, offset, nextOffset: page.nextOffset, done: page.done, chunk: page.chunk }
    },
  })
}

function renderPage(value) {
  if (value.done) return value.chunk === '' ? '[observation-pack] end of archived content' : value.chunk
  return `${value.chunk}\n\n[observation-pack] more remains; recall again with offset=${value.nextOffset}`
}
