import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TasteEngine, MAX_TASTE_RULES } from '../src/taste/engine.mjs'
import { checkCodeInvariants, checkDiffInvariants } from '../src/taste/sentinel.mjs'
import { CONFIG_PRESETS, MODEL_PRESETS, detectModelPreset, validateSettings } from '../src/config/fields.mjs'
import { resolveModelPreset } from '../src/config/model-presets-loader.mjs'
import { registerTaskLifecycle } from '../src/task/lifecycle.mjs'

test('TasteEngine defaults when .patchwork/taste.md is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pw-taste-test-'))
  try {
    const engine = new TasteEngine(dir)
    const contract = await engine.loadContract()
    assert.ok(contract.architecture.length > 0)
    assert.ok(contract.implementation.length > 0)
    assert.ok(contract.visual.length > 0)
    assert.ok(contract.banned.length > 0)

    const injection = await engine.getContextInjection(['src/app.jsx'])
    assert.match(injection, /\[Craftsmanship & Taste Invariants\]/)
    assert.match(injection, /\[FORBIDDEN\]/)
    assert.match(injection, /\[UI\]/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('TasteEngine parses custom markdown and injects targeted rules', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pw-taste-test-'))
  try {
    const engine = new TasteEngine(dir)
    const customMd = `
# Taste Contract

## 1. 架构品味 (Architectural Invariants)
- Always use SSOT in controllers

## 2. 实现品味 (Implementation Taste)
- Guard clauses only

## 3. 视觉与交互品味 (Visual & Interaction Taste)
- Strict 8px grid

## 4. 禁手清单 (Banned Anti-patterns / Negative Taste)
- Never delete test assertions
`
    const parsed = engine.parseContract(customMd)
    assert.deepEqual(parsed.architecture, ['Always use SSOT in controllers'])
    assert.deepEqual(parsed.implementation, ['Guard clauses only'])
    assert.deepEqual(parsed.visual, ['Strict 8px grid'])
    assert.deepEqual(parsed.banned, ['Never delete test assertions'])

    // UI-only injection
    engine.cachedContract = parsed
    const uiInj = await engine.getContextInjection(['src/view.css'])
    assert.match(uiInj, /Strict 8px grid/)
    assert.match(uiInj, /Never delete test assertions/)
    assert.doesNotMatch(uiInj, /Guard clauses only/)

    // Core-only injection
    const coreInj = await engine.getContextInjection(['src/server.mjs'])
    assert.match(coreInj, /Guard clauses only/)
    assert.match(coreInj, /Always use SSOT in controllers/)
    assert.doesNotMatch(coreInj, /Strict 8px grid/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('TasteEngine proposeRule handles duplicates and capacity limits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pw-taste-test-'))
  try {
    const engine = new TasteEngine(dir)
    await engine.loadContract()

    // Add unique rule
    const res1 = await engine.proposeRule('banned', 'Do not use eval()')
    assert.equal(res1.status, 'added')

    // Duplicate rule
    const res2 = await engine.proposeRule('banned', 'Do not use eval()')
    assert.equal(res2.status, 'duplicate')

    // Capacity limit
    for (let i = 0; i < 30; i++) {
      await engine.proposeRule('implementation', `Rule number ${i}`)
    }
    const contract = await engine.loadContract()
    const totalCount = Object.values(contract).reduce((acc, arr) => acc + arr.length, 0)
    assert.ok(totalCount <= MAX_TASTE_RULES)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('Invariants Sentinel catches empty catch blocks and deleted assertions', () => {
  const badCode1 = 'try { doSomething(); } catch (e) { }'
  const badCode2 = 'try { doSomething(); } catch {}'
  const goodCode = 'try { doSomething(); } catch (err) { logger.error(err); throw err; }'

  assert.equal(checkCodeInvariants(badCode1).length, 1)
  assert.equal(checkCodeInvariants(badCode2).length, 1)
  assert.equal(checkCodeInvariants(goodCode).length, 0)

  const badDiff = `
--- a/test.js
+++ b/test.js
@@ -10,3 +10,2 @@
-  assert.equal(result, 42)
+  // removed check
`
  const goodDiff = `
--- a/test.js
+++ b/test.js
@@ -10,3 +10,3 @@
-  const x = 1;
+  const x = 2;
   assert.equal(x, 2)
`
  assert.equal(checkDiffInvariants(badDiff).length, 1)
  assert.equal(checkDiffInvariants(goodDiff).length, 0)
})

test('CONFIG_PRESETS validate cleanly through validateSettings', () => {
  for (const [key, preset] of Object.entries(CONFIG_PRESETS)) {
    assert.ok(preset.label)
    assert.ok(preset.description)
    const result = validateSettings(preset.settings)
    assert.equal(result.ok, true, `Workflow preset ${key} settings failed validation: ${result.reason}`)
  }
})

test('MODEL_PRESETS validate cleanly and resolve proper cognitive nudges', () => {
  for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
    assert.ok(preset.label)
    assert.ok(preset.description)
    assert.ok(preset.cognitiveNudge)
    const result = validateSettings(preset.settings)
    assert.equal(result.ok, true, `Model preset ${key} settings failed validation: ${result.reason}`)
  }

  // Detect models
  assert.equal(detectModelPreset('deepseek-chat'), 'deepseek')
  assert.equal(detectModelPreset('deepseek-reasoner'), 'deepseek')
  assert.equal(detectModelPreset('step-3.5-flash'), 'stepfun')
  assert.equal(detectModelPreset('step-5-preview'), 'stepfun')

  // Resolve presets
  const resolvedAuto = resolveModelPreset({}, { model: 'step-3.5-flash' })
  assert.equal(resolvedAuto.id, 'stepfun')
  assert.match(resolvedAuto.cognitiveNudge, /StepFun/)

  const resolvedExplicit = resolveModelPreset({ modelPreset: 'deepseek' })
  assert.equal(resolvedExplicit.id, 'deepseek')
  assert.match(resolvedExplicit.cognitiveNudge, /DeepSeek/)
})

test('resolveModelPreset loads custom overrides from workspace .patchwork/model-presets.json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pw-model-preset-test-'))
  try {
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(join(dir, '.patchwork'), { recursive: true })
    await writeFile(join(dir, '.patchwork', 'model-presets.json'), JSON.stringify({
      stepfun: {
        label: 'Custom Overridden StepFun',
        cognitiveNudge: 'Custom Project Cognitive Nudge',
      },
    }))
    const resolved = resolveModelPreset({}, { model: 'step-3.5-flash' }, dir)
    assert.equal(resolved.label, 'Custom Overridden StepFun')
    assert.equal(resolved.cognitiveNudge, 'Custom Project Cognitive Nudge')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})


test('registerTaskLifecycle registers hooks with TasteEngine', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pw-taste-hook-'))
  try {
    const engine = new TasteEngine(dir)
    await engine.proposeRule('architecture', 'Custom SSOT Invariant')
    const listeners = new Map()
    registerTaskLifecycle({ on: (event, fn) => listeners.set(event, fn), tools: { register() {} }, commands: { register() {} } }, {}, engine)
    assert.ok(listeners.has('agent/pre-step'))
    assert.ok(listeners.has('agent/inbox/inserted'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})



