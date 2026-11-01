import { readFile, readdir, writeFile } from 'node:fs/promises'
import { zstdDecompressSync } from 'node:zlib'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = process.env.SOL_LAB
if (!root) throw new Error('Set SOL_LAB to the isolated experiment directory')

// Recover committed events from the pilot interrupted by a harness bug. Each
// DSH persistence frame is independent; Node exposes the consumed input size.
const sessionRoot = join(root, 'home', 'sessions')
for (const directory of (await readdir(sessionRoot)).filter(name => name.endsWith('task1-af-on--'))) {
  for (const sessionId of await readdir(join(sessionRoot, directory))) {
    const bytes = await readFile(join(sessionRoot, directory, sessionId, 'session.v4.jsonl.zstd'))
    const frames = []
    let offset = 0
    while (offset < bytes.length) {
      const result = zstdDecompressSync(bytes.subarray(offset), { info: true })
      if (result.engine.bytesWritten <= 0) throw new Error('Decoder did not advance')
      frames.push(result.buffer)
      offset += result.engine.bytesWritten
    }
    const events = Buffer.concat(frames).toString('utf8').trim().split('\n').map(JSON.parse).filter(event => event.type !== 'session')
    await writeFile(join(root, 'results', 'task1-af-on-recovered.json'), JSON.stringify({
      sessionId, preset: 'patchwork', events, status: 'harness-error',
      reason: 'Pilot timeout called unsupported agent.abort; later driver uses cancel. Excluded from AF efficacy comparison.',
    }, null, 2))
  }
}

function usageOf(usages) {
  return usages.reduce((sum, usage) => {
    for (const key of ['inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens']) sum[key] += usage?.[key] ?? 0
    return sum
  }, { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 })
}

const names = ['task1-af-off', 'task1-af-on-recovered', 'task2-raw', 'task2-epr', 'task2-targeted-raw', 'task2-targeted-epr', 'task2-local-epr', 'task3-maintenance', 'task3-noop', 'task4-op', 'task4-packed']
const validity = {
  'task1-af-off': 'incomplete-task: acceptance 4/5; no AF benefit established',
  'task1-af-on-recovered': 'invalid-comparison: harness error, acceptance 3/5, no fusion',
  'task2-raw': 'invalid-pilot: test-worker spawn EPERM',
  'task2-epr': 'invalid-task-outcome: incomplete snapshot/config contamination; reducer fallback observed',
  'task2-targeted-raw': 'valid targeted diagnosis baseline',
  'task2-targeted-epr': 'valid targeted diagnosis; model reducer failed open',
  'task2-local-epr': 'valid targeted diagnosis; local failure-section receipt',
  'task3-maintenance': 'valid staged task and explicit native probes; not automatic OCC benefit',
  'task3-noop': 'valid fresh-session native noop probe',
  'task4-op': 'valid inventory below packing threshold',
  'task4-packed': 'valid packed inventory; head/tail answer without recall',
}
const results = []
for (const name of names) {
  let run
  try { run = JSON.parse(await readFile(join(root, 'results', `${name}.json`), 'utf8')) } catch { continue }
  const assistants = run.events.filter(event => event.type === 'assistant/message')
  const calls = run.events.filter(event => event.type === 'tool/call')
  const tools = {}
  const duplicates = {}
  for (const { data } of calls) {
    tools[data.name] = (tools[data.name] ?? 0) + 1
    const key = `${data.name}:${data.arguments}`
    duplicates[key] = (duplicates[key] ?? 0) + 1
  }
  const toolResults = run.events.filter(event => event.type === 'tool/result')
  const fusions = toolResults.flatMap(event => event.data.message.content.flatMap(block => block.text?.match(/\[then_run:(\w+)\]/g) ?? []))
  results.push({
    name, sessionId: run.sessionId, preset: run.preset, status: run.status, validity: validity[name],
    elapsedMs: run.elapsedMs ?? run.events.at(-1).time - run.events[0].time,
    requestAttempts: run.requests, assistantCommits: assistants.length,
    turnEnd: run.events.findLast(event => event.type === 'turn/end')?.data.reason,
    tools, repeatedIdenticalCalls: Object.values(duplicates).reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    fusions, conversationUsage: usageOf(assistants.map(event => event.data.usage)),
    successfulCompactionUsage: usageOf(run.events.filter(event => event.type === 'compaction/summary').map(event => event.data.usage)),
    compactionProbes: run.compactionProbes,
    toolResultBytes: toolResults.map(event => event.data.message.content.reduce((sum, block) => sum + Buffer.byteLength(block.text ?? ''), 0)),
  })
}

const step = (id, status, text = 'same work') => ({ id, text, status })
const acceptance = []
for (const name of ['task1-af-off', 'task1-af-on']) {
  const { analyzeTransition } = await import(pathToFileURL(join(root, name, 'src/mechanisms/online-context-compact/plan.mjs')))
  const cases = [
    ['initial history', undefined, [step('a', 'completed')], []],
    ['new completed id', [step('a', 'pending')], [step('a', 'pending'), step('b', 'completed')], []],
    ['changed work', [step('a', 'pending')], [step('a', 'completed', 'new work')], []],
    ['real transition', [step('a', 'pending')], [step('a', 'completed')], ['a']],
    ['repeat', [step('a', 'completed')], [step('a', 'completed')], []],
  ].map(([label, before, after, expected]) => {
    const actual = analyzeTransition(before, after).newlyCompleted
    return { label, actual, expected, passed: JSON.stringify(actual) === JSON.stringify(expected) }
  })
  acceptance.push({ name, cases, passed: cases.filter(item => item.passed).length, total: cases.length })
}

const summary = { date: '2026-10-30', runtime: 'DSH 0.2.1-rc.2 / step-3.5-flash', results, acceptance,
  limits: 'Usage excludes unreported failed auxiliary calls and background title generation. No monetary saving or statistical significance claimed. Raw runs remain in SOL_LAB.' }
const destination = join(fileURLToPath(new URL('.', import.meta.url)), 'results-summary.json')
await writeFile(destination, JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
