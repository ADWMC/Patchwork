import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeRunReport, verifyAuditDir, evaluateScenario, summarizeEvents } from '../scripts/audit-lib.mjs'

function events({ standalone = false, taskStatus = 'ready' } = {}) {
  return [
    { type: 'session', data: { id: 'session-audit-1', agentPreset: 'patchwork', cwd: 'C:/work' } },
    { type: 'user/message', data: { content: [{ type: 'text', text: 'fix and verify' }], source: { kind: 'user' } } },
    { type: 'tool/call', data: { callId: 'c1', name: 'patchwork_task', arguments: JSON.stringify({ action: 'check', id: 'tests' }) } },
    { type: 'tool/result', data: { message: { source: { callId: 'c1' }, content: [{ type: 'text', text: 'ok' }], isError: false } } },
    ...(standalone ? [{ type: 'tool/call', data: { callId: 'c2', name: 'pwsh', arguments: '{"command":"npm test"}' } }, { type: 'tool/result', data: { message: { source: { callId: 'c2' }, content: [{ type: 'text', text: 'ok' }], isError: false } } }] : []),
    { type: 'plugin:patchwork/task', data: { status: taskStatus, requirements: [] } },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'done' }] } } },
  ]
}

test('audit report captures assertions, hashes and verifies offline', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-audit-'))
  const session = join(dir, 'session.jsonl')
  await writeFile(session, events().map(item => JSON.stringify(item)).join('\n') + '\n')
  const reportDir = join(dir, 'run')
  const result = await writeRunReport({ sessionPath: session, scenario: 'task-check-output', outDir: reportDir, prompt: 'fix and verify', mainDshTouched: false })
  assert.equal(result.manifest.status, 'passed')
  assert.ok(result.manifest.artifacts.length >= 5)
  const verified = await verifyAuditDir(dir)
  assert.equal(verified.ok, true, JSON.stringify(verified.errors))
})

test('standalone shell is a hard failure and scenario evaluation is honest', async () => {
  const summary = summarizeEvents(events({ standalone: true, taskStatus: 'partial' }))
  const evaluation = evaluateScenario('task-check-output', summary)
  assert.equal(evaluation.status, 'failed')
  assert.equal(evaluation.assertions.find(item => item.id === 'no-standalone-shell').status, 'failed')
})
