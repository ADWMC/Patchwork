import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { DEFAULT_MODEL_PRESETS, detectModelPreset } from './model-presets.mjs'

export { DEFAULT_MODEL_PRESETS, detectModelPreset }

export function loadModelPresetsSync(workspaceRoot = process.cwd()) {
  const merged = { ...DEFAULT_MODEL_PRESETS }
  // 1. Global config (~/.dsh/patchwork/model-presets.json)
  try {
    const globalPath = process.env.DSH_HOME ? join(process.env.DSH_HOME, 'patchwork', 'model-presets.json') : dshHomePath('patchwork', 'model-presets.json')
    const globalCustom = JSON.parse(readFileSync(globalPath, 'utf8'))
    if (globalCustom && typeof globalCustom === 'object') {
      for (const [k, v] of Object.entries(globalCustom)) {
        merged[k] = { ...merged[k], ...v }
      }
    }
  } catch { /* Fails open if missing */ }

  // 2. Project workspace config (.patchwork/model-presets.json)
  if (workspaceRoot) {
    try {
      const projectPath = join(workspaceRoot, '.patchwork', 'model-presets.json')
      const projectCustom = JSON.parse(readFileSync(projectPath, 'utf8'))
      if (projectCustom && typeof projectCustom === 'object') {
        for (const [k, v] of Object.entries(projectCustom)) {
          merged[k] = { ...merged[k], ...v }
        }
      }
    } catch { /* Fails open if missing */ }
  }

  return merged
}

export function resolveModelPreset(config = {}, hostHeader = null, workspaceRoot = null) {
  const presets = loadModelPresetsSync(workspaceRoot)
  if (config.modelPreset && config.modelPreset !== 'auto' && presets[config.modelPreset]) {
    return presets[config.modelPreset]
  }
  const candidate = config.reducerModel || hostHeader?.model || hostHeader?.provider || ''
  const detected = detectModelPreset(candidate)
  return presets[detected] ?? presets['deepseek']
}
