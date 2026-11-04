import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const root = join(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

/** Installed host version selects the matching pinned standard fixture. */
function hostVersion() {
  return JSON.parse(readFileSync(require.resolve('@deepseek-ai/dsh-agent-preset/package.json'), 'utf8')).version
}

function hostStandardPath(version = hostVersion()) {
  return join(root, 'tests', 'fixtures', `dsh-v${version}.standard.patch.yml`)
}

test('bundle patch installs only the host web bridge at root', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- insert:/)
  assert.match(patch, /- id: patchwork-agent/)
  assert.match(patch, /name: '@patchwork\/coding-agent'/)
  assert.doesNotMatch(patch, /@patchwork\/coding-agent\/runtime/)
})

test('bundle patch declares the agent preset alongside the plugin', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.deepEqual(pkg.dsh.bundle.patch, ['./cordis.patch.yml', './presets/patchwork.patch.yml'])
  // 0.1.7 起没有任何读者读 $DSH_HOME/.agent-presets/，preset 只能由声明行承载。
  assert.equal(existsSync(join(root, 'presets/patchwork/agent.cordis.yml')), false)
})

test('generated preset preserves host tools and adds scoped runtime and browser', () => {
  const work = mkdtempSync(join(tmpdir(), 'patchwork-preset-'))
  const host = join(work, 'standard.patch.yml')
  const out = join(work, 'out')
  try {
    writeFileSync(
      host,
      [
        `- insert:`,
        `    - id: preset-standard`,
        `      name: '@deepseek-ai/dsh-agent-preset'`,
        `      config:`,
        `        id: standard`,
        `        order: 1`,
        `        plugins:`,
        `          - id: persona`,
        `            name: '@deepseek-ai/dsh-persona'`,
        `            config:`,
        `              prefix: You are a coding agent.`,
        `          - id: tool-example`,
        `            name: '@example/tool'`,
        ``,
      ].join('\n'),
    )
    mkdirSync(out)
    execFileSync(process.execPath, ['scripts/gen-preset.mjs', '--out', out], {
      cwd: root,
      env: { ...process.env, DSH_HOST_STANDARD_YML: host },
    })
    const generated = readFileSync(join(out, 'patchwork.patch.yml'), 'utf8')
    assert.match(generated, /- id: preset-patchwork/)
    assert.match(generated, /^ {8}id: patchwork$/m)
    assert.match(generated, /name: '@patchwork\/coding-agent\/runtime'/)
    assert.equal((generated.match(/- id: patchwork-runtime/g) ?? []).length, 1)
    assert.doesNotMatch(generated, /dsh-mcp-client|patchwork-browser/)
    assert.match(generated, /- id: tool-example/)
    assert.match(generated, /prefix: You are a coding agent\./)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('committed preset carries the 0.1.7 host rows', () => {
  const preset = readFileSync(join(root, 'presets/patchwork.patch.yml'), 'utf8')
  // worker-thread 后端在 0.1.7 里换成了 ptc；persona 的单一 text 字段已退役。
  assert.match(preset, /name: '@deepseek-ai\/dsh-workflow-ptc'/)
  assert.doesNotMatch(preset, /dsh-workflow-worker-thread/)
  assert.doesNotMatch(preset, /text: >-/)
  assert.match(preset, /prefix: You are a coding agent powered by the \{\{model\}\} model\./)
  assert.match(preset, /- id: patchwork-runtime\n {12}name: '@patchwork\/coding-agent\/runtime'/)
  assert.doesNotMatch(preset, /dsh-mcp-client|patchwork-browser/)
})

test('committed preset keeps one owner for cross-version rows', () => {
  const preset = readFileSync(join(root, 'presets/patchwork.patch.yml'), 'utf8')
  // 0.2.2-alpha.3 folded list_agents into the main control package and removed
  // the `./list-agents` subpath. The main row already supplies it there.
  assert.doesNotMatch(preset, /dsh-tool-subagent-control\/list-agents/)
  assert.match(preset, /- id: tool-subagent-control\n {16}name: '@deepseek-ai\/dsh-tool-subagent-control'/)
  // 0.2.1 spells this `modelSelectionSettings`; 0.2.2 splits it into two keys.
  // Schemastery ignores unknown keys, so one row carries both spellings.
  assert.match(preset, /modelSelectionSettings: true/)
  assert.match(preset, /modelSelection: true/)
  assert.match(preset, /modelDiscovery: true/)
})

test('generated preset normalizes every pinned host standard', () => {
  for (const version of ['0.2.1-rc.2', '0.2.1-rc.5', '0.2.2-alpha.3']) {
    const host = hostStandardPath(version)
    assert.ok(existsSync(host), `missing pinned standard fixture for ${version}`)
    const work = mkdtempSync(join(tmpdir(), 'patchwork-preset-version-'))
    const out = join(work, 'out')
    try {
      mkdirSync(out)
      execFileSync(process.execPath, ['scripts/gen-preset.mjs', '--out', out], {
        cwd: root,
        env: { ...process.env, DSH_HOST_STANDARD_YML: host },
      })
      const generated = readFileSync(join(out, 'patchwork.patch.yml'), 'utf8')
      assert.doesNotMatch(generated, /dsh-tool-subagent-control\/list-agents/, version)
      assert.match(generated, /modelSelectionSettings: true/, version)
      assert.match(generated, /modelSelection: true/, version)
      assert.match(generated, /modelDiscovery: true/, version)
      assert.match(generated, /- id: patchwork-runtime\n {12}name: '@patchwork\/coding-agent\/runtime'/, version)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  }
})

test('profile installs Patchwork as a bundle layer', () => {
  const profile = JSON.parse(readFileSync(join(root, 'profiles/patchwork/package.json'), 'utf8'))
  assert.equal(profile.dependencies['@patchwork/coding-agent'], JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version)
  const base = profile.dependencies['@deepseek-ai/dsh-base']
  assert.match(base, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
  assert.equal(profile.dependencies['@deepseek-ai/dsh-web-app'], base)
  assert.equal(profile.dsh.profile.bundles.includes('@patchwork/coding-agent'), true)
})
