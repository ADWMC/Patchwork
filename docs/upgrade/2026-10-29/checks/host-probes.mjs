// Contract probe: real Cordis/tools/fs/pwsh packages, synthetic agent, no model.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootPatchwork, loadDriver } from '../../../../tests/real-composition/harness.mjs'

const work = await mkdtemp(join(tmpdir(), 'patchwork-af-audit-'))
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = join(work, 'dsh-home')
const boot = await bootPatchwork({ actionFusion: true, observationPack: false, evidencePreservingReducer: false, onlineContextCompact: false })
try {
  const { createAgent } = await loadDriver()
  const { agent, agentKey, tools } = createAgent({ cwd: work, sessionId: 'audit-af-contract' })
  const fused = tools.get('write', agentKey)
  const file = join(work, 'fixture.txt')
  const value = await fused.execute(
    { file_path: file, content: 'audit fixture\n', then_run: { command: "Write-Output 'audit-ok'" } },
    { agent, signal: new AbortController().signal, callId: 'audit-fused-1' },
  )
  assert.equal(await readFile(file, 'utf8'), 'audit fixture\n')
  assert.equal(value.thenRun.status, 'succeeded')
  assert.equal(value.thenRun.exitCode, 0)
  assert.match(value.thenRun.output, /audit-ok/)
  console.log(JSON.stringify({
    id: 'AF-01',
    observation: 'Native write and follow-up through real host tools both succeed.',
    thenRun: value.thenRun,
    boundary: 'Real tools service with synthetic agent; this does not boot the full standard preset.',
  }, null, 2))
} finally {
  await boot.dispose()
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(work, { recursive: true, force: true })
}
