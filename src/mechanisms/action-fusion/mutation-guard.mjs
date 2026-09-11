import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

/**
 * 目标内容指纹。读不到时返回 undefined：文件不存在或不可读都不构成
 * 「内容被改动」的证据，因此不阻断命令。
 */
export async function hashFile(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return undefined
  try {
    return createHash('sha256').update(await readFile(filePath)).digest('hex')
  } catch {
    return undefined
  }
}

/**
 * 命令执行前确认目标仍是改动后的那份内容。
 *
 * 同文件的本机制写入由 file-queue 串行化，所以这里主要防的是本实例之外的
 * 写入者。检出变化时跳过命令：对一份并非本次改动产出的内容跑验证，得到的
 * 证据是假的。
 */
export async function targetUnchanged(filePath, expectedHash) {
  if (expectedHash === undefined) return true
  return (await hashFile(filePath)) === expectedHash
}

/** 让出一次事件循环，给本实例之外的写入者一个暴露的机会。 */
export function yieldToHost() {
  return new Promise(resolve => setImmediate(resolve))
}
