import assert from 'node:assert/strict'
import test from 'node:test'
import { compareVersions, isNewer, packageVersion, releaseApiUrl, repositoryUrl } from '../src/util/version.mjs'

test('semver precedence handles releases and prereleases', () => {
  assert.equal(compareVersions('1.0.1', '1.0.0'), 1)
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1)
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2'), -1)
  assert.equal(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10'), -1)
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0'), -1)
  assert.equal(compareVersions('1.0.0+build.1', '1.0.0'), 0)
  assert.equal(compareVersions('not-a-version', '1.0.0'), null)
  assert.equal(isNewer('1.0.1', '1.0.0'), true)
  assert.equal(isNewer('v1.0.1'.replace(/^v/, ''), '1.0.0'), true)
  assert.equal(isNewer('1.0.0', '1.0.0'), false)
  assert.equal(isNewer('bad', '1.0.0'), false)
})

test('the release feed only accepts GitHub repository URLs', () => {
  assert.equal(releaseApiUrl('git+https://github.com/ADWMC/Patchwork.git'), 'https://api.github.com/repos/ADWMC/Patchwork/releases/latest')
  assert.equal(releaseApiUrl('https://github.com/ADWMC/Patchwork'), 'https://api.github.com/repos/ADWMC/Patchwork/releases/latest')
  assert.equal(releaseApiUrl('https://gitlab.com/ADWMC/Patchwork.git'), null)
  assert.equal(releaseApiUrl(repositoryUrl), 'https://api.github.com/repos/ADWMC/Patchwork/releases/latest')
  assert.match(packageVersion, /^\d+\.\d+\.\d+/)
})
