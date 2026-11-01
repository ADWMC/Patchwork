// Explicitly mount only in an isolated official DSH profile, never a primary instance.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { taskProjection, taskState, flushTasks } from '../../src/task/store.mjs'

const host = createRequire(join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh/package.json'))
const { installModelSelection } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-agent')).href)
const { createUserMessage } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-llm')).href)
export const name = 'patchwork-task-integration-acceptance'
export const inject = ['agents', 'sessions', 'agentPresets', 'agentDefaultModel']
export function apply(ctx) { void run(ctx).catch(error => { console.error(error.stack); ctx.get('appExit')(1) }) }

async function run(ctx) {
  if (!process.env.PATCHWORK_INTEGRATION_RESULT || !process.env.DSH_HOME.includes('patchwork-integration-')) throw new Error('explicit isolated environment required')
  await ctx.get('loader').await()
  if (process.env.PATCHWORK_INTEGRATION_RESTORE === '1') return restore(ctx)
  const selection = ctx.get('agentDefaultModel').currentSelection()
  const registry = ctx.get('agentPresets'), cwd = process.cwd()
  async function create(preset) {
    const { agent } = await ctx.get('agents').create({ sessionId: `session-${randomUUID()}`, meta: { cwd, agentPreset: preset },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: async c => { await registry.mount(c, preset); installModelSelection(c, { current: selection, assembled: undefined }) } })
    await registry.select(agent, preset)
    return agent
  }
  const native = await create('patchwork'), standard = await create('standard'), model = await create('patchwork')
  assert.equal(standard.ctx.tools.get('patchwork_task', standard), undefined)
  let serial = 0
  async function call(agent, name, args) {
    const id = `integration-${++serial}`
    return agent.ctx.tools.execute({ agent, name, arguments: args, callId: id, rootCallId: id, signal: new AbortController().signal })
  }
  const task = args => call(native, 'patchwork_task', args)
  await task({ action: 'define', baseRevision: 0, title: '真实宿主验收探针', phase: 'implement', references: [join(cwd, 'reference')], requirements: [
    { id: 'native-command', label: '实际命令退出状态', kind: 'command' },
    { id: 'document', label: '文档结构与路径', kind: 'artifact', targets: ['note'] },
  ] })
  const outside = await call(native, 'write', { file_path: join(cwd, '..', 'outside-proof.txt'), content: 'must not exist' })
  const ref = await call(native, 'write', { file_path: join(cwd, 'reference/proof.txt'), content: 'must not exist' })
  assert.equal(outside.isError, true); assert.equal(ref.isError, true)
  try { await readFile(join(cwd, 'native-note.md')); await call(native, 'read', { file_path: join(cwd, 'native-note.md') }) } catch { /* first run */ }
  const af = await call(native, 'write', { file_path: join(cwd, 'native-note.md'), content: '# Native evidence\nIsolated task.\n', then_run: { command: 'exit 7' } })
  assert.equal(af.value.thenRun.exitCode, 7)
  assert.notEqual(taskState(native).status, 'ready')
  const failed = await task({ action: 'check', baseRevision: taskState(native).revision, id: 'native-command', tool: 'pwsh', command: 'exit 7', description: 'Expected failure receipt' })
  assert.equal(failed.value.receipt.outcome, 'failed')
  await task({ action: 'correct', baseRevision: taskState(native).revision, title: '真实宿主纠正后验收', phase: 'verify', affected: ['native-command'] })
  await task({ action: 'artifact', baseRevision: taskState(native).revision, id: 'note', path: join(cwd, 'native-note.md') })
  await task({ action: 'check', baseRevision: taskState(native).revision, id: 'document', rules: { anchors: ['# Native evidence'], maxLength: 100 } })
  await task({ action: 'check', baseRevision: taskState(native).revision, id: 'native-command', tool: 'pwsh', command: "Write-Output 'NATIVE_TASK_OK'", description: 'Actual successful command' })
  assert.equal(taskState(native).status, 'ready')
  const stolen = native.ctx.tools.get('patchwork_task', native)
  // This blank-session composition switch is intentionally exercised on a separate agent.
  const blank = await create('patchwork'), blankTool = blank.ctx.tools.get('patchwork_task', blank)
  await registry.select(blank, 'standard')
  await assert.rejects(blankTool.execute({ action: 'inspect' }, { agent: blank }), /Patchwork/)
  assert.ok(stolen)

  await writeFile(join(cwd, 'sum.mjs'), 'export const sum = (a, b) => a - b\n')
  const acceptanceSource = "import test from 'node:test'; import assert from 'node:assert/strict'; import {sum} from './sum.mjs';\ntest('positive',()=>assert.equal(sum(2,3),5)); test('negative',()=>assert.equal(sum(-2,3),1));\n"
  await writeFile(join(cwd, 'acceptance.test.mjs'), acceptanceSource)
  const prompt = `真实集成任务：修复当前工作区 sum.mjs 的加法错误，只可改这个文件，不改 acceptance.test.mjs。必须真实调用工具。
先用 patchwork_task inspect 取 revision，再 define：title 为“加法修复与真实验收”，phase implement，requirements 仅一项（省略 coverage 则默认 all）{id:"sum-tests",label:"加法行为测试",kind:"command",targets:["sum"]}。
读取文件后修复；artifact 登记 sum.mjs 的绝对路径（id=sum），最后 patchwork_task check 使用顶层 id=sum-tests、command 和 description，通过宿主 pwsh 执行 node --test --test-isolation=none acceptance.test.mjs，description="Verify actual addition behavior"。每次 baseRevision 使用工具最新返回值，必要时 inspect。
不要额外派生代理、联网、发布或改其他文件。完成后给实际结果和文件绝对路径。`
  const timer = setTimeout(() => model.cancel({ kind: 'hook', reason: 'isolated integration timeout' }), 150000)
  model.followup(createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }))
  await model.whenIdle(); clearTimeout(timer)
  const completed = taskProjection(model)
  const modelEvents = model.session.snapshotEvents()
  const calls = modelEvents.flatMap(e => (e.data?.message?.content ?? []).filter(c => c.type === 'tool-call').map(c => ({ seq: e.seq, name: c.name })))
  assert.equal(completed?.status, 'ready', JSON.stringify({ state: completed?.status, end: modelEvents.findLast(e => e.type === 'turn/end')?.data }))
  assert.match(await readFile(join(cwd, 'sum.mjs'), 'utf8'), /a\s*\+\s*b/)
  assert.equal(await readFile(join(cwd, 'acceptance.test.mjs'), 'utf8'), acceptanceSource)
  model.followup(createUserMessage({ content: [{ type: 'text', text: '纠正后续阶段：现在只分析，不再改任何文件或运行命令。只回复 INTEGRATION_OK。' }], source: { kind: 'user' } }))
  const second = setTimeout(() => model.cancel({ kind: 'hook', reason: 'isolated followup timeout' }), 60000)
  await model.whenIdle(); clearTimeout(second)
  const corrected = taskProjection(model)
  assert.notEqual(corrected.status, 'ready')
  for (const a of [native, standard, model, blank]) { await flushTasks(a); await ctx.get('sessions').flush(a.session) }
  const result = { date: '2026-10-30', host: 'official DSH 0.2.1-rc.2', model: selection.model, cwd,
    nativeSession: native.session.header.id, modelSession: model.session.header.id, standardSession: standard.session.header.id,
    native: taskProjection(native), modelBeforeCorrection: completed, modelAfterCorrection: corrected,
    modelToolCalls: calls, acceptanceFileUnchanged: true,
    standardCatalogIsolated: true, switchedToolDenied: true, outsideDenied: true, referenceDenied: true, afFailureExit: 7,
    interpretation: 'Native driver probes and actual model task are separate evidence; not a controlled performance comparison.' }
  await writeFile(process.env.PATCHWORK_INTEGRATION_RESULT, JSON.stringify(result, null, 2))
  console.log('PATCHWORK_INTEGRATION_ACCEPTANCE_OK')
  if (process.env.PATCHWORK_INTEGRATION_KEEP_WEB !== '1') ctx.get('appExit')(0)
}

async function restore(ctx) {
  const prior = JSON.parse(await readFile(process.env.PATCHWORK_INTEGRATION_RESULT, 'utf8'))
  const registry = ctx.get('agentPresets'), selection = ctx.get('agentDefaultModel').currentSelection()
  async function setup(c) { await registry.mount(c, 'patchwork'); installModelSelection(c, { current: selection, assembled: undefined }) }
  const { agent: native } = await ctx.get('agents').resume({ resumeSessionId: prior.nativeSession, setup,
    agentOptions: { provider: selection.provider, model: selection.model } })
  const { agent: model } = await ctx.get('agents').resume({ resumeSessionId: prior.modelSession, setup,
    agentOptions: { provider: selection.provider, model: selection.model } })
  const restored = taskProjection(native), corrected = taskProjection(model)
  assert.equal(restored.status, 'ready'); assert.equal(restored.persistence, 'native')
  assert.equal(restored.revision, prior.native.revision)
  assert.notEqual(corrected.status, 'ready')
  assert.equal(corrected.requirements[0].status, 'stale')
  const forbiddenTarget = join(process.cwd(), 'unassessed-mutation.txt')
  const denied = await model.ctx.tools.execute({ agent: model, name: 'write',
    arguments: { file_path: forbiddenTarget, content: 'must not be written' },
    callId: 'restore-unassessed-write', signal: new AbortController().signal })
  assert.equal(denied.isError, true)
  assert.match(JSON.stringify(denied), /restate/)
  await assert.rejects(readFile(forbiddenTarget), /ENOENT/)
  const seed = native.session.snapshotEvents()
  const { agent: fork } = await ctx.get('agents').create({ sessionId: `session-${randomUUID()}`, setup,
    seed, inheritedEventCount: seed.length, meta: { cwd: process.cwd(), agentPreset: 'patchwork', parentSession: native.session.header.id, isSeeded: true },
    agentOptions: { provider: selection.provider, model: selection.model } })
  const forkState = taskProjection(fork)
  assert.notEqual(forkState.status, 'ready'); assert.equal(forkState.instance, null)
  assert.equal(forkState.source.kind, 'restored')
  for (const a of [native, model, fork]) { await flushTasks(a); await ctx.get('sessions').flush(a.session) }
  const summary = { hostColdRestart: true, realAgentResume: true, nativeStatus: restored.status, nativeRevision: restored.revision,
    correctionPreserved: corrected.requirements[0].status, realHostFork: true, forkSession: fork.session.header.id, forkStatus: forkState.status,
    forkInstance: forkState.instance, unassessedMutationDenied: true, nativeSession: native.session.header.id, modelSession: model.session.header.id }
  await writeFile(join(process.env.DSH_HOME, '..', 'results/restore.json'), JSON.stringify(summary, null, 2))
  console.log('PATCHWORK_COLD_RESTORE_AND_FORK_OK')
}
