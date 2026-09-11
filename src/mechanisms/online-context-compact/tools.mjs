import { PLAN_TOOL_NAME } from './config.mjs'
import { formatPlanSnapshot, validatePlan } from './plan.mjs'

const STEP_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Stable id for this step; reuse it when you update the step.' },
    text: { type: 'string', description: 'What this step does, in one short line.' },
    status: { type: 'string', description: 'One of pending, in_progress, completed.' },
  },
  required: ['id', 'text', 'status'],
  additionalProperties: false,
}

/**
 * `update_plan` 是本机制的语义输入：模型只有把某个步骤标成 completed，
 * 才产生一个可压缩的边界。
 *
 * 校验失败走抛错（→ isError），因为提交一份含糊的计划是模型的错误，
 * 不该被静默接受后再由本机制去猜它想表达什么。
 *
 * @param onPlan - 接收校验后的计划与本次新完成的步骤；由生命周期决定要不要压缩。
 */
export function registerPlanTool(ctx, onPlan) {
  ctx.tools.register({
    name: PLAN_TOOL_NAME,
    description:
      'Record or update your working plan for the current task. Submit the complete list every time; mark a step completed only when it is actually finished, because a completed step is the point where the session may compact its context and continue.',
    parameters: {
      type: 'object',
      properties: { steps: { type: 'array', items: STEP_SCHEMA } },
      required: ['steps'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          completed: { type: 'number' },
          total: { type: 'number' },
          plan: { type: 'string' },
        },
        required: ['completed', 'total', 'plan'],
        additionalProperties: false,
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Plan recorded: ${value.completed}/${value.total} steps completed.\n${value.plan}`,
        },
      ],
    },
    async execute(args, exec) {
      const validated = validatePlan(args)
      if (!validated.ok) throw new Error(`invalid plan: ${validated.reason}`)

      const outcome = await onPlan({ steps: validated.steps, exec })
      return {
        completed: validated.steps.filter(step => step.status === 'completed').length,
        total: validated.steps.length,
        plan: formatPlanSnapshot(validated.steps),
        ...outcome,
      }
    },
  })
}
