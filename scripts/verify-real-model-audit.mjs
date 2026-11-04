#!/usr/bin/env node
import { resolve } from 'node:path'
import { verifyAuditDir, updateIndex } from './audit-lib.mjs'

const args = process.argv.slice(2)
// Raw real-model evidence is intentionally not stored in the repository. Pass an
// external audit directory explicitly; this script never defaults into the repo.
const base = args.find(arg => !arg.startsWith('-'))
if (!base) {
  console.error('Usage: node scripts/verify-real-model-audit.mjs <external-audit-dir> [--index]')
  process.exitCode = 2
} else {
  const index = args.includes('--index')
  const result = await verifyAuditDir(resolve(base))
  if (index) await updateIndex(resolve(base))
  console.log(JSON.stringify({ base, ...result }, null, 2))
  process.exitCode = result.ok ? 0 : 1
}
