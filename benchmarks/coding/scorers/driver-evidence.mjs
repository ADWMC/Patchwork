import { realpath, readFile, stat } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'

// Consistency and containment checks for an explicitly trusted driver. This
// cannot authenticate a model provider or make an untrusted driver trustworthy.
export async function verifyDriverEvidence(resultsDir, driver, expected) {
  const invalid = { evidenceVerified: false }
  if (typeof driver?.evidenceRef !== 'string' || driver.runId !== expected.runId) return invalid
  try {
    const root = await realpath(resultsDir), path = await realpath(resolve(root, driver.evidenceRef))
    const local = relative(root, path)
    if (!local || isAbsolute(local) || local === '..' || local.startsWith('../') || local.startsWith('..\\')) return invalid
    const info = await stat(path)
    if (!info.isFile() || info.size > 2_000_000) return invalid
    const bytes = await readFile(path), evidenceHash = createHash('sha256').update(bytes).digest('hex')
    const record = JSON.parse(bytes)
    return { evidenceHash, evidenceVerified: evidenceHash === driver.evidenceHash && ['runId', 'taskId', 'model', 'dshVersion', 'requestCount'].every(key => record[key] === expected[key]) && record.mode === 'real-host' }
  } catch { return invalid }
}
