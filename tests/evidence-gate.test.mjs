import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EVIDENCE_HINT,
  hasShellEvidence,
  noteShellEvidence,
  sessionKey,
  shouldHintEvidence,
} from '../src/quality/evidence-gate.mjs'

test('sessionKey prefers cwd', () => {
  assert.equal(sessionKey({ session: { header: { cwd: 'C:/proj' } } }), 'C:/proj')
})

test('completion without shell evidence hints once', () => {
  const key = 'C:/proj-evidence-test'
  assert.equal(hasShellEvidence(key), false)
  assert.equal(shouldHintEvidence(key, '这个功能已经完成了'), true)
  assert.equal(shouldHintEvidence(key, '又说一次已完成'), false)
  assert.match(EVIDENCE_HINT, /\[pw:evidence\]/)
})

test('successful shell suppresses evidence hint', () => {
  const key = 'C:/proj-with-shell'
  noteShellEvidence(
    { name: 'pwsh', agent: { session: { header: { cwd: key } } } },
    { isError: false },
  )
  assert.equal(hasShellEvidence(key), true)
  assert.equal(shouldHintEvidence(key, '已完成全部测试'), false)
})

test('error shell does not count as evidence', () => {
  const key = 'C:/proj-err-shell'
  noteShellEvidence(
    { name: 'bash', agent: { session: { header: { cwd: key } } } },
    { isError: true },
  )
  assert.equal(hasShellEvidence(key), false)
})

test('non-claim text does not trigger', () => {
  assert.equal(shouldHintEvidence('C:/proj-neutral', '正在读取文件列表'), false)
})
