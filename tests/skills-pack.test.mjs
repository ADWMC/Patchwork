import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../assets/skills', import.meta.url))
const EXPECTED = ['anti-slop', 'architecture', 'code-review', 'collaborator', 'debt', 'debugging', 'documentation', 'evidence', 'improvement', 'memory', 'patchwork', 'retrieval', 'standards', 'web-ui']

test('skill packs exist with frontmatter name+description and valid references', async () => {
  const dirs = (await readdir(root, { withFileTypes: true }))
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
  assert.deepEqual(dirs, EXPECTED)

  for (const name of EXPECTED) {
    const path = join(root, name, 'SKILL.md')
    const raw = await readFile(path, 'utf8')
    assert.match(raw, /^---\n/, `${name} missing frontmatter`)
    assert.match(raw, new RegExp(`^name:\\s*${name}\\s*$`, 'm'), `${name} name field`)
    const desc = raw.match(/^description:\s*(.+)$/m)
    assert.ok(desc, `${name} description field`)
    assert.ok(desc[1].trim().length >= 20, `${name} description too short`)
    assert.ok(desc[1].trim().length <= 500, `${name} description too long`)
    const { size } = await stat(path)
    assert.ok(size < 4000, `${name} SKILL.md too large: ${size}`)
    for (const [, reference] of raw.matchAll(/\]\((references\/[\w./-]+)\)/g)) {
      assert.ok(!reference.includes('..'), `${name} reference escapes skill directory: ${reference}`)
      await stat(join(root, name, reference))
    }
  }
})
