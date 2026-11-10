import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { isPatchworkAgent, requirePatchworkAgent } from '../scope.mjs'
import { registerActionChecks } from './action-check.mjs'
import { executeAcceptance, registerArtifact } from './acceptance.mjs'
import { flushTasks, taskProjection, taskSummary, transitionTask } from './store.mjs'
import { HANDOFF_SOURCE, hasTaskHandoff, taskHandoff, taskHandoffText } from './handoff.mjs'
import { currentPolicy, policyOutputs } from '../improvement/policy.mjs'
import { recallMemory } from '../memory/store.mjs'
import { resolveModelPreset } from '../config/model-presets-loader.mjs'

const item = { type: 'object', properties: {
  id: { type: 'string', description: 'Stable acceptance id, later used as check.id.' }, label: { type: 'string' }, kind: { type: 'string', enum: ['command', 'artifact', 'semantic'] },
  required: { type: 'boolean' }, targets: { type: 'array', description: 'Artifact ids; reuse exactly these ids when registering artifacts.', items: { type: 'string' } }, coverage: { type: 'array', minItems: 1, description: 'Required unit ids. Omit for one check; default is ["all"]. Never send []. check.unit must match one.', items: { type: 'string' } },
}, required: ['id', 'label', 'kind'], additionalProperties: false }

function boundedOutput(result, max = 4000) {
  const text = (result?.content ?? []).filter(block => block?.type === 'text').map(block => block.text).join('\n')
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}\n[output truncated to ${max} characters]` : text
}

export function registerTaskLifecycle(ctx, config = {}, tasteEngine) {
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
    let summary = taskHandoffText(agent) + (policy.deliveryReminder ? '\n' + policy.deliveryReminder : '')
    try {
      const activeModelPreset = resolveModelPreset(config, agent?.session?.header, agent?.session?.header?.cwd)
      if (activeModelPreset?.cognitiveNudge) {
        summary += '\n\n' + activeModelPreset.cognitiveNudge
      }
    } catch { /* Model cognitive nudge fails open */ }
    if (tasteEngine) {
      try {
        const task = taskProjection(agent)
        const affected = task?.affected ?? []
        const tasteNotice = await tasteEngine.getContextInjection(affected)
        if (tasteNotice) summary += '\n\n' + tasteNotice
      } catch { /* Taste injection fails open */ }
    }
    try {
      const recalled = await recallMemory(agent, { includeProject: true, limit: 3 })
      if (recalled?.entries?.length > 0) {
        const lines = recalled.entries.map(e => `• [${e.kind}] ${e.key}: ${e.value}`)
        summary += `\n\n[Active Project Experience]\n${lines.join('\n')}`
      }
    } catch { /* Memory auto-feed fails open */ }
    if (hasTaskHandoff(agent, summary, decision.messages)) return decision
    return { ...decision, messages: [...decision.messages, createUserMessage({
      content: [{ type: 'text', text: summary }], source: { kind: 'patchwork', form: 'notice', summary: HANDOFF_SOURCE },
    })] }
  })
  ctx.tools.register({
    name: 'patchwork_task',
    description: 'Track multi-step edits, corrections, artifacts and acceptance; skip one-off read-only answers. All fields are TOP LEVEL, never nested in arguments. Inspect for current revision; handoff reads a bounded recovery snapshot without changing the task. define may include a brief (goal, successCriteria, unknowns, assumptions, budget) so goals and stop conditions survive compaction. Examples: {action:"artifact",baseRevision:3,id:"code",path:"C:/work/file.mjs"}; {action:"check",baseRevision:4,id:"tests",command:"node --test",description:"Run behavioral tests"}. check.id is the REQUIREMENT id; artifact.id must match requirement.targets. check EXECUTES the command, records a receipt and returns a bounded output preview; use that output instead of re-running the same command in a standalone shell. Standalone shell calls invalidate artifacts, including read-only commands. Register final targets then call check directly. Omit coverage/unit for one check. Model statements do not grant permissions. Semantic assessment remains unknown; host approvals still apply.',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['inspect', 'handoff', 'define', 'correct', 'artifact', 'check', 'assessment', 'candidate', 'cancel'] },
      baseRevision: { type: 'integer', description: 'Required for every action except inspect/handoff. Use the current revision from inspect or handoff; do not guess.' },
      title: { type: 'string', description: 'Required for define. For correct, omit to keep the existing title.' },
      phase: { type: 'string', enum: ['analysis', 'plan', 'implement', 'verify'], description: 'Required for define; correct inherits it when omitted. Source edits require implement or verify; plan allows Markdown only, analysis allows no edits.' },
      brief: { type: 'object', description: 'Optional cognitive frame for multi-step work: goal, success criteria, unknowns, assumptions and budgets. Not authorization. Omit for simple tasks.', properties: {
        goal: { type: 'string', maxLength: 500 }, successCriteria: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 240 } },
        unknowns: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 240 } }, assumptions: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 240 } },
        budget: { type: 'object', properties: { maxSteps: { type: 'integer', minimum: 1, maximum: 200 }, maxSearchCalls: { type: 'integer', minimum: 1, maximum: 100 }, maxTokens: { type: 'integer', minimum: 1000, maximum: 2000000 } }, additionalProperties: false },
      }, additionalProperties: false },
      requirements: { type: 'array', maxItems: 24, items: item }, references: { type: 'array', maxItems: 24, items: { type: 'string' } },
      affected: { type: 'array', items: { type: 'string' } }, needsClarification: { type: 'boolean' },
      instance: { type: 'object', properties: { id: { type: 'string' }, endpoint: { type: 'string' } }, required: ['id', 'endpoint'], additionalProperties: false },
      id: { type: 'string', description: 'For check/assessment: a requirement id from inspect. For artifact: an exact id in requirement.targets. Register every target after the final edit, BEFORE check, including command checks.' }, path: { type: 'string', description: 'Absolute artifact path; TOP LEVEL for artifact action.' }, supersedes: { type: 'string' }, unit: { type: 'string', description: 'Coverage unit id from inspect; omit for default all.' },
      tool: { type: 'string', enum: ['pwsh', 'bash'], description: 'Command check shell; defaults to pwsh.' },
      command: { type: 'string', description: 'TOP LEVEL shell command that check executes itself. Do not pre-run it through shell just to attach a result. Register current targets first; never a nested arguments object.' },
      description: { type: 'string', description: 'Purpose of the check command.' },
      rules: { type: 'object', description: 'Required for check on an artifact requirement: inspect its registered target file for these structure rules. Command requirements instead use command/tool; assessment is only for semantic requirements.', properties: { minLength: { type: 'integer', description: 'Minimum character count (not bytes).' }, maxLength: { type: 'integer', description: 'Maximum character count (not bytes).' }, anchors: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
      visual: { type: 'object', description: 'Optional visual verification options: url and viewport dimensions.', properties: { url: { type: 'string' }, viewport: { type: 'object', properties: { width: { type: 'integer' }, height: { type: 'integer' } } } }, additionalProperties: false },
      verdict: { type: 'string', enum: ['supported', 'contradicted', 'unknown'] },
      sourceReceiptId: { type: 'string' }, trigger: { type: 'string' }, label: { type: 'string' },
    }, required: ['action'], additionalProperties: false },
    output: { schema: { type: 'object', properties: { task: { type: 'object', additionalProperties: true }, receipt: { type: 'object', additionalProperties: true }, handoff: { type: 'object', additionalProperties: true }, output: { type: 'string' } }, required: ['task'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      const agent = exec.agent
      requirePatchworkAgent(agent)
      let receipt, output
      if (!['inspect', 'handoff'].includes(args.action) && !Number.isSafeInteger(args.baseRevision)) throw new Error('baseRevision required; inspect first')
      if (['define', 'correct'].includes(args.action)) transitionTask(agent, { kind: args.action, baseRevision: args.baseRevision, data: args })
      else if (args.action === 'artifact') {
        if (!args.id || !args.path) throw new Error('artifact requires TOP LEVEL baseRevision, id and absolute path. Example: {action:"artifact",baseRevision:3,id:"code",path:"C:/work/file.mjs"}')
        await registerArtifact(agent, args, args.baseRevision)
      }
      else if (args.action === 'check') {
        if (args.path && args.id && Number.isSafeInteger(args.baseRevision)) {
          try {
            await registerArtifact(agent, { id: args.id, path: args.path }, args.baseRevision)
            args.baseRevision = taskProjection(agent).revision
          } catch { /* Auto-register artifact when path is passed with check */ }
        }
        const checked = await executeAcceptance(agent, { ...args, tool: args.tool ?? 'pwsh', arguments: { command: args.command, description: args.description ?? 'Verify declared acceptance' } }, exec)
        receipt = checked.receipt
        output = boundedOutput(checked.result)
      }
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
      return { task: taskProjection(agent), ...(receipt ? { receipt } : {}), ...(output ? { output } : {}) }
    },
  })
  ctx.commands.register({ name: 'patchwork-task', description: '查看当前任务、纠正版本和逐项验收（不授予权限）',
    handler(invocation) { requirePatchworkAgent(invocation.agent); return { kind: 'success', text: taskSummary(invocation.agent) } } })
}
