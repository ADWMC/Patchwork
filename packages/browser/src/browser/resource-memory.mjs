import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { browserEnvironment } from './policy.mjs'

const execute = promisify(execFile)
const MiB = 1024 * 1024
const unsupported = reason => ({ status: 'unsupported', reason })

// Only the current browser supplies PIDs. Never enumerate all Edge processes,
// inspect command lines, or include host/other-session memory in this result.
export async function measureBrowserMemory(session, { platform = process.platform, run = execute } = {}) {
  session.check()
  const browser = session.browser
  if (!browser) return { status: 'not-running' }
  if (platform !== 'win32' || !browser.newBrowserCDPSession || session.profile?.backend === 'camoufox') return unsupported('当前平台或内核尚不支持私有驻留采样')
  let cdp
  try {
    cdp = await browser.newBrowserCDPSession()
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo')
    session.check()
    if (!Array.isArray(processInfo) || !processInfo.length || processInfo.length > 128) return unsupported('内核未提供完整进程列表')
    const ids = [...new Set(processInfo.map(info => info.id))]
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0 || id > 0xffffffff)) return unsupported('内核进程列表无效')
    const script = `$ErrorActionPreference='Stop';$ids=@(${ids.join(',')});$rows=@(Get-CimInstance Win32_PerfRawData_PerfProc_Process -Filter '${ids.map(id => `IDProcess = ${id}`).join(' OR ')}');[pscustomobject]@{processes=$rows.Count;privateWorkingSet=[double](($rows|Measure-Object WorkingSetPrivate -Sum).Sum);workingSet=[double](($rows|Measure-Object WorkingSet -Sum).Sum);privateCommit=[double](($rows|Measure-Object PrivateBytes -Sum).Sum)}|ConvertTo-Json -Compress`
    const shell = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe')
    const { stdout } = await run(shell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { timeout: 8000, maxBuffer: 16 * 1024, windowsHide: true, env: browserEnvironment() })
    session.check()
    if (session.browser !== browser) return unsupported('采样期间浏览器已变化')
    const data = JSON.parse(stdout.trim().replace(/^\uFEFF/, ''))
    if (data.processes !== ids.length || ['privateWorkingSet', 'workingSet', 'privateCommit'].some(key => !Number.isFinite(data[key]) || data[key] < 0)) return unsupported('采样期间进程已变化，请重试')
    return { status: 'measured', processes: data.processes, privateWorkingSetMiB: Math.round(data.privateWorkingSet / MiB * 10) / 10, workingSetMiB: Math.round(data.workingSet / MiB * 10) / 10, privateCommitMiB: Math.round(data.privateCommit / MiB * 10) / 10, scope: 'current-browser-cdp-processes', metric: 'private-resident-pages' }
  } catch {
    session.check()
    return unsupported('系统采样不可用，请稍后重试')
  } finally { await cdp?.detach().catch(() => {}) }
}
