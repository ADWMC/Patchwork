export function dedupeSources(sources) {
  const seen = new Set()
  return sources.filter(source => {
    if (seen.has(source.url)) return false
    seen.add(source.url)
    return true
  })
}
