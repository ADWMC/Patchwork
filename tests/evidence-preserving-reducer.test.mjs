import { scopedAgent } from './helpers/agent.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 归档与判断日志都落在宿主用户数据根下；把根指到临时目录，测试不污染真实 ~/.dsh。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-epr-home-'))

const { RECEIPT_MARKER, RECEIPT_SCHEMA } = await import('../src/mechanisms/evidence-preserving-reducer/config.mjs')
const { buildRequest, parseReceipt, renderReceipt } = await import(
  '../src/mechanisms/evidence-preserving-reducer/receipt.mjs'
)
const { reducibleLog } = await import('../src/mechanisms/evidence-preserving-reducer/candidate.mjs')
const { registerEvidencePreservingReducer, sessionRoot } = await import(
  '../src/mechanisms/evidence-preserving-reducer/index.mjs'
)
const { contentHashOf } = await import('../src/util/content-archive.mjs')
const { nodeSpecReceipt } = await import('../src/mechanisms/evidence-preserving-reducer/node-spec.mjs')

const SESSION_ID = 'epr-session'
const COMMAND = 'cargo test'

const BODY = [
  'error[E0308]: mismatched types',
  '  --> src/lib.rs:12:9',
  'warning: unused variable: `total`',
  ...Array.from({ length: 200 }, (_, index) => `   Compiling dependency-${index} v0.1.0`),
  'error: could not compile `demo` (lib test)',
].join('\n')

const SOURCE_HASH = contentHashOf(BODY)

const exec = {
  name: 'pwsh',
  callId: 'call-1',
  arguments: { command: COMMAND },
  agent: scopedAgent({ session: { header: { id: SESSION_ID } } }),
}
const result = { isError: true, content: [{ type: 'text', text: BODY }] }

function receiptWith(extra = {}, sourceHash = SOURCE_HASH) {
  return JSON.stringify({
    schema: RECEIPT_SCHEMA,
    source_sha256: sourceHash,
    status: 'compile failed',
    uncertain: false,
    evidence: [
      { kind: 'fatal', quote: 'error[E0308]: mismatched types' },
      { kind: 'failure', quote: 'error: could not compile `demo` (lib test)' },
    ],
    ...extra,
  })
}

function scriptedLlm(chunks) {
  return {
    stream() {
      return (async function* generate() {
        for (const chunk of chunks) yield chunk
      })()
    },
  }
}

function textStream(text) {
  return scriptedLlm([
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
}

function inBandErrorLlm() {
  return scriptedLlm([{ type: 'finish', reason: { kind: 'error', failure: { message: 'boom' } } }])
}

function throwingLlm() {
  return {
    stream() {
      return (async function* generate() {
        throw new Error('adapter exploded')
      })()
    },
  }
}

function listenerFor(llm) {
  const listeners = new Map()
  registerEvidencePreservingReducer(
    { on: (event, listener) => listeners.set(event, listener), get: name => (name === 'llm' ? llm : undefined) },
    { reducerProvider: 'test-provider', reducerModel: 'test-model' },
  )
  return listeners.get('tools/post-execute')
}

const runListener = listener => listener(exec, result, async () => ({ kind: 'accept' }))

test('only long diagnostic shell output is a candidate', () => {
  assert.equal(reducibleLog(exec, result).ok, true)

  assert.equal(reducibleLog(exec, { ...result, content: [{ type: 'text', text: 'short' }] }).reason, 'below-threshold')
  assert.equal(reducibleLog({ ...exec, name: 'read' }, result).reason, 'not-a-shell-tool')
  assert.equal(reducibleLog({ ...exec, arguments: { command: 'echo hi' } }, result).reason, 'not-a-diagnostic-command')
  assert.equal(
    reducibleLog(exec, { ...result, content: [{ type: 'text', text: BODY }, { type: 'image' }] }).reason,
    'not-plain-text',
  )
  assert.equal(
    reducibleLog(exec, { ...result, content: [{ type: 'text', text: `${RECEIPT_MARKER} already reduced` }] }).reason,
    'already-reduced',
  )
  assert.equal(
    reducibleLog(exec, { ...result, content: [{ type: 'text', text: `${BODY}\napi_key = sk-live-abcdefghijklmnop` }] })
      .reason,
    'likely-secret',
  )
})

test('node test diagnostics are recognized and already-packed logs are not reduced twice', () => {
  for (const command of ['node --test', 'node --test --test-reporter=spec', 'node --test-reporter=spec --test tests/a.test.mjs', 'node tests/online-context-compact.test.mjs']) {
    assert.equal(reducibleLog({ ...exec, arguments: { command } }, result).ok, true, command)
  }
  assert.equal(reducibleLog({ ...exec, arguments: { command: 'node app.mjs' } }, result).ok, false)
  assert.equal(reducibleLog(exec, { ...result, content: [{ type: 'text', text: '[observation-pack] obs_abc\n' + BODY }] }).reason, 'already-reduced')
})

test('a nonzero process result requires failure evidence even when tool dispatch succeeded', async () => {
  const successfulDispatch = { ...result, isError: false, value: { exitCode: 1 } }
  assert.equal(reducibleLog(exec, successfulDispatch).isError, true)
  const onlyWarning = receiptWith({ evidence: [{ kind: 'warning', quote: 'warning: unused variable: `total`' }] })
  const decision = { kind: 'accept' }
  const listener = listenerFor(textStream(onlyWarning))
  assert.equal(await listener(exec, successfulDispatch, async () => decision), decision)
  const valid = await listenerFor(textStream(receiptWith()))(exec, successfulDispatch, async () => decision)
  assert.match(valid.content[0].text, /command_failed=true/)
})

test('Node spec extraction retains every failure byte and never needs a model', async () => {
  const section = '✖ failing tests:\n\ntest at tests/a.test.mjs:1:1\n✖ expected behavior\n  AssertionError: 0 !== 1\n[exit code: 1]'
  const body = '✔ passed case\n'.repeat(400) + 'ℹ tests 401\nℹ pass 400\nℹ fail 1\n\n' + section
  const hash = contentHashOf(body)
  const candidate = { command: 'node --test --test-reporter=spec', body, sourceHash: hash, isError: true }
  const receipt = nodeSpecReceipt(candidate)
  assert.equal(receipt.evidence.filter(item => item.kind === 'failure').map(item => item.quote).join(''), section)
  assert.equal(parseReceipt(JSON.stringify(receipt), { body, sourceHash: hash, isError: true }).ok, true)
  assert.equal(nodeSpecReceipt({ ...candidate, body: body.replace('ℹ fail 1', 'ℹ fail 2') }), undefined)
  assert.equal(nodeSpecReceipt({ ...candidate, isError: false }), undefined)
  assert.equal(nodeSpecReceipt({ ...candidate, command: 'cargo test' }), undefined)
  assert.equal(nodeSpecReceipt({ ...candidate, body: body + 'x'.repeat(601) }), undefined)
  let listener
  registerEvidencePreservingReducer({
    on(_event, callback) { listener = callback },
    get() { throw new Error('structured extraction must not look up a model') },
  })
  const output = await listener({ ...exec, arguments: { command: candidate.command } }, {
    isError: false, value: { exitCode: 1 }, content: [{ type: 'text', text: body }],
  }, async () => ({ kind: 'accept' }))
  assert.match(output.content[0].text, /reducer_provider=local/)
  assert.match(output.content[0].text, /command_failed=true/)
  assert.match(output.content[0].text, /full_log_path=/)
  assert.doesNotMatch(output.content[0].text, /✔ passed case/)
})

test('a truncated reducer response with no text reports budget exhaustion and usage', async () => {
  const { callReducer } = await import('../src/mechanisms/evidence-preserving-reducer/provider.mjs')
  const llm = scriptedLlm([{ type: 'usage', usage: { inputTokens: 200, outputTokens: 2048 } }, { type: 'finish', reason: { kind: 'max-tokens' } }])
  const outcome = await callReducer(llm, { route: { provider: 'test', model: 'test' }, userText: 'test' })
  assert.equal(outcome.reason, 'reducer-output-budget-exhausted')
  assert.equal(outcome.usage.outputTokens, 2048)
})

test('the request carries the hash, the command and the log as untrusted data', () => {
  const { system, userText } = buildRequest({ command: COMMAND, body: BODY, sourceHash: 'abc', isError: true })
  assert.match(userText, /command: cargo test/)
  assert.match(userText, /source_sha256: abc/)
  assert.match(userText, /<untrusted_log>[\s\S]*<\/untrusted_log>/)
  assert.match(userText, /error\[E0308\]/)
  assert.match(system, /untrusted data/)
  assert.match(system, /BYTE FOR BYTE/)
})

test('a receipt is accepted only when every quote appears verbatim', () => {
  const ok = parseReceipt(receiptWith(), { body: BODY, sourceHash: SOURCE_HASH, isError: true })
  assert.equal(ok.ok, true)
  assert.equal(ok.receipt.evidence.length, 2)
  assert.equal(ok.receipt.evidence[0].line, 1)

  const rejected = (text, reason) => {
    const parsed = parseReceipt(text, { body: BODY, sourceHash: SOURCE_HASH, isError: true })
    assert.equal(parsed.ok, false, `expected ${reason}, got ${parsed.reason}`)
    assert.equal(parsed.reason, reason)
  }

  rejected('not json at all', 'unparseable-receipt')
  rejected(JSON.stringify([]), 'receipt-not-an-object')
  rejected(receiptWith({ schema: 'other/1' }), 'receipt-schema-mismatch')
  rejected(receiptWith({}, 'other-hash'), 'receipt-source-hash-mismatch')
  rejected(receiptWith({ status: '' }), 'receipt-status-missing')
  rejected(receiptWith({ uncertain: 'no' }), 'receipt-uncertain-not-boolean')
  rejected(receiptWith({ evidence: [] }), 'receipt-evidence-missing')
  rejected(
    receiptWith({ evidence: Array.from({ length: 13 }, () => ({ kind: 'failure', quote: BODY.split('\n')[0] })) }),
    'receipt-too-many-evidence-items',
  )
  rejected(receiptWith({ evidence: [{ kind: 'nope', quote: BODY.split('\n')[0] }] }), 'evidence-kind-unknown:nope')
  rejected(receiptWith({ evidence: [{ kind: 'fatal', quote: 'x'.repeat(601) }] }), 'evidence-quote-length')
  // 读起来像正文，但并非原文子串——这类引用必须被拒绝。
  rejected(receiptWith({ evidence: [{ kind: 'fatal', quote: 'error[E9999]: phantom failure' }] }), 'unverifiable-quote')
})

test('a failed command must keep failure evidence', () => {
  const onlyWarning = receiptWith({ evidence: [{ kind: 'warning', quote: 'warning: unused variable: `total`' }] })
  assert.equal(parseReceipt(onlyWarning, { body: BODY, sourceHash: SOURCE_HASH, isError: true }).reason, 'missing-failure-evidence')
  assert.equal(parseReceipt(onlyWarning, { body: BODY, sourceHash: SOURCE_HASH, isError: false }).ok, true)
})

test('fenced JSON is tolerated and duplicate quotes collapse', () => {
  const fenced = ['Here is the receipt:', '```json', receiptWith(), '```'].join('\n')
  assert.equal(parseReceipt(fenced, { body: BODY, sourceHash: SOURCE_HASH, isError: true }).ok, true)

  const duplicated = receiptWith({
    evidence: [
      { kind: 'fatal', quote: 'error[E0308]: mismatched types' },
      { kind: 'fatal', quote: 'error[E0308]: mismatched types' },
    ],
  })
  assert.equal(parseReceipt(duplicated, { body: BODY, sourceHash: SOURCE_HASH, isError: true }).receipt.evidence.length, 1)
})

test('the rendered receipt carries the marker, the quotes and the reducer route', () => {
  const text = renderReceipt(
    {
      schema: RECEIPT_SCHEMA,
      source_sha256: 'abc',
      status: 'compile failed',
      uncertain: true,
      evidence: [{ kind: 'fatal', quote: 'error[E0308]: mismatched types', line: 1 }],
    },
    { model: 'test-model', provider: 'test-provider' },
  )
  assert.ok(text.startsWith(RECEIPT_MARKER))
  assert.match(text, /status=compile failed uncertain=true/)
  assert.match(text, /reducer_model=test-model/)
  assert.match(text, /- fatal \(line 1\): error\[E0308\]: mismatched types/)
})

test('a verified receipt replaces the log and the original is archived', async () => {
  const decision = await runListener(listenerFor(textStream(receiptWith())))
  assert.equal(decision.kind, 'accept')
  assert.ok(decision.content[0].text.startsWith(RECEIPT_MARKER))
  assert.ok(decision.content[0].text.length < BODY.length)

  const archived = await readFile(join(sessionRoot(SESSION_ID), 'objects', `${SOURCE_HASH}.txt`), 'utf8')
  assert.equal(archived, BODY)
})

test('every failure path leaves the original result untouched', async () => {
  const cases = [
    ['missing llm service', listenerFor(undefined)],
    ['thrown adapter failure', listenerFor(throwingLlm())],
    ['in-band error finish', listenerFor(inBandErrorLlm())],
    ['fabricated quote', listenerFor(textStream(receiptWith({ evidence: [{ kind: 'fatal', quote: 'nope' }] })))],
    ['wrong source hash', listenerFor(textStream(receiptWith({}, 'wrong-hash')))],
  ]
  for (const [label, listener] of cases) {
    assert.deepEqual(await runListener(listener), { kind: 'accept' }, `${label} must fail open`)
  }
})
