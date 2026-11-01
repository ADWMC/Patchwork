import { join } from 'node:path'
import { appendBoundedJsonl } from '../../logging/jsonl.mjs'
import { diagnosticData } from '../../logging/schema.mjs'

/** 审计用的追加式 JSONL。只记录事实，不参与任何决策。 */
export function ledgerPath(root) {
  return join(root, 'ledger.jsonl')
}

export async function appendLedger(root, entry, options) {
  const kind = entry.kind === 'recall' ? 'recall' : 'placeholder'
  const clean = diagnosticData({ ...entry, mechanism: 'op', event: kind === 'recall' ? 'recall' : 'packed', reason: kind === 'recall' ? 'recalled' : 'packed', sourceBytes: entry.bytes })
  await appendBoundedJsonl(ledgerPath(root), { ...clean, kind }, options)
}
