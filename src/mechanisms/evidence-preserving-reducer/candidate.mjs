import {
  DIAGNOSTIC_COMMAND,
  LIKELY_SECRET,
  MAX_CHARS,
  MIN_BYTES,
  RECEIPT_MARKER,
} from './config.mjs'
import { HANDLE_PREFIX } from '../observation-pack/observation.mjs'

const SHELL_TOOLS = new Set(['bash', 'pwsh'])

function isTextOnly(content) {
  if (!Array.isArray(content) || content.length === 0) return false
  return content.every(block => block?.type === 'text' && typeof block.text === 'string')
}

function textOf(content) {
  return content.map(block => block.text).join('\n')
}

/**
 * 判定一次工具结果是否是可约简的诊断日志。
 * 返回 `{ok:true, command, body}` 或 `{ok:false, reason}`——原因会进判断日志，
 * 因此「为什么没压缩」永远可回答。
 */
export function reducibleLog(exec, result, contentOverride) {
  if (!SHELL_TOOLS.has(exec?.name)) return { ok: false, reason: 'not-a-shell-tool' }

  const command = typeof exec?.arguments?.command === 'string' ? exec.arguments.command : ''
  if (command.trim() === '' || !DIAGNOSTIC_COMMAND.test(command)) return { ok: false, reason: 'not-a-diagnostic-command' }

  const content = contentOverride ?? result?.content
  if (!isTextOnly(content)) return { ok: false, reason: 'not-plain-text' }

  const body = textOf(content)
  if (body.startsWith(RECEIPT_MARKER) || body.startsWith(HANDLE_PREFIX)) {
    return { ok: false, reason: 'already-reduced' }
  }
  if (body.length > MAX_CHARS) return { ok: false, reason: 'source-over-max-chars' }

  const bytes = Buffer.byteLength(body, 'utf8')
  if (bytes < MIN_BYTES) return { ok: false, reason: 'below-threshold' }

  // 疑似密钥一律不外发。这是预防而不是完整的密钥扫描器。
  if (LIKELY_SECRET.test(body)) return { ok: false, reason: 'likely-secret' }

  return { ok: true, command, body }
}
