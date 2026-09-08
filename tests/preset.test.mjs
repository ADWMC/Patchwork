import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('bundle patch registers the Patchwork plugin on the profile root', () => {
  const patch = readFileSync(join(import.meta.dirname, '..', 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- insert:/)
  assert.match(patch, /- id: patchwork-agent/)
  assert.match(patch, /name: '@patchwork\/coding-agent'/)
})

test('generated preset exposes host tools without remounting the plugin', () => {
  const root = mkdtempSync(join(tmpdir(), 'patchwork-preset-'))
  const host = join(root, 'standard.yml')
  const out = join(root, 'out')
  try {
    writeFileSync(host, "- id: persona\n  name: '@deepseek-ai/dsh-persona'\n\n- id: tool-example\n  name: '@example/tool'\n")
    mkdirSync(out)
    execFileSync(process.execPath, ['scripts/gen-preset.mjs', '--out', out], {
      cwd: join(import.meta.dirname, '..'),
      env: { ...process.env, DSH_HOST_STANDARD_YML: host },
    })
    const generated = readFileSync(join(out, 'agent.cordis.yml'), 'utf8')
    assert.doesNotMatch(generated, /@patchwork\/coding-agent/)
    assert.match(generated, /- id: tool-example/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('profile installs Patchwork as a bundle layer', () => {
  const profile = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'profiles/patchwork/package.json'), 'utf8'))
  assert.equal(profile.dependencies['@patchwork/coding-agent'], '0.1.2')
  assert.equal(profile.dsh.profile.bundles.includes('@patchwork/coding-agent'), true)
})
