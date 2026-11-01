export function parseJsonl(text) {
  const lines = text.split(/\r?\n/)
  const result = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue
    try { result.push(JSON.parse(line)) } catch (error) {
      if (index === lines.length - 1 && !text.endsWith('\n') && !text.endsWith('\r')) break
      throw new Error('INVALID_JSONL', { cause: error })
    }
  }
  return result
}
