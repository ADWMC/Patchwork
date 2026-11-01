import { logDiagnostic } from '../logging/session-log.mjs'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { decideCandidate, improvementSnapshot, proposeCandidate, recordExperiment, recordIncident, rollbackCandidate } from './store.mjs'

export const PATCHWORK_IMPROVEMENT_TOOL = 'patchwork_improvement'

const schema = { type: 'object', properties: {
  schemaVersion: { type: 'integer' }, status: { type: 'string' }, persistence: { type: 'string' }, failures: { type: 'integer' }, revision: { type: 'integer' }, failureCode: { type: 'string' },
  incident: { type: 'object', additionalProperties: true }, candidate: { type: 'object', additionalProperties: true }, experiment: { type: 'object', additionalProperties: true },
  eligibility: { type: 'object', additionalProperties: true }, incidents: { type: 'array', items: { type: 'object', additionalProperties: true } },
  candidates: { type: 'array', items: { type: 'object', additionalProperties: true } }, experiments: { type: 'array', items: { type: 'object', additionalProperties: true } },
  automaticActivation: { type: 'string' }, activation: { type: 'string' },
}, required: ['status'], additionalProperties: false }

export function registerImprovementTool(ctx, config = {}) {
  if (config.improvementEnabled === false) return
  ctx.tools.register({
    name: PATCHWORK_IMPROVEMENT_TOOL,
    description: 'Record failures and propose bounded Patchwork improvements. Candidates require real incident provenance and a baseline/candidate/held-out experiment. Approval, trial and rollback require explicit user confirmation and never change runtime rules automatically.',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['list', 'incident', 'propose', 'experiment', 'approve', 'trial', 'rollback'] },
      kind: { type: 'string', enum: ['failure', 'correction', 'repeat', 'boundary', 'context-cost', 'ui-confusion', 'unverified-tool'] },
      sourceReceiptIds: { type: 'array', items: { type: 'string' }, maxItems: 8 }, incidentIds: { type: 'array', items: { type: 'string' }, maxItems: 8 },
      candidateId: { type: 'string' }, trigger: { type: 'string' }, actionText: { type: 'string' }, object: { type: 'string', enum: ['rule', 'memory-policy', 'tool-flow', 'ui-copy'] },
      hypothesis: { type: 'string' }, changeScope: { type: 'string' }, rollbackTarget: { type: 'string' }, activationScope: { type: 'string', enum: ['session', 'project'] },
      sourceFailureIds: { type: 'array', items: { type: 'string' }, maxItems: 16 }, sets: { type: 'object', additionalProperties: false, properties: { tuning: { type: 'array', items: { type: 'string' } }, heldOut: { type: 'array', items: { type: 'string' } } } },
      baseline: { type: 'object', additionalProperties: true }, candidate: { type: 'object', additionalProperties: true }, regressions: { type: 'array', items: { type: 'string' } }, sideEffects: { type: 'array', items: { type: 'string' } },
      expectedRevision: { type: 'integer' },
    }, required: ['action'], additionalProperties: false },
    output: { schema, render: (_args, value) => [{ type: 'text', text: `[${PATCHWORK_IMPROVEMENT_TOOL}] status=${value.status} revision=${value.revision ?? 'unknown'} automaticActivation=${value.automaticActivation ?? 'disabled'}` }] },
    async execute(args, exec) {
      const agent = requirePatchworkAgent(exec?.agent)
      const started = Date.now()
      logDiagnostic(ctx, exec, { mechanism: 'improvement', event: 'start', reason: 'improvement-started', provider: args?.action })
      try {
        let result
        if (args.action === 'list') result = improvementSnapshot(agent)
        else if (args.action === 'incident') result = recordIncident(agent, { ...args, action: args.actionText, sourceReceiptIds: args.sourceReceiptIds })
        else if (args.action === 'propose') result = proposeCandidate(agent, args)
        else if (args.action === 'experiment') result = recordExperiment(agent, args)
        else if (args.action === 'approve') result = decideCandidate(agent, args.candidateId, args.expectedRevision, { mode: 'enabled', userConfirmed: exec?.userConfirmed === true })
        else if (args.action === 'trial') result = decideCandidate(agent, args.candidateId, args.expectedRevision, { mode: 'trial', userConfirmed: exec?.userConfirmed === true })
        else if (args.action === 'rollback') result = rollbackCandidate(agent, args.candidateId, args.expectedRevision, { userConfirmed: exec?.userConfirmed === true })
        else result = { status: 'failed', failureCode: 'IMPROVEMENT_INVALID_ACTION' }
        requirePatchworkAgent(agent)
        logDiagnostic(ctx, exec, { mechanism: 'improvement', event: result.status === 'failed' ? 'failure' : 'success', reason: result.status === 'failed' ? 'improvement-failed' : 'improvement-completed', provider: args?.action, elapsedMs: Date.now() - started })
        return result
      } catch (error) {
        if (isPatchworkAgent(agent)) logDiagnostic(ctx, exec, { mechanism: 'improvement', event: 'failure', reason: 'exception', provider: args?.action, elapsedMs: Date.now() - started, error })
        throw error
      }
    },
  })
}
