import assert from 'node:assert/strict'
import test from 'node:test'
import { formatBytes, formatElapsed, logFacts, logReason, logTitle, logTone, matchesLog } from '../src/client/log-presentation.mjs'
import { PANEL_CSS } from '../src/client/panel-styles.mjs'

test('log presentation uses readable titles while preserving decision semantics', () => {
  assert.equal(logTitle({ mechanism: 'af', event: 'success' }), '接续执行完成')
  assert.equal(logTitle({ mechanism: 'code', event: 'success' }), '代码检索完成')
  assert.match(logReason({ reason: 'code-graph-started' }), /已启动/)
  assert.equal(logTitle({ mechanism: 'epr', event: 'decision', reason: 'retained' }), '关键证据已保留')
  assert.match(logReason({ reason: 'non-positive-saving' }), /预估节省不足/)
  assert.equal(logTitle({ mechanism: 'unknown', event: 'new-event' }), '机制运行记录')
  assert.equal(logReason({ reason: 'unknown-secret-value' }).includes('unknown-secret-value'), false)
  assert.equal(logTone({ level: 'warn', event: 'success' }), 'warn')
  assert.equal(logTone({ level: 'error' }), 'error')
  assert.equal(logTone({ level: 'info', event: 'success' }), 'success')
})

test('details distinguish zero, unavailable and estimated versus measured values', () => {
  const facts = Object.fromEntries(logFacts({ exitCode: 0, elapsedMs: 0, contextTokens: 0,
    sourceBytes: 0, estimatedSaving: -140, measuredSaving: 0, usage: { inputTokens: 0 } }))
  assert.equal(facts['执行结果'], '退出码 0')
  assert.equal(facts['耗时'], '0 ms')
  assert.equal(facts['原文大小'], '0 B')
  assert.equal(facts['估计节省 tokens'], -140)
  assert.equal(facts['实际节省 tokens'], 0)
  assert.equal(facts['输入 tokens'], 0)
  assert.equal(Object.fromEntries(logFacts({}))['执行结果'], undefined)
  assert.equal(Object.fromEntries(logFacts({ exitCode: null }))['执行结果'], undefined)
})

test('log search composes with mechanism and severity filters', () => {
  const entry = { mechanism: 'af', event: 'success', level: 'info', reason: 'command-succeeded', commandHash: 'abc123' }
  assert.equal(matchesLog(entry, { query: '接续执行' }), true)
  assert.equal(matchesLog(entry, { query: '  ABC123 ' }), true)
  assert.equal(matchesLog(entry, { query: 'command-succeeded' }), true)
  assert.equal(matchesLog(entry, { query: '不存在' }), false)
  assert.equal(matchesLog(entry, { mechanism: 'op' }), false)
  assert.equal(matchesLog(entry, { level: 'error' }), false)
  assert.equal(matchesLog(entry, { query: '   ', mechanism: 'af', level: 'info' }), true)
})

test('byte and duration formatting handles zero and missing measurements', () => {
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(formatBytes(1048576), '1.0 MB')
  assert.equal(formatBytes(undefined), null)
  assert.equal(formatElapsed(1029), '1.03 秒')
  assert.equal(formatElapsed(4), '4 ms')
  assert.equal(formatElapsed(null), null)
})

test('CSS escapes do not turn into JavaScript control characters', () => {
  assert.equal(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(PANEL_CSS), false)
})
