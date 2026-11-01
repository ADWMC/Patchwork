import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { MECHANISM_DIR } from './config.mjs'
import { appendBoundedJsonl } from '../../logging/jsonl.mjs'
import { diagnosticData } from '../../logging/schema.mjs'

export function journalRoot(sessionId) {
  return dshHomePath('patchwork', MECHANISM_DIR, sessionId)
}

/**
 * 兼容决策账本：只追加白名单元数据，并按文件大小轮转。
 * 主诊断流由 index.mjs 写入宿主非上下文插件记录；这里保留历史文件入口，
 * 不保存完整命令或动态错误文本，也不参与压缩决策。原文 objects 单独保留。
 */
export async function appendJournal(sessionId, entry, options) {
  const root = journalRoot(sessionId)
  const clean = diagnosticData({ ...entry, mechanism: 'epr', event: 'decision', routeKind: entry.reducer?.kind,
    model: entry.reducer?.model, provider: entry.reducer?.provider, elapsedMs: entry.reducer?.elapsedMs,
    usage: entry.reducer?.usage, sourceBytes: entry.reducer?.sourceBytes, resultBytes: entry.reducer?.receiptBytes })
  await appendBoundedJsonl(join(root, 'journal.jsonl'), { ...clean, kind: entry.kind === 'applied' ? 'applied' : 'fallback' }, options)
}
