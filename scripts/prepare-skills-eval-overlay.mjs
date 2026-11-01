import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const presetPath = fileURLToPath(new URL('../presets/patchwork.patch.yml', import.meta.url))

export function evaluationOverlay(source, mode) {
  if (!['core', 'expanded', 'none'].includes(mode)) throw new Error('mode must be core, expanded or none')
  const start = source.indexOf('- insert:\n')
  if (start < 0) throw new Error('Patchwork preset insert block not found')
  const nested = source.slice(start + '- insert:\n'.length).split('\n')
  const rows = nested.map(line => line ? line.replace(/^    /, '') : line)
  if (!rows[0]?.startsWith('- id: preset-patchwork')) throw new Error('unexpected Patchwork preset shape')
  const runtime = rows.findIndex(line => line === '      - id: patchwork-runtime')
  if (runtime < 0 || rows[runtime + 1] !== "        name: '@patchwork/coding-agent/runtime'") throw new Error('Patchwork runtime row not found')
  rows.splice(runtime + 2, 0, '        config:', mode === 'none' ? '          skillsEnabled: false' : `          skillsMode: ${mode}`)
  return `# Generated for an isolated DSH evaluation; never install into the main profile.\n${rows.join('\n')}`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, output] = process.argv.slice(2)
  if (!output) throw new Error('usage: node scripts/prepare-skills-eval-overlay.mjs <core|expanded|none> <output.yml>')
  await writeFile(output, evaluationOverlay(await readFile(presetPath, 'utf8'), mode))
}
