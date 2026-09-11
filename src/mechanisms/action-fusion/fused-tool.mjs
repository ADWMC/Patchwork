import { withFileQueue } from './file-queue.mjs'

export const THEN_RUN_PARAMETER = 'then_run'

const THEN_RUN_DESCRIPTION = [
  'Optional shell command to run in the same call, immediately after this mutation succeeds.',
  'Use it for the validation command that would otherwise need its own call.',
].join(' ')

const THEN_RUN_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    command: { type: 'string' },
    output: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['status', 'command'],
  additionalProperties: false,
}

/**
 * 在原生参数 Schema 上追加可选的 `then_run`。原本的 `required` 保持不变，
 * 因此老调用方式继续有效——这是遮蔽原生工具后仍要守住的兼容面。
 */
export function extendParameters(parameters = {}) {
  const properties = { ...(parameters.properties ?? {}) }
  properties[THEN_RUN_PARAMETER] = {
    type: 'object',
    description: THEN_RUN_DESCRIPTION,
    properties: {
      command: { type: 'string', description: 'Shell command to run after the mutation succeeds.' },
    },
    required: ['command'],
    additionalProperties: false,
  }
  return { ...parameters, properties }
}

/** 跟进命令的结果在模型侧的表现形式。 */
export function thenRunBlocks(thenRun) {
  if (!thenRun || typeof thenRun !== 'object') return []
  const lines = [`[then_run:${thenRun.status}]`]
  if (thenRun.reason) lines.push(`reason: ${thenRun.reason}`)
  if (thenRun.output) lines.push(thenRun.output)
  return [{ type: 'text', text: lines.join('\n') }]
}

/**
 * 由原生工具定义派生遮蔽定义：同样的名字与执行内核，额外接受 `then_run`。
 *
 * 规范值包装为 `{ mutation, thenRun? }`，因此必须自己声明 output 契约；
 * 展示投影仍委托原生实现，UI 的 diff 卡片不受影响。
 */
export function createFusedDefinition({ original, runThenRun }) {
  if (typeof original?.execute !== 'function') throw new TypeError('original tool must declare execute')
  if (typeof original?.output?.render !== 'function') throw new TypeError('original tool must declare output.render')

  const nativeRender = original.output.render
  const nativePresentationMeta = original.output.presentationMeta

  return {
    ...original,
    description: `${original.description} It can optionally run a follow-up command via \`${THEN_RUN_PARAMETER}\`.`,
    parameters: extendParameters(original.parameters),
    output: {
      schema: {
        type: 'object',
        properties: { mutation: original.output.schema, thenRun: THEN_RUN_RESULT_SCHEMA },
        required: ['mutation'],
        additionalProperties: false,
      },
      render: (args, value) => [...nativeRender(args, value?.mutation), ...thenRunBlocks(value?.thenRun)],
      ...(nativePresentationMeta
        ? { presentationMeta: (args, value) => nativePresentationMeta(args, value?.mutation) }
        : {}),
    },
    async execute(args, exec) {
      const { [THEN_RUN_PARAMETER]: thenRun, ...mutationArgs } = args ?? {}
      const command = typeof thenRun?.command === 'string' ? thenRun.command.trim() : ''

      // 没有 then_run 时完全不改变原生路径：不进队列，也不额外读文件。
      if (command === '') return { mutation: await original.execute(mutationArgs, exec) }

      return withFileQueue(mutationArgs.file_path, async () => {
        const mutation = await original.execute(mutationArgs, exec)
        const thenRunResult = await runThenRun({ command, filePath: mutationArgs.file_path, exec })
        return { mutation, thenRun: thenRunResult }
      })
    },
  }
}
