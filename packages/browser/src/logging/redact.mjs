/** Preview defense in depth; diagnostic records do not include free text at all. */
export function redactPreview(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie)(\s*:\s*)[^\r\n]*/gi, '$1$2[REDACTED]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|authorization|cookie|set-cookie)\s*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;\r\n]+)/gi, '$1[REDACTED]')
    .replace(/((?:--?)(?:api[-_]?key|token|password|secret)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|\S+)/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^\s\/@:]+:[^\s\/@]+@/gi, '$1[REDACTED]@')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, '[REDACTED]')
}
