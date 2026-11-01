import { isAbsolute, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const PATH_KEYS = ['dshHome', 'workspace', 'resultsDir']

function pathValue(value) {
  return typeof value === 'string' && isAbsolute(value) && value.length <= 2048 ? resolve(value) : null
}

/**
 * Validate the boundary for an evolution run before any DSH process is started.
 * This module does not start a process or inherit the caller's DSH_HOME.
 */
export function validateIsolationSpec(spec = {}, { currentDshHome = process.env.DSH_HOME } = {}) {
  const reasons = []
  const paths = Object.fromEntries(PATH_KEYS.map(key => [key, pathValue(spec[key])]))
  for (const key of PATH_KEYS) if (!paths[key]) reasons.push(`missing-or-relative:${key}`)
  if (new Set(Object.values(paths).filter(Boolean)).size !== PATH_KEYS.length) reasons.push('paths-must-be-distinct')
  if (currentDshHome && paths.dshHome && paths.dshHome === pathValue(currentDshHome)) reasons.push('must-not-use-current-dsh-home')
  if (!Number.isInteger(spec.port) || spec.port < 1024 || spec.port > 65535) reasons.push('isolated-port-required')
  if (typeof spec.model !== 'string' || !spec.model.trim()) reasons.push('model-required')
  if (!Number.isFinite(spec.budget) || spec.budget <= 0) reasons.push('positive-budget-required')
  return { ok: reasons.length === 0, reasons, paths, port: spec.port ?? null, model: typeof spec.model === 'string' ? spec.model.slice(0, 160) : null, budget: Number.isFinite(spec.budget) ? spec.budget : null }
}

export function isolatedEnvironment(spec, options) {
  const validation = validateIsolationSpec(spec, options)
  if (!validation.ok) return { ok: false, reasons: validation.reasons }
  return { ok: true, env: { ...process.env, DSH_HOME: validation.paths.dshHome, PATCHWORK_EVOLUTION_WORKSPACE: validation.paths.workspace,
    PATCHWORK_EVOLUTION_RESULTS: validation.paths.resultsDir, PATCHWORK_EVOLUTION_PORT: String(validation.port), PATCHWORK_EVOLUTION_MODEL: validation.model,
    PATCHWORK_EVOLUTION_BUDGET: String(validation.budget) }, boundary: validation }
}

/** Run one bounded, shell-free process inside a validated experiment boundary. */
export async function runIsolatedCommand(spec, { command, args = [], timeoutMs = 120000, maxOutputBytes = 65536 } = {}, options) {
  const prepared = isolatedEnvironment(spec, options)
  if (!prepared.ok) return { status: 'rejected', reasons: prepared.reasons }
  if (typeof command !== 'string' || !command.trim() || !Array.isArray(args) || args.some(item => typeof item !== 'string')) return { status: 'rejected', reasons: ['command-and-args-required'] }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 900000) return { status: 'rejected', reasons: ['invalid-timeout'] }
  await Promise.all(Object.values(prepared.boundary.paths).map(path => mkdir(path, { recursive: true })))
  return await new Promise(resolveResult => {
    const child = spawn(command, args, { cwd: prepared.boundary.paths.workspace, env: prepared.env, shell: false, windowsHide: true })
    const stdout = [], stderr = []; let outBytes = 0; let errBytes = 0; let timedOut = false; let settled = false
    const take = (target, chunk, current) => { if (current >= maxOutputBytes) return current; const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)); const remaining = maxOutputBytes - current; target.push(value.subarray(0, remaining)); return current + Math.min(value.length, remaining) }
    child.stdout?.on('data', chunk => { outBytes = take(stdout, chunk, outBytes) })
    child.stderr?.on('data', chunk => { errBytes = take(stderr, chunk, errBytes) })
    const timer = setTimeout(() => { timedOut = true; child.kill() }, timeoutMs)
    const finish = (exitCode, signal, error) => {
      if (settled) return; settled = true; clearTimeout(timer)
      resolveResult({ status: error ? 'failed' : timedOut ? 'timeout' : exitCode === 0 ? 'completed' : 'failed', exitCode: Number.isInteger(exitCode) ? exitCode : null,
        signal: signal ?? null, timedOut, errorCode: error?.code ?? null, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8'), boundary: prepared.boundary })
    }
    child.once('error', error => finish(null, null, error)); child.once('close', (code, signal) => finish(code, signal))
  })
}
