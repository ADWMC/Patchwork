import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// DSH owns the standard tools in the host plane. Copying the full standard
// preset here makes a second session register pwsh/read/etc. and fail with
// "tool already registered" when presets are switched in one process.
const outArg = process.argv.indexOf('--out')
const outputDir = outArg >= 0 ? process.argv[outArg + 1] : resolve(new URL('../presets/patchwork', import.meta.url).pathname)
const output = `# Minimal preset: host owns tool registrations; Patchwork is loaded by the profile bundle.\n\n- id: persona\n  name: '@deepseek-ai/dsh-persona'\n  config:\n    text: >-\n      You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.\n\n- id: agent-instructions\n  name: '@deepseek-ai/dsh-agent-instructions'\n  config:\n    maxBytes: 65536\n`

await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, 'agent.cordis.yml')
await writeFile(outputPath, output)
console.log(outputPath)
