#!/usr/bin/env node
/**
 * 跑一条 auto-research lineage：把提案与测量喂给两道门，留下非支配的幸存者，
 * 并把每个判决写进研究账本。
 *
 * 用法：
 *   node research/run.mjs --measurements <file.json> [--baseline <file.json>]
 *                         [--proposals research/proposals.json]
 *                         [--ledger research/ledger] [--no-record] [--json]
 *
 * 测量文件形状：
 *   {
 *     "P-001-action-fusion": { "capability": { "taskCompletionRate": 1 }, "efficiency": { "modelRequests": 120, "tokens": 900000 } },
 *     ...
 *   }
 *
 * 注意：本命令**不调用模型**。它只判定别人测出来的数字——`benchmark/analyze.mjs`
 * 提供轨迹反事实，真实 A/B 的测量由调用方提供。没有测量就不判，绝不猜。
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatLineage, runLineage } from './lib/lineage.mjs'
import { appendVerdict } from './lib/ledger.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const options = parseArgs(process.argv.slice(2))

const proposals = JSON.parse(await readFile(options.proposals, 'utf8'))
const measurements = options.measurements
  ? JSON.parse(await readFile(options.measurements, 'utf8'))
  : {}
const baseline = options.baseline ? JSON.parse(await readFile(options.baseline, 'utf8')) : { efficiency: {} }

const result = runLineage({ proposals, measurements, baseline, directions: options.directions })

if (options.json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(formatLineage(result))
  if (Object.keys(measurements).length === 0) {
    console.log('\n（没有提供测量：所有提案都判为 not-measured，这不是淘汰，是尚未评估。）')
  }
}

if (!options.noRecord) {
  for (const item of result.evaluated) {
    await appendVerdict(options.ledger, {
      id: item.id,
      mechanism: item.proposal.mechanism,
      keep: item.verdict.keep,
      nonDominated: item.nonDominated,
      reason: item.verdict.reason,
    })
  }
}

function parseArgs(argv) {
  const options = {
    proposals: join(here, 'proposals.json'),
    measurements: undefined,
    baseline: undefined,
    ledger: join(here, 'ledger'),
    directions: { tokens: 'lower', modelRequests: 'lower', peakContextTokens: 'lower' },
    json: false,
    noRecord: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--json') options.json = true
    else if (arg === '--no-record') options.noRecord = true
    else if (arg === '--proposals') options.proposals = argv[++index]
    else if (arg === '--measurements') options.measurements = argv[++index]
    else if (arg === '--baseline') options.baseline = argv[++index]
    else if (arg === '--ledger') options.ledger = argv[++index]
    else throw new Error(`unknown option: ${arg}`)
  }
  return options
}
