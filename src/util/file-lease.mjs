import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rm, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'

// Owner-checked process lease. Never remove the name a newer owner can acquire.
export async function acquireFileLease(path, { check = () => {}, timeoutMs = 5000, orphanGraceMs = 30000 } = {}) {
  const started = Date.now(), token = randomUUID()
  while (true) {
    check()
    try {
      await mkdir(path, { mode: 0o700 })
      try { await writeFile(join(path, 'owner.json'), JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() }), { mode: 0o600, flag: 'wx' }) }
      catch (error) { await rm(path, { recursive: true, force: true }); throw error }
      return async () => {
        const owner = await readFile(join(path, 'owner.json'), 'utf8').then(JSON.parse).catch(() => null)
        if (owner?.token === token) await rm(path, { recursive: true, force: true })
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const owner = await readFile(join(path, 'owner.json'), 'utf8').then(JSON.parse).catch(() => null)
      let orphan = false
      if (Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0) } catch (error) { orphan = error.code === 'ESRCH' }
      } else {
        const info = await stat(path).catch(() => null)
        orphan = info && Date.now() - info.mtimeMs > orphanGraceMs
      }
      if (orphan) {
        // Recovery is itself an owner-checked lease: a crash during recovery
        // must not leave a permanent, ownerless semaphore behind.
        const recovery = `${path}.recovery`
        let releaseRecovery
        try {
          releaseRecovery = await acquireFileLease(recovery, { check, timeoutMs: Math.max(1, timeoutMs - (Date.now() - started)), orphanGraceMs })
          const current = await readFile(join(path, 'owner.json'), 'utf8').then(JSON.parse).catch(() => null)
          if (JSON.stringify(current) === JSON.stringify(owner)) {
            const stale = `${path}.stale-${token}`
            await rename(path, stale)
            await rm(stale, { recursive: true, force: true })
          }
        } catch (error) { if (!['EEXIST', 'ENOENT'].includes(error.code)) throw error }
        finally { await releaseRecovery?.() }
      }
      if (Date.now() - started >= timeoutMs) throw Object.assign(new Error('File is busy; retry after its owner finishes'), { code: 'MEMORY_LOCK_TIMEOUT' })
      await new Promise(resolve => setTimeout(resolve, 15))
    }
  }
}
