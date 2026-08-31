import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('generated preset owns the Patchwork runtime', () => {
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
    assert.equal((generated.match(/@patchwork\/coding-agent/g) ?? []).length, 1)
    assert.match(generated, /- id: tool-example/)
    assert.doesNotMatch(readFileSync(join(import.meta.dirname, '..', 'cordis.patch.yml'), 'utf8'), /@patchwork\/coding-agent/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
