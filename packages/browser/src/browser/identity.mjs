import { createHash } from 'node:crypto'

// Report measured coverage explicitly. An empty comparison can never be a pass.
export function compareIdentity(expected = {}, observed = {}, { fields, unsupported = [] } = {}) {
  const keys = fields ?? [...new Set([...Object.keys(expected), ...Object.keys(observed)])]
  const items = keys.map(field => {
    if (unsupported.includes(field)) return { field, status: 'unsupported' }
    const want = expected[field]
    const got = observed[field]
    if (want === undefined || want === null || got === undefined || got === null) return { field, status: 'unknown' }
    return { field, status: JSON.stringify(want) === JSON.stringify(got) ? 'match' : 'mismatch' }
  })
  const counts = { match: 0, mismatch: 0, unknown: 0, unsupported: 0 }
  for (const item of items) counts[item.status]++
  const status = counts.mismatch ? 'mismatch' : !counts.match || counts.unknown || counts.unsupported ? 'unknown' : 'match'
  return { status, compared: counts.match + counts.mismatch, counts, items }
}

export function identityId(profile) {
  if (profile.mode === 'native') return null
  if (profile.backend === 'aliasmode') return createHash('sha256').update(JSON.stringify({ schema: profile.engineIdentity?.schema, seed: profile.engineIdentity?.seed, platform: profile.engineIdentity?.platform, screen: profile.screen, dpr: profile.deviceScaleFactor })).digest('hex').slice(0, 12)
  const hardware = structuredClone(profile.fingerprint?.fingerprint ?? {})
  if (hardware.navigator) {
    for (const key of ['language', 'languages', 'userAgent', 'appVersion', 'userAgentData', 'doNotTrack', 'webdriver']) delete hardware.navigator[key]
  }
  // Locale, headers and engine upgrades are environment revisions, not new devices.
  return createHash('sha256').update(JSON.stringify({ hardware, screen: profile.screen, dpr: profile.deviceScaleFactor })).digest('hex').slice(0, 12)
}

export function preserveDeviceLocale(fingerprint, locale) {
  if (!fingerprint) return undefined
  const sample = structuredClone(fingerprint)
  const language = new Intl.Locale(locale).language
  sample.fingerprint.navigator.language = locale
  sample.fingerprint.navigator.languages = [...new Set([locale, language])]
  for (const key of Object.keys(sample.headers ?? {})) {
    if (key.toLowerCase() === 'accept-language') sample.headers[key] = `${locale},${language};q=0.9`
  }
  return sample
}
