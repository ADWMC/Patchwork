import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const originalDshHome = process.env.DSH_HOME
const isolatedDshHome = await mkdtemp(join(tmpdir(), 'patchwork-real-improvement-'))
process.env.DSH_HOME = isolatedDshHome
const { bootPatchwork, loadDriver } = await import('../tests/real-composition/harness.mjs')
const boot = await bootPatchwork({ actionFusion: true, memoryEnabled: true })
const startedAt = new Date().toISOString()
try {
  const { createAgent, selectPreset } = await loadDriver()
  const { agent: patchwork, tools } = createAgent({ sessionId: 'improvement-patchwork', preset: 'patchwork', cwd: process.cwd() })
  const { agent: standard } = createAgent({ sessionId: 'improvement-standard', preset: 'standard', cwd: process.cwd() })
  const patchworkNames = tools.schemas(patchwork).map(schema => schema.name)
  const standardNames = tools.schemas(standard).map(schema => schema.name)
  const incident = await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'real-improvement-incident', rootCallId: 'real-improvement-incident',
    arguments: { action: 'incident', kind: 'failure', sourceReceiptIds: ['real-host-receipt'], trigger: 'real host failure', actionText: 'retain evidence' }, signal: new AbortController().signal })
  const retained = tools.get('patchwork_improvement', patchwork)
  selectPreset(patchwork, 'standard')
  let stolenRejected = false
  try { await retained.execute({ action: 'list' }, { agent: patchwork }) } catch { stolenRejected = true }
  selectPreset(patchwork, 'patchwork')
  const list = await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'real-improvement-list', rootCallId: 'real-improvement-list', arguments: { action: 'list' }, signal: new AbortController().signal })
  const result = {
    schemaVersion: 1, executedAt: startedAt, host: 'official-dsh-composition',
    isolation: { dshHome: isolatedDshHome, workspace: process.cwd(), mainDshTouched: false },
    checks: {
      catalogIsolation: { patchworkHasImprovement: patchworkNames.includes('patchwork_improvement'), standardHasImprovement: standardNames.includes('patchwork_improvement') },
      realIncident: { isError: incident.isError === true, status: incident.value?.status ?? null, hasSource: Boolean(incident.value?.incident?.sourceReceiptIds?.length) },
      list: { isError: list.isError === true, incidentCount: list.value?.incidents?.length ?? 0, automaticActivation: list.value?.automaticActivation ?? null },
      stolenReference: { rejected: stolenRejected },
    },
  }
  await mkdir(join(process.cwd(), 'docs', 'checks'), { recursive: true })
  await writeFile(join(process.cwd(), 'docs', 'checks', 'improvement-real.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} finally {
  await boot.dispose()
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
}
