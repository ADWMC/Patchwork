import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { registerActionChecks } from './action-check.mjs'
import { executeAcceptance, registerArtifact } from './acceptance.mjs'
import { flushTasks, taskProjection, taskSummary, transitionTask } from './store.mjs'
import { HANDOFF_SOURCE, hasTaskHandoff, taskHandoff, taskHandoffText } from './handoff.mjs'
import { currentPolicy, policyOutputs, revokePolicies } from '../improvement/policy.mjs'

const item = { type: 'object', properties: {
  id: { type: 'string', description: 'Stable acceptance id, later used as check.id.' }, label: { type: 'string' }, kind: { type: 'string', enum: ['command', 'artifact', 'semantic'] },
  required: { type: 'boolean' }, targets: { type: 'array', description: 'Artifact ids; reuse exactly these ids when registering artifacts.', items: { type: 'string' } }, coverage: { type: 'array', minItems: 1, description: 'Required unit ids. Omit for one check; default is ["all"]. Never send []. check.unit must match one.', items: { type: 'string' } },
}, required: ['id', 'label', 'kind'], additionalProperties: false }

export function registerTaskLifecycle(ctx, config = {}) {
  registerActionChecks(ctx, config)
  ctx.on('agent/inbox/inserted', ({ agent, message }) => {
    if (!isPatchworkAgent(agent) || message?.source?.kind === 'patchwork' || !message?.id) return
    try { transitionTask(agent, { kind: 'incoming', eventId: message.id, sourceKind: message.source?.kind }) }
    catch { /* Degraded state stays blocked; no permission is inferred from text. */ }
  })
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    if (!isPatchworkAgent(agent) || decision.kind !== 'enter') return decision
    const policy = policyOutputs(currentPolicy(agent), { hasTask: Boolean(taskProjection(agent)?.title) })
    const summary = taskHandoffText(agent) + (policy.deliveryReminder ? '\n' + policy.deliveryReminder : '')
    if (hasTaskHandoff(agent, summary, decision.messages)) return decision
    return { ...decision, messages: [...decision.messages, createUserMessage({
      content: [{ type: 'text', text: summary }], source: { kind: 'patchwork', form: 'notice', summary: HANDOFF_SOURCE },
    })] }
  })
  ctx.tools.register({
    name: 'patchwork_task',
    description: 'Track multi-step edits, corrections, artifacts and acceptance; skip one-off read-only answers. All fields are TOP LEVEL, never nested in arguments. Inspect for current revision; handoff reads a bounded recovery snapshot without changing the task. Examples: {action:"artifact",baseRevision:3,id:"code",path:"C:/work/file.mjs"}; {action:"check",baseRevision:4,id:"tests",command:"node --test",description:"Run behavioral tests"}. check.id is the REQUIREMENT id; artifact.id must match requirement.targets. check EXECUTES the command and records a receipt, not attaches a previous shell result. Register final targets then call check directly: standalone shell calls invalidate artifacts, including read-only commands. Omit coverage/unit for one check. Model statements do not grant permissions. Semantic assessment remains unknown; host approvals still apply.',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['inspect', 'handoff', 'define', 'correct', 'artifact', 'check', 'assessment', 'candidate', 'cancel'] },
      baseRevision: { type: 'integer', description: 'Required for every action except inspect/handoff. Use the current revision from inspect or handoff; do not guess.' },
      title: { type: 'string', description: 'Required for define. For correct, omit to keep the existing title.' },
      phase: { type: 'string', enum: ['analysis', 'plan', 'implement', 'verify'], description: 'Required for define; correct inherits it when omitted. Source edits require implement or verify; plan allows Markdown only, analysis allows no edits.' },
      requirements: { type: 'array', maxItems: 24, items: item }, references: { type: 'array', maxItems: 24, items: { type: 'string' } },
      affected: { type: 'array', items: { type: 'string' } }, needsClarification: { type: 'boolean' },
      instance: { type: 'object', properties: { id: { type: 'string' }, endpoint: { type: 'string' } }, required: ['id', 'endpoint'], additionalProperties: false },
      id: { type: 'string', description: 'For check/assessment: a requirement id from inspect. For artifact: an exact id in requirement.targets. Register every target after the final edit, BEFORE check, including command checks.' }, path: { type: 'string', description: 'Absolute artifact path; TOP LEVEL for artifact action.' }, supersedes: { type: 'string' }, unit: { type: 'string', description: 'Coverage unit id from inspect; omit for default all.' },
      tool: { type: 'string', enum: ['pwsh', 'bash'], description: 'Command check shell; defaults to pwsh.' },
      command: { type: 'string', description: 'TOP LEVEL shell command that check executes itself. Do not pre-run it through shell just to attach a result. Register current targets first; never a nested arguments object.' },
      description: { type: 'string', description: 'Purpose of the check command.' },
      rules: { type: 'object', description: 'Required for check on an artifact requirement: inspect its registered target file for these structure rules. Command requirements instead use command/tool; assessment is only for semantic requirements.', properties: { minLength: { type: 'integer' }, maxLength: { type: 'integer' }, anchors: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
      verdict: { type: 'string', enum: ['supported', 'contradicted', 'unknown'] },
      sourceReceiptId: { type: 'string' }, trigger: { type: 'string' }, label: { type: 'string' },
    }, required: ['action'], additionalProperties: false },
    output: { schema: { type: 'object', properties: { task: { type: 'object', additionalProperties: true }, receipt: { type: 'object', additionalProperties: true }, handoff: { type: 'object', additionalProperties: true } }, required: ['task'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      const agent = exec.agent
      requirePatchworkAgent(agent)
      let receipt
      if (!['inspect', 'handoff'].includes(args.action) && !Number.isSafeInteger(args.baseRevision)) throw new Error('baseRevision required; inspect first')
      if (['define', 'correct'].includes(args.action)) transitionTask(agent, { kind: args.action, baseRevision: args.baseRevision, data: args })
      else if (args.action === 'artifact') {
        if (!args.id || !args.path) throw new Error('artifact requires TOP LEVEL baseRevision, id and absolute path. Example: {action:"artifact",baseRevision:3,id:"code",path:"C:/work/file.mjs"}')
        await registerArtifact(agent, args, args.baseRevision)
      }
      else if (args.action === 'check') ({ receipt } = await executeAcceptance(agent, { ...args, tool: args.tool ?? 'pwsh', arguments: { command: args.command, description: args.description ?? 'Verify declared acceptance' } }, exec))
      else if (args.action === 'assessment') transitionTask(agent, { kind: 'assessment', baseRevision: args.baseRevision, id: args.id, verdict: args.verdict })
      else if (args.action === 'cancel') transitionTask(agent, { kind: 'cancel', baseRevision: args.baseRevision })
      else if (args.action === 'candidate') transitionTask(agent, { kind: 'candidate', baseRevision: args.baseRevision, data: args })
      else if (!['inspect', 'handoff'].includes(args.action)) throw new Error('unknown task action')
      await flushTasks(agent)
      requirePatchworkAgent(agent)
      if (args.action === 'handoff') {
        const handoff = taskHandoff(agent)
        return { task: { taskId: handoff.taskId, revision: handoff.revision, status: handoff.status }, handoff }
      }
      return { task: taskProjection(agent), ...(receipt ? { receipt } : {}) }
    },
  })
  ctx.commands.register({ name: 'patchwork-task', description: '查看当前任务、纠正版本和逐项验收（不授予权限）',
    handler(invocation) { requirePatchworkAgent(invocation.agent); return { kind: 'success', text: taskSummary(invocation.agent) } } })
}
