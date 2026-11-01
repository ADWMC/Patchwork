import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export async function diffFileSnapshots(before, after) {
  const files = [], root = await mkdtemp(join(tmpdir(), 'patchwork-diff-'))
  try {
    for (const path of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      const a = before[path]?.content, b = after[path]?.content
      const bytes = value => value === undefined ? Buffer.alloc(0) : Buffer.isBuffer(value) ? value : Buffer.from(value)
      if (a !== undefined && b !== undefined && bytes(a).equals(bytes(b))) continue
      await mkdir(join(root, 'old'), { recursive: true }); await mkdir(join(root, 'new'), { recursive: true })
      const oldPath = join(root, 'old', 'file'), newPath = join(root, 'new', 'file')
      await writeFile(oldPath, bytes(a)); await writeFile(newPath, bytes(b))
      const diff = spawnSync('git', ['diff', '--no-index', '--numstat', '--no-renames', '--', oldPath, newPath], { encoding: 'utf8', windowsHide: true })
      if (diff.error || ![0, 1].includes(diff.status)) throw new Error('git diff failed; refusing invented change counts')
      const [added, deleted] = diff.stdout.trim().split('\t')
      files.push({ path, kind: a === undefined ? 'added' : b === undefined ? 'deleted' : 'modified', binary: added === '-', added: added === '-' ? null : Number(added || 0), deleted: deleted === '-' ? null : Number(deleted || 0),
        beforeHash: a === undefined ? null : createHash('sha256').update(bytes(a)).digest('hex'), afterHash: b === undefined ? null : createHash('sha256').update(bytes(b)).digest('hex') })
    }
    return { files, changedFiles: files.map(item => item.path), changedLines: files.reduce((n, file) => n + (file.added ?? 0) + (file.deleted ?? 0), 0), binaryChanges: files.filter(file => file.binary).length, renamePolicy: 'counted-as-delete-and-add' }
  } finally { await rm(root, { recursive: true, force: true }) }
}
