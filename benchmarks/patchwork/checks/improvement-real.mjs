import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { bootPatchwork, loadDriver } from '../../../tests/real-composition/harness.mjs'

const previous = process.env.DSH_HOME
if (!process.env.DSH_HOME || !process.env.PATCHWORK_BENCHMARK_ROOT) throw new Error('isolated benchmark environment required')
const boot = await bootPatchwork({ actionFusion: true, memoryEnabled: true })
try {
  const { createAgent, selectPreset } = await loadDriver()
  const { agent: patchwork, tools } = createAgent({ sessionId: 'benchmark-improvement-patchwork', preset: 'patchwork', cwd: process.cwd() })
  const { agent: standard } = createAgent({ sessionId: 'benchmark-improvement-standard', preset: 'standard', cwd: process.cwd() })
  const patchworkNames = tools.schemas(patchwork).map(schema => schema.name)
  const standardNames = tools.schemas(standard).map(schema => schema.name)
  const signal = new AbortController().signal
  const incident = await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'benchmark-improvement-incident', rootCallId: 'benchmark-improvement-incident', arguments: { action: 'incident', kind: 'failure', sourceReceiptIds: ['benchmark-host-receipt'], trigger: 'benchmark host failure', actionText: 'retain evidence' }, signal })
  const retained = tools.get('patchwork_improvement', patchwork)
  selectPreset(patchwork, 'standard')
  let stolenRejected = false
  try { await retained.execute({ action: 'list' }, { agent: patchwork }) } catch { stolenRejected = true }
  selectPreset(patchwork, 'patchwork')
  const list = await tools.execute({ agent: patchwork, name: 'patchwork_improvement', callId: 'benchmark-improvement-list', rootCallId: 'benchmark-improvement-list', arguments: { action: 'list' }, signal })
  const result = { schemaVersion: 1, host: 'official-dsh-composition', isolation: { dshHome: process.env.DSH_HOME, taskRoot: process.env.PATCHWORK_BENCHMARK_ROOT, mainDshTouched: false }, checks: {
    catalogIsolation: { patchworkHasImprovement: patchworkNames.includes('patchwork_improvement'), standardHasImprovement: standardNames.includes('patchwork_improvement') },
    realIncident: { isError: incident.isError === true, status: incident.value?.status ?? null, hasSource: Boolean(incident.value?.incident?.sourceReceiptIds?.length) },
    list: { isError: list.isError === true, incidentCount: list.value?.incidents?.length ?? 0, automaticActivation: list.value?.automaticActivation ?? null },
    stolenReference: { rejected: stolenRejected },
  } }
  const output = join(process.env.PATCHWORK_BENCHMARK_ROOT, 'improvement-real.json')
  await mkdir(process.env.PATCHWORK_BENCHMARK_ROOT, { recursive: true })
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`)
  if (!result.checks.catalogIsolation.patchworkHasImprovement || result.checks.catalogIsolation.standardHasImprovement || !result.checks.realIncident.status || !stolenRejected) process.exitCode = 1
  console.log(JSON.stringify(result))
} finally {
  await boot.dispose()
  if (previous === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previous
}
