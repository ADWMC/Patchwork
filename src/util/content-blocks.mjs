export function isTextOnly(content) {
  if (!Array.isArray(content) || content.length === 0) return false
  return content.every(block => block?.type === 'text' && typeof block.text === 'string')
}

export function textOf(content) {
  if (!Array.isArray(content)) return ''
  return content.filter(block => block?.type === 'text').map(block => block.text).join('\n')
}
