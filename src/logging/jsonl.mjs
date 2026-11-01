import { mkdir, stat, rename, rm, appendFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const JOURNAL_MAX_BYTES = 256 * 1024
const pending = new Map()

/** Bounded compatibility metadata only; never rotates/deletes evidence objects. */
export function appendBoundedJsonl(path, data, { maxBytes = JOURNAL_MAX_BYTES, authorize = () => true } = {}) {
  const work = (pending.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (!authorize()) return
    const line = JSON.stringify({ ...data, timestamp: new Date().toISOString() }) + '\n'
    if (Buffer.byteLength(line) > maxBytes) throw new Error('diagnostic-record-too-large')
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    let bytes = 0
    try { bytes = (await stat(path)).size } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (!authorize()) return
    if (bytes + Buffer.byteLength(line) > maxBytes) {
      await rm(`${path}.1`, { force: true })
      if (!authorize()) return
      await rename(path, `${path}.1`)
    }
    if (!authorize()) return
    await appendFile(path, line, { encoding: 'utf8', mode: 0o600 })
  })
  pending.set(path, work)
  void work.finally(() => { if (pending.get(path) === work) pending.delete(path) }).catch(() => {})
  return work
}
