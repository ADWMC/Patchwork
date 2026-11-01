import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { acquireLease } from './lease.mjs'
const keyCache = new Map()
export function forgetStorageKey(directory) { const entry = keyCache.get(directory); entry?.key.fill(0); keyCache.delete(directory) }
function rememberKey(directory, wrapped, key) {
  forgetStorageKey(directory)
  if (keyCache.size >= 32) forgetStorageKey(keyCache.keys().next().value)
  keyCache.set(directory, { wrapped: Buffer.from(wrapped), key: Buffer.from(key) })
}

// Only the encrypted data key is stored. DPAPI is bound to the current OS user.
async function dpapi(operation, value) {
  const script = `Add-Type -AssemblyName System.Security; $v = [Console]::In.ReadToEnd() | ConvertFrom-Json; $b = [Convert]::FromBase64String($v.value); $e = [Text.Encoding]::UTF8.GetBytes('Patchwork browser storage v1'); if ($v.operation -eq 'protect') { $r = [Security.Cryptography.ProtectedData]::Protect($b,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser) } else { $r = [Security.Cryptography.ProtectedData]::Unprotect($b,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser) }; [Console]::Out.Write([Convert]::ToBase64String($r))`
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP } })
    let output = ''; let settled = false
    const finish = (error, data) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(data) }
    const timer = setTimeout(() => { child.kill(); finish(new Error('OS encryption timed out; storage was not saved')) }, 15_000)
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 16_384) { child.kill(); finish(new Error('Invalid OS encryption response')) } })
    child.stderr.resume()
    child.on('error', () => finish(new Error('OS encryption is unavailable; plaintext fallback is disabled')))
    child.stdin.on('error', () => {})
    child.on('close', code => {
      if (code !== 0 || !/^[A-Za-z0-9+/]+=*$/.test(output.trim())) return finish(new Error('OS encryption failed; plaintext fallback is disabled'))
      finish(null, Buffer.from(output.trim(), 'base64'))
    })
    child.stdin.end(JSON.stringify({ operation, value: value.toString('base64') }))
  })
}

export async function storageKey(directory, check) {
  check()
  if (process.platform !== 'win32') {
    const value = process.env.PATCHWORK_BROWSER_STORAGE_KEY ?? ''
    const key = Buffer.from(value, 'base64')
    if (key.length !== 32 || key.toString('base64') !== value) throw new Error('Set PATCHWORK_BROWSER_STORAGE_KEY to a private 32-byte base64 key to save login state on this OS')
    return key
  }
  const release = await acquireLease(join(directory, 'storage-key.lock'), { check })
  try {
    const path = join(directory, 'storage-key.dpapi')
    let wrapped
    try { wrapped = await readFile(path); if (wrapped.length > 16_384) throw new Error('Invalid wrapped storage key') }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      const key = randomBytes(32)
      try { wrapped = await dpapi('protect', key); check(); await writeFile(path, wrapped, { mode: 0o600, flag: 'wx' }); rememberKey(directory, wrapped, key); return Buffer.from(key) } finally { key.fill(0) }
    }
    const cached = keyCache.get(directory)
    if (cached?.wrapped.equals(wrapped)) { check(); return Buffer.from(cached.key) }
    const key = await dpapi('unprotect', wrapped)
    check()
    if (key.length !== 32) { key.fill(0); throw new Error('Invalid OS storage key') }
    rememberKey(directory, wrapped, key)
    return key
  } finally { await release() }
}

export function sealStorage(state, key, aad) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad))
  const data = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()])
  return { version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
}

export function openStorage(envelope, key, aad) {
  if (envelope?.version !== 1 || envelope.algorithm !== 'aes-256-gcm') throw new Error('Unsupported encrypted browser storage')
  try {
    const decode = value => {
      if (typeof value !== 'string') throw new Error('Invalid encoding')
      const bytes = Buffer.from(value, 'base64')
      if (bytes.toString('base64') !== value) throw new Error('Invalid encoding')
      return bytes
    }
    const iv = decode(envelope.iv), tag = decode(envelope.tag), data = decode(envelope.data)
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid authentication parameters')
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
    decipher.setAAD(Buffer.from(aad))
    decipher.setAuthTag(tag)
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'))
  } catch { throw new Error('Browser storage authentication failed; login state was not loaded') }
}
