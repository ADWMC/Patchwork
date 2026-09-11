import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 研究账本：每个提案的判决、依据的测量与原因都写一行。
 *
 * 它存在的理由与基准测试一样：一次搜索的价值取决于能否回头核对「当时为什么
 * 留下/淘汰了它」。没有账本的搜索结果只是一组无法复核的结论。
 */
export function ledgerPath(dir) {
  return join(dir, 'ledger.jsonl')
}

export async function appendVerdict(dir, verdict) {
  await mkdir(dir, { recursive: true })
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...verdict })
  await appendFile(ledgerPath(dir), `${line}\n`, 'utf8')
}

export async function readVerdicts(dir) {
  try {
    const text = await readFile(ledgerPath(dir), 'utf8')
    return text
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line))
  } catch {
    return []
  }
}
