import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, lstat, realpath, open, rename, rm } from 'node:fs/promises'
import { join, relative } from 'node:path'

export class BrowserArtifacts {
  constructor(agent, check) { this.agent = agent; this.check = check; this.items = [] }

  async directory() {
    this.check()
    const cwd = this.agent.session.header.cwd ?? this.agent.session.meta?.cwd
    if (!cwd) throw new Error('Browser file delivery requires a session workspace')
    const root = await realpath(cwd)
    let directory = root
    for (const part of ['.patchwork', 'browser-artifacts', createHash('sha256').update(this.agent.session.header.id).digest('hex').slice(0, 20)]) {
      directory = join(directory, part)
      await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
      if ((await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory) throw new Error('Browser artifact directory must not be a symbolic link')
    }
    this.check()
    return { root, directory }
  }

  async writeStream(stream, name, limit) {
    const { root, directory } = await this.directory()
    const id = randomUUID()
    const safeName = /^[a-z][a-z0-9.-]{0,60}$/.test(name) ? name : 'artifact.bin'
    const path = join(directory, `${id}-${safeName}`)
    const temporary = `${path}.partial`
    const file = await open(temporary, 'wx', 0o600)
    const hash = createHash('sha256')
    let bytes = 0, committed = false
    try {
      for await (const chunk of stream) {
        this.check()
        const data = Buffer.from(chunk); bytes += data.length
        if (bytes > limit) throw new Error('Browser artifact exceeds the delivery size limit')
        hash.update(data); await file.writeFile(data)
      }
      if (!bytes) throw new Error('Browser artifact is empty; no file was delivered')
      await file.close(); this.check()
      await rename(temporary, path); this.check()
      const item = { id, name: safeName, path: relative(root, path).replaceAll('\\', '/'), bytes, sha256: hash.digest('hex'), state: 'delivered', at: new Date().toISOString() }
      this.items.push(item); this.items = this.items.slice(-30); committed = true
      return item
    } finally {
      await file.close().catch(() => {})
      await rm(temporary, { force: true })
      if (!committed) await rm(path, { force: true })
    }
  }

  write(data, name, limit = 2 * 1024 * 1024) { return this.writeStream([Buffer.isBuffer(data) ? data : Buffer.from(data)], name, limit) }
  copy(path, name, limit) { return this.writeStream(createReadStream(path), name, limit) }
}
