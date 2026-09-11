import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { MECHANISM_DIR } from './config.mjs'

export function journalRoot(sessionId) {
  return dshHomePath('patchwork', MECHANISM_DIR, sessionId)
}

/**
 * 决策日志：每次是否压缩、以什么原因放弃，都留一条事实。
 *
 * 与 SoL-Pi 的差异：它写进 session log 的非上下文条目；这里写会话级 JSONL。
 * 两者都不进模型上下文，区别只在于是否随会话日志一起迁移。本机制改用旁挂
 * 文件，是因为 DSH 的自定义 session 事件需要先合并进 `SessionEventMap` 才
 * 有稳定契约，而这里只做诊断。
 */
export async function appendJournal(sessionId, entry) {
  const root = journalRoot(sessionId)
  await mkdir(root, { recursive: true, mode: 0o700 })
  await appendFile(join(root, 'journal.jsonl'), `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}
