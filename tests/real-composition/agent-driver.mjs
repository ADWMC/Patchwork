import { createScope, scopeOf, scopeTarget, bindScopeParent, scopeParentOf } from '@deepseek-ai/dsh-scope'
import { executeTool } from '../../src/util/tool-execute.mjs'

/**
 * Test-only 驱动插件。它只做一件事：在被测插件挂载完成后，按真实形状造出
 * agent 作用域并派发 `agent/created`。
 *
 * 为什么不在 `apply` 里造 agent：Loader 的 entry 是并发挂载的，`apply` 期间
 * 兄弟 entry（这里是 `dsh-tool-fs`）还没注册工具。真实部署里 agent 也是在
 * boot settle 之后、会话开始时才创建。
 *
 * agent 作用域用 `createScope` 构造。`@deepseek-ai/dsh-agent-preset-registry` 把
 * agent 自己的作用域键的父亲设为 preset 的 standing 键（`bindScopeParent` 调用），
 * 本例的父就是根，等价于「继承根层注册的工具」这一关系。
 */
export const name = 'patchwork-agent-driver'
export const inject = ['tools', 'commands', 'skills', 'systemPrompt']

let rootCtx
let presetKey
const liveAgents = new Map()
const agentBindings = new WeakMap()
export const observed = {}

export async function apply(ctx, config) {
  rootCtx = ctx
  liveAgents.clear()
  presetKey = {}
  // Use native scope ancestry and native registries. Only the composition-id
  // lookup is a fixture; browser acceptance also uses DSH's actual registry.
  ctx.provide('agentPresets', { composedPreset: context => scopeParentOf(scopeOf(context)) === presetKey ? 'patchwork' : 'standard' })
  ctx.provide('agents', { get: id => liveAgents.get(id) })
  const scoped = createScope(ctx, presetKey)
  const { pluginEntry, ...pluginConfig } = config
  const plugin = await import(pluginEntry)
  await plugin.apply(scoped.ctx, pluginConfig)
  observed.applied = true
}

/** 记录派发期间发生的事，供断言与排障使用。 */
function dispatch(payload) {
  const warnings = []
  const originalWarn = console.warn
  let emitError
  console.warn = (...args) => warnings.push(args.map(String).join(' '))
  try {
    rootCtx.emit(scopeTarget(payload.agent, scopeOf(payload.agent.ctx)), 'agent/created', payload)
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

export function createAgent({ id = 'test-agent', cwd = process.cwd(), sessionId = 'test-session', preset = 'patchwork' } = {}) {
  const agentKey = {}
  const agentScope = createScope(rootCtx, agentKey)
  agentBindings.set(agentKey, bindScopeParent(agentKey, preset === 'patchwork' ? presetKey : {}))
  const followups = []
  const agent = Object.assign(agentKey, {
    id,
    ctx: agentScope.ctx,
    session: { header: { id: sessionId, cwd }, requestContext: () => ({ contextWindow: 200_000 }), seq: 0, inheritedEventCount: 0, snapshotEvents: () => [], deriveMessages: () => [] },
    whenIdle: async () => {},
    runMaintenance: task => task(new AbortController().signal),
    followup: message => followups.push(message),
  })
  liveAgents.set(sessionId, agent)

  const { warnings, emitError } = dispatch({ agent })

  observed.agentKey = agentKey
  observed.agent = agent
  observed.followups = followups
  observed.tools = rootCtx.tools
  observed.warnings = warnings
  observed.emitError = emitError
  observed.agentToolsAccess = probeAccess(agent)
  observed.rootToolNames = rootCtx.tools.schemas().map(schema => schema.name)
  observed.agentToolNames = rootCtx.tools.schemas(agentKey).map(schema => schema.name)

  // The acceptance tests call the registry directly. DSH 0.2.2-alpha moved
  // that API to batches, so expose the same single-call adapter production uses.
  const tools = new Proxy(rootCtx.tools, {
    get(target, property, receiver) {
      if (property === 'execute') return call => executeTool(target, call)
      return Reflect.get(target, property, receiver)
    },
  })
  return { agent, agentKey, tools, followups }
}

export function selectPreset(agent, preset) {
  agentBindings.get(scopeOf(agent.ctx)).rebind(preset === 'patchwork' ? presetKey : {})
  rootCtx.emit('agent-preset/selected', agent.session.header.id, preset)
}
