const sensitive = new Set(['password', 'token', 'apikey', 'authorization', 'secret'])

export function redactRecord(value) {
  if (Array.isArray(value)) return value.map(redactRecord)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitive.has(key.toLowerCase()) ? '[REDACTED]' : redactRecord(entry)]))
}
