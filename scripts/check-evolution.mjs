import { readFile } from 'node:fs/promises'
import { evaluateRealHostCandidate } from '../src/quality/evolution.mjs'
const path = process.argv[2]
if (!path) { console.error('Usage: node scripts/check-evolution.mjs <experiment.json>'); process.exitCode = 2 }
else {
  try {
    const result = evaluateRealHostCandidate(JSON.parse(await readFile(path, 'utf8')))
    console.log(JSON.stringify(result, null, 2))
    if (!result.eligibleForReview) process.exitCode = 1
  } catch { console.error('Experiment record could not be read or validated'); process.exitCode = 2 }
}
