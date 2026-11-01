import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export async function sourceFingerprint(root = fileURLToPath(new URL('../', import.meta.url))) {
  const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0')
  const files = []
  for (const path of [...new Set(names)].filter(path => /^(?:src|assets|presets|profiles|tests|scripts|benchmarks|hooks)\/|^packages\/browser\/(?:src|assets|tests|scripts)\/|^(?:packages\/browser\/)?(?:package(?:-lock)?\.json|pnpm-lock\.yaml|cordis\.patch\.yml)$/.test(path)).sort()) {
    try { const bytes = await readFile(resolve(root, path)); files.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') }) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return { algorithm: 'sha256', hash: createHash('sha256').update(JSON.stringify(files)).digest('hex'), fileCount: files.length, files }
}
