import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outArg = process.argv.indexOf('--out')
const outputDir = outArg >= 0 ? process.argv[outArg + 1] : resolve(root, 'presets')
const outputName = 'patchwork.patch.yml'

// Host tools remain verbatim; Patchwork behavior is a preset-scoped addition.
const declaration = [
  `- insert:`,
  `    - id: preset-patchwork`,
  `      name: '@deepseek-ai/dsh-agent-preset'`,
  `      config:`,
  `        id: patchwork`,
  `        name: Patchwork`,
  `        description: 'Patchwork: 可维护代码 Agent，先调查、最小修改、真实验证。'`,
  `        order: 20`,
  `        plugins:`,
]

function hostStandard() {
  if (process.env.DSH_HOST_STANDARD_YML) return resolve(process.env.DSH_HOST_STANDARD_YML)
  if (process.env.DSH_HOST_VERSION) return join(root, 'tests', 'fixtures', `dsh-v${process.env.DSH_HOST_VERSION}.standard.patch.yml`)
  return join(root, 'tests', 'fixtures', 'dsh-v0.2.1-rc.5.standard.patch.yml')
}

/**
 * Rows whose module path disappeared in 0.2.2-alpha.3. The main control
 * package now registers `list_agents` itself, so removing this row keeps one
 * declaration on both host lines instead of resolving a missing subpath.
 */
const REMOVED_HOST_ROWS = new Set(['tool-subagent-list-agents'])

function removeRow(rows, id) {
  const pattern = new RegExp(`^(\\s*)- id: ${id}\\s*$`)
  const index = rows.findIndex(line => pattern.test(line))
  if (index < 0) return
  const indent = pattern.exec(rows[index])[1].length
  let end = index + 1
  while (end < rows.length) {
    const line = rows[end]
    if (line.trim() !== '' && /^\s*/.exec(line)[0].length <= indent) break
    end++
  }
  rows.splice(index, end - index)
}

/**
 * `modelSelectionSettings` was renamed to `modelSelection`/`modelDiscovery`.
 * Schemastery ignores unknown keys, so one preset can carry both spellings and
 * each host reads the one it knows. Remove this normalization after the last
 * supported 0.2.1 host is retired.
 */
function addSpawnSelectionCompatibility(rows) {
  const rowIndex = rows.findIndex(line => /^\s*- id: tool-subagent\s*$/.test(line))
  if (rowIndex < 0) return
  const configIndex = rows.findIndex((line, index) => index > rowIndex && /^\s*config:\s*$/.test(line))
  if (configIndex < 0) return
  const configIndent = /^\s*/.exec(rows[configIndex])[0].length
  let end = configIndex + 1
  while (end < rows.length) {
    const line = rows[end]
    if (line.trim() !== '' && /^\s*/.exec(line)[0].length <= configIndent) break
    end++
  }
  const block = rows.slice(configIndex + 1, end)
  const indent = `${' '.repeat(configIndent + 2)}`
  for (const key of ['modelSelectionSettings', 'modelSelection', 'modelDiscovery']) {
    if (!block.some(line => new RegExp(`^${indent}${key}:\\s*true\\s*$`).test(line))) {
      rows.splice(end++, 0, `${indent}${key}: true`)
    }
  }
}

/**
 * 宿主 standard 行的缩进层级与本文件一致（列表项在 10 列），所以正文逐字搬运即可。
 * 不重排、不补写宿主默认值：本文件曾因抄了一份 persona 文案，在宿主把该字段换成
 * 必填 `prefix`/`suffix` 后成了失效点。只有跨版本改名/移除的行由上方两个
 * 归一化函数处理。
 */
function generate(standard) {
  const head = /^ {8}plugins:[^\S\r\n]*\r?\n/m.exec(standard)
  if (!head) throw new Error('host standard declares no `plugins:` list')
  const rows = []
  for (const line of standard.slice(head.index + head[0].length).split(/\r?\n/)) {
    if (!/^\s*(#|$)/.test(line) && !line.startsWith('          ')) break
    rows.push(line)
  }
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop()
  if (!rows.some(line => line.startsWith('          - id: '))) throw new Error('host standard declares no plugin rows')
  for (const id of REMOVED_HOST_ROWS) removeRow(rows, id)
  addSpawnSelectionCompatibility(rows)
  return `${declaration.join('\n')}\n${rows.join('\n')}\n          - id: patchwork-runtime\n            name: '@patchwork/coding-agent/runtime'\n`
}

const standardPath = hostStandard()
const standard = await readFile(standardPath, 'utf8')
// 手工补充的行内注释会在重跑时被覆盖；比对靠 tests/preset.test.mjs 的逐行核对。
const source = process.env.DSH_HOST_STANDARD_YML ? 'host standard override' : 'pinned DSH dsh-v0.2.1-rc.5 standard'
const generated = `# Generated from ${source} plus the scoped Patchwork runtime.\n# gen-preset: host=${createHash('sha256').update(standard).digest('hex')}\n\n${generate(standard)}`
await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, outputName)
await writeFile(outputPath, generated)
console.log(outputPath)
