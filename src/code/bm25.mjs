/**
 * 纯本地 BM25：代码 chunk 检索的打分内核。
 *
 * 不调用模型、不依赖 embedding——查询与文档用同一套确定性分词，排名可复现。
 * 参数取教科书值（k1=1.5、b=0.75），与社区实现一致；本文件只做分词与打分，
 * 不做任何文件读取或策略决定。
 */

const K1 = 1.5
const B = 0.75

/** ASCII 标识符（按 camel/snake 边界切分、小写化）与 CJK 单字。 */
export function tokenize(text) {
  const tokens = []
  const source = String(text ?? '')
  const ascii = source.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []
  for (const word of ascii) {
    const parts = word
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[_$\s]+/)
      .filter(Boolean)
    for (const part of parts) tokens.push(part.toLowerCase())
  }
  for (const char of source.match(/[\u4e00-\u9fff]/g) ?? []) tokens.push(char)
  return tokens
}

/** 统计文档频率、词频与文档长度，得到 BM25 所需的语料统计。 */
export function computeBM25Stats(docs) {
  const docFreq = new Map()
  const termFreq = new Map()
  const docLengths = []
  for (let docId = 0; docId < docs.length; docId++) {
    const doc = docs[docId]
    docLengths.push(doc.length)
    for (const term of doc) {
      if (!termFreq.has(term)) termFreq.set(term, new Map())
      const perDoc = termFreq.get(term)
      perDoc.set(docId, (perDoc.get(docId) ?? 0) + 1)
    }
    for (const term of new Set(doc)) docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
  }
  const totalDocs = docs.length
  const avgDocLength = totalDocs ? docLengths.reduce((sum, n) => sum + n, 0) / totalDocs : 0
  return { docFreq, termFreq, docLengths, avgDocLength, totalDocs }
}

export function bm25Score(queryTerms, docIndex, stats) {
  if (!stats.totalDocs || !stats.avgDocLength) return 0
  let score = 0
  for (const term of queryTerms) {
    const tf = stats.termFreq.get(term)?.get(docIndex) ?? 0
    if (!tf) continue
    const df = stats.docFreq.get(term) ?? 0
    const idf = Math.log((stats.totalDocs - df + 0.5) / (df + 0.5) + 1)
    const norm = tf + K1 * (1 - B + (B * stats.docLengths[docIndex]) / stats.avgDocLength)
    score += idf * ((tf * (K1 + 1)) / norm)
  }
  return score
}

/** 对一组文档按查询相关性排序，返回 [{ index, score }]（已过滤零分）。 */
export function rankDocuments(query, docs) {
  const queryTerms = [...new Set(tokenize(query))]
  if (!queryTerms.length || !docs.length) return []
  const stats = computeBM25Stats(docs.map(doc => (Array.isArray(doc) ? doc : tokenize(doc))))
  return docs
    .map((_doc, index) => ({ index, score: bm25Score(queryTerms, index, stats) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
}
