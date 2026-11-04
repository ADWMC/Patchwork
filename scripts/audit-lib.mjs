import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

export const AUDIT_SCHEMA = 1
const SECRET_KEY = /api[-_]?key|authorization|cookie|password|secret|credential|token/i
const MAX_STRING = 4000

export function sha256(value) { return createHash('sha256').update(value).digest('hex') }

export async function sha256File(path) { return sha256(await readFile(path)) }

export function redact(value, depth = 0) {
  if (value === null || value === undefined) return value
  if (depth > 12) return '[depth-limit]'
  if (typeof value === 'string') return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…' : value.replace(/(sk-[A-Za-z0-9_-]{8,})/g, '[redacted-key]')
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 200).map(item => redact(item, depth + 1))
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) { out[key] = '[redacted]'; continue }
    out[key] = redact(item, depth + 1)
  }
  return out
}

function decompressZstd(buffer) {
  const magic = [0x28, 0xb5, 0x2f, 0xfd]
  const starts = []
  for (let i = 0; i + 4 <= buffer.length; i++) if (magic.every((byte, j) => buffer[i + j] === byte)) starts.push(i)
  if (starts[0] !== 0) starts.unshift(0)
  const outputs = []
  let cursor = 0
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s]
    if (start < cursor) continue
    for (let e = s + 1; e <= starts.length; e++) {
      const end = e < starts.length ? starts[e] : buffer.length
      try {
        const output = zstdDecompressSync(buffer.subarray(start, end))
        if (output.length) { outputs.push(output); cursor = end; break }
      } catch { /* try a larger frame */ }
    }
  }
  return Buffer.concat(outputs)
}

export async function readSessionEvents(path) {
  const buffer = await readFile(path)
  const text = buffer[0] === 0x28 && buffer[1] === 0xb5 ? decompressZstd(buffer).toString('utf8') : buffer.toString('utf8')
  return text.split(/\r?\n/).filter(line => line.trim().startsWith('{')).map(line => {
    try { return JSON.parse(line) } catch { return null }
  }).filter(Boolean)
}

function textOf(content) {
  return (content ?? []).filter(block => block?.type === 'text').map(block => block.text).join('\n')
}

export function summarizeEvents(events) {
  const sessionEvent = events.find(event => event.type === 'session')
  const session = sessionEvent?.data ?? sessionEvent ?? {}
  const requestContext = events.find(event => event.type === 'request/context')?.data ?? {}
  const calls = []
  const results = new Map()
  const user = []
  const assistant = []
  const diagnostics = []
  for (const event of events) {
    if (event.type === 'user/message') {
      const text = textOf(event.data?.content)
      if (text && event.data?.source?.kind !== 'runtime-context') user.push({ source: event.data?.source?.kind ?? null, text })
    } else if (event.type === 'assistant/message') {
      const text = textOf(event.data?.message?.content)
      if (text) assistant.push(text)
    } else if (event.type === 'tool/call') {
      let args = event.data?.arguments
      if (typeof args === 'string') { try { args = JSON.parse(args) } catch { args = { raw: args.slice(0, 500) } } }
      calls.push({ callId: event.data?.callId, name: event.data?.name, arguments: args })
    } else if (event.type === 'tool/result') {
      const message = event.data?.message
      results.set(message?.source?.callId, { isError: message?.isError === true, text: textOf(message?.content).slice(0, 4000) })
    } else if (String(event.type).startsWith('plugin:patchwork/diagnostic')) {
      diagnostics.push(event.data)
    }
  }
  const model = events.find(event => event.type === 'subagent/descriptor')?.data?.agentModel
    ?? requestContext.model
    ?? events.find(event => event.type === 'request/header')?.data?.header?.config?.model
    ?? null
  const provider = events.find(event => event.type === 'subagent/descriptor')?.data?.agentProvider
    ?? requestContext.provider
    ?? events.find(event => event.type === 'request/header')?.data?.header?.config?.provider
    ?? null
  const task = events.filter(event => event.type === 'plugin:patchwork/task').at(-1)?.data ?? null
  return {
    sessionId: session.id ?? null, preset: session.agentPreset ?? null, cwd: session.cwd ?? null, model, provider,
    eventCount: events.length, user, assistant, calls, results, diagnostics, task,
    toolErrors: [...results.values()].filter(result => result.isError).length,
  }
}

export function toolsCalled(summary) { return [...new Set(summary.calls.map(call => call.name).filter(Boolean))] }
export function call(summary, name, predicate = () => true) { return summary.calls.filter(item => item.name === name && predicate(item.arguments ?? {})) }
export function callNames(summary) { return summary.calls.map(call => call.name) }

export const SCENARIOS = {
  'code-map': {
    title: 'Local code map and symbol search',
    assertions: summary => [
      { id: 'code-tool-used', status: call(summary, 'patchwork_code').length ? 'passed' : 'failed', detail: `${call(summary, 'patchwork_code').length} patchwork_code calls` },
      { id: 'no-public-search-for-local-code', status: call(summary, 'patchwork_search').length ? 'failed' : 'passed', detail: 'local code must not be routed to public search' },
      { id: 'no-tool-errors', status: summary.toolErrors === 0 ? 'passed' : 'failed', detail: `${summary.toolErrors} tool errors` },
    ],
  },
  'project-docs': {
    title: 'AGENTS.md and DESIGN.md managed with CAS',
    assertions: summary => {
      const actions = new Set(call(summary, 'patchwork_project_docs').map(item => item.arguments?.action))
      const writes = call(summary, 'write').length + call(summary, 'edit').length + call(summary, 'pwsh').length + call(summary, 'bash').length
      return [
        ...['status', 'apply', 'read'].map(action => ({ id: `docs-${action}`, status: actions.has(action) ? 'passed' : 'failed', detail: actions.has(action) ? 'observed' : 'missing' })),
        { id: 'no-direct-writes-or-shell', status: writes ? 'failed' : 'passed', detail: `${writes} write/edit/shell calls` },
        { id: 'no-tool-errors', status: summary.toolErrors === 0 ? 'passed' : 'failed', detail: `${summary.toolErrors} tool errors` },
      ]
    },
  },
  'native-code-graph': {
    title: 'Opt-in workspace graph started by the model',
    assertions: summary => {
      const actions = new Set(call(summary, 'patchwork_code').map(item => item.arguments?.action))
      const required = ['graph-status', 'graph-start', 'callers', 'callees', 'impact', 'affected']
      const writes = call(summary, 'write').length + call(summary, 'edit').length + call(summary, 'pwsh').length + call(summary, 'bash').length
      return [
        ...required.map(action => ({ id: `${action}-observed`, status: actions.has(action) ? 'passed' : 'failed', detail: actions.has(action) ? 'observed' : 'missing' })),
        { id: 'no-writes-or-shell', status: writes ? 'failed' : 'passed', detail: `${writes} write/edit/shell calls` },
        { id: 'no-tool-errors', status: summary.toolErrors === 0 ? 'passed' : 'failed', detail: `${summary.toolErrors} tool errors` },
      ]
    },
  },
  'task-check-output': {
    title: 'Task check returns output and no standalone shell',
    assertions: summary => {
      const checks = call(summary, 'patchwork_task', args => args.action === 'check')
      const standalone = call(summary, 'pwsh').length + call(summary, 'bash').length
      const blocked = summary.task?.status === 'blocked'
      return [
        { id: 'check-executed', status: checks.length ? 'passed' : 'failed', detail: `${checks.length} check calls` },
        { id: 'no-standalone-shell', status: standalone ? 'failed' : 'passed', detail: `${standalone} standalone shell calls` },
        { id: 'task-not-blocked', status: summary.task ? blocked ? 'failed' : 'passed' : 'skipped', detail: `task=${summary.task?.status ?? 'missing'}` },
      ]
    },
  },
  'memory-project-scope': {
    title: 'Project-shared memory requires explicit scope',
    assertions: summary => {
      const memory = call(summary, 'patchwork_memory')
      const inspectNoScope = memory.find(item => item.arguments?.action === 'inspect' && item.arguments?.includeProject !== true)
      const inspectScope = memory.find(item => item.arguments?.action === 'inspect' && item.arguments?.includeProject === true)
      const noScopeResult = inspectNoScope ? summary.results.get(inspectNoScope.callId)?.text ?? '' : ''
      return [
        { id: 'memory-proposed', status: memory.some(item => item.arguments?.action === 'propose') ? 'passed' : 'failed', detail: 'propose call observed' },
        { id: 'scope-required-error', status: noScopeResult.includes('MEMORY_PROJECT_SCOPE_REQUIRED') ? 'passed' : 'failed', detail: noScopeResult.slice(0, 160) || 'missing negative scope result' },
        { id: 'scoped-inspect', status: inspectScope ? 'passed' : 'failed', detail: inspectScope ? 'inspect with includeProject observed' : 'missing scoped inspect call' },
        { id: 'no-tool-errors', status: summary.toolErrors === 0 ? 'passed' : 'failed', detail: `${summary.toolErrors} tool errors` },
      ]
    },
  },
  'superagent-explore': {
    title: 'Read-only explore returns findings without writes',
    assertions: summary => {
      const submit = call(summary, 'patchwork_superagent', args => args.action === 'submit')
      const writes = call(summary, 'write').length + call(summary, 'edit').length
      return [
        { id: 'superagent-submitted', status: submit.length ? 'passed' : 'failed', detail: `${submit.length} submit calls` },
        { id: 'no-writes', status: writes ? 'failed' : 'passed', detail: `${writes} write/edit calls` },
      ]
    },
  },
  'superagent-submit': {
    title: 'Explore job submitted and no writes in parent',
    assertions: summary => {
      const submit = call(summary, 'patchwork_superagent', args => args.action === 'submit')
      const explore = submit.some(item => (item.arguments?.jobs ?? []).some(job => job.mode === 'explore'))
      const writes = call(summary, 'write').length + call(summary, 'edit').length
      return [
        { id: 'explore-submitted', status: explore ? 'passed' : 'failed', detail: explore ? 'mode=explore observed' : 'no explore job' },
        { id: 'no-parent-writes', status: writes ? 'failed' : 'passed', detail: `${writes} parent write/edit calls` },
      ]
    },
  },
  'explore-child': {
    title: 'Explore executor returns findings without writes',
    assertions: summary => {
      const report = call(summary, 'patchwork_superagent', args => args.action === 'report')
      const writes = call(summary, 'write').length + call(summary, 'edit').length + call(summary, 'pwsh').length + call(summary, 'bash').length
      return [
        { id: 'code-tool-used', status: call(summary, 'patchwork_code').length ? 'passed' : 'failed', detail: `${call(summary, 'patchwork_code').length} code calls` },
        { id: 'report-ready', status: report.some(item => item.arguments?.status === 'ready') ? 'passed' : 'failed', detail: `${report.length} report calls` },
        { id: 'no-writes-or-shell', status: writes ? 'failed' : 'passed', detail: `${writes} write/edit/shell calls` },
      ]
    },
  },
  'fetch-evidence': {
    title: 'Public fetch and evidence citation',
    assertions: summary => [
      { id: 'fetch-used', status: call(summary, 'patchwork_fetch').length ? 'passed' : 'failed', detail: `${call(summary, 'patchwork_fetch').length} fetch calls` },
      { id: 'evidence-cited', status: call(summary, 'patchwork_evidence', args => args.action === 'cite').length ? 'passed' : 'failed', detail: 'cite call expected' },
      { id: 'no-tool-errors', status: summary.toolErrors === 0 ? 'passed' : 'failed', detail: `${summary.toolErrors} tool errors` },
    ],
  },
  smoke: {
    title: 'Session and model smoke',
    assertions: summary => [
      { id: 'assistant-response', status: summary.assistant.length ? 'passed' : 'failed', detail: `${summary.assistant.length} assistant messages` },
      { id: 'no-tool-errors', status: summary.toolErrors === 0 ? 'passed' : 'failed', detail: `${summary.toolErrors} tool errors` },
    ],
  },
}

export function evaluateScenario(id, summary) {
  const scenario = SCENARIOS[id]
  if (!scenario) throw new Error(`unknown scenario: ${id}`)
  const assertions = scenario.assertions(summary)
  const status = assertions.some(item => item.status === 'failed') ? 'failed' : assertions.length ? 'passed' : 'partial'
  return { scenario: id, title: scenario.title, status, assertions }
}

function markdownReport({ runId, manifest, summary, evaluation, prompt }) {
  const callLines = summary.calls.map(item => `- \`${item.name}\` ${JSON.stringify(redact(item.arguments)).slice(0, 500)}`).join('\n') || '- (none)'
  const assertionLines = evaluation.assertions.map(item => `- [${item.status}] ${item.id}: ${item.detail}`).join('\n')
  return `# Real model audit: ${runId}\n\n## Scenario\n\n${evaluation.title}\n\n## Environment\n\n- model: ${manifest.model?.provider ?? 'unknown'} / ${manifest.model?.id ?? 'unknown'}\n- DSH: ${manifest.dshVersion ?? 'unknown'}\n- package: ${manifest.packageVersion ?? 'unknown'}\n- git: ${manifest.gitHead ?? 'unknown'}\n- preset: ${manifest.preset ?? 'unknown'}\n- main DSH touched: ${manifest.isolation?.mainDshTouched === false ? 'no' : 'UNKNOWN'}\n\n## Prompt\n\n${prompt ? '```text\n' + prompt.slice(0, 2000) + '\n```' : 'Prompt omitted; hash only.'}\n\n## Observed tool calls\n\n${callLines}\n\n## Assertions\n\n${assertionLines}\n\n## Result\n\n**${evaluation.status}**\n\n## Limitations\n\nThis is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.\n`
}

function compactEvent(event) {
  if (!event?.type || /stream|chunk/i.test(event.type)) return null
  const keep = new Set(['session', 'request/header', 'request/context', 'user/message', 'assistant/message', 'tool/call', 'tool/result'])
  if (!keep.has(event.type) && !String(event.type).startsWith('plugin:patchwork/')) return null
  const base = { type: event.type, ...(event.seq !== undefined ? { seq: event.seq } : {}), ...(event.time !== undefined ? { time: event.time } : {}) }
  if (event.type === 'session') return { ...base, data: { id: event.id ?? event.data?.id, cwd: event.cwd ?? event.data?.cwd, agentPreset: event.agentPreset ?? event.data?.agentPreset, createdAt: event.createdAt ?? event.data?.createdAt } }
  if (event.type === 'request/header') {
    const header = event.data?.header ?? {}
    return { ...base, data: { header: { config: redact(header.config), tools: (header.tools ?? []).map(tool => tool.name) } } }
  }
  if (event.type === 'request/context') return { ...base, data: redact({ provider: event.data?.provider, model: event.data?.model, contextWindow: event.data?.contextWindow }) }
  if (event.type === 'user/message') return { ...base, data: { source: event.data?.source, textHash: sha256(textOf(event.data?.content)), textLength: textOf(event.data?.content).length } }
  if (event.type === 'assistant/message') {
    const message = event.data?.message ?? {}
    return { ...base, data: { turn: event.data?.turn, step: event.data?.step, message: { role: message.role, content: redact((message.content ?? []).filter(block => block?.type === 'text')) }, usage: event.data?.usage } }
  }
  if (event.type === 'tool/call') {
    const data = redact(event.data)
    if (event.data?.name === 'patchwork_superagent' && typeof data.arguments === 'string') {
      try {
        const args = JSON.parse(data.arguments)
        for (const job of args.jobs ?? []) if (job && typeof job.prompt === 'string') job.prompt = '[omitted]'
        data.arguments = JSON.stringify(args)
      } catch { /* keep bounded raw arguments */ }
    }
    return { ...base, data }
  }
  if (event.type === 'tool/result') {
    const message = event.data?.message ?? {}
    return { ...base, data: { message: { source: message.source, isError: message.isError === true, content: redact((message.content ?? []).filter(block => block?.type === 'text')) } } }
  }
  if (String(event.type).startsWith('plugin:patchwork/')) return { ...base, data: redact(event.data) }
  return { ...base, data: redact(event.data) }
}

export async function writeRunReport({ sessionPath, scenario, outDir, prompt = '', screenshots = [], mainDshTouched = false, dshVersion = null, packageVersion = null, gitHead = null, includePrompt = false }) {
  const events = await readSessionEvents(sessionPath)
  const summary = summarizeEvents(events)
  const evaluation = evaluateScenario(scenario, summary)
  const runId = basename(outDir)
  await mkdir(outDir, { recursive: true })
  const safeEvents = events.map(compactEvent).filter(Boolean).map(event => redact(event))
  const eventsText = safeEvents.map(event => JSON.stringify(event)).join('\n') + '\n'
  const toolCalls = summary.calls.map(item => ({ name: item.name, arguments: redact(item.arguments), result: summary.results.get(item.callId) ?? null }))
  const promptHash = sha256(prompt || summary.user.map(item => item.text).join('\n'))
  const promptText = includePrompt ? prompt : ''
  const manifest = {
    schemaVersion: AUDIT_SCHEMA, runId, scenario, status: evaluation.status,
    startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
    gitHead, packageVersion, dshVersion, model: { provider: summary.provider, id: summary.model }, preset: summary.preset,
    isolation: { mainDshTouched, dshHomeHash: null, workspaceHash: null, port: null },
    prompt: { path: 'prompt.md', sha256: promptHash }, session: { id: summary.sessionId, rawSha256: await sha256File(sessionPath), eventCount: summary.eventCount },
    assertions: evaluation.assertions, artifacts: [], redactions: ['secret-like keys', 'long strings truncated'],
    limitations: ['single run', 'model nondeterminism'],
  }
  await writeFile(join(outDir, 'events.jsonl'), eventsText)
  await writeFile(join(outDir, 'tool-calls.json'), JSON.stringify(toolCalls, null, 2) + '\n')
  await writeFile(join(outDir, 'result.json'), JSON.stringify({ ...evaluation, task: summary.task, toolErrors: summary.toolErrors, tools: toolsCalled(summary) }, null, 2) + '\n')
  await writeFile(join(outDir, 'prompt.md'), promptText ? `<!-- prompt sha256: ${promptHash} -->\n\n${promptText}\n` : `<!-- prompt sha256: ${promptHash}; prompt content omitted; reasoning omitted -->\n`)
  await writeFile(join(outDir, 'report.md'), markdownReport({ runId, manifest, summary, evaluation, prompt: promptText }))
  for (const item of screenshots) {
    try { await mkdir(join(outDir, 'screenshots'), { recursive: true }); await writeFile(join(outDir, 'screenshots', basename(item)), await readFile(item)) } catch { /* optional screenshot */ }
  }
  const artifactPaths = ['events.jsonl', 'tool-calls.json', 'result.json', 'prompt.md', 'report.md']
  manifest.artifacts = await Promise.all(artifactPaths.map(async path => ({ path, sha256: await sha256File(join(outDir, path)) })))
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return { manifest, evaluation, summary }
}

export async function updateIndex(baseDir) {
  const runs = []
  async function walk(dir) {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.name === 'manifest.json') {
        try {
          const manifest = JSON.parse(await readFile(path, 'utf8'))
          runs.push({ runId: manifest.runId, scenario: manifest.scenario, status: manifest.status, report: relative(baseDir, join(dirname(path), 'report.md')) })
        } catch { /* invalid manifest is listed by verifier */ }
      }
    }
  }
  await walk(baseDir)
  runs.sort((a, b) => String(a.runId).localeCompare(String(b.runId)))
  await writeFile(join(baseDir, 'index.json'), JSON.stringify({ schemaVersion: AUDIT_SCHEMA, updatedAt: new Date().toISOString(), runs }, null, 2) + '\n')
  return runs
}

export async function verifyAuditDir(baseDir) {
  const errors = []
  async function walk(dir) {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { await walk(path); continue }
      if (entry.name !== 'manifest.json') continue
      let manifest
      try { manifest = JSON.parse(await readFile(path, 'utf8')) } catch { errors.push(`${path}: invalid JSON`); continue }
      if (manifest.schemaVersion !== AUDIT_SCHEMA) errors.push(`${path}: schemaVersion`)
      if (!['passed', 'failed', 'partial', 'skipped'].includes(manifest.status)) errors.push(`${path}: status`)
      if (manifest.isolation?.mainDshTouched !== false) errors.push(`${path}: mainDshTouched must be false`)
      for (const artifact of manifest.artifacts ?? []) {
        try { const actual = await sha256File(join(dirname(path), artifact.path)); if (actual !== artifact.sha256) errors.push(`${path}: hash mismatch ${artifact.path}`) }
        catch { errors.push(`${path}: missing ${artifact.path}`) }
      }
      if (!manifest.session?.id) errors.push(`${path}: session id missing`)
      if (!Array.isArray(manifest.assertions)) errors.push(`${path}: assertions missing`)
    }
  }
  await walk(baseDir)
  return { ok: errors.length === 0, errors }
}
