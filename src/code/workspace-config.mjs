import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const WORKSPACE_CONFIG_DIR = '.patchwork'
export const WORKSPACE_CONFIG_FILE = 'config.json'
export const WORKSPACE_CONFIG_SCHEMA = 1

export const CODE_GRAPH_DEFAULTS = Object.freeze({
  enabled: false,
  maxFiles: 4000,
  maxFileBytes: 524288,
  tokenBudget: 2000,
  exclude: [],
})

export function workspaceConfigPath(root) {
  return join(root, WORKSPACE_CONFIG_DIR, WORKSPACE_CONFIG_FILE)
}

function boundedInt(value, min, max, fallback) {
  if (value === undefined) return fallback
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : (() => { throw new Error('invalid codeGraph integer') })()
}

function normalizeCodeGraph(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('codeGraph must be an object')
  const exclude = input.exclude === undefined ? [] : input.exclude
  if (!Array.isArray(exclude) || exclude.length > 64 || exclude.some(item => typeof item !== 'string' || !item.trim() || item.length > 240)) throw new Error('invalid codeGraph exclude')
  return {
    enabled: input.enabled === true,
    maxFiles: boundedInt(input.maxFiles, 100, 20000, CODE_GRAPH_DEFAULTS.maxFiles),
    maxFileBytes: boundedInt(input.maxFileBytes, 4096, 2 * 1024 * 1024, CODE_GRAPH_DEFAULTS.maxFileBytes),
    tokenBudget: boundedInt(input.tokenBudget, 400, 8000, CODE_GRAPH_DEFAULTS.tokenBudget),
    exclude: [...new Set(exclude.map(item => item.replace(/\\/g, '/').trim()))],
  }
}

export function normalizeWorkspaceConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('workspace config must be an object')
  if (input.schemaVersion !== undefined && input.schemaVersion !== WORKSPACE_CONFIG_SCHEMA) throw new Error('unsupported workspace config schemaVersion')
  return { schemaVersion: WORKSPACE_CONFIG_SCHEMA, codeGraph: normalizeCodeGraph(input.codeGraph) }
}

export function defaultWorkspaceConfig() {
  return normalizeWorkspaceConfig({ schemaVersion: WORKSPACE_CONFIG_SCHEMA, codeGraph: CODE_GRAPH_DEFAULTS })
}

export async function readWorkspaceConfig(root) {
  try {
    const raw = JSON.parse(await readFile(workspaceConfigPath(root), 'utf8'))
    return { status: 'loaded', config: normalizeWorkspaceConfig(raw), path: workspaceConfigPath(root) }
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'missing', config: defaultWorkspaceConfig(), path: workspaceConfigPath(root) }
    return { status: 'invalid', failureCode: 'CODE_GRAPH_CONFIG_INVALID', message: error instanceof Error ? error.message : String(error), path: workspaceConfigPath(root) }
  }
}

/** Sync variant for the state route; never throws on missing/invalid files. */
export function readWorkspaceConfigSync(root) {
  try {
    const raw = JSON.parse(readFileSync(workspaceConfigPath(root), 'utf8'))
    return { status: 'loaded', config: normalizeWorkspaceConfig(raw), path: workspaceConfigPath(root) }
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'missing', config: defaultWorkspaceConfig(), path: workspaceConfigPath(root) }
    return { status: 'invalid', failureCode: 'CODE_GRAPH_CONFIG_INVALID', message: error instanceof Error ? error.message : String(error), path: workspaceConfigPath(root) }
  }
}

export async function writeWorkspaceConfig(root, patch, { merge = true } = {}) {
  const current = merge ? await readWorkspaceConfig(root) : { config: defaultWorkspaceConfig() }
  if (current.status === 'invalid') throw new Error(`workspace config is invalid: ${current.message}`)
  const next = normalizeWorkspaceConfig({ ...current.config, ...patch, codeGraph: { ...current.config.codeGraph, ...(patch?.codeGraph ?? {}) } })
  const path = workspaceConfigPath(root)
  await mkdir(join(root, WORKSPACE_CONFIG_DIR), { recursive: true, mode: 0o700 })
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temp, path)
  } finally { await rm(temp, { force: true }) }
  return { status: 'written', config: next, path }
}

export async function enableWorkspaceGraph(root, { enabled = true, overrides = {} } = {}) {
  return writeWorkspaceConfig(root, { codeGraph: { enabled: enabled === true, ...overrides } })
}

export async function workspaceConfigInfo(root) {
  const result = await readWorkspaceConfig(root)
  let exists = false
  try { exists = (await stat(result.path)).isFile() } catch { /* missing */ }
  return { ...result, exists, relativePath: `${WORKSPACE_CONFIG_DIR}/${WORKSPACE_CONFIG_FILE}` }
}
