export function decodeHtmlEntities(value) {
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

export function textFromHtml(value) {
  const html = String(value ?? '').replace(/<\/?(?:strong|b|em|mark)\b[^>]*>/gi, '')
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
