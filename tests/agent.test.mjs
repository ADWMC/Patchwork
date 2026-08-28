import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject, name } from '../src/index.mjs'

test('patchwork agent registers its maintainability prompt', () => {
  const sections = []
  apply({ systemPrompt: { section: value => sections.push(value) } })

  assert.deepEqual(inject, ['systemPrompt'])
  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, name)
  assert.equal(sections[0].order, 50)
  assert.match(sections[0].text, /主人翁心态/)
  assert.match(sections[0].text, /最小正确改动/)
})
