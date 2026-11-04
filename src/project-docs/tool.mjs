import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { logDiagnostic } from '../logging/session-log.mjs'
import { record } from '../ui/mechanism-stats.mjs'
import { requirePatchworkAgent } from '../scope.mjs'
import { inside, workspaceRoot } from '../code/code-index.mjs'

export const PROJECT_DOCS_TOOL = 'patchwork_project_docs'
const DOC_NAMES = { agents: 'AGENTS.md', design: 'DESIGN.md' }
const MAX_BYTES = 64 * 1024
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '.patchwork'])

class DocError extends Error {
  constructor(message, code = 'PROJECT_DOC_FAILED') { super(message); this.name = 'DocError'; this.code = code }
}

const sha256 = value => createHash('sha256').update(value).digest('hex')
const isKind = value => Object.hasOwn(DOC_NAMES, value)

function targetPath(root, kind, requested) {
  if (!isKind(kind)) throw new DocError('kind must be agents or design', 'PROJECT_DOC_KIND_REQUIRED')
  const name = DOC_NAMES[kind]
  const target = requested ? resolve(root, requested) : join(root, name)
  if (!inside(root, target)) throw new DocError('path is outside the workspace', 'PROJECT_DOC_PATH_OUTSIDE')
  if (basename(target) !== name) throw new DocError(`only ${name} can be written`, 'PROJECT_DOC_NAME_REQUIRED')
  return target
}

async function findDocs(root, kind, depth = 0, found = []) {
  if (found.length >= 50) return found
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) } catch { return found }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (depth >= 2 || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      await findDocs(join(root, entry.name), kind, depth + 1, found)
      continue
    }
    if (!entry.isFile() || entry.name !== DOC_NAMES[kind]) continue
    const path = join(root, entry.name)
    const info = await stat(path)
    const content = await readFile(path, 'utf8')
    found.push({ kind, path, bytes: info.size, sha256: sha256(content), modifiedAt: info.mtime.toISOString() })
    if (found.length >= 50) break
  }
  return found
}

function validate(kind, content) {
  if (!isKind(kind)) throw new DocError('kind must be agents or design', 'PROJECT_DOC_KIND_REQUIRED')
  if (typeof content !== 'string' || !content.trim()) throw new DocError('content is empty', 'PROJECT_DOC_CONTENT_REQUIRED')
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) throw new DocError(`content exceeds ${MAX_BYTES} bytes`, 'PROJECT_DOC_TOO_LARGE')
  if (content.includes('\0')) throw new DocError('content contains NUL', 'PROJECT_DOC_INVALID_CONTENT')
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{16,}/.test(content)) throw new DocError('content looks like it contains a secret', 'PROJECT_DOC_SECRET')
  const warnings = []
  if (kind === 'agents') {
    if (!/^#\s/m.test(content)) warnings.push('AGENTS.md has no top-level heading')
    if (!/(test|build|lint|npm|pnpm|yarn|make|pytest|cargo)/i.test(content)) warnings.push('AGENTS.md has no recognizable build/test command')
  } else {
    if (!content.startsWith('---')) warnings.push('DESIGN.md has no YAML front matter')
    if (!/(colors?|typography|spacing|rounded|token)/i.test(content)) warnings.push('DESIGN.md has no recognizable design tokens')
  }
  return { ok: true, bytes: Buffer.byteLength(content, 'utf8'), warnings }
}

function assertWritable(content) {
  if (!content.endsWith('\n')) content += '\n'
  return content
}

export function registerProjectDocsTool(ctx, config = {}) {
  if (config.codeEnabled === false) return
  ctx.tools.register({
    name: PROJECT_DOCS_TOOL,
    description: 'Create, read, validate or update the project AGENTS.md / DESIGN.md. Existing files require expectedSha256 for compare-and-swap; missing/wrong hashes fail instead of overwriting. Only these two filenames are writable, paths stay inside the workspace, secrets are rejected. This tool never grants permissions and does not auto-create project rules.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'read', 'validate', 'apply'] },
        kind: { type: 'string', enum: ['agents', 'design'] },
        path: { type: 'string', description: 'Optional workspace-relative path; basename must be AGENTS.md or DESIGN.md.' },
        content: { type: 'string', maxLength: MAX_BYTES, description: 'Full next content for apply/validate.' },
        expectedSha256: { type: 'string', description: 'Current file hash for updates. Omit only when creating a new file.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          action: { type: 'string' }, status: { type: 'string' }, failureCode: { type: 'string' }, message: { type: 'string' },
          kind: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' }, sha256: { type: 'string' },
          expectedSha256: { type: 'string' }, bytes: { type: 'integer' }, warnings: { type: 'array', items: { type: 'string' } },
          docs: { type: 'array', items: { type: 'object', additionalProperties: true } }, mode: { type: 'string' }, refreshHint: { type: 'string' },
        },
        required: ['action', 'status'], additionalProperties: true,
      },
      render: (_args, value) => [{ type: 'text', text: `[${PROJECT_DOCS_TOOL}] ${value.action}\n${JSON.stringify(value)}` }],
    },
    async execute(args, exec) {
      const agent = requirePatchworkAgent(exec?.agent)
      const action = args?.action
      const started = Date.now()
      logDiagnostic(ctx, exec, { mechanism: 'docs', event: 'start', reason: 'docs-started', provider: action })
      try {
        if (!['status', 'read', 'validate', 'apply'].includes(action)) throw new DocError('invalid action', 'PROJECT_DOC_INVALID_ACTION')
        const root = await workspaceRoot(agent)
        let result
        if (action === 'status') {
          if (args?.kind !== undefined && !isKind(args.kind)) throw new DocError('kind must be agents or design', 'PROJECT_DOC_KIND_REQUIRED')
          const kinds = args?.kind ? [args.kind] : ['agents', 'design']
          const docs = []
          for (const kind of kinds) docs.push(...await findDocs(root, kind))
          result = { action, status: 'ok', docs }
        } else if (action === 'read') {
          const path = targetPath(root, args?.kind, args?.path)
          const content = await readFile(path, 'utf8')
          if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) throw new DocError('file is too large to read here', 'PROJECT_DOC_TOO_LARGE')
          result = { action, status: 'ok', kind: args.kind, path, content, sha256: sha256(content), bytes: Buffer.byteLength(content, 'utf8') }
        } else if (action === 'validate') {
          const checked = validate(args?.kind, args?.content)
          result = { action, status: 'ok', kind: args.kind, bytes: checked.bytes, warnings: checked.warnings }
        } else {
          const path = targetPath(root, args?.kind, args?.path)
          const checked = validate(args?.kind, args?.content)
          let existing
          try { existing = await readFile(path, 'utf8') } catch (error) { if (error?.code !== 'ENOENT') throw error }
          if (existing !== undefined) {
            const current = sha256(existing)
            if (!args?.expectedSha256) throw new DocError(`file exists; pass expectedSha256=${current}`, 'PROJECT_DOC_EXISTS')
            if (args.expectedSha256 !== current) throw new DocError(`hash mismatch; current=${current}`, 'PROJECT_DOC_CONFLICT')
          } else if (args?.expectedSha256) {
            throw new DocError('expectedSha256 was provided but the file does not exist', 'PROJECT_DOC_NOT_FOUND')
          }
          const content = assertWritable(args.content)
          const bytes = Buffer.byteLength(content, 'utf8')
          const temp = `${path}.${randomUUID()}.tmp`
          await mkdir(dirname(path), { recursive: true, mode: 0o700 })
          try {
            await writeFile(temp, content, { encoding: 'utf8', mode: 0o600 })
            await rename(temp, path)
          } finally { await rm(temp, { force: true }) }
          result = { action, status: 'ok', kind: args.kind, path, mode: existing === undefined ? 'created' : 'updated', bytes, warnings: checked.warnings, sha256: sha256(content), ...(existing !== undefined ? { expectedSha256: sha256(existing) } : {}), refreshHint: args.kind === 'agents' ? 'call the structured read tool on this path (or reopen the session) so DSH refreshes the injected instructions; shell cd does not trigger discovery' : 'DESIGN.md is not auto-injected; read it explicitly when needed' }
        }
        record('docs', `${action}Calls`)
        logDiagnostic(ctx, exec, { mechanism: 'docs', event: 'success', reason: `docs-${action}`, provider: action, elapsedMs: Date.now() - started, resultCount: result.docs?.length ?? 1 })
        return result
      } catch (error) {
        const code = error instanceof DocError ? error.code : 'PROJECT_DOC_FAILED'
        record('docs', 'failures')
        logDiagnostic(ctx, exec, { mechanism: 'docs', event: 'failure', reason: 'docs-failed', provider: action, elapsedMs: Date.now() - started, error })
        return { action, status: 'failed', failureCode: code, message: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}
