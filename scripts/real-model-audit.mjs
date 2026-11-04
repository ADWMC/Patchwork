#!/usr/bin/env node
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { writeRunReport, updateIndex, SCENARIOS } from './audit-lib.mjs'

function argsOf(argv) {
  const out = { screenshots: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--session') out.session = argv[++i]
    else if (arg === '--scenario') out.scenario = argv[++i]
    else if (arg === '--out') out.out = argv[++i]
    else if (arg === '--prompt') out.promptFile = argv[++i]
    else if (arg === '--screenshot') out.screenshots.push(argv[++i])
    else if (arg === '--dsh-version') out.dshVersion = argv[++i]
    else if (arg === '--package-version') out.packageVersion = argv[++i]
    else if (arg === '--git-head') out.gitHead = argv[++i]
    else if (arg === '--index') out.index = argv[++i]
    else if (arg === '--list') out.list = true
    else if (arg === '--help' || arg === '-h') out.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return out
}

const args = argsOf(process.argv.slice(2))
if (args.help || args.list) {
  console.log(JSON.stringify({ scenarios: Object.entries(SCENARIOS).map(([id, scenario]) => ({ id, title: scenario.title })), usage: 'node scripts/real-model-audit.mjs --session <session.jsonl|jsonl.zstd> --scenario <id> --out <dir> [--index <dir>] [--prompt <file>] [--screenshot <png>]' }, null, 2))
  process.exit(0)
}
if (!args.session || !args.scenario || !args.out) throw new Error('--session, --scenario and --out are required')
const prompt = args.promptFile ? await readFile(resolve(args.promptFile), 'utf8') : ''
const result = await writeRunReport({
  sessionPath: resolve(args.session), scenario: args.scenario, outDir: resolve(args.out), prompt,
  screenshots: args.screenshots.map(item => resolve(item)), dshVersion: args.dshVersion ?? null,
  packageVersion: args.packageVersion ?? null, gitHead: args.gitHead ?? null,
})
if (args.index) await updateIndex(resolve(args.index))
console.log(JSON.stringify({ runId: result.manifest.runId, scenario: result.manifest.scenario, status: result.manifest.status, assertions: result.evaluation.assertions }, null, 2))
process.exitCode = result.manifest.status === 'failed' ? 1 : 0
