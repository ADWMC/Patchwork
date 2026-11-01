import { realpath } from 'node:fs/promises'
import { isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { redactPreview } from '../logging/redact.mjs'

const ENV_KEYS = [
  'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE',
  'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'PATH', 'PATHEXT',
  'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME', 'DISPLAY', 'WAYLAND_DISPLAY', 'PLAYWRIGHT_BROWSERS_PATH',
]

export function browserEnvironment() {
  return Object.fromEntries(ENV_KEYS.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]))
}

export async function allowedFile(url, agent) {
  const cwd = agent.session?.header?.cwd ?? agent.session?.meta?.cwd
  if (!cwd) throw new Error('Local file navigation requires a session workspace')
  const [root, target] = await Promise.all([realpath(cwd), realpath(fileURLToPath(url))])
  const path = relative(root, target)
  if (path !== '' && (path === '..' || path.startsWith('..\\') || path.startsWith('../') || isAbsolute(path))) {
    throw new Error('Local file is outside the session workspace')
  }
}

export async function checkedUrl(value, agent) {
  boundedText(value, 'URL', 4096)
  let url
  try { url = new URL(value) } catch { throw new Error('Invalid URL') }
  if (url.username || url.password) throw new Error('URL credentials are not supported')
  if (url.protocol === 'file:') await allowedFile(url, agent)
  else if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) and workspace file URLs are supported')
  return url.href
}

export function boundedText(value, label, limit) {
  if (typeof value !== 'string' || !value || value.length > limit) throw new Error(`${label} is required and must be at most ${limit} characters`)
  return value
}

export function dimensions({ width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 240 || width > 2560 || height < 240 || height > 1800) {
    throw new Error('Viewport width must be 240-2560 and height 240-1800')
  }
  return { width, height }
}

export function safeBrowserError(error) {
  // Playwright messages can include navigation URLs and proxy authentication data.
  const message = error instanceof Error ? error.message : 'Browser operation failed'
  return redactPreview(message.split('\nCall log:')[0].slice(0, 1000))
    .replace(/--fingerprint(?:-[a-z-]+)?=[^\s]+/gi, '--fingerprint=[redacted]')
    .replace(/(https?|socks5):\/\/[^\s/@]+:[^\s/@]+@/gi, '$1://[redacted]@')
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1?[redacted]')
}
