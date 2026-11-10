import { createHash } from 'node:crypto'
import { mkdir, open, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { inside } from '../util/path-safety.mjs'

export { inside }

export const CODE_INDEX_SCHEMA = 5
export const CODE_DEFAULTS = Object.freeze({
  maxFiles: 4000,
  maxFileBytes: 512 * 1024,
  maxResults: 30,
  maxTokenBudget: 8000,
  maxQueryChars: 300,
  cacheMaxAgeMs: 5 * 60 * 1000,
})

const HARD_IGNORED_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'bower_components', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.cache', '.parcel-cache', '.turbo', '.venv', 'venv', '__pycache__',
  '.mypy_cache', '.pytest_cache', 'target', 'vendor', 'Pods', 'DerivedData', '.patchwork', '.codegraph',
])
const SENSITIVE_NAMES = new Set(['.env', '.npmrc', '.pypirc', '.netrc', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'credentials', 'secrets'])
const SENSITIVE_EXT = new Set(['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore'])
const ENTRY_NAMES = new Set(['index', 'main', 'app', 'server', 'cli', 'bootstrap', 'entry'])
const BLOOM_BYTES = 256
const BLOOM_BITS = BLOOM_BYTES * 8
const TEST_RE = /(^|\/)(__tests__|test|tests|spec)(\/|$)|\.(test|spec)\.[^.]+$/i

export class CodeError extends Error {
  constructor(message, code = 'CODE_ERROR') { super(message); this.name = 'CodeError'; this.code = code }
}

export function normalizeRel(value) { return String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '') }

export function isSensitivePath(rel) {
  const clean = normalizeRel(rel)
  const base = basename(clean).toLowerCase()
  if (SENSITIVE_NAMES.has(base)) return true
  if (base.startsWith('.env.')) return true
  if (SENSITIVE_EXT.has(extname(base))) return true
  return /(^|\/)(credentials|secrets)(\.|\/|$)/i.test(clean)
}

function globToRegExp(pattern) {
  let value = normalizeRel(pattern).trim()
  if (!value) return null
  let anchored = false
  if (value.startsWith('/')) { anchored = true; value = value.slice(1) }
  let out = ''
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (char === '*') {
      if (value[i + 1] === '*') {
        i++
        if (value[i + 1] === '/') { i++; out += '(?:.*/)?' } else out += '.*'
      } else out += '[^/]*'
    } else if (char === '?') out += '[^/]'
    else out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`${anchored ? '^' : '(?:^|/)'}${out}(?:/|$)`, 'i')
}

export async function ignoreRules(root) {
  const rules = []
  try {
    const text = await readFile(join(root, '.gitignore'), 'utf8')
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#') || line.startsWith('!')) continue
      const regex = globToRegExp(line)
      if (regex) rules.push(regex)
    }
  } catch { /* .gitignore is optional */ }
  return rules
}

export function isIgnoredPath(rel, rules = []) {
  const clean = normalizeRel(rel)
  if (!clean || clean === '.') return false
  if (isSensitivePath(clean)) return true
  const parts = clean.split('/')
  if (parts.some(part => HARD_IGNORED_DIRS.has(part))) return true
  if (/\.(min\.(js|css)|map|lock|snap|wasm|zip|gz|tgz|7z|rar|png|jpe?g|gif|webp|ico|pdf|mp4|mov|woff2?|ttf|otf|eot|exe|dll|so|dylib|class|jar)$/i.test(clean)) return true
  return rules.some(regex => regex.test(clean))
}

function bloomHash(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}

function bloomFor(text) {
  const bytes = Buffer.alloc(BLOOM_BYTES)
  const seen = new Set()
  for (const token of text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
    if (token.length < 2 || seen.has(token)) continue
    seen.add(token)
    for (const seed of [0, 1, 2]) {
      const bit = bloomHash(`${seed}:${token}`) % BLOOM_BITS
      bytes[bit >> 3] |= 1 << (bit & 7)
    }
  }
  return bytes.toString('base64')
}

function bloomHas(bloom, token) {
  if (typeof bloom !== 'string') return true
  let bytes
  try { bytes = Buffer.from(bloom, 'base64') } catch { return true }
  for (const seed of [0, 1, 2]) {
    const bit = bloomHash(`${seed}:${token}`) % BLOOM_BITS
    if (!(bytes[bit >> 3] & (1 << (bit & 7)))) return false
  }
  return true
}

function queryTokens(query) {
  return [...new Set((String(query).match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []).filter(token => token.length >= 2))].slice(0, 8)
}

export function languageFor(path) {
  const ext = extname(path).toLowerCase()
  if (['.js', '.mjs', '.cjs', '.jsx'].includes(ext)) return 'javascript'
  if (['.ts', '.mts', '.cts', '.tsx'].includes(ext)) return 'typescript'
  if (ext === '.py') return 'python'
  if (ext === '.go') return 'go'
  if (ext === '.rs') return 'rust'
  if (ext === '.java') return 'java'
  if (ext === '.rb') return 'ruby'
  if (ext === '.php') return 'php'
  if (ext === '.cs') return 'csharp'
  if (ext === '.md' || ext === '.mdx') return 'markdown'
  if (ext === '.json') return 'json'
  return 'text'
}

function pushSymbol(list, seen, name, kind, line, signature) {
  if (!name || name.length > 96 || seen.has(`${kind}:${name}:${line}`)) return
  seen.add(`${kind}:${name}:${line}`)
  list.push({ name, kind, line, signature: String(signature ?? '').trim().slice(0, 180) })
}

export function extractSymbols(text, path) {
  const language = languageFor(path)
  const symbols = [], imports = [], seen = new Set()
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const lineNo = index + 1
    if (line.length > 4000) continue
    let match
    if (language === 'javascript' || language === 'typescript') {
      if ((match = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'function', lineNo, line)
      else if ((match = /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'class', lineNo, line)
      else if ((match = /^\s*(?:export\s+)?(?:interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'type', lineNo, line)
      else if ((match = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line))) pushSymbol(symbols, seen, match[1], 'variable', lineNo, line)
      if ((match = /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/.exec(line))) imports.push(match[1])
      else if ((match = /require\(\s*['"]([^'"]+)['"]\s*\)/.exec(line))) imports.push(match[1])
    } else if (language === 'python') {
      if ((match = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'function', lineNo, line)
      else if ((match = /^\s*class\s+([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'class', lineNo, line)
      if ((match = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/.exec(line))) imports.push(match[1] ?? match[2])
    } else if (language === 'go') {
      if ((match = /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'function', lineNo, line)
      else if ((match = /^\s*type\s+([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'type', lineNo, line)
      else if ((match = /^\s*(?:const|var)\s+([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'variable', lineNo, line)
      if ((match = /^\s*import\s+(?:\(\s*)?"([^"]+)"/.exec(line))) imports.push(match[1])
    } else if (language === 'rust') {
      if ((match = /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'function', lineNo, line)
      else if ((match = /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|mod|type)\s+([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'type', lineNo, line)
      else if ((match = /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const|static)\s+([A-Za-z_]\w*)/.exec(line))) pushSymbol(symbols, seen, match[1], 'variable', lineNo, line)
      if ((match = /^\s*use\s+([^;]+);/.exec(line))) imports.push(match[1].trim())
    } else if (language === 'markdown') {
      if ((match = /^\s{0,3}(#{1,4})\s+(.+)$/.exec(line))) pushSymbol(symbols, seen, match[2].trim(), 'heading', lineNo, line)
    }
  }
  symbols.sort((a, b) => a.line - b.line)
  for (let index = 0; index < symbols.length; index++) symbols[index].endLine = (symbols[index + 1]?.line ?? lines.length + 1) - 1
  return { symbols: symbols.slice(0, 400), imports: [...new Set(imports)].slice(0, 80), lines: lines.length, language }
}

function isBinary(buffer) {
  if (!buffer?.length) return false
  let control = 0
  for (const byte of buffer) {
    if (byte === 0) return true
    if (byte < 9 || (byte > 13 && byte < 32)) control++
  }
  return control / buffer.length > 0.2
}

async function readPrefix(path, length = 4096) {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally { await handle.close() }
}

export async function workspaceRoot(agent) {
  const cwd = agent?.session?.header?.cwd
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new CodeError('workspace cwd is unavailable', 'CODE_WORKSPACE_REQUIRED')
  const root = await realpath(cwd)
  const info = await stat(root)
  if (!info.isDirectory()) throw new CodeError('workspace cwd is not a directory', 'CODE_WORKSPACE_REQUIRED')
  return root
}

export async function resolveWithin(root, requested, { file = false } = {}) {
  if (typeof requested !== 'string' || !requested.trim() || requested.length > 2048) throw new CodeError('a workspace-relative or absolute path is required', 'CODE_PATH_REQUIRED')
  const candidate = isAbsolute(requested) ? resolve(requested) : resolve(root, requested)
  if (!inside(root, candidate)) throw new CodeError('path is outside the workspace', 'CODE_PATH_OUTSIDE_WORKSPACE')
  let target
  try { target = await realpath(candidate) }
  catch { throw new CodeError('path does not exist', 'CODE_PATH_NOT_FOUND') }
  if (!inside(root, target)) throw new CodeError('path is outside the workspace', 'CODE_PATH_OUTSIDE_WORKSPACE')
  if (file) {
    const info = await stat(target)
    if (!info.isFile()) throw new CodeError('path is not a file', 'CODE_PATH_NOT_FILE')
  }
  return target
}

export async function gitHead(root) {
  try {
    const head = (await readFile(join(root, '.git', 'HEAD'), 'utf8')).trim()
    if (!head.startsWith('ref: ')) return head.slice(0, 80)
    const ref = head.slice(5).trim()
    try { return (await readFile(join(root, '.git', ref), 'utf8')).trim().slice(0, 80) }
    catch {
      try {
        const packed = await readFile(join(root, '.git', 'packed-refs'), 'utf8')
        const line = packed.split(/\r?\n/).find(item => item.endsWith(` ${ref}`))
        if (line) return line.split(' ')[0]
      } catch { /* no packed refs */ }
      return head.slice(0, 80)
    }
  } catch { return null }
}

async function walkFiles(root, { maxFiles, maxFileBytes, rules, excludes = [] }) {
  const files = []
  const seenDirs = new Set()
  const stack = ['']
  let truncated = false, ignored = 0
  const excluded = (rel) => excludes.some(regex => regex.test(rel))
  while (stack.length) {
    const relDir = stack.pop()
    let entries
    try { entries = await readdir(join(root, relDir), { withFileTypes: true }) } catch { continue }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const rel = normalizeRel(relDir ? `${relDir}/${entry.name}` : entry.name)
      if (isIgnoredPath(rel, rules) || excluded(rel)) { ignored++; continue }
      const full = join(root, rel)
      if (entry.isSymbolicLink()) {
        let actual
        try { actual = await realpath(full) } catch { ignored++; continue }
        if (!inside(root, actual)) { ignored++; continue }
        let info
        try { info = await stat(actual) } catch { ignored++; continue }
        if (info.isDirectory()) {
          if (!seenDirs.has(actual)) { seenDirs.add(actual); stack.push(rel) }
          continue
        }
        if (!info.isFile()) continue
      } else if (entry.isDirectory()) {
        stack.push(rel)
        continue
      } else if (!entry.isFile()) continue
      if (files.length >= maxFiles) { truncated = true; break }
      let info
      try { info = await stat(full) } catch { ignored++; continue }
      if (info.size > maxFileBytes) { ignored++; continue }
      let prefix
      try { prefix = await readPrefix(full) } catch { ignored++; continue }
      if (isBinary(prefix)) { ignored++; continue }
      files.push({ path: rel, size: info.size, mtimeMs: info.mtimeMs })
    }
    if (truncated) break
  }
  return { files, truncated, ignored }
}

function indexRoot(root) {
  const hash = createHash('sha256').update(root).digest('hex').slice(0, 24)
  return dshHomePath('patchwork', 'code-index', hash)
}

async function loadCache(root, head) {
  try {
    const raw = JSON.parse(await readFile(join(indexRoot(root), 'index.json'), 'utf8'))
    if (raw?.schemaVersion !== CODE_INDEX_SCHEMA || raw.root !== root) return null
    if (head !== null && raw.gitHead !== null && raw.gitHead !== head) return null
    return raw
  } catch { return null }
}

async function readAliases(root) {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    try {
      const raw = await readFile(join(root, name), 'utf8')
      const clean = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1')
      const parsed = JSON.parse(clean)
      const options = parsed?.compilerOptions ?? {}
      const baseUrl = typeof options.baseUrl === 'string' ? normalizeRel(options.baseUrl) : ''
      const paths = options.paths && typeof options.paths === 'object' ? options.paths : {}
      const aliases = []
      for (const [pattern, targets] of Object.entries(paths)) {
        if (typeof pattern !== 'string' || !Array.isArray(targets)) continue
        for (const target of targets) if (typeof target === 'string') aliases.push({ pattern, target, baseUrl })
      }
      if (aliases.length) return aliases
    } catch { /* try next config */ }
  }
  return []
}

async function saveCache(root, data) {
  try {
    const dir = indexRoot(root)
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await writeFile(join(dir, 'index.json'), `${JSON.stringify(data)}\n`, { encoding: 'utf8', mode: 0o600 })
  } catch { /* Cache failure never blocks a read-only query. */ }
}

export async function buildCodeIndex(root, { refresh = false, maxFiles = CODE_DEFAULTS.maxFiles, maxFileBytes = CODE_DEFAULTS.maxFileBytes, exclude = [] } = {}) {
  const rules = await ignoreRules(root)
  const head = await gitHead(root)
  const cached = refresh ? null : await loadCache(root, head)
  const byPath = new Map((cached?.files ?? []).map(file => [file.path, file]))
  const walked = await walkFiles(root, { maxFiles, maxFileBytes, rules, excludes: exclude.map(globToRegExp).filter(Boolean) })
  const files = []
  for (const live of walked.files) {
    const prior = byPath.get(live.path)
    if (prior && prior.size === live.size && prior.mtimeMs === live.mtimeMs && Array.isArray(prior.symbols)) {
      files.push(prior)
      continue
    }
    let text = ''
    try { text = await readFile(join(root, live.path), 'utf8') } catch { continue }
    const parsed = extractSymbols(text, live.path)
    const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
    files.push({
      ...live, language: parsed.language, lines: parsed.lines, symbols: parsed.symbols, imports: parsed.imports, bloom: bloomFor(text),
      test: TEST_RE.test(live.path), generated: /@generated|do not edit|auto-generated/i.test(firstLine) || text.split(/\r?\n/).some(line => line.length > 2000),
    })
  }
  const result = {
    schemaVersion: CODE_INDEX_SCHEMA, root, gitHead: head, aliases: await readAliases(root), builtAt: new Date().toISOString(),
    cacheHit: Boolean(cached), truncated: walked.truncated, ignoredFiles: walked.ignored, files,
  }
  await saveCache(root, result)
  return result
}

function recordByPath(index, path) {
  const clean = normalizeRel(path)
  const exact = index.files.find(file => file.path === clean)
  if (exact) return exact
  const suffix = index.files.filter(file => file.path.endsWith(`/${clean}`))
  return suffix.length === 1 ? suffix[0] : null
}

function symbolAt(file, line) {
  let found
  for (const symbol of file.symbols ?? []) if (symbol.line <= line) found = symbol
  return found?.name
}

function globMatcher(pattern) {
  if (!pattern) return null
  return globToRegExp(pattern)
}

function compileMatcher(query, mode, caseSensitive) {
  if (typeof query !== 'string' || !query.trim()) throw new CodeError('query is required', 'CODE_QUERY_REQUIRED')
  if (query.length > CODE_DEFAULTS.maxQueryChars) throw new CodeError(`query exceeds ${CODE_DEFAULTS.maxQueryChars} characters`, 'CODE_QUERY_TOO_LONG')
  if (mode === 'regex') {
    try { return new RegExp(query, caseSensitive ? 'm' : 'mi') }
    catch (error) { throw new CodeError(`invalid regular expression: ${error.message}`, 'CODE_INVALID_REGEX') }
  }
  if (mode !== 'literal' && mode !== 'word') throw new CodeError('mode must be literal, word or regex', 'CODE_INVALID_MODE')
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const source = mode === 'word' ? `(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])` : escaped
  return new RegExp(source, caseSensitive ? 'm' : 'mi')
}

async function readFileText(root, file, maxBytes) {
  try {
    const text = await readFile(join(root, file.path), 'utf8')
    if (Buffer.byteLength(text, 'utf8') <= maxBytes) return { text, truncated: false }
    return { text: Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8'), truncated: true }
  } catch { return null }
}

export async function searchCode(index, { query, mode = 'literal', caseSensitive = true, path, glob, maxResults = CODE_DEFAULTS.maxResults, maxFiles = null } = {}) {
  const scanLimit = maxFiles === null ? index.files.length : Math.max(1, Math.min(index.files.length, Math.trunc(Number(maxFiles) || index.files.length)))
  const matcher = compileMatcher(query, mode, caseSensitive)
  const rawPath = path ? normalizeRel(path).replace(/\/$/, '') : null
  const pathFilter = rawPath && rawPath !== '.' ? rawPath : null
  const globRegex = globMatcher(glob)
  const records = index.files.filter(file => {
    if (pathFilter && file.path !== pathFilter && !file.path.startsWith(`${pathFilter}/`)) return false
    if (globRegex && !globRegex.test(file.path)) return false
    return true
  })
  let ranked = records.slice().sort((a, b) => Number(Boolean(b.test)) - Number(Boolean(a.test)) || Number(Boolean(a.generated)) - Number(Boolean(b.generated)))
  if (mode !== 'regex') {
    const tokens = queryTokens(query)
    if (tokens.length) {
      const candidates = ranked.filter(file => tokens.every(token => bloomHas(file.bloom, token)))
      if (candidates.length) ranked = candidates
    }
  }
  const matches = []
  let scanned = 0, truncated = false
  for (const file of ranked) {
    if (scanned >= scanLimit) { truncated = true; break }
    scanned++
    const read = await readFileText(index.root, file, CODE_DEFAULTS.maxFileBytes)
    if (!read) continue
    const lines = read.text.split(/\r?\n/)
    let perFile = 0
    for (let i = 0; i < lines.length; i++) {
      matcher.lastIndex = 0
      if (!matcher.test(lines[i])) continue
      matches.push({
        path: file.path, line: i + 1, column: Math.max(0, lines[i].search(new RegExp(matcher.source, matcher.flags.replace('g', '')))) + 1,
        text: lines[i].trim().slice(0, 240), symbol: symbolAt(file, i + 1) ?? null, kind: 'match',
      })
      if (++perFile >= 5) break
      if (matches.length >= maxResults) { truncated = true; break }
    }
    if (matches.length >= maxResults) { truncated = true; break }
  }
  return { query, mode, matches, scanned, totalFiles: records.length, truncated }
}

export async function findDefinitions(index, { symbol, maxResults = CODE_DEFAULTS.maxResults } = {}) {
  if (typeof symbol !== 'string' || !symbol.trim()) throw new CodeError('symbol is required', 'CODE_SYMBOL_REQUIRED')
  const query = symbol.trim()
  const matcher = compileMatcher(query, 'word', true)
  const matches = []
  for (const file of index.files) {
    for (const item of file.symbols ?? []) {
      matcher.lastIndex = 0
      if (!matcher.test(item.name)) continue
      matches.push({ path: file.path, line: item.line, endLine: item.endLine, symbol: item.name, kind: 'definition', symbolKind: item.kind, signature: item.signature })
      if (matches.length >= maxResults) break
    }
    if (matches.length >= maxResults) break
  }
  if (matches.length) return { symbol: query, matches, definitions: matches.length, truncated: matches.length >= maxResults }
  const fallback = await searchCode(index, { query, mode: 'word', caseSensitive: true, maxResults })
  return { symbol: query, matches: fallback.matches, definitions: 0, references: fallback.matches.length, truncated: fallback.truncated, lexical: true }
}

export async function findReferences(index, { symbol, maxResults = CODE_DEFAULTS.maxResults } = {}) {
  if (typeof symbol !== 'string' || !symbol.trim()) throw new CodeError('symbol is required', 'CODE_SYMBOL_REQUIRED')
  const result = await searchCode(index, { query: symbol.trim(), mode: 'word', caseSensitive: true, maxResults })
  return { ...result, symbol: symbol.trim(), lexical: true, definitions: result.matches.filter(match => index.files.find(file => file.path === match.path)?.symbols?.some(item => item.name === match.symbol && item.line === match.line)).length }
}

export async function outlineCode(index, path) {
  const requested = await resolveWithin(index.root, path, { file: true })
  const rel = normalizeRel(relative(index.root, requested))
  const record = recordByPath(index, rel)
  if (!record) throw new CodeError('file is not indexed (ignored, binary or outside limits)', 'CODE_FILE_NOT_INDEXED')
  return { path: record.path, language: record.language, lines: record.lines, symbols: record.symbols ?? [], imports: record.imports ?? [], test: record.test, generated: record.generated }
}

function scoreFile(file) {
  let score = 0
  const name = basename(file.path).replace(/\.[^.]+$/, '').toLowerCase()
  if (ENTRY_NAMES.has(name)) score += 50
  if (/(^|\/)(src|app|lib|packages|cmd)\//.test(file.path)) score += 8
  if (file.test) score -= 20
  if (file.generated) score -= 40
  score += Math.min((file.symbols ?? []).length, 20)
  score -= file.path.split('/').length
  return score
}

export function repoMap(index, { tokenBudget = 2000, focus, query } = {}) {
  const budget = Math.max(400, Math.min(CODE_DEFAULTS.maxTokenBudget, Math.trunc(Number(tokenBudget) || 2000))) * 4
  const focusText = `${focus ?? ''} ${query ?? ''}`.trim().toLowerCase()
  const entries = index.files.filter(file => !file.test && !file.generated).slice().sort((a, b) => scoreFile(b) - scoreFile(a))
  const dirs = new Map()
  for (const file of index.files) {
    const top = file.path.includes('/') ? file.path.split('/')[0] : '.'
    const entry = dirs.get(top) ?? { files: 0, symbols: 0, tests: 0 }
    entry.files++; entry.symbols += (file.symbols ?? []).length; if (file.test) entry.tests++
    dirs.set(top, entry)
  }
  const lines = [`[code-map] root=${basename(index.root) || index.root} files=${index.files.length} truncated=${index.truncated ? 'yes' : 'no'}`]
  lines.push('', '## Modules')
  for (const [dir, info] of [...dirs.entries()].sort((a, b) => b[1].files - a[1].files).slice(0, 16)) {
    lines.push(`- ${dir}${dir === '.' ? '' : '/'}: ${info.files} files, ${info.symbols} symbols${info.tests ? `, ${info.tests} tests` : ''}`)
  }
  lines.push('', '## Start here')
  const selected = entries.filter(file => {
    if (!focusText) return true
    return file.path.toLowerCase().includes(focusText) || (file.symbols ?? []).some(symbol => symbol.name.toLowerCase().includes(focusText))
  })
  const files = (selected.length ? selected : entries).slice(0, 60)
  for (const file of files) {
    const symbols = (file.symbols ?? []).slice(0, 10).map(symbol => symbol.name).join(', ')
    lines.push(`- ${file.path} (${file.language}, ${file.lines} lines)${symbols ? ` — ${symbols}` : ''}`)
  }
  let text = lines.join('\n')
  let truncated = index.truncated || selected.length !== entries.length || files.length < entries.length
  if (text.length > budget) { text = text.slice(0, Math.max(0, budget - 80)) + '\n[code-map truncated by token budget]'; truncated = true }
  return { text, files: files.length, symbolCount: files.reduce((sum, file) => sum + (file.symbols ?? []).length, 0), truncated, cache: index.cacheHit ? 'hit' : 'built' }
}

function enclosingSymbol(file, line) {
  return (file?.symbols ?? []).filter(symbol => symbol.line <= line && (symbol.endLine ?? symbol.line) >= line)
    .sort((a, b) => b.line - a.line)[0]
}

/** Lexical caller approximation: references grouped by their enclosing symbol. */
export async function callersOf(index, { symbol, maxResults = CODE_DEFAULTS.maxResults } = {}) {
  if (typeof symbol !== 'string' || !symbol.trim()) throw new CodeError('symbol is required', 'CODE_SYMBOL_REQUIRED')
  const target = symbol.trim()
  const targets = index.files.flatMap(file => (file.symbols ?? []).filter(item => item.name === target).map(item => ({ name: item.name, path: file.path, line: item.line, kind: item.kind })))
  const searched = await searchCode(index, { query: target, mode: 'word', caseSensitive: true, maxResults: 100 })
  const callers = [], seen = new Set()
  for (const match of searched.matches) {
    const file = recordByPath(index, match.path)
    const caller = enclosingSymbol(file, match.line)
    if (!caller || caller.name === target) continue
    const key = `${match.path}:${caller.name}:${caller.line}`
    if (seen.has(key)) continue
    seen.add(key)
    callers.push({ name: caller.name, kind: caller.kind, path: match.path, line: caller.line, callLine: match.line, test: Boolean(file?.test) })
    if (callers.length >= maxResults) break
  }
  return { symbol: target, targets, ambiguous: targets.length > 1, callers, matchCount: searched.matches.length, truncated: searched.truncated || callers.length >= maxResults, lexical: true }
}

/** Direct callees inside a symbol body; names are matched to indexed definitions when possible. */
export async function calleesOf(index, { symbol, maxResults = CODE_DEFAULTS.maxResults } = {}) {
  if (typeof symbol !== 'string' || !symbol.trim()) throw new CodeError('symbol is required', 'CODE_SYMBOL_REQUIRED')
  const target = symbol.trim()
  const predefined = await findDefinitions(index, { symbol: target, maxResults: 8 })
  const definitions = predefined.matches.filter(match => match.kind === 'definition')
  const callees = [], seen = new Set()
  const keywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'new', 'await', 'async', 'with', 'super', 'constructor'])
  for (const definition of definitions) {
    const file = recordByPath(index, definition.path)
    if (!file) continue
    const read = await readFileText(index.root, file, CODE_DEFAULTS.maxFileBytes)
    if (!read) continue
    const lines = read.text.split(/\r?\n/)
    const start = Math.max(0, (definition.line ?? 1) - 1)
    const end = Math.min(lines.length, definition.endLine ?? (start + 80))
    const body = lines.slice(start, end).join('\n')
    for (const match of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = match[1]
      if (keywords.has(name) || name === target) continue
      const key = `${definition.path}:${name}`
      if (seen.has(key)) continue
      seen.add(key)
      const targetDefinitions = index.files.flatMap(item => (item.symbols ?? []).filter(candidate => candidate.name === name).map(candidate => ({ path: item.path, line: candidate.line })))
      callees.push({ name, path: definition.path, line: definition.line, target: targetDefinitions[0] ?? null, resolved: targetDefinitions.length > 0 })
      if (callees.length >= maxResults) break
    }
    if (callees.length >= maxResults) break
  }
  return { symbol: target, targets: definitions.map(item => ({ name: item.symbol, path: item.path, line: item.line, kind: item.symbolKind })), ambiguous: definitions.length > 1, definitions: definitions.length, callees, truncated: callees.length >= maxResults || predefined.truncated, lexical: true }
}

/** Reverse-call impact approximation, bounded by depth and node count. */
export async function impactOf(index, { symbol, depth = 2, maxNodes = 80 } = {}) {
  if (typeof symbol !== 'string' || !symbol.trim()) throw new CodeError('symbol is required', 'CODE_SYMBOL_REQUIRED')
  const limit = Math.max(1, Math.min(4, Math.trunc(Number(depth) || 2)))
  const cap = Math.max(1, Math.min(200, Math.trunc(Number(maxNodes) || 80)))
  const start = symbol.trim()
  const visited = new Set([`target:${start}`])
  const impacted = [], queue = [{ name: start, depth: 0 }]
  let truncated = false
  while (queue.length) {
    const current = queue.shift()
    if (current.depth >= limit) continue
    const result = await callersOf(index, { symbol: current.name, maxResults: 100 })
    for (const caller of result.callers) {
      const key = `${caller.path}:${caller.name}`
      if (visited.has(key)) continue
      visited.add(key)
      impacted.push({ ...caller, depth: current.depth + 1 })
      queue.push({ name: caller.name, depth: current.depth + 1 })
      if (impacted.length >= cap) { truncated = true; break }
    }
    if (truncated) break
  }
  return { symbol: start, targets: (index.files.flatMap(file => (file.symbols ?? []).filter(item => item.name === start).map(item => ({ name: item.name, path: file.path, line: item.line, kind: item.kind })))), ambiguous: index.files.reduce((n, file) => n + (file.symbols ?? []).filter(item => item.name === start).length, 0) > 1, depth: limit, impacted, tests: impacted.filter(item => item.test), truncated, lexical: true }
}

function aliasCandidates(index, specifier) {
  const found = []
  for (const alias of index.aliases ?? []) {
    const star = alias.pattern.indexOf('*')
    if (star < 0) { if (specifier === alias.pattern) found.push({ target: alias.target, baseUrl: alias.baseUrl }); continue }
    const prefix = alias.pattern.slice(0, star), suffix = alias.pattern.slice(star + 1)
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue
    const middle = specifier.slice(prefix.length, specifier.length - suffix.length)
    found.push({ target: alias.target.replace('*', middle), baseUrl: alias.baseUrl })
  }
  return found.map(item => normalizeRel(join(item.baseUrl, item.target)))
}

function resolveSpecifier(index, fromPath, specifier) {
  if (typeof specifier !== 'string') return null
  const bases = specifier.startsWith('.') ? [normalizeRel(join(dirname(fromPath), specifier))] : aliasCandidates(index, specifier)
  const candidates = bases.flatMap(base => [base, ...['.mjs', '.js', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs'].map(ext => base + ext),
    ...['index.mjs', 'index.js', 'index.ts', 'index.tsx', '__init__.py'].map(name => `${base}/${name}`)])
  return candidates.find(candidate => index.files.some(file => file.path === candidate)) ?? null
}

/** Find test files that transitively depend on changed source files via import edges. */
export function affectedTests(index, { files = [] } = {}) {
  const changed = files.map(normalizeRel).filter(Boolean)
  const dependents = new Map()
  for (const file of index.files) {
    for (const specifier of file.imports ?? []) {
      const target = resolveSpecifier(index, file.path, specifier)
      if (!target) continue
      const list = dependents.get(target) ?? []
      list.push(file.path)
      dependents.set(target, list)
    }
  }
  const visited = new Set(changed), tests = new Set(), queue = [...changed]
  while (queue.length) {
    const current = queue.shift()
    for (const dependent of dependents.get(current) ?? []) {
      if (visited.has(dependent)) continue
      visited.add(dependent)
      const record = recordByPath(index, dependent)
      if (record?.test) tests.add(dependent)
      queue.push(dependent)
    }
  }
  return { changed, tests: [...tests], dependents: [...visited].filter(path => !changed.includes(path)), truncated: false, lexical: true }
}

export function indexSummary(index) {
  return { root: index.root, files: index.files.length, symbolCount: index.files.reduce((sum, file) => sum + (file.symbols ?? []).length, 0), truncated: index.truncated, cache: index.cacheHit ? 'hit' : 'built', builtAt: index.builtAt }
}
