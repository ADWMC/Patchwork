#!/usr/bin/env node
/**
 * 在真实 DSH 轨迹上报告每个机制的反事实节省。
 *
 * 用法：
 *   node benchmark/analyze.mjs [--cwd Patchwork] [--limit 5] [--json]
 *
 * 数字来源分两类，报告中分开呈现：
 *   - **事实**：会话日志记录的内容（provider usage、工具结果字节数、命令文本）
 *   - **估计**：由事实按声明过的假设推导的反事实
 */
import { collectSessions } from './lib/session-source.mjs'
import { actionFusion, contextGrowth, observationPack, reducer, summarize } from './lib/counterfactual.mjs'

const options = parseArgs(process.argv.slice(2))
const collected = await collectSessions({ cwdIncludes: options.cwd, limit: options.limit })
const sessions = collected.sessions

if (sessions.length === 0) {
  console.error(`没有匹配 "${options.cwd}" 的会话（存储里共列出 ${collected.listed} 个会话）。`)
  process.exit(0)
}

const reports = sessions.map(session => ({
  id: session.id,
  createdAt: session.createdAt,
  agentPreset: session.agentPreset,
  tokensMeasured: session.tokensMeasured,
  facts: summarize(session),
  fusion: actionFusion(session),
  observations: observationPack(session),
  reducible: reducer(session),
  context: contextGrowth(session),
}))

if (options.json) {
  console.log(JSON.stringify({ sessions: reports, aggregate: aggregate(reports) }, null, 2))
  process.exit(0)
}

print(reports)
console.log(JSON.stringify(aggregate(reports), null, 2))

function aggregate(list) {
  const sum = (pick) => list.reduce((total, item) => total + pick(item), 0)
  return {
    sessions: list.length,
    facts: {
      requests: sum(item => item.facts.requests),
      turns: sum(item => item.facts.turns),
      toolCalls: sum(item => item.facts.results),
      toolResultMegabytes: round(sum(item => item.facts.toolBytes) / (1024 * 1024), 2),
      inputTokens: sum(item => item.facts.inputTokens),
      outputTokens: sum(item => item.facts.outputTokens),
      totalTokens: sum(item => item.facts.totalTokens),
      cacheReadTokens: sum(item => item.facts.cacheReadTokens),
    },
    actionFusion: {
      candidates: sum(item => item.fusion.candidates),
      savedRequests: sum(item => item.fusion.savedRequests),
      savedTokens: sum(item => item.fusion.savedTokens),
    },
    observationPack: {
      candidates: sum(item => item.observations.candidates),
      candidateMegabytes: round(sum(item => item.observations.rawBytes) / (1024 * 1024), 2),
      replaysAvoided: sum(item => item.observations.replays),
      replayTokens: sum(item => item.observations.savedTokens),
    },
    reducer: {
      candidates: sum(item => item.reducible.candidates),
      sourceMegabytes: round(sum(item => item.reducible.sourceBytes) / (1024 * 1024), 2),
      replayTokens: sum(item => item.reducible.savedTokens),
    },
    contextPeakTokens: list.length ? Math.max(...list.map(item => item.context.peakTokens)) : 0,
  }
}

function print(list) {
  for (const report of list) {
    console.log(`\n=== ${report.id} (${report.agentPreset ?? 'no preset'}) ===`)
    const facts = report.facts
    console.log(
      `facts: ${facts.requests} requests / ${facts.turns} turns / ${facts.results} tool results / ` +
        `${(facts.toolBytes / (1024 * 1024)).toFixed(2)} MiB of tool output`,
    )
    console.log(
      `tokens: total=${facts.totalTokens} input=${facts.inputTokens} output=${facts.outputTokens} ` +
        `cacheRead=${facts.cacheReadTokens} reasoning=${facts.reasoningTokens}`,
    )
    console.log(
      `action fusion: ${report.fusion.candidates} eligible pairs -> would remove ${report.fusion.savedRequests} requests, ` +
        `${report.fusion.savedTokens} tokens`,
    )
    console.log(
      `observation pack: ${report.observations.candidates} oversized results -> ${report.observations.replays} replays avoided, ` +
        `${report.observations.savedTokens} tokens`,
    )
    console.log(
      `reducer: ${report.reducible.candidates} diagnostic logs (${(report.reducible.sourceBytes / 1024).toFixed(0)} KiB) -> ` +
        `${report.reducible.savedTokens} tokens`,
    )
    console.log(`context: peak ${report.context.peakTokens} tokens over ${report.context.requests} requests`)
    console.log(
      `measurement: host token estimator ${report.tokensMeasured ? 'available' : 'UNAVAILABLE'} ` +
        `(coverage ${(report.facts.tokenCoverage * 100).toFixed(0)}% of tool results)`,
    )
  }
}

function parseArgs(argv) {
  const options = { cwd: 'Patchwork', limit: 5, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--json') options.json = true
    else if (arg === '--cwd') options.cwd = argv[++index]
    else if (arg === '--limit') options.limit = Number(argv[++index])
    else throw new Error(`unknown option: ${arg}`)
  }
  return options
}

function round(value, digits) {
  return Number(value.toFixed(digits))
}
