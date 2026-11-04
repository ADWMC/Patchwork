import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import test from 'node:test'

const root = join(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const hostVersion = JSON.parse(readFileSync(require.resolve('@deepseek-ai/dsh-agent-preset/package.json'), 'utf8')).version
const supported = '>=0.2.1-rc.2 <0.3.0-0'
const manifests = [
  {
    label: 'coding agent',
    pkg: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')),
    hostPackages: ['@deepseek-ai/dsh-agent-preset', '@deepseek-ai/dsh-home-paths'],
  },
  {
    label: 'optional browser',
    pkg: JSON.parse(readFileSync(join(root, 'packages/browser/package.json'), 'utf8')),
    hostPackages: ['@deepseek-ai/dsh-home-paths'],
  },
]

// dsh-app-boot evaluates every plugin manifest against the running dsh version.
// A host package pinned in `dependencies` is hoisted into the profile and can
// shadow the host's own copy; @deepseek-ai/dsh-agent-preset@0.2.0-rc.2 then
// disabled every preset row (including patchwork) on dsh 0.2.1-rc.5.
for (const { label, pkg, hostPackages } of manifests) {
  test(`${label}: published dependencies never shadow host runtime packages`, () => {
    for (const name of hostPackages) {
      assert.equal(pkg.dependencies?.[name], undefined, `${name} must be a peer, not a bundled dependency`)
      assert.equal(pkg.devDependencies?.[name], hostVersion, `${name} follows the installed host for tests`)
      assert.equal(pkg.peerDependencies?.[name], supported)
    }
    assert.equal(pkg.engines?.dsh, supported, 'engines.dsh is the single compatibility declaration')
  })
}

test('host runtime peers accept the supported DSH range', () => {
  const pkg = manifests[0].pkg
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-llm'], supported)
})
