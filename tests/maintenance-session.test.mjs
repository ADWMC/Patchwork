import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyTask, createMaintenanceSession, summarizeOutput } from '../src/maintenance-session.mjs'

test('large tasks require a research record before implementation', () => {
  assert.equal(classifyTask('实现一个新的系统模块').requiresResearch, true)
  const session = createMaintenanceSession({ prompt: '实现一个新的系统模块', scope: ['src/index.mjs'] })
  assert.equal(session.canStartImplementation(), false)
  session.recordResearch({ query: 'similar plugin', source: 'https://github.com/example/project', decision: '参考生命周期' })
  assert.equal(session.canStartImplementation(), true)
})

test('session enforces change scope and verification before finishing', () => {
  const session = createMaintenanceSession({ prompt: '修复一个 bug', scope: ['src/index.mjs'] })
  assert.throws(() => session.markChanged('src/other.mjs'), /outside change scope/)
  session.markChanged('src/index.mjs')
  assert.equal(session.canFinish(), false)
  session.recordVerification({ name: 'focused test', passed: true })
  assert.equal(session.canFinish(), true)
})

test('long command output is truncated with an explicit marker', () => {
  const result = summarizeOutput('a'.repeat(80), 40)
  assert.match(result, /output truncated/)
  assert.ok(result.length <= 40)
})
