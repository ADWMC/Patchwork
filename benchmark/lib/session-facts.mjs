/**
 * 把会话日志事件折成**事实**：每个模型请求的 provider usage、每次工具调用的
 * 名称与命令、每个工具结果的字节数。
 *
 * 纯函数，不碰 IO，也不做任何推断——反事实推导在 counterfactual.mjs。
 */
export function parseEvents(text) {
  const events = []
  for (const line of String(text).split('\n')) {
    if (!line) continue
    try {
      events.push(JSON.parse(line))
    } catch {
      // 单行损坏不应丢掉整个会话；eventCount 与请求数的差异会暴露它
    }
  }
  return events
}

export function extractFacts(events, estimate) {
  const calls = new Map()
  const requests = []
  const results = []

  for (const event of events) {
    const data = event.data ?? {}
    if (event.type === 'assistant/message' && data.usage) {
      requests.push({
        seq: event.seq,
        turn: data.turn,
        step: data.step,
        inputTokens: numberOr0(data.usage.inputTokens),
        outputTokens: numberOr0(data.usage.outputTokens),
        totalTokens: numberOr0(data.usage.totalTokens),
        cacheReadTokens: numberOr0(data.usage.cacheReadTokens),
        reasoningTokens: numberOr0(data.usage.reasoningTokens),
      })
      continue
    }

    if (event.type === 'tool/call') {
      let args = {}
      try {
        args = JSON.parse(data.arguments ?? '{}')
      } catch {
        args = {}
      }
      calls.set(data.callId, {
        name: data.name,
        command: typeof args.command === 'string' ? args.command : undefined,
        target: typeof args.file_path === 'string' ? args.file_path : undefined,
      })
      continue
    }

    if (event.type === 'tool/result') {
      const callId = data.message?.source?.callId
      const call = calls.get(callId)
      const text = collectText(data.message?.content)
      results.push({
        seq: event.seq,
        turn: data.turn,
        step: data.step,
        callId,
        toolName: call?.name ?? null,
        command: call?.command ?? null,
        isError: readIsError(data.message?.content),
        bytes: Buffer.byteLength(text, 'utf8'),
        // token 一律来自宿主估算器；没有它就记 null，分析侧不得假装知道。
        tokens: estimate ? estimate(text) : null,
      })
    }
  }

  return { requests, results }
}

function collectText(content) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block?.type === 'tool-result' && Array.isArray(block.content)) {
      for (const inner of block.content) {
        if (inner?.type === 'text' && typeof inner.text === 'string') parts.push(inner.text)
      }
    } else if (block?.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text)
    }
  }
  return parts.join('\n')
}

function readIsError(content) {
  if (!Array.isArray(content)) return false
  for (const block of content) {
    if (block?.type === 'tool-result' && block.isError === true) return true
  }
  return false
}

function numberOr0(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}
