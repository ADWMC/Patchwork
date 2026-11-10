import { Config } from './config/plugin-config.mjs'
import { effectiveConfig, readUserConfig } from './config/user-config.mjs'
import { registerPatchworkSkills } from './skills/register.mjs'
import { registerUiGuidance } from './skills/ui-guidance.mjs'
import { registerReviewCommand } from './review/review-command.mjs'
import { registerStructureHook } from './hook/post-execute-hook.mjs'
import { registerConfiguredMechanisms } from './mechanisms/index.mjs'
import { setSuperagentStallConfig } from './superagent/state.mjs'
import { registerRuntimeCollector } from './ui/runtime-state.mjs'
import { initializeDiagnostics } from './logging/session-log.mjs'
import { registerTaskLifecycle } from './task/lifecycle.mjs'
import { registerSuperagent } from './superagent/index.mjs'
import { registerRetrievalTools } from './retrieval/index.mjs'
import { registerCodeTool } from './code/tool.mjs'
import { registerProjectDocsTool } from './project-docs/tool.mjs'
import { registerMemoryTool } from './memory/tool.mjs'
import { loadMemoryState } from './memory/store.mjs'
import { registerImprovementTool } from './improvement/tool.mjs'
import { loadImprovementState } from './improvement/store.mjs'
import { TasteEngine } from './taste/engine.mjs'

export const name = 'patchwork-runtime'
export const inject = ['skills', 'commands', 'tools', 'agentPresets']
export { Config }

// Mounted only by the Patchwork preset. The host's scoped registries hide
// these skills, commands and tools from all other compositions.
export async function apply(ctx, config) {
  await initializeDiagnostics(ctx)
  const rowConfig = config ?? {}
  const effective = effectiveConfig(rowConfig, readUserConfig())
  try { await loadMemoryState() } catch { /* Memory fails closed and exposes recovery; other scoped capabilities remain available. */ }
  const tasteEngine = new TasteEngine(process.cwd())
  registerTaskLifecycle(ctx, effective, tasteEngine)
  setSuperagentStallConfig(effective.superagentStallMs)
  registerSuperagent(ctx)
  registerRetrievalTools(ctx, effective)
  registerCodeTool(ctx, effective)
  registerProjectDocsTool(ctx, effective)
  registerMemoryTool(ctx, effective)
  registerImprovementTool(ctx, effective)
  const skillNames = await registerPatchworkSkills(ctx, effective)
  registerUiGuidance(ctx, effective)
  registerReviewCommand(ctx)
  registerStructureHook(ctx, effective)
  registerConfiguredMechanisms(ctx, effective)
  // Loading is intentionally read-only: candidates never become runtime rules
  // merely because a session is restored.
  ctx.on?.('agent/created', ({ agent }) => { loadImprovementState(agent) })
  registerRuntimeCollector(ctx, { rowConfig, loadedConfig: effective, skillNames })
}
