import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

export const packageVersion = pkg.version
export const repositoryUrl = pkg.repository?.url ?? ''

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value ?? '').trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  }
}

function comparePrerelease(left, right) {
  if (!left.length && !right.length) return 0
  // A release outranks any prerelease of the same core version.
  if (!left.length) return 1
  if (!right.length) return -1
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const a = left[index], b = right[index]
    if (a === undefined) return -1
    if (b === undefined) return 1
    const numericA = /^\d+$/.test(a), numericB = /^\d+$/.test(b)
    if (numericA && numericB) {
      const diff = Number(a) - Number(b)
      if (diff) return diff < 0 ? -1 : 1
      continue
    }
    if (numericA !== numericB) return numericA ? -1 : 1
    if (a !== b) return a < b ? -1 : 1
  }
  return 0
}

/** SemVer precedence for `major.minor.patch[-prerelease]`; invalid input returns null. */
export function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right)
  if (!a || !b) return null
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return comparePrerelease(a.prerelease, b.prerelease)
}

export function isNewer(latest, current) {
  const order = compareVersions(latest, current)
  return order !== null && order > 0
}

/** GitHub Releases API feed for a repository URL; non-GitHub sources return null. */
export function releaseApiUrl(repository = repositoryUrl) {
  const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(String(repository ?? ''))
  if (!match) return null
  return `https://api.github.com/repos/${match[1]}/${match[2]}/releases/latest`
}
