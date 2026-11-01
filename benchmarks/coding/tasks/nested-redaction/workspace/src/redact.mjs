const sensitive = new Set(['password', 'token', 'apikey', 'authorization', 'secret'])

export function redactRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitive.has(key.toLowerCase()) ? '[REDACTED]' : entry]))
}
