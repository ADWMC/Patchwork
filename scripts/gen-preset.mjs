import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const standardPath = process.env.DSH_HOST_STANDARD_YML ||
  resolve(process.env.APPDATA || '', 'npm/node_modules/@deepseek-ai/dsh/config/agent-presets/standard/agent.cordis.yml')
const outArg = process.argv.indexOf('--out')
const outputDir = outArg >= 0 ? process.argv[outArg + 1] : resolve(root, 'presets/patchwork')
const prompt = (await readFile(resolve(root, 'assets/prompts/maintainable-coding-agent-prompt.md'), 'utf8')).trim()
const standard = await readFile(standardPath, 'utf8')

const start = standard.indexOf('- id: persona\n')
const end = standard.indexOf('- id: agent-instructions\n', start)
if (start < 0 || end < 0) throw new Error(`无法定位 standard persona: ${standardPath}`)

const indented = prompt.split('\n').map(line => line ? `      ${line}` : '').join('\n')
const persona = `- id: persona\n  name: '@deepseek-ai/dsh-persona'\n  config:\n    text: |\n${indented}\n\n`
const fingerprint = createHash('sha256').update(standard).digest('hex')
const output = `# Generated from the host standard preset. Regenerate after DSH upgrades.\n# gen-preset: host=${fingerprint}\n\n${standard.slice(0, start)}${persona}${standard.slice(end)}`

await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, 'agent.cordis.yml')
if (!existsSync(outputPath) || await readFile(outputPath, 'utf8') !== output) await writeFile(outputPath, output)
console.log(outputPath)
