import { logDiagnostic } from '../logging/session-log.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { confirmMemory, forgetMemory, memorySnapshot, proposeMemory, recallMemory } from './store.mjs'

export const PATCHWORK_MEMORY_TOOL = 'patchwork_memory'

function resultSchema() {
  return {
    type: 'object',
    properties: {
      schemaVersion: { type: 'integer' }, status: { type: 'string' }, operationId: { type: 'string' }, recordId: { type: 'string' }, revision: { type: 'integer' },
      namespaceEpoch: { type: 'integer' }, failureCode: { type: 'string' }, includeProject: { type: 'boolean' },
      visibility: { type: 'string' }, indexed: { type: 'boolean' }, automaticInjection: { type: 'string' }, entries: { type: 'array', items: { type: 'object', additionalProperties: true } },
      record: { type: 'object', additionalProperties: true },
    },
    required: ['status'], additionalProperties: false,
  }
}

export function registerMemoryTool(ctx, config = {}) {
  if (config.memoryEnabled === false) return
  ctx.tools.register({
    name: PATCHWORK_MEMORY_TOOL,
    description: 'Manage Patchwork memory explicitly inside the current Patchwork Agent scope. Proposals are never automatically active; project sharing requires explicit confirmation, reads are on-demand, and memory is never injected into ordinary model context.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['propose', 'recall', 'confirm', 'forget', 'list'] },
        visibility: { type: 'string', enum: ['session-private', 'project-shared'] },
        key: { type: 'string' }, value: { type: 'string' }, kind: { type: 'string' }, conditions: { type: 'string' }, query: { type: 'string' }, includeProject: { type: 'boolean' },
        id: { type: 'string' }, expectedRevision: { type: 'integer' }, limit: { type: 'integer', minimum: 1, maximum: 5 },
      }, required: ['action'], additionalProperties: false,
    },
    output: { schema: resultSchema(), render: (_args, value) => [{ type: 'text', text: `[${PATCHWORK_MEMORY_TOOL}] status=${value.status} entries=${value.entries?.length ?? 0} automaticInjection=${value.automaticInjection ?? 'disabled'}` }] },
    async execute(args, exec) {
      const agent = requirePatchworkAgent(exec?.agent)
      const action = args?.action
      const started = Date.now()
      logDiagnostic(ctx, exec, { mechanism: 'memory', event: 'start', reason: 'memory-started', provider: action })
      try {
        let result
        if (action === 'propose') result = await proposeMemory(agent, args)
        else if (action === 'confirm') result = await confirmMemory(agent, args?.id, args?.expectedRevision, { userConfirmed: exec?.userConfirmed === true })
        else if (action === 'forget') result = await forgetMemory(agent, args?.id, args?.expectedRevision, { userConfirmed: exec?.userConfirmed === true })
        else if (action === 'recall') result = await recallMemory(agent, { query: args?.query, includeProject: args?.includeProject === true, limit: args?.limit })
        else if (action === 'list') result = memorySnapshot(agent) ?? { status: 'failed', failureCode: 'MEMORY_SCOPE_REQUIRED', entries: [] }
        else result = { status: 'failed', failureCode: 'MEMORY_INVALID_ACTION', entries: [] }
        requirePatchworkAgent(agent)
        logDiagnostic(ctx, exec, { mechanism: 'memory', event: result.status === 'failed' ? 'failure' : 'success', reason: result.status === 'failed' ? 'memory-failed' : 'memory-completed', provider: action, elapsedMs: Date.now() - started, resultCount: result.entries?.length ?? (result.record ? 1 : 0) })
        return result
      } catch (error) {
        if (isPatchworkAgent(agent)) logDiagnostic(ctx, exec, { mechanism: 'memory', event: 'failure', reason: 'exception', provider: action, elapsedMs: Date.now() - started, error })
        throw error
      }
    },
  })
}
