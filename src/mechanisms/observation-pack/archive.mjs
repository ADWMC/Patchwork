import { mkdir, open, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

/** 归档根下的对象目录。会话之间互相隔离。 */
export function objectsDir(root) {
  return join(root, 'objects')
}

export function objectPath(root, handle) {
  return join(objectsDir(root), `${handle}.txt`)
}

function hashOf(body) {
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

/**
 * 写入归档对象，独占创建。
 *
 * fail-closed：同名对象已存在时**必须**逐字节一致才复用，否则抛错。句柄是
 * 内容寻址的，所以不一致只可能来自损坏或被替换的归档——这时宁可失败，
 * 也不能把错的原文当成证据交出去。
 */
export async function writeObject(root, handle, body) {
  const dir = objectsDir(root)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const path = objectPath(root, handle)
  const expected = hashOf(body)

  let file
  try {
    file = await open(path, 'wx', 0o600)
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    const existing = await readFile(path, 'utf8')
    if (existing !== body) {
      throw new Error(`observation-pack archive mismatch for ${handle}: refusing to reuse a different payload`)
    }
    return { path, hash: expected, reused: true }
  }

  try {
    await file.writeFile(body, 'utf8')
  } finally {
    await file.close()
  }
  return { path, hash: expected, reused: false }
}

/** 读出归档对象的原始字节，供按偏移召回使用。 */
export async function readObject(root, handle) {
  return readFile(objectPath(root, handle))
}
