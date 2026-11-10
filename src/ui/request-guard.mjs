const SAME_SITE_VALUES = new Set(['same-origin', 'none'])

/**
 * The page token travels in plugin-injected HTML. Reject obvious cross-site
 * calls as defense in depth; requests without these headers (tests, older
 * hosts) keep working.
 */
export function crossSiteRequest(req) {
  const site = req?.headers?.['sec-fetch-site']
  if (typeof site === 'string' && site && !SAME_SITE_VALUES.has(site)) return true
  const origin = req?.headers?.origin
  if (typeof origin === 'string' && origin) {
    try {
      const expected = new URL(origin).host
      const host = req.headers.host
      if (host && expected !== host) return true
    } catch { return true }
  }
  return false
}
