import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { evaluationOverlay } from '../scripts/prepare-skills-eval-overlay.mjs'

const preset = await readFile(fileURLToPath(new URL('../presets/patchwork.patch.yml', import.meta.url)), 'utf8')

test('isolated evaluation overlay exposes explicit rollback modes', () => {
  for (const mode of ['expanded', 'core', 'none']) {
    const overlay = evaluationOverlay(preset, mode)
    assert.match(overlay, /Generated for an isolated DSH evaluation/)
    assert.match(overlay, /name: '@patchwork\/coding-agent\/runtime'/)
    assert.equal((overlay.match(/skillsMode:|skillsEnabled:/g) ?? []).length, 1)
    if (mode === 'none') assert.match(overlay, /skillsEnabled: false/)
    else assert.match(overlay, new RegExp(`skillsMode: ${mode}`))
  }
  assert.throws(() => evaluationOverlay(preset, 'unknown'), /mode must be/)
  assert.throws(() => evaluationOverlay('unrelated', 'core'), /insert block not found/)
})
