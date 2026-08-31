import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outArg = process.argv.indexOf('--out')
const outputDir = outArg >= 0 ? process.argv[outArg + 1] : resolve(root, 'presets/patchwork')

function hostStandard() {
  if (process.env.DSH_HOST_STANDARD_YML) return resolve(process.env.DSH_HOST_STANDARD_YML)
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const globalRoot = execFileSync(npm, ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
  return join(globalRoot, '@deepseek-ai', 'dsh', 'config', 'agent-presets', 'standard', 'agent.cordis.yml')
}

function renderPersona() {
  return `- id: persona\n  name: '@deepseek-ai/dsh-persona'\n  config:\n    text: >-\n      You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.`
}

function generate(standard) {
  const match = standard.match(/^- id: persona\r?\n/m)
  if (!match || match.index === undefined) throw new Error('host standard has no persona row')
  const next = standard.indexOf('- id: ', match.index + match[0].length)
  const end = next < 0 ? standard.length : next
  return `${standard.slice(0, match.index)}${renderPersona()}\n\n${standard.slice(end).replace(/^\r?\n+/, '')}`
}

const standardPath = hostStandard()
const standard = await readFile(standardPath, 'utf8')
const generated = `# Generated from DSH standard; host tools are intentionally exposed here.\n# gen-preset: host=${createHash('sha256').update(standard).digest('hex')}\n\n${generate(standard)}`
await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, 'agent.cordis.yml')
await writeFile(outputPath, generated)
console.log(outputPath)
