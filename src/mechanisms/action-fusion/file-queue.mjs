import { resolve } from 'node:path'

/**
 * 每个文件一条串行链。同一文件的「改动 + 跟进命令」整体占一个临界区，
 * 使并发派发的 fused 调用不会互相插进对方的命令执行中间。
 *
 * 键按解析后的绝对路径归一（Windows 大小写不敏感）。不解析符号链接：
 * 目标文件在写之前可能并不存在，realpath 无法提供稳定键。
 */
const tails = new Map()

function queueKey(filePath) {
  const absolute = resolve(filePath)
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute
}

export async function withFileQueue(filePath, task) {
  if (typeof filePath !== 'string' || filePath === '') return task()

  const key = queueKey(filePath)
  const previous = tails.get(key) ?? Promise.resolve()
  let release
  const gate = new Promise(resolveGate => { release = resolveGate })
  const tail = previous.then(() => gate)
  tails.set(key, tail)

  await previous
  try {
    return await task()
  } finally {
    release()
    // 只有在没有后来者接管时才清理，避免表随文件数无界增长。
    if (tails.get(key) === tail) tails.delete(key)
  }
}
