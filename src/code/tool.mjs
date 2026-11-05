import { logDiagnostic } from '../logging/session-log.mjs'
import { record } from '../ui/mechanism-stats.mjs'
import { requirePatchworkAgent } from '../scope.mjs'
import {
  CODE_DEFAULTS,
  CodeError,
  affectedTests,
  buildCodeIndex,
  calleesOf,
  callersOf,
  findDefinitions,
  findReferences,
  impactOf,
  indexSummary,
  outlineCode,
  repoMap,
  searchCode,
  workspaceRoot,
} from './code-index.mjs'
import { enableWorkspaceGraph, readWorkspaceConfig, workspaceConfigInfo } from './workspace-config.mjs'
import { searchChunks, CHUNK_DEFAULTS } from './chunks.mjs'

export const PATCHWORK_CODE_TOOL = 'patchwork_code'
const GRAPH_ACTIONS = new Set(['graph-status', 'graph-enable', 'graph-disable', 'graph-start', 'graph-stop'])
const QUERY_ACTIONS = new Set(['callers', 'callees', 'impact', 'affected'])
const activeGraphs = new Set()
export function isCodeGraphStarted(root) { return activeGraphs.has(root) }

function textResult(value) {
  if (value.action === 'map') return [{ type: 'text', text: value.text }]
  if (value.action === 'chunks') {
    const chunks = Array.isArray(value.chunks) ? value.chunks : []
    const text = chunks.length
      ? chunks.map(chunk => `${chunk.path}:${chunk.startLine}-${chunk.endLine} (score ${chunk.score}${chunk.enclosingSymbol ? `, in ${chunk.enclosingSymbol}` : ''})\n${chunk.preview}`).join('\n\n---\n\n')
      : (value.message ?? 'no relevant chunks')
    return [{ type: 'text', text }]
  }
  return [{ type: 'text', text: `[${PATCHWORK_CODE_TOOL}] ${value.action}\n${JSON.stringify(value)}` }]
}

function failure(action, error) {
  const code = error instanceof CodeError ? error.code : 'CODE_FAILED'
  return { action, status: 'failed', failureCode: code, message: error instanceof Error ? error.message : String(error) }
}

function graphConfigValues(info) {
  const graph = info?.config?.codeGraph
  if (!graph) return null
  return { maxFiles: graph.maxFiles, maxFileBytes: graph.maxFileBytes, tokenBudget: graph.tokenBudget, exclude: graph.exclude }
}

async function indexFor(root, config, { refresh = false } = {}) {
  const graph = graphConfigValues(config) ?? {}
  return buildCodeIndex(root, {
    refresh,
    maxFiles: graph.maxFiles ?? CODE_DEFAULTS.maxFiles,
    maxFileBytes: graph.maxFileBytes ?? CODE_DEFAULTS.maxFileBytes,
    exclude: graph.exclude ?? [],
  })
}

function graphStatusPayload(action, info, root) {
  const graph = info?.config?.codeGraph
  return {
    action, status: 'ok', enabled: graph?.enabled === true, started: activeGraphs.has(root),
    configPath: info?.relativePath ?? '.patchwork/config.json', configExists: info?.exists === true,
    configStatus: info?.status ?? 'missing', maxFiles: graph?.maxFiles ?? null, maxFileBytes: graph?.maxFileBytes ?? null,
    tokenBudget: graph?.tokenBudget ?? null, exclude: graph?.exclude ?? [], ...(info?.failureCode ? { failureCode: info.failureCode } : {}),
  }
}

export function registerCodeTool(ctx, config = {}) {
  if (config.codeEnabled === false) return
  const fallbackMaxFiles = Math.max(100, Math.min(20000, Math.trunc(Number(config.codeMaxFiles) || CODE_DEFAULTS.maxFiles)))
  const fallbackTokenBudget = Math.max(400, Math.min(CODE_DEFAULTS.maxTokenBudget, Math.trunc(Number(config.codeTokenBudget) || 2000)))
  ctx.tools.register({
    name: PATCHWORK_CODE_TOOL,
    description: 'Read-only local code map, ranked chunk search, and opt-in workspace code graph. Use map/outline/find/references/search for normal exploration; chunks ranks fixed-line code blocks by BM25 relevance to a natural-language or identifier query (no model call). The graph is disabled by default: graph-enable writes .patchwork/config.json, graph-start builds it, then callers/callees/impact/affected answer with a bounded lexical call graph. Graph actions are local workspace reads; they never grant permissions or use public web search. Results are bounded and exclude dependencies, build outputs and sensitive files.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['map', 'outline', 'find', 'references', 'search', 'chunks', ...GRAPH_ACTIONS, ...QUERY_ACTIONS] },
        path: { type: 'string', description: 'Workspace-relative or absolute file/directory; for affected, a comma-separated changed-file list.' },
        query: { type: 'string', description: 'Search text for search; may be literal, word-boundary or regex.' },
        symbol: { type: 'string', description: 'Symbol name for find/references/callers/callees/impact.' },
        mode: { type: 'string', enum: ['literal', 'word', 'regex'], description: 'Search matching mode; defaults to literal.' },
        caseSensitive: { type: 'boolean', description: 'Defaults to true; set false for case-insensitive search.' },
        glob: { type: 'string', description: 'Optional file glob filter for search, e.g. src/**/*.mjs.' },
        tokenBudget: { type: 'integer', minimum: 400, maximum: CODE_DEFAULTS.maxTokenBudget, description: 'Map token budget; omission uses the workspace or plugin default.' },
        maxResults: { type: 'integer', minimum: 1, maximum: 100, description: 'Bounded result count for search/find/references/callers/callees.' },
        maxFiles: { type: 'integer', minimum: 100, maximum: 20000, description: 'Workspace graph file cap for graph-enable.' },
        maxFileBytes: { type: 'integer', minimum: 4096, maximum: 2097152, description: 'Workspace graph per-file byte cap for graph-enable.' },
        exclude: { type: 'array', maxItems: 64, items: { type: 'string', maxLength: 240 }, description: 'Additional workspace-relative exclude globs for graph-enable.' },
        depth: { type: 'integer', minimum: 1, maximum: 4, description: 'Impact traversal depth; defaults to 2.' },
        files: { type: 'array', maxItems: 64, items: { type: 'string' }, description: 'Changed source files for affected, as an alternative to path.' },
        refresh: { type: 'boolean', description: 'Rebuild the index instead of reusing unchanged file metadata.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          action: { type: 'string' }, status: { type: 'string' }, failureCode: { type: 'string' }, message: { type: 'string' },
          text: { type: 'string' }, path: { type: 'string' }, language: { type: 'string' }, lines: { type: 'integer' },
          symbols: { type: 'array', items: { type: 'object', additionalProperties: true } }, symbolCount: { type: 'integer' }, imports: { type: 'array', items: { type: 'string' } },
          matches: { type: 'array', items: { type: 'object', additionalProperties: true } }, files: { type: 'integer' },
          definitions: { type: 'integer' }, references: { type: 'integer' }, matchCount: { type: 'integer' }, scanned: { type: 'integer' }, totalFiles: { type: 'integer' },
          truncated: { type: 'boolean' }, cache: { type: 'string' }, builtAt: { type: 'string' }, lexical: { type: 'boolean' },
          enabled: { type: 'boolean' }, started: { type: 'boolean' }, configPath: { type: 'string' }, configExists: { type: 'boolean' },
          configStatus: { type: 'string' }, maxFiles: { type: 'integer' }, maxFileBytes: { type: 'integer' }, tokenBudget: { type: 'integer' },
          exclude: { type: 'array', items: { type: 'string' } }, callers: { type: 'array', items: { type: 'object', additionalProperties: true } },
          callees: { type: 'array', items: { type: 'object', additionalProperties: true } }, targets: { type: 'array', items: { type: 'object', additionalProperties: true } }, ambiguous: { type: 'boolean' }, impacted: { type: 'array', items: { type: 'object', additionalProperties: true } },
          tests: { type: 'array', items: { type: 'string' } }, dependents: { type: 'array', items: { type: 'string' } }, depth: { type: 'integer' },
          query: { type: 'string' }, chunks: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['action', 'status'], additionalProperties: true,
      },
      render: (_args, value) => textResult(value),
    },
    async execute(args, exec) {
      const agent = requirePatchworkAgent(exec?.agent)
      const action = args?.action
      const started = Date.now()
      logDiagnostic(ctx, exec, { mechanism: 'code', event: 'start', reason: 'code-started', provider: action })
      try {
        if (!['map', 'outline', 'find', 'references', 'search', 'chunks'].includes(action) && !GRAPH_ACTIONS.has(action) && !QUERY_ACTIONS.has(action)) {
          return failure(action, new CodeError('invalid patchwork_code action', 'CODE_INVALID_ACTION'))
        }
        const root = await workspaceRoot(agent)
        const info = await workspaceConfigInfo(root)
        if (info.status === 'invalid') return failure(action, new CodeError(info.message, 'CODE_GRAPH_CONFIG_INVALID'))

        if (action === 'graph-status') {
          logDiagnostic(ctx, exec, { mechanism: 'code', event: 'success', reason: 'code-graph-status', provider: action, elapsedMs: Date.now() - started })
          return graphStatusPayload(action, info, root)
        }
        if (action === 'graph-enable') {
          const overrides = {}
          if (args?.maxFiles !== undefined) overrides.maxFiles = args.maxFiles
          if (args?.maxFileBytes !== undefined) overrides.maxFileBytes = args.maxFileBytes
          if (args?.tokenBudget !== undefined) overrides.tokenBudget = args.tokenBudget
          if (args?.exclude !== undefined) overrides.exclude = args.exclude
          const written = await enableWorkspaceGraph(root, { enabled: true, overrides })
          record('code', 'graphEnableCalls')
          logDiagnostic(ctx, exec, { mechanism: 'code', event: 'success', reason: 'code-graph-enabled', provider: action, elapsedMs: Date.now() - started })
          return { action, status: 'ok', enabled: true, started: activeGraphs.has(root), configPath: written.path, ...graphConfigValues({ config: written.config }) }
        }
        if (action === 'graph-disable') {
          const written = await enableWorkspaceGraph(root, { enabled: false })
          activeGraphs.delete(root)
          record('code', 'graphDisableCalls')
          logDiagnostic(ctx, exec, { mechanism: 'code', event: 'success', reason: 'code-graph-disabled', provider: action, elapsedMs: Date.now() - started })
          return { action, status: 'ok', enabled: false, started: false, configPath: written.path }
        }
        if (action === 'graph-stop') {
          activeGraphs.delete(root)
          logDiagnostic(ctx, exec, { mechanism: 'code', event: 'success', reason: 'code-graph-stopped', provider: action, elapsedMs: Date.now() - started })
          return { action, status: 'ok', enabled: info.config.codeGraph.enabled, started: false }
        }
        if ((action === 'graph-start' || QUERY_ACTIONS.has(action)) && info.config.codeGraph.enabled !== true) {
          return { action, status: 'failed', failureCode: 'CODE_GRAPH_DISABLED', enabled: false, started: false, configPath: info.relativePath, message: `workspace code graph is disabled; call patchwork_code graph-enable first (config: ${info.relativePath})` }
        }
        if (action === 'graph-start') {
          const index = await indexFor(root, info, { refresh: args?.refresh === true })
          activeGraphs.add(root)
          record('code', 'graphStartCalls')
          logDiagnostic(ctx, exec, { mechanism: 'code', event: 'success', reason: 'code-graph-started', provider: action, elapsedMs: Date.now() - started })
          return { action, status: 'ok', enabled: true, started: true, configPath: info.relativePath, ...indexSummary(index), ...graphConfigValues(info) }
        }
        if (QUERY_ACTIONS.has(action) && !activeGraphs.has(root)) {
          return { action, status: 'failed', failureCode: 'CODE_GRAPH_NOT_STARTED', enabled: true, started: false, message: 'workspace code graph is not started; call patchwork_code graph-start first' }
        }

        const index = await indexFor(root, info, { refresh: args?.refresh === true })
        requirePatchworkAgent(agent)
        let result
        if (action === 'map') result = { action, status: 'ok', ...repoMap(index, { tokenBudget: args?.tokenBudget ?? graphConfigValues(info)?.tokenBudget ?? fallbackTokenBudget, focus: args?.path, query: args?.query }) }
        else if (action === 'outline') result = { action, status: 'ok', ...(await outlineCode(index, args?.path)) }
        else if (action === 'find') result = { action, status: 'ok', ...(await findDefinitions(index, { symbol: args?.symbol, maxResults: args?.maxResults ?? CODE_DEFAULTS.maxResults })) }
        else if (action === 'references') result = { action, status: 'ok', ...(await findReferences(index, { symbol: args?.symbol, maxResults: args?.maxResults ?? CODE_DEFAULTS.maxResults })) }
        else if (action === 'search') result = { action, status: 'ok', ...(await searchCode(index, { query: args?.query, mode: args?.mode ?? 'literal', caseSensitive: args?.caseSensitive !== false, path: args?.path, glob: args?.glob, maxResults: args?.maxResults ?? CODE_DEFAULTS.maxResults })) }
        else if (action === 'chunks') {
          if (!args?.query || !String(args.query).trim()) throw new CodeError('chunks requires a query', 'CODE_INVALID_QUERY')
          result = { action, status: 'ok', query: String(args.query).trim(), chunks: await searchChunks({ cwd: agent.session?.header?.cwd, index, query: args.query, maxResults: args?.maxResults ?? CHUNK_DEFAULTS.maxResults, path: args?.path, glob: args?.glob }) }
        }
        else if (action === 'callers') result = { action, status: 'ok', ...(await callersOf(index, { symbol: args?.symbol, maxResults: args?.maxResults ?? CODE_DEFAULTS.maxResults })) }
        else if (action === 'callees') result = { action, status: 'ok', ...(await calleesOf(index, { symbol: args?.symbol, maxResults: args?.maxResults ?? CODE_DEFAULTS.maxResults })) }
        else if (action === 'impact') result = { action, status: 'ok', ...(await impactOf(index, { symbol: args?.symbol, depth: args?.depth ?? 2 })) }
        else {
          const files = Array.isArray(args?.files) ? args.files : String(args?.path ?? '').split(',').map(item => item.trim()).filter(Boolean)
          result = { action, status: 'ok', ...affectedTests(index, { files }) }
        }
        const summary = indexSummary(index)
        record('code', `${action}Calls`)
        record('code', 'requests')
        record('code', 'filesIndexed', summary.files)
        if (result.truncated) record('code', 'truncatedResults')
        logDiagnostic(ctx, exec, { mechanism: 'code', event: 'success', reason: `code-${action}`, provider: action, elapsedMs: Date.now() - started, resultCount: result.matches?.length ?? result.callers?.length ?? result.callees?.length ?? result.matchCount ?? result.files ?? result.symbols?.length ?? 0 })
        return { ...result, ...(action === 'map' ? { builtAt: summary.builtAt, cache: result.cache ?? summary.cache } : {}) }
      } catch (error) {
        const result = failure(action, error)
        record('code', 'failures')
        logDiagnostic(ctx, exec, { mechanism: 'code', event: 'failure', reason: 'code-failed', provider: action, elapsedMs: Date.now() - started, error })
        return result
      }
    },
  })
}
