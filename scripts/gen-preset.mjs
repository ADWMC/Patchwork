import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outArg = process.argv.indexOf('--out')
const outputDir = outArg >= 0 ? process.argv[outArg + 1] : resolve(root, 'presets')
const outputName = 'patchwork.patch.yml'

// 声明行的显示字段（roster 里的位置与描述）。插件本体仍由 cordis.patch.yml 注册，
// 这个文件只声明 preset，因此它不含 @patchwork/coding-agent 行。
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
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const globalRoot = execFileSync(npm, ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
  return join(globalRoot, '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml')
}

/**
 * 宿主 standard 行的缩进层级与本文件一致（列表项在 10 列），所以正文逐字搬运即可。
 * 不重排、不补写宿主默认值：本文件曾因抄了一份 persona 文案，在宿主把该字段换成
 * 必填 `prefix`/`suffix` 后成了失效点。
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
  return `${declaration.join('\n')}\n${rows.join('\n')}\n`
}

const standardPath = hostStandard()
const standard = await readFile(standardPath, 'utf8')
// 手工补充的行内注释会在重跑时被覆盖；比对靠 tests/preset.test.mjs 的逐行核对。
const generated = `# 由 scripts/gen-preset.mjs 生成，宿主 standard 行逐字搬运；下面的解释性注释是手工补充的，\n# 重跑本脚本会覆盖它们，改完请用 tests/preset.test.mjs 的逐行核对。\n# gen-preset: host=${createHash('sha256').update(standard).digest('hex')}\n\n${generate(standard)}`
await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, outputName)
await writeFile(outputPath, generated)
console.log(outputPath)
