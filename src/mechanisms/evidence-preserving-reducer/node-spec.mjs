import { MAX_EVIDENCE_ITEMS, MAX_QUOTE_CHARS, RECEIPT_SCHEMA } from './config.mjs'

/**
 * Lossless failure-section extraction for Node's spec reporter. Every failure
 * block and the complete numeric summary must fit; otherwise use the reducer.
 * No diagnosis is generated here, and unfamiliar formats are left alone.
 */
export function nodeSpecReceipt({ command, body, sourceHash, isError }) {
  if (!isError || !/(?:^|\s)node(?:\.exe)?\s/.test(command)) return undefined
  const summary = /^ℹ tests \d+\r?\n[\s\S]*?(?=^✖ failing tests:)/m.exec(body)
  const marker = /^✖ failing tests:\r?$/m.exec(body)
  const failed = summary && /^ℹ fail (\d+)\r?$/m.exec(summary[0])
  if (!summary || !marker || !failed || Number(failed[1]) < 1) return undefined
  const section = body.slice(marker.index)
  if ((section.match(/^test at /gm) ?? []).length !== Number(failed[1])) return undefined
  const summaryQuotes = exactChunks(summary[0])
  const failureQuotes = exactChunks(section)
  if (!summaryQuotes || !failureQuotes || summaryQuotes.length + failureQuotes.length > MAX_EVIDENCE_ITEMS) return undefined
  return {
    schema: RECEIPT_SCHEMA,
    source_sha256: sourceHash,
    status: 'Node.js tests failed; complete failure section retained',
    uncertain: false,
    evidence: [
      ...summaryQuotes.map(quote => ({ kind: 'summary', quote })),
      ...failureQuotes.map(quote => ({ kind: 'failure', quote })),
    ],
  }
}

function exactChunks(text) {
  const chunks = []
  let current = ''
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    if (line.length > MAX_QUOTE_CHARS) return undefined
    if (current.length + line.length > MAX_QUOTE_CHARS) {
      chunks.push(current)
      current = ''
    }
    current += line
  }
  if (current) chunks.push(current)
  return chunks.join('') === text ? chunks : undefined
}
