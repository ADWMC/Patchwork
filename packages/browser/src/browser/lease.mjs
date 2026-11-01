import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rm, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'

export async function acquireLease(path, { check = () => {}, orphanGraceMs = 30_000, depth = 0 } = {}) {
  check()
  const token = randomUUID()
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await mkdir(path, { mode: 0o700 }) }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      const recovery = `${path}.recovery`
      if (depth >= 8) throw new Error('Browser lease recovery chain needs operator inspection')
      const releaseRecovery = await acquireLease(recovery, { check, orphanGraceMs, depth: depth + 1 })
      try {
      let owner
      try { owner = JSON.parse(await readFile(join(path, 'owner.json'), 'utf8')) } catch {}
      let alive = true
      if (Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0) } catch (error) { if (error.code === 'ESRCH') alive = false }
      } else {
        const info = await stat(path).catch(() => null)
        alive = !info || Date.now() - info.mtimeMs < orphanGraceMs
      }
      if (alive) throw new Error('Browser profile is in use; close its other runtime or retry later')
      // Rename before removal. Never remove the path a new owner could acquire.
      const stale = `${path}.stale-${token}`
      try { await rename(path, stale) } catch { throw new Error('Browser lease changed; retry') }
      await rm(stale, { recursive: true, force: true })
      } finally { await releaseRecovery() }
      continue
    }
    try {
      check()
      await writeFile(join(path, 'owner.json'), JSON.stringify({ token, pid: process.pid, createdAt: new Date().toISOString() }), { mode: 0o600, flag: 'wx' })
      check()
    } catch (error) { await rm(path, { recursive: true, force: true }); throw error }
    let released = false
    return async () => {
      if (released) return
      released = true
      const owner = await readFile(join(path, 'owner.json'), 'utf8').then(JSON.parse).catch(() => null)
      if (owner?.token === token) await rm(path, { recursive: true, force: true })
    }
  }
  throw new Error('Browser lease recovery raced; retry')
}
