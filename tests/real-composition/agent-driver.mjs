import { createScope } from '@deepseek-ai/dsh-scope'

/**
 * Test-only 驱动插件。它只做一件事：在被测插件挂载完成后，按真实形状造出
 * agent 作用域并派发 `agent/created`。
 *
 * 为什么不在 `apply` 里造 agent：Loader 的 entry 是并发挂载的，`apply` 期间
 * 兄弟 entry（这里是 `dsh-tool-fs`）还没注册工具。真实部署里 agent 也是在
 * boot settle 之后、会话开始时才创建。
 *
 * agent 作用域用 `createScope` 构造。`dsh-agent-presets` 把 agent 自己的作用域键
 * 的父亲设为 preset 的 standing 键（`lib/index.js:779` 的说明与
 * `:1504/:1538/:1702` 的 `bindScopeParent` 调用），本例的父就是根，等价于
 * 「继承根层注册的工具」这一关系。
 */
export const name = 'patchwork-agent-driver'
export const inject = ['tools']

let rootCtx
export const observed = {}

export function apply(ctx) {
  rootCtx = ctx
  observed.applied = true
}

/** 记录派发期间发生的事，供断言与排障使用。 */
function dispatch(payload) {
  const warnings = []
  const originalWarn = console.warn
  let emitError
  console.warn = (...args) => warnings.push(args.map(String).join(' '))
  try {
    rootCtx.emit('agent/created', payload)
  } catch (error) {
    emitError = error instanceof Error ? error.message : String(error)
  } finally {
    console.warn = originalWarn
  }
  return { warnings, emitError }
}

function probeAccess(agent) {
  try {
    return typeof agent.ctx.tools
  } catch (error) {
    return `THREW: ${error instanceof Error ? error.message : String(error)}`
  }
}

export function createAgent({ id = 'test-agent', cwd = process.cwd() } = {}) {
  const agentKey = {}
  const agentScope = createScope(rootCtx, agentKey)
  const agent = {
    id,
    ctx: agentScope.ctx,
    session: { header: { cwd } },
    whenIdle: async () => {},
  }

  const { warnings, emitError } = dispatch({ agent })

  observed.agentKey = agentKey
  observed.agent = agent
  observed.tools = rootCtx.tools
  observed.warnings = warnings
  observed.emitError = emitError
  observed.agentToolsAccess = probeAccess(agent)
  observed.rootToolNames = rootCtx.tools.schemas().map(schema => schema.name)
  observed.agentToolNames = rootCtx.tools.schemas(agentKey).map(schema => schema.name)

  return { agent, agentKey, tools: rootCtx.tools }
}
