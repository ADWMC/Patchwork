import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { browserEnvironment, safeBrowserError } from '../policy.mjs'

export function installerEnvironment(directory, proxy) {
  const env = { ...browserEnvironment(), PLAYWRIGHT_BROWSERS_PATH: join(directory, 'cache'), PLAYWRIGHT_SKIP_BROWSER_GC: '1', PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '30000' }
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS']) if (process.env[name]) env[name] = process.env[name]
  if (proxy) env.HTTP_PROXY = env.HTTPS_PROXY = env.http_proxy = env.https_proxy = proxy
  return env
}
export function npmCli() {
  const paths = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')]
  const cli = paths.find(path => path && /npm-cli\.js$/.test(path) && existsSync(path))
  if (!cli) throw new Error('npm CLI unavailable; use npm run components to install the Camoufox SDK')
  return cli
}
export function runInstaller(args, { env, cwd, signal, timeoutMs = 20 * 60_000, onProgress = () => {}, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const child = spawn(process.execPath, args, { env, cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
    let output = '', errorOutput = '', last = 0, timedOut = false, oversized = false, stopping
    // Stop only this installer's process tree, including download workers.
    const abort = () => stopping ??= new Promise(resolve => {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return resolve()
      if (process.platform === 'win32') {
        const killer = spawn(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', env: browserEnvironment() })
        killer.once('error', () => { child.kill(); resolve() }); killer.once('close', resolve)
      } else { try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill() } resolve() }
    })
    const timer = setTimeout(() => { timedOut = true; void abort() }, timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) void abort()
    const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    child.stdout.on('data', b => {
      if (capture) { output += b.toString(); if (output.length > 64 * 1024) { oversized = true; void abort() } }
      else if (Date.now() - last > 1000) { onProgress({ stage: 'upstream', message: safeBrowserError(new Error(b.toString().slice(-1000))) }); last = Date.now() }
    })
    child.stderr.on('data', b => { errorOutput = (errorOutput + b.toString()).slice(-4000) })
    child.once('error', e => { clean(); reject(e) })
    child.once('close', async code => {
      clean()
      await stopping
      if (signal?.aborted) return reject(signal.reason ?? new Error('Installation cancelled'))
      if (timedOut) return reject(new Error('Component installer timed out; active installation was not changed'))
      if (oversized) return reject(new Error('Component installer output exceeded its limit'))
      if (code !== 0) return reject(new Error(safeBrowserError(new Error(errorOutput || 'Component installer failed'))))
      resolve(output)
    })
  })
}
