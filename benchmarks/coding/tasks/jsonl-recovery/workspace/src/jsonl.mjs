export function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
}
