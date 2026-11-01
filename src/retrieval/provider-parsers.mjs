const DEFAULT_ENDPOINT = 'https://html.duckduckgo.com/html/'

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([\da-f]+);/gi, (_, digits) => String.fromCodePoint(parseInt(digits, 16)))
}

function textFromHtml(value) {
  const html = String(value ?? '').replace(/<\/?(?:strong|b|em|mark)\b[^>]*>/gi, '')
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function attribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, 'i')
  return pattern.exec(tag)?.[2]
}

function normalizeUrl(rawHref, base = DEFAULT_ENDPOINT) {
  if (!rawHref) return undefined
  try {
    const result = new URL(decodeHtmlEntities(rawHref), base)
    if (!['http:', 'https:'].includes(result.protocol)) return undefined
    result.hash = ''
    return result.href
  } catch {
    return undefined
  }
}

function unwrapDuckDuckGoUrl(rawHref) {
  const href = normalizeUrl(rawHref)
  if (!href) return undefined
  try {
    const parsed = new URL(href)
    if (parsed.hostname === 'duckduckgo.com' && parsed.pathname === '/l/') return normalizeUrl(parsed.searchParams.get('uddg'))
  } catch { /* normalizeUrl already validated the URL. */ }
  return href
}

function decodeBase64Url(value) {
  const raw = String(value ?? '')
  const encoded = raw.startsWith('a1') ? raw.slice(2) : raw
  if (!encoded || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) return undefined
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return undefined
  }
}

function unwrapBingUrl(rawHref) {
  const href = normalizeUrl(rawHref, 'https://www.bing.com/search')
  if (!href) return undefined
  try {
    const parsed = new URL(href)
    if (parsed.hostname.endsWith('bing.com') && parsed.pathname === '/ck/a') {
      const decoded = decodeBase64Url(parsed.searchParams.get('u'))
      return normalizeUrl(decoded) ?? href
    }
  } catch { /* normalizeUrl already validated the URL. */ }
  return href
}

function boundedLimit(maxResults) {
  return Math.max(1, Math.min(12, Math.trunc(Number(maxResults) || 8)))
}

function pushUnique(results, seen, source) {
  if (!source?.url || !source.title || seen.has(source.url)) return
  seen.add(source.url)
  results.push(source)
}

/** Parse only result links and snippets from DuckDuckGo's public HTML page. */
export function parseDuckDuckGoResults(html, maxResults = 8) {
  const limit = boundedLimit(maxResults)
  const results = []
  const seen = new Set()
  const tagPattern = /<a\b[^>]*>/gi
  let match
  while ((match = tagPattern.exec(String(html ?? '')))) {
    const tag = match[0]
    if (!/\bresult__a\b/i.test(attribute(tag, 'class') ?? '')) continue
    const href = unwrapDuckDuckGoUrl(attribute(tag, 'href'))
    if (!href || seen.has(href)) continue
    const bodyStart = tagPattern.lastIndex
    const bodyEnd = String(html).indexOf('</a>', bodyStart)
    if (bodyEnd < 0) continue
    const title = textFromHtml(String(html).slice(bodyStart, bodyEnd))
    if (!title) continue
    const windowEnd = Math.min(String(html).length, bodyEnd + 5000)
    const window = String(html).slice(bodyEnd, windowEnd)
    const snippetTag = /<a\b[^>]*class\s*=\s*(["'])[^"']*\bresult__snippet\b[^"']*\1[^>]*>/i.exec(window)
    let snippet = ''
    if (snippetTag) {
      const snippetStart = snippetTag.index + snippetTag[0].length
      const snippetEnd = window.indexOf('</a>', snippetStart)
      if (snippetEnd >= 0) snippet = textFromHtml(window.slice(snippetStart, snippetEnd))
    }
    pushUnique(results, seen, { title, url: href, ...(snippet ? { snippet } : {}) })
    if (results.length > limit) return { results: results.slice(0, limit), truncated: true }
  }
  return { results, truncated: false }
}

/** Parse Bing's server-rendered result list and unwrap its redirect links. */
export function parseBingResults(html, maxResults = 8) {
  const limit = boundedLimit(maxResults)
  const results = []
  const seen = new Set()
  const itemPattern = /<li\b[^>]*class\s*=\s*(["'])[^"']*\bb_algo\b[^"']*\1[^>]*>([\s\S]*?)<\/li>/gi
  let match
  while ((match = itemPattern.exec(String(html ?? '')))) {
    const item = match[2]
    const link = /<h2\b[\s\S]*?<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i.exec(item)
    if (!link) continue
    const url = unwrapBingUrl(link[2])
    const title = textFromHtml(link[3])
    if (!url || !title) continue
    const caption = /<div\b[^>]*class\s*=\s*(["'])[^"']*\bb_caption\b[^"']*\1[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(item)
    const snippet = caption ? textFromHtml(caption[2]) : ''
    pushUnique(results, seen, { title, url, ...(snippet ? { snippet } : {}) })
    if (results.length > limit) return { results: results.slice(0, limit), truncated: true }
  }
  return { results, truncated: false }
}

/** Parse Brave's server-rendered web snippets without executing page scripts. */
export function parseBraveResults(html, maxResults = 8) {
  const limit = boundedLimit(maxResults)
  const results = []
  const seen = new Set()
  const itemPattern = /<div\b[^>]*data-type\s*=\s*(["'])web\1[^>]*>([\s\S]*?)(?=<div\b[^>]*data-type\s*=\s*(["'])web\3|<\/main>|$)/gi
  let match
  while ((match = itemPattern.exec(String(html ?? '')))) {
    const item = match[2]
    const link = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<div\b[^>]*class\s*=\s*(["'])[^"']*\btitle\b[^"']*\3[^>]*title\s*=\s*(["'])(.*?)\4[^>]*>/i.exec(item)
    if (!link) continue
    const url = normalizeUrl(link[2], 'https://search.brave.com/search')
    const title = textFromHtml(link[5])
    if (!url || !title) continue
    const snippetMatch = /<div\b[^>]*class\s*=\s*(["'])[^"']*\bgeneric-snippet\b[^"']*\1[^>]*>[\s\S]*?<div\b[^>]*class\s*=\s*(["'])[^"']*\bcontent\b[^"']*\2[^>]*>([\s\S]*?)<\/div>/i.exec(item)
    const snippet = snippetMatch ? textFromHtml(snippetMatch[3]) : ''
    pushUnique(results, seen, { title, url, ...(snippet ? { snippet } : {}) })
    if (results.length > limit) return { results: results.slice(0, limit), truncated: true }
  }
  return { results, truncated: false }
}

export const providerParsers = Object.freeze({
  'duckduckgo-html': parseDuckDuckGoResults,
  'bing-html': parseBingResults,
  'brave-html': parseBraveResults,
})

export { decodeHtmlEntities, textFromHtml, normalizeUrl }
