import { readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { rankDocuments } from './bm25.mjs'
import { isSensitivePath } from './code-index.mjs'

/**
 * 排序 chunk 检索：把工作区源文件切成定行块，用 BM25 按查询相关性排序。
 *
 * 与 map/find/search 的分工：那三个回答“有什么、在哪、被谁引用”，这一个回答
 * “哪一段代码和这个问题最相关”。纯本地、无模型、无 embedding；块首行号与所在
 * 符号一并返回，模型可用 read 按跨度取全文。测试与生成文件不参与（与 map 同规则）。
 */

export const CHUNK_DEFAULTS = Object.freeze({
  lines: 40,
  maxResults: 8,
  maxFiles: 400,
  maxFileBytes: 262144,
  previewChars: 400,
})

function normalizeRel(value) {
  return String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
}

function candidateFiles(index, { path, glob }) {
  const pattern = glob ? new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i') : null
  const focus = path ? normalizeRel(path).toLowerCase() : ''
  return index.files
    .filter(file => !file.test && !file.generated && !isSensitivePath(file.path))
    .filter(file => (focus ? file.path.toLowerCase().includes(focus) : true) && (pattern ? pattern.test(file.path) : true))
    .slice(0, CHUNK_DEFAULTS.maxFiles)
}

function splitChunks(text, lines) {
  const all = String(text ?? '').split(/\r?\n/)
  const chunks = []
  for (let start = 0; start < all.length; start += lines) {
    const slice = all.slice(start, start + lines)
    if (slice.some(line => line.trim())) chunks.push({ startLine: start + 1, endLine: start + slice.length, text: slice.join('\n') })
  }
  return chunks
}

function enclosingSymbol(file, startLine, endLine, queryTerms = []) {
  const inRange = (file?.symbols ?? [])
    .filter(symbol => symbol.line <= endLine && (symbol.endLine ?? symbol.line) >= startLine)
  if (!inRange.length) return undefined
  // 查询词命中的符号优先；否则取块内第一个，保证确定性。
  const terms = new Set(queryTerms)
  return inRange
    .map(symbol => ({ symbol, hit: [...terms].some(term => symbol.name.toLowerCase().includes(term)) ? 0 : 1 }))
    .sort((a, b) => a.hit - b.hit || a.symbol.line - b.symbol.line)[0].symbol
}

/**
 * 检索与 query 最相关的代码块。返回按 BM25 降序的块列表；零命中返回空数组，
 * 读取失败的文件按跳过处理（检索是增强，不是关卡）。
 */
export async function searchChunks({ cwd, index, query, maxResults = CHUNK_DEFAULTS.maxResults, path, glob } = {}) {
  const question = String(query ?? '').trim()
  if (!question) throw new Error('chunks requires a query')
  const limit = Math.max(1, Math.min(20, Math.trunc(Number(maxResults) || CHUNK_DEFAULTS.maxResults)))
  const candidates = candidateFiles(index, { path, glob })
  const docs = []
  const meta = []
  for (const file of candidates) {
    const absolute = isAbsolute(file.path) ? file.path : join(index.root, file.path)
    let text
    try {
      if (Number(file.size ?? 0) > CHUNK_DEFAULTS.maxFileBytes) continue
      text = await readFile(absolute, 'utf8')
    } catch { continue }
    if (Buffer.byteLength(text, 'utf8') > CHUNK_DEFAULTS.maxFileBytes) continue
    for (const chunk of splitChunks(text, CHUNK_DEFAULTS.lines)) {
      docs.push(chunk.text)
      meta.push({ file, chunk })
    }
    if (docs.length > 4000) break
  }
  const ranked = rankDocuments(question, docs).slice(0, limit)
  // index 里的 path 已是 root 相对路径，只需统一分隔符。
  const rel = value => normalizeRel(value)
  return ranked.map(({ index: docIndex, score }) => {
    const { file, chunk } = meta[docIndex]
    const symbol = enclosingSymbol(file, chunk.startLine, chunk.endLine, [...new Set(question.toLowerCase().match(/[a-z0-9_]+/g) ?? [])])
    const preview = chunk.text.replace(/\s+\n/g, '\n').trim().slice(0, CHUNK_DEFAULTS.previewChars)
    return {
      path: rel(file.path),
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      score: Math.round(score * 1000) / 1000,
      enclosingSymbol: symbol ? `${symbol.name}@${symbol.line}` : null,
      preview: preview.length < chunk.text.trim().length ? `${preview}…` : preview,
    }
  })
}
