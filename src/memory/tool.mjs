import { logDiagnostic } from '../logging/session-log.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { confirmMemory, forgetMemory, listMemory, proposeMemory, recallMemory, revokeMemoryOperations } from './store.mjs'

export const PATCHWORK_MEMORY_TOOL = 'patchwork_memory'

function resultSchema() {
  return {
    type: 'object',
    properties: {
      schemaVersion: { type: 'integer' }, status: { type: 'string' }, operationId: { type: 'string' }, recordId: { type: 'string' }, revision: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
      namespaceEpoch: { type: 'integer' }, failureCode: { type: 'string' }, includeProject: { type: 'boolean' },
      visibility: { type: 'string' }, indexed: { type: 'boolean' }, automaticInjection: { type: 'string' }, entries: { type: 'array', items: { type: 'object', additionalProperties: true } },
      record: { type: 'object', additionalProperties: true },
      persistence: { type: 'string' }, recovery: { type: 'string' }, entryCount: { type: 'integer' }, hasMore: { type: 'boolean' },
      offset: { type: 'integer' }, nextOffset: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
    },
    required: ['status'], additionalProperties: false,
  }
}

export function registerMemoryTool(ctx, config = {}) {
  const cancellation = new AbortController()
  ctx.effect?.(() => () => { cancellation.abort(); revokeMemoryOperations(ctx) }, 'patchwork: revoke queued memory operations')
  if (config.memoryEnabled === false) return
  ctx.tools.register({
    name: PATCHWORK_MEMORY_TOOL,
    description: 'Manage Patchwork memory explicitly inside the current Patchwork Agent scope. list returns at most five metadata rows with query/status/validity filters and offset pagination, never bodies or audit history. inspect reads one exact visible record on demand; project-shared records require includeProject: true. recall returns at most five active fresh memories. Set includeProject explicitly to read shared project records. Proposals are never automatically active; confirmation/forget require the host user-confirmation channel. No automatic injection into ordinary model context.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['propose', 'recall', 'confirm', 'forget', 'list', 'inspect'] },
        visibility: { type: 'string', enum: ['session-private', 'project-shared'] },
        key: { type: 'string' }, value: { type: 'string' }, kind: { type: 'string' }, conditions: { type: 'string' }, query: { type: 'string' }, includeProject: { type: 'boolean' },
        id: { type: 'string' }, expectedRevision: { type: 'integer' }, limit: { type: 'integer', minimum: 1, maximum: 5 },
        offset: { type: 'integer', minimum: 0 }, status: { type: 'string', enum: ['all', 'proposed', 'active', 'superseded', 'revoked'] }, validity: { type: 'string', enum: ['all', 'fresh', 'stale', 'conflicted', 'expired', 'unsupported'] },
      }, required: ['action'], additionalProperties: false,
    },
    output: { schema: resultSchema(), render: (_args, value) => [{ type: 'text', text: `[${PATCHWORK_MEMORY_TOOL}]\n${JSON.stringify(value)}` }] },
    async execute(args, exec) {
      const agent = requirePatchworkAgent(exec?.agent)
      cancellation.signal.throwIfAborted()
      const signal = exec?.signal ? AbortSignal.any([exec.signal, cancellation.signal]) : cancellation.signal
      const action = args?.action
      const started = Date.now()
      logDiagnostic(ctx, exec, { mechanism: 'memory', event: 'start', reason: 'memory-started', provider: action })
      try {
        let result
        if (action === 'propose') result = await proposeMemory(agent, args, { signal })
        else if (action === 'confirm') result = await confirmMemory(agent, args?.id, args?.expectedRevision, { userConfirmed: exec?.userConfirmed === true, signal })
        else if (action === 'forget') result = await forgetMemory(agent, args?.id, args?.expectedRevision, { userConfirmed: exec?.userConfirmed === true, signal })
        else if (action === 'recall') result = await recallMemory(agent, { query: args?.query, includeProject: args?.includeProject === true, limit: args?.limit })
        else if (action === 'list') {
          const snapshot = await listMemory(agent, { query: args?.query ?? '', scope: args?.includeProject ? 'all' : 'session-private', status: args?.status ?? 'all', validity: args?.validity ?? 'all', offset: args?.offset ?? 0, limit: args?.limit ?? 5, signal })
          result = { status: snapshot.status, entries: (snapshot.entries ?? []).map(({ id, key, kind, conditions, visibility, status, validity, revision, contentVersion }) => ({ id, key, kind, conditions, visibility, status, validity, revision, ...(contentVersion ? { contentVersion } : {}) })), revision: snapshot.revision ?? null, automaticInjection: 'disabled', ...(snapshot.failureCode ? { failureCode: snapshot.failureCode } : { persistence: 'file', namespaceEpoch: snapshot.namespaceEpoch, entryCount: snapshot.entryCount, hasMore: snapshot.hasMore, offset: snapshot.offset, nextOffset: snapshot.hasMore ? snapshot.offset + snapshot.limit : null }) }
        } else if (action === 'inspect') {
          if (typeof args?.id !== 'string' || !args.id) result = { status: 'failed', failureCode: 'MEMORY_ID_REQUIRED' }
          else {
            const snapshot = await listMemory(agent, { id: args.id, scope: args.includeProject ? 'all' : 'session-private', limit: 1, signal })
            if (snapshot.record) result = { status: 'indexed', record: snapshot.record, revision: snapshot.revision }
            else if (args.includeProject) result = { status: 'failed', failureCode: snapshot.failureCode ?? 'MEMORY_NOT_FOUND' }
            else {
              // A project-shared record is invisible without explicit inclusion; name the scope requirement instead of a bare not-found.
              const all = await listMemory(agent, { id: args.id, scope: 'all', limit: 1, signal })
              result = all.record ? { status: 'failed', failureCode: 'MEMORY_PROJECT_SCOPE_REQUIRED' } : { status: 'failed', failureCode: all.failureCode ?? snapshot.failureCode ?? 'MEMORY_NOT_FOUND' }
            }
          }
        }
        else result = { status: 'failed', failureCode: 'MEMORY_INVALID_ACTION', entries: [] }
        cancellation.signal.throwIfAborted(); requirePatchworkAgent(agent)
        logDiagnostic(ctx, exec, { mechanism: 'memory', event: result.status === 'failed' ? 'failure' : 'success', reason: result.status === 'failed' ? 'memory-failed' : 'memory-completed', level: result.status === 'failed' ? 'warn' : 'info', provider: action, elapsedMs: Date.now() - started, resultCount: result.entries?.length ?? (result.record ? 1 : 0) })
        return result
      } catch (error) {
        if (isPatchworkAgent(agent)) logDiagnostic(ctx, exec, { mechanism: 'memory', event: 'failure', reason: 'exception', provider: action, elapsedMs: Date.now() - started, error })
        throw error
      }
    },
  })
}
