import assert from 'node:assert/strict'
import test from 'node:test'
import { actionFusion, contextGrowth, observationPack, reducer, summarize } from '../benchmark/lib/counterfactual.mjs'
import { extractFacts, parseEvents } from '../benchmark/lib/session-facts.mjs'

const request = (turn, step, { input = 100, output = 10, cache = 1000 } = {}) => ({
  seq: turn * 100 + step,
  turn,
  step,
  inputTokens: input,
  outputTokens: output,
  totalTokens: input + output + cache,
  cacheReadTokens: cache,
  reasoningTokens: 0,
})

const result = (turn, step, toolName, { bytes = 2048, tokens = 512, command, isError = false } = {}) => ({
  seq: turn * 100 + step + 0.5,
  turn,
  step,
  callId: `call-${turn}-${step}`,
  toolName,
  command,
  isError,
  bytes,
  tokens,
})

test('a removed request costs its whole context, cache reads included', () => {
  const session = {
    requests: [request(1, 1), request(1, 2)],
    results: [result(1, 1, 'edit'), result(1, 2, 'pwsh', { command: 'npm test' })],
  }
  const fusion = actionFusion(session)
  assert.equal(fusion.candidates, 1)
  assert.equal(fusion.savedRequests, 1)
  // 100 输入 + 1000 缓存读 + 10 输出；漏掉缓存读会严重低估。
  assert.equal(fusion.savedTokens, 1110)
})

test('fusion ignores pairs that are not an adjacent mutation then shell', () => {
  const notAdjacent = {
    requests: [request(1, 1), request(1, 2)],
    results: [result(1, 1, 'edit'), result(1, 2, 'read')],
  }
  assert.equal(actionFusion(notAdjacent).candidates, 0)

  const twoCalls = {
    requests: [request(1, 1), request(1, 2)],
    results: [result(1, 1, 'edit'), result(1, 2, 'pwsh'), result(1, 2, 'read')],
  }
  assert.equal(actionFusion(twoCalls).candidates, 0)
})

test('observation pack counts one saving per later request and subtracts the handle', () => {
  const session = {
    requests: [request(1, 1), request(1, 2), request(1, 3)],
    results: [result(1, 1, 'pwsh', { bytes: 20 * 1024, tokens: 5000 })],
  }
  const saving = observationPack(session, { placeholderTokens: 300 })
  assert.equal(saving.candidates, 1)
  assert.equal(saving.replays, 2) // 只有 (1,2) 与 (1,3) 会带上它
  assert.equal(saving.savedTokens, (5000 - 300) * 2)
})

test('observation pack skips small, failed and unmeasured results', () => {
  const session = {
    requests: [request(1, 1), request(1, 2)],
    results: [
      result(1, 1, 'pwsh', { bytes: 1024, tokens: 100 }),
      result(1, 1, 'pwsh', { bytes: 20 * 1024, tokens: 5000, isError: true }),
      result(1, 1, 'pwsh', { bytes: 20 * 1024, tokens: null }),
    ],
  }
  const saving = observationPack(session)
  assert.equal(saving.candidates, 1) // 失败的被排除，小结果被排除，未测量的算候选
  assert.equal(saving.measured, 0)
  assert.equal(saving.savedTokens, 0)
})

test('the reducer only claims diagnostic commands', () => {
  const session = {
    requests: [request(1, 1), request(1, 2)],
    results: [
      result(1, 1, 'pwsh', { bytes: 8192, tokens: 2048, command: 'cargo test' }),
      result(1, 1, 'pwsh', { bytes: 8192, tokens: 2048, command: 'Get-ChildItem' }),
      result(1, 1, 'read', { bytes: 8192, tokens: 2048, command: 'pytest' }),
      result(1, 1, 'pwsh', { bytes: 1024, tokens: 256, command: 'cargo test' }),
    ],
  }
  const saving = reducer(session, { receiptTokens: 400 })
  assert.equal(saving.candidates, 1)
  assert.equal(saving.savedTokens, (2048 - 400) * 1)
})

test('summarize reports totals and how much of the results were measured', () => {
  const session = {
    requests: [request(1, 1), request(1, 2)],
    results: [result(1, 1, 'pwsh', { bytes: 100, tokens: 25 }), result(1, 2, 'pwsh', { bytes: 300, tokens: null })],
  }
  const facts = summarize(session)
  assert.equal(facts.requests, 2)
  assert.equal(facts.turns, 1)
  assert.equal(facts.toolBytes, 400)
  assert.equal(facts.tokenCoverage, 0.5)
  assert.equal(facts.cacheReadTokens, 2000)
})

test('context growth reports the peak and the turn boundaries', () => {
  const session = { requests: [request(1, 1, { cache: 10 }), request(2, 1, { cache: 90 }), request(2, 2, { cache: 50 })] }
  const growth = contextGrowth(session)
  // 上下文规模 = 非缓存输入 + 缓存读取；最大的是 (2,1) 的 100 + 90。
  assert.equal(growth.peakTokens, 190)
  assert.equal(growth.turnBoundaries, 2)
})

test('facts are extracted from the real event shapes', () => {
  const events = parseEvents(
    [
      JSON.stringify({ type: 'tool/call', seq: 17, data: { turn: 1, step: 1, callId: 'c1', name: 'pwsh', arguments: '{"command":"npm test","description":"x"}' } }),
      JSON.stringify({
        type: 'tool/result',
        seq: 18,
        data: {
          turn: 1,
          step: 1,
          message: { role: 'tool', id: 'm18', source: { kind: 'tool', callId: 'c1' }, toolCallId: 'c1', isError: true, content: [{ type: 'text', text: 'boom' }] },
        },
      }),
      JSON.stringify({ type: 'assistant/message', seq: 19, data: { turn: 1, step: 1, usage: { inputTokens: 5, outputTokens: 6, totalTokens: 11, cacheReadTokens: 7 } } }),
      'not json',
    ].join('\n'),
  )
  const facts = extractFacts(events, () => 42)
  assert.equal(facts.requests.length, 1)
  assert.equal(facts.requests[0].cacheReadTokens, 7)
  assert.equal(facts.results.length, 1)
  assert.equal(facts.results[0].toolName, 'pwsh')
  assert.equal(facts.results[0].command, 'npm test')
  assert.equal(facts.results[0].isError, true)
  assert.equal(facts.results[0].bytes, 4)
  assert.equal(facts.results[0].tokens, 42)
})
