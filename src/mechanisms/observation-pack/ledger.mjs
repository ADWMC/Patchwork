import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/** 审计用的追加式 JSONL。只记录事实，不参与任何决策。 */
export function ledgerPath(root) {
  return join(root, 'ledger.jsonl')
}

export async function appendLedger(root, entry) {
  await mkdir(root, { recursive: true, mode: 0o700 })
  await appendFile(ledgerPath(root), `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}
