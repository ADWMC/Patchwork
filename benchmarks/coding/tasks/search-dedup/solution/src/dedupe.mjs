function keyOf(url) {
  try {
    const parsed = new URL(url)
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.hash = ''
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    return parsed.toString()
  } catch { return url }
}

export function dedupeSources(sources) {
  const seen = new Set()
  return sources.filter(source => {
    const key = keyOf(source.url)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
