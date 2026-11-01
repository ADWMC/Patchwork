import yauzl from 'yauzl'
import { mkdir, chmod, symlink } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname, join, isAbsolute, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Writable } from 'node:stream'
import { guarded, inside, safeRelative } from './store.mjs'

// Lazy entries and streaming file writes avoid loading a >1 GiB browser ZIP
// into the Node heap. Reject traversal, link escape, duplicates and ZIP bombs.
export async function extractZip(archive, directory, { signal, maxBytes = 8 * 1024 ** 3, maxEntries = 50000 } = {}) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const zip = await new Promise((resolve, reject) => yauzl.open(archive, { lazyEntries: true, validateEntrySizes: true }, (e, z) => e ? reject(e) : resolve(z)))
  let count = 0, bytes = 0, active = false, activeStream
  try {
    await new Promise((done, fail) => {
      const abort = () => { zip.close(); activeStream?.destroy(signal.reason ?? new Error('Extraction cancelled')); if (!active) { clean(); fail(signal.reason ?? new Error('Extraction cancelled')) } }
      signal?.addEventListener('abort', abort, { once: true })
      const clean = () => signal?.removeEventListener('abort', abort)
      zip.once('error', e => { clean(); fail(e) }); zip.once('end', () => { clean(); done() })
      zip.on('entry', entry => { void (async () => {
        active = true
        signal?.throwIfAborted()
        if (++count > maxEntries || (bytes += entry.uncompressedSize) > maxBytes) throw new Error('ZIP extraction limits exceeded')
        const name = safeRelative(entry.fileName.replace(/\/$/, ''))
        const target = await guarded(directory, join(directory, name))
        if (entry.fileName.endsWith('/')) { await mkdir(target, { recursive: true, mode: 0o755 }); signal?.throwIfAborted(); active = false; zip.readEntry(); return }
        await mkdir(dirname(target), { recursive: true, mode: 0o755 })
        const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (e, s) => e ? reject(e) : resolve(s)))
        activeStream = stream
        const mode = entry.externalFileAttributes >>> 16
        if ((mode & 0o170000) === 0o120000) {
          if (entry.uncompressedSize > 4096) { stream.destroy(); throw new Error('ZIP link is too long') }
          // yauzl's fd-slicer streams do not reliably support async iteration.
          const chunks = []
          await pipeline(stream, new Writable({ write(chunk, _encoding, callback) { chunks.push(chunk); callback() } }), { signal })
          const link = Buffer.concat(chunks).toString('utf8')
          if (isAbsolute(link) || /[\x00-\x1f]/.test(link) || !inside(directory, resolve(dirname(target), link))) throw new Error('ZIP link escapes its component')
          await symlink(link, target)
        } else {
          if (mode & 0o170000 && (mode & 0o170000) !== 0o100000) { stream.destroy(); throw new Error('Unsupported ZIP entry type') }
          await pipeline(stream, createWriteStream(target, { flags: 'wx', mode: mode & 0o777 || 0o644 }), { signal })
          if (process.platform !== 'win32' && mode & 0o111) await chmod(target, mode & 0o777)
        }
        signal?.throwIfAborted(); activeStream = null; active = false; zip.readEntry()
      })().catch(error => { clean(); zip.close(); fail(error) }) })
      if (signal?.aborted) abort(); else zip.readEntry()
    })
  } finally { zip.close() }
}
