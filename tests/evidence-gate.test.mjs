import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EVIDENCE_HINT,
  hasShellEvidence,
  noteShellEvidence,
  sessionKey,
  shouldHintEvidence,
} from '../src/quality/evidence-gate.mjs'

test('sessionKey requires a real session id and never falls back to cwd', () => {
  assert.equal(sessionKey({ session: { header: { id: 's1', cwd: 'C:/proj' } } }), 's1')
  assert.equal(sessionKey({ id: 'agent', session: { header: { cwd: 'C:/proj' } } }), undefined)
})

test('completion without shell evidence hints once', () => {
  const key = 'C:/proj-evidence-test'
  assert.equal(hasShellEvidence(key), false)
  assert.equal(shouldHintEvidence(key, '这个功能已经完成了'), true)
  assert.equal(shouldHintEvidence(key, '又说一次已完成'), false)
  assert.match(EVIDENCE_HINT, /\[pw:evidence\]/)
})

test('unrelated shell success cannot suppress task evidence hint', () => {
  const key = 'C:/proj-with-shell'
  noteShellEvidence(
    { name: 'pwsh', agent: { session: { header: { id: key, cwd: key } } } },
    { isError: false },
  )
  assert.equal(hasShellEvidence(key), false)
  assert.equal(shouldHintEvidence(key, '已完成全部测试'), true)
})

test('error shell does not count as evidence', () => {
  const key = 'C:/proj-err-shell'
  noteShellEvidence(
    { name: 'bash', agent: { session: { header: { id: key, cwd: key } } } },
    { isError: true },
  )
  assert.equal(hasShellEvidence(key), false)
})

test('nonzero process exits and timeouts do not become successful verification evidence', () => {
  for (const [index, value] of [{ exitCode: 1 }, { timedOut: true }, { aborted: true }].entries()) {
    const key = `failed-process-${index}`
    noteShellEvidence({ name: 'pwsh', agent: { session: { header: { id: key } } } }, { isError: false, value })
    assert.equal(hasShellEvidence(key), false)
  }
})

test('non-claim text does not trigger', () => {
  assert.equal(shouldHintEvidence('C:/proj-neutral', '正在读取文件列表'), false)
})
