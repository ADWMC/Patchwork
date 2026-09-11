import { createHash } from 'node:crypto'

export { contentHashOf } from '../../util/content-archive.mjs'

export const HANDLE_PREFIX = 'obs_'
export const HANDLE_PATTERN = /^obs_[a-f0-9]{24}$/

/** 超过这个字节数的纯文本工具结果才值得打包。与 SoL-Pi 的阈值一致。 */
export const MIN_PACK_BYTES = 10 * 1024

/** 单次召回的上限：留出余量，避免召回本身又变成一个巨型观察。 */
export const RECALL_MAX_BYTES = 15 * 1024
export const RECALL_MAX_LINES = 400

/** 占位符里保留的开头字节数，让模型不必为「刚看过的东西」多跑一次召回。 */
export const EXCERPT_BYTES = 512

export function isTextOnly(content) {
  if (!Array.isArray(content) || content.length === 0) return false
  return content.every(block => block?.type === 'text' && typeof block.text === 'string')
}

export function textOf(content) {
  return content.map(block => block.text).join('\n')
}

/**
 * 内容寻址的句柄：同一 (工具, 调用, 内容) 永远得到同一个句柄，
 * 因此重复出现的同一份内容可以稳定复用同一个归档对象。
 */
export function handleFor(toolName, callId, contentHash) {
  const digest = createHash('sha256').update(`${toolName}\u0000${callId}\u0000${contentHash}`).digest('hex')
  return `${HANDLE_PREFIX}${digest.slice(0, 24)}`
}

/** 只有成功、纯文本、且足够大的结果才打包；其余一律保持原样。 */
export function shouldPack({ isError, content, byteLength }) {
  if (isError) return false
  if (!Number.isFinite(byteLength) || byteLength <= MIN_PACK_BYTES) return false
  return isTextOnly(content)
}

export function countLines(buffer) {
  let lines = 1
  for (const byte of buffer) if (byte === 0x0a) lines += 1
  return lines
}

export function placeholderText({ handle, byteLength, lineCount, excerpt }) {
  return [
    `[observation-pack] ${handle}`,
    `${byteLength} bytes, ${lineCount} lines. The full content is archived and is not replayed; recall it exactly with obs_recall.`,
    `obs_recall(id="${handle}", offset=N) returns a byte-exact page and the next offset.`,
    '',
    '--- head excerpt ---',
    excerpt,
    '--- end excerpt ---',
  ].join('\n')
}

/**
 * 按字节切页，并保证把各页按顺序拼回就是原文。
 *
 * 两条不变量：`nextOffset` 恰好等于本页实际返回的最后一个字节的下一个位置
 * （因此不丢字节、不重叠）；切点不落在多字节 UTF-8 序列中间（因此不会产生
 * 替换字符）。行边界回退只是可读性优化，若会切掉半页以上就放弃。
 */
export function pageText(buffer, offset, { maxBytes = RECALL_MAX_BYTES, maxLines = RECALL_MAX_LINES } = {}) {
  const start = Math.max(0, Math.min(Math.trunc(offset) || 0, buffer.length))
  if (start >= buffer.length) return { chunk: '', nextOffset: buffer.length, done: true }

  let end = Math.min(buffer.length, start + maxBytes)
  end = cutAtLineLimit(buffer, start, end, maxLines)
  end = trimIncompleteUtf8(buffer, start, end)
  // 预算小于一个多字节字符时，回退会把切点退回到起点。宁可让这一页超出预算，
  // 也必须前进一个完整字符：零长度页会让按 offset 迭代的调用方永不终止。
  if (end === start) end = nextCharBoundary(buffer, start)

  const chunk = buffer.subarray(start, end).toString('utf8')
  return { chunk, nextOffset: end, done: end >= buffer.length }
}

function nextCharBoundary(buffer, position) {
  let index = Math.min(buffer.length, position + 1)
  while (index < buffer.length && (buffer[index] & 0b1100_0000) === 0b1000_0000) index += 1
  return index
}

function trimIncompleteUtf8(buffer, start, end) {
  let cut = end
  while (cut > start && (buffer[cut] & 0b1100_0000) === 0b1000_0000) cut -= 1
  return cut
}

function cutAtLineLimit(buffer, start, end, maxLines) {
  let lines = 0
  let lastNewline = -1
  for (let index = start; index < end; index += 1) {
    if (buffer[index] !== 0x0a) continue
    lines += 1
    lastNewline = index
    if (lines >= maxLines) return index + 1
  }
  // 未触发行数上限时，只有当最后一个换行落在后半页才回退，避免产出过短的页。
  if (lastNewline > start + Math.floor((end - start) / 2)) return lastNewline + 1
  return end
}
