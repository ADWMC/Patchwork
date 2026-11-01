import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  HANDLE_PATTERN,
  countLines,
  handleFor,
  isTextOnly,
  pageText,
  placeholderText,
  shouldPack,
  tailText,
} from '../src/mechanisms/observation-pack/observation.mjs'
import { appendLedger, ledgerPath } from '../src/mechanisms/observation-pack/ledger.mjs'
import { readObject, writeObject } from '../src/util/content-archive.mjs'
import { registerObservationPack } from '../src/mechanisms/observation-pack/index.mjs'
import { scopedAgent } from './helpers/agent.mjs'

test('a recalled page over the packing threshold reaches the model unchanged', async () => {
  let postExecute
  registerObservationPack({
    tools: { register() {} },
    on(event, listener) { if (event === 'tools/post-execute') postExecute = listener },
  })
  const content = [{ type: 'text', text: 'recalled exact bytes\n'.repeat(700) }]
  const decision = { kind: 'accept', content }
  assert.equal(await postExecute(
    { name: 'obs_recall', callId: 'recall-page', agent: scopedAgent() },
    { isError: false, content }, async () => decision,
  ), decision)
})

test('bounded native task handoff is not replaced by an observation handle', async () => {
  let postExecute
  registerObservationPack({ tools: { register() {} }, on(event, fn) { if (event === 'tools/post-execute') postExecute = fn } })
  const content = [{ type: 'text', text: '界'.repeat(7000) }]
  const decision = { kind: 'accept', content }
  const result = await postExecute({ name: 'patchwork_task', arguments: { action: 'handoff' }, agent: scopedAgent(), callId: 'handoff' }, { isError: false, content }, async () => decision)
  assert.equal(result, decision)
  assert.equal(result.content[0].text.length, 7000)
})

test('process and fused validation failures stay visible even if dispatch itself succeeded', async () => {
  let listener
  registerObservationPack({ tools: { register() {} }, on(_event, callback) { listener = callback } })
  const content = [{ type: 'text', text: 'failure evidence\n'.repeat(1000) }]
  const decision = { kind: 'accept', content }
  for (const value of [{ exitCode: 1 }, { timedOut: true }, { aborted: true }, { thenRun: { status: 'failed', exitCode: 1 } }]) {
    assert.equal(await listener({ name: 'pwsh', callId: 'failed', agent: scopedAgent() }, { isError: false, value, content }, async () => decision), decision)
  }
  const renderedOnly = [{ type: 'text', text: content[0].text + '\n[exit code: 2]' }]
  const renderedDecision = { kind: 'accept', content: renderedOnly }
  assert.equal(await listener({ name: 'pwsh', agent: scopedAgent() }, { isError: false, content: renderedOnly }, async () => renderedDecision), renderedDecision)
})

/** 每页都取回并迭代到 done，模拟 obs_recall 的真实调用序列。 */
function recallAll(text, options) {
  const buffer = Buffer.from(text, 'utf8')
  let offset = 0
  const pages = []
  for (let guard = 0; offset < buffer.length; guard += 1) {
    assert.ok(guard < 10_000, 'paging must terminate')
    const page = pageText(buffer, offset, options)
    assert.ok(page.nextOffset > offset, `paging must advance (offset=${offset})`)
    pages.push(page)
    offset = page.nextOffset
  }
  return { pages, joined: pages.map(page => page.chunk).join('') }
}

test('only successful oversized plain-text results are packed', () => {
  const text = [{ type: 'text', text: 'x' }]
  assert.equal(shouldPack({ isError: false, content: text, byteLength: 20 * 1024 }), true)
  assert.equal(shouldPack({ isError: true, content: text, byteLength: 20 * 1024 }), false)
  assert.equal(shouldPack({ isError: false, content: text, byteLength: 1024 }), false)
  assert.equal(
    shouldPack({ isError: false, content: [...text, { type: 'image', text: '' }], byteLength: 20 * 1024 }),
    false,
  )
  assert.equal(shouldPack({ isError: false, content: [], byteLength: 20 * 1024 }), false)
  assert.equal(isTextOnly([{ type: 'text', text: '' }]), true)
})

test('handles are content addressed and stable', () => {
  const first = handleFor('bash', 'call-1', 'abc')
  assert.match(first, HANDLE_PATTERN)
  assert.equal(handleFor('bash', 'call-1', 'abc'), first)
  assert.notEqual(handleFor('bash', 'call-2', 'abc'), first)
  assert.notEqual(handleFor('bash', 'call-1', 'abd'), first)
})

test('paged recall reproduces the original bytes exactly', () => {
  const body = `${'诊断行 line\n'.repeat(400)}中文与 emoji 🚀 混排\n${'tail\n'.repeat(50)}`
  for (const options of [undefined, { maxBytes: 64 }, { maxBytes: 7 }, { maxBytes: 1 }, { maxLines: 3 }]) {
    const { joined } = recallAll(body, options)
    assert.equal(joined, body, `round trip failed for ${JSON.stringify(options)}`)
  }
})

test('a page never ends inside a multi-byte character', () => {
  const body = '🚀'.repeat(20) + '中文'.repeat(20)
  const { pages } = recallAll(body, { maxBytes: 3 })
  assert.ok(pages.length > 5)
  for (const page of pages) assert.doesNotMatch(page.chunk, /\uFFFD/)
})

test('the line budget bounds a page and the offset still advances', () => {
  const body = 'a\nb\nc\nd\ne\nf\ng\n'
  const page = pageText(Buffer.from(body, 'utf8'), 0, { maxLines: 2 })
  assert.equal(page.chunk, 'a\nb\n')
  assert.equal(page.nextOffset, 4)
  assert.equal(page.done, false)
})

test('recalling past the end terminates with an empty page', () => {
  const buffer = Buffer.from('short', 'utf8')
  const page = pageText(buffer, buffer.length, {})
  assert.deepEqual(page, { chunk: '', nextOffset: buffer.length, done: true })
})

test('the placeholder names the handle, the size and the recall path', () => {
  const text = placeholderText({ handle: 'obs_0123456789abcdef01234567', byteLength: 12345, lineCount: 300, excerpt: 'head' })
  assert.match(text, /obs_0123456789abcdef01234567/)
  assert.match(text, /12345 bytes, 300 lines/)
  assert.match(text, /obs_recall/)
  assert.match(text, /head/)
})

test('a bounded tail excerpt exposes the final summary without a recall round trip', () => {
  const text = placeholderText({ handle: 'obs_0123456789abcdef01234567', byteLength: 20000, lineCount: 800, excerpt: 'start', tailExcerpt: '148 tests; 0 failures' })
  assert.match(text, /--- tail excerpt ---\n148 tests; 0 failures/)
  assert.match(text, /obs_recall/)
  const excerpt = tailText(Buffer.from('中文🚀'.repeat(100)), 13)
  assert.doesNotMatch(excerpt, /\uFFFD/)
  assert.ok(Buffer.byteLength(excerpt) <= 13)
})

test('line counting treats a non-terminated final line as a line', () => {
  assert.equal(countLines(Buffer.from('a\nb', 'utf8')), 2)
  assert.equal(countLines(Buffer.from('a\nb\n', 'utf8')), 3)
  assert.equal(countLines(Buffer.from('', 'utf8')), 1)
})

test('the archive is exclusive and fails closed on a mismatched payload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-archive-'))
  try {
    const handle = handleFor('bash', 'call-1', 'h')
    const first = await writeObject(root, handle, 'body one')
    assert.equal(first.reused, false)
    assert.equal(await readFile(first.path, 'utf8'), 'body one')

    const again = await writeObject(root, handle, 'body one')
    assert.equal(again.reused, true)

    await assert.rejects(() => writeObject(root, handle, 'body two'), /refusing to reuse a different payload/)
    assert.deepEqual(await readObject(root, handle), Buffer.from('body one', 'utf8'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the ledger appends one JSON object per event', async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-ledger-'))
  try {
    await appendLedger(root, { kind: 'placeholder', handle: 'obs_x', bytes: 10 })
    await appendLedger(root, { kind: 'recall', handle: 'obs_x', offset: 0 })
    const lines = (await readFile(ledgerPath(root), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(lines.map(line => line.kind), ['placeholder', 'recall'])
    assert.match(lines[0].timestamp, /^\d{4}-\d{2}-\d{2}T/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
