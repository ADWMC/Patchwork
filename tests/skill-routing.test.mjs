import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const path = fileURLToPath(new URL('./fixtures/skill-routing.json', import.meta.url))
const corpus = JSON.parse(await readFile(path, 'utf8'))

test('routing corpus covers each shipped skill with nearby negatives', async () => {
  const { readdir } = await import('node:fs/promises')
  const skillsRoot = fileURLToPath(new URL('../assets/skills', import.meta.url))
  const shipped = (await readdir(skillsRoot, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort()
  assert.deepEqual(Object.keys(corpus).sort(), shipped)
  for (const [name, cases] of Object.entries(corpus)) {
    assert.ok(cases.positive.length >= 4 && cases.negative.length >= 4, `${name}: insufficient contrast cases`)
    assert.equal(new Set([...cases.positive, ...cases.negative]).size, cases.positive.length + cases.negative.length)
    for (const prompt of [...cases.positive, ...cases.negative]) assert.ok(prompt.trim().length > 0, `${name}: empty routing prompt`)
  }
})
