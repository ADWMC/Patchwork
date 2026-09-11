import { Service } from '@deepseek-ai/cordis'

/**
 * Test-only 的脚本化模型服务，扮演一个**守规矩的 reducer**：它真的去读请求里
 * 的 `<untrusted_log>` 块与 `source_sha256`，再据此产出一份引用确实来自原文的
 * 收据。
 *
 * 这样 mock 掉的是「非确定性的模型」，而请求组装、哈希串接、收据校验与投影
 * 全部走真实代码——符合 plugin-test 对脚本化模型的要求。
 */
class ScriptedLlm extends Service {
  constructor(ctx) {
    super(ctx, 'llm')
    this.calls = []
  }

  stream(options) {
    this.calls.push({ provider: options.provider, model: options.model, system: options.system, messages: options.messages })
    const prompt = textOf(options.messages)
    const log = between(prompt, '<untrusted_log>', '</untrusted_log>')
    const sourceHash = /source_sha256:\s*([0-9a-f]{64})/i.exec(prompt)?.[1] ?? 'missing'
    const quote = firstQuotableLine(log)

    const receipt = JSON.stringify({
      schema: 'sol-pi-evidence-receipt/1',
      source_sha256: sourceHash,
      status: 'scripted reduction',
      uncertain: false,
      evidence: [{ kind: 'failure', quote }],
    })

    const self = this
    return (async function* generate() {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: receipt }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: receipt } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      self.lastReceipt = receipt
    })()
  }
}

function textOf(messages) {
  const blocks = messages?.[0]?.content
  if (typeof blocks === 'string') return blocks
  if (!Array.isArray(blocks)) return ''
  return blocks.map(block => (block?.type === 'text' ? block.text : '')).join('\n')
}

function between(text, open, close) {
  const start = text.indexOf(open)
  const end = text.lastIndexOf(close)
  if (start < 0 || end <= start) return ''
  return text.slice(start + open.length, end)
}

/** 第一行非空且长度合规的文本，保证它是原文的真子串。 */
function firstQuotableLine(log) {
  for (const line of log.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length >= 4 && trimmed.length <= 600) return trimmed
  }
  return log.slice(0, 40)
}

export const name = 'scripted-llm'
export const provide = 'llm'

let instance

export function apply(ctx) {
  instance = new ScriptedLlm(ctx)
}

/** 供测试断言脚本化模型实际收到了什么。 */
export function scriptedLlm() {
  return instance
}
