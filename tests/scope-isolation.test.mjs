import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedAgent } from './helpers/agent.mjs'
import { isPatchworkAgent, resolvePatchworkAgent } from '../src/scope.mjs'
import { submitReview } from '../src/review/review-command.mjs'
import { registerStructureHook } from '../src/hook/post-execute-hook.mjs'
import { registerObservationPack } from '../src/mechanisms/observation-pack/index.mjs'
import { registerEvidencePreservingReducer } from '../src/mechanisms/evidence-preserving-reducer/index.mjs'
import { registerOnlineContextCompact } from '../src/mechanisms/online-context-compact/index.mjs'
import { createFusedDefinition } from '../src/mechanisms/action-fusion/fused-tool.mjs'
import { collectToolEvidence, runtimeSnapshot } from '../src/ui/runtime-state.mjs'
import { sessionKey, noteShellEvidence, hasShellEvidence, shouldHintEvidence } from '../src/quality/evidence-gate.mjs'

test('composition authority is fail closed, ignores forged headers and follows rebind', () => {
  assert.equal(isPatchworkAgent({ session: { header: { id: 'forged', agentPreset: 'patchwork' } } }), false)
  assert.equal(isPatchworkAgent({ ctx: { get: () => { throw Error('offline') } }, session: { header: { id: 'unknown' } } }), false)
  const agent = scopedAgent({}, 'standard')
  assert.equal(isPatchworkAgent(agent), false)
  agent.selectPreset('patchwork')
  assert.equal(isPatchworkAgent(agent), true)
  agent.selectPreset('standard')
  assert.equal(isPatchworkAgent(agent), false)
  const ctx = { get: () => ({ get: () => agent }) }
  assert.equal(resolvePatchworkAgent(ctx, 'different-session'), undefined)
})

test('standard and unknown agents get unchanged projections, no prompt, reducer or storage reads', async () => {
  for (const agent of [scopedAgent({}, 'standard'), { session: { header: { id: 'unknown' } } }]) {
    for (const register of [registerStructureHook, registerObservationPack, registerEvidencePreservingReducer]) {
      let listener
      const ctx = {
        on: (event, fn) => { if (event === 'tools/post-execute') listener = fn },
        tools: { register() {} },
        get: () => { assert.fail('non-Patchwork must not resolve a reducer service') },
      }
      register(ctx)
      const original = { kind: 'accept', additionalContexts: [] }
      let calls = 0
      const result = await listener({ agent, name: 'pwsh', callId: 'foreign', arguments: { command: 'cargo test' } },
        { isError: false, content: [{ type: 'text', text: 'all tests pass\n'.repeat(2000) }] },
        async () => { calls++; return original })
      assert.equal(result, original)
      assert.equal(calls, 1)
    }
    collectToolEvidence({ agent, callId: 'foreign', name: 'read' }, { content: [{ type: 'text', text: 'PRIVATE' }] })
    assert.equal(runtimeSnapshot(agent.session.header.id), null)
  }
})

test('retained tool and review references cannot run from another preset', async () => {
  const agent = scopedAgent({}, 'standard')
  let definitions = []
  const ctx = { tools: { register: def => definitions.push(def) }, on() {} }
  registerObservationPack(ctx)
  registerOnlineContextCompact(ctx)
  for (const def of definitions) await assert.rejects(def.execute({}, { agent }), /Patchwork agent preset/)
  await assert.rejects(submitReview({ agent, rawInput: 'anything' }), /Patchwork agent preset/)
  let mutations = 0
  const fused = createFusedDefinition({ original: {
    name: 'write', output: { schema: {}, render: () => [] }, execute: () => { mutations++ },
  }, runThenRun: () => { assert.fail('foreign shell') } })
  await assert.rejects(fused.execute({ then_run: { command: 'echo leak' } }, { agent }), /Patchwork agent preset/)
  assert.equal(mutations, 0)
})

test('same cwd does not share evidence and missing ids do not share a default bucket', () => {
  const a = scopedAgent({ session: { header: { id: 'scope-evidence-A', cwd: 'same' } } })
  const b = scopedAgent({ session: { header: { id: 'scope-evidence-B', cwd: 'same' } } })
  noteShellEvidence({ name: 'pwsh', agent: a }, { isError: false })
  assert.equal(hasShellEvidence(sessionKey(a)), false)
  assert.equal(hasShellEvidence(sessionKey(b)), false)
  assert.equal(shouldHintEvidence(sessionKey(b), 'all tests pass'), true)
  assert.equal(shouldHintEvidence(undefined, 'all tests pass'), false)
})
