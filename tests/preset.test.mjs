import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const root = join(import.meta.dirname, '..')

/** 宿主随包发布的 standard preset；源码检出或未装 dsh 时可能不存在。 */
function hostStandardPath() {
  if (process.env.DSH_HOST_STANDARD_YML) return process.env.DSH_HOST_STANDARD_YML
  try {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const globalRoot = execFileSync(npm, ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
    return join(globalRoot, '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml')
  } catch {
    return null
  }
}

// 注释与空行不参与比较：preset 声明里的说明文字是手工补充的。
const contentLines = text =>
  text
    .split(/\r?\n/)
    .filter(line => line.trim() !== '' && !/^\s*#/.test(line))

test('bundle patch registers the Patchwork plugin on the profile root', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- insert:/)
  assert.match(patch, /- id: patchwork-agent/)
  assert.match(patch, /name: '@patchwork\/coding-agent'/)
})

test('bundle patch declares the agent preset alongside the plugin', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.deepEqual(pkg.dsh.bundle.patch, ['./cordis.patch.yml', './presets/patchwork.patch.yml'])
  // 0.1.7 起没有任何读者读 $DSH_HOME/.agent-presets/，preset 只能由声明行承载。
  assert.equal(existsSync(join(root, 'presets/patchwork/agent.cordis.yml')), false)
})

test('generated preset exposes host tools without remounting the plugin', () => {
  const work = mkdtempSync(join(tmpdir(), 'patchwork-preset-'))
  const host = join(work, 'standard.patch.yml')
  const out = join(work, 'out')
  try {
    writeFileSync(
      host,
      [
        `- insert:`,
        `    - id: preset-standard`,
        `      name: '@deepseek-ai/dsh-agent-preset'`,
        `      config:`,
        `        id: standard`,
        `        order: 1`,
        `        plugins:`,
        `          - id: persona`,
        `            name: '@deepseek-ai/dsh-persona'`,
        `            config:`,
        `              prefix: You are a coding agent.`,
        `          - id: tool-example`,
        `            name: '@example/tool'`,
        ``,
      ].join('\n'),
    )
    mkdirSync(out)
    execFileSync(process.execPath, ['scripts/gen-preset.mjs', '--out', out], {
      cwd: root,
      env: { ...process.env, DSH_HOST_STANDARD_YML: host },
    })
    const generated = readFileSync(join(out, 'patchwork.patch.yml'), 'utf8')
    assert.match(generated, /- id: preset-patchwork/)
    assert.match(generated, /^ {8}id: patchwork$/m)
    assert.doesNotMatch(generated, /@patchwork\/coding-agent/)
    assert.match(generated, /- id: tool-example/)
    assert.match(generated, /prefix: You are a coding agent\./)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('committed preset carries the 0.1.7 host rows', () => {
  const preset = readFileSync(join(root, 'presets/patchwork.patch.yml'), 'utf8')
  // worker-thread 后端在 0.1.7 里换成了 ptc；persona 的单一 text 字段已退役。
  assert.match(preset, /name: '@deepseek-ai\/dsh-workflow-ptc'/)
  assert.doesNotMatch(preset, /dsh-workflow-worker-thread/)
  assert.doesNotMatch(preset, /text: >-/)
  assert.match(preset, /prefix: You are a coding agent powered by the \{\{model\}\} model\./)
  assert.match(preset, /- id: tool-ralph\n {16}name: '@deepseek-ai\/dsh-tool-ralph'\n {16}disabled: true/)
})

test('committed preset rows match the installed host standard verbatim', t => {
  const hostPath = hostStandardPath()
  if (!hostPath || !existsSync(hostPath)) return t.skip('no installed host standard to compare against')
  const rows = text => {
    const lines = contentLines(text)
    return lines.slice(lines.findIndex(line => line.trim() === 'plugins:'))
  }
  // 正文逐行等于宿主 standard：本仓库不抄写宿主默认值，抄过的那份 persona 文案
  // 就是 0.1.7 的失效点。
  assert.deepEqual(rows(readFileSync(join(root, 'presets/patchwork.patch.yml'), 'utf8')), rows(readFileSync(hostPath, 'utf8')))
})

test('profile installs Patchwork as a bundle layer', () => {
  const profile = JSON.parse(readFileSync(join(root, 'profiles/patchwork/package.json'), 'utf8'))
  assert.equal(profile.dependencies['@patchwork/coding-agent'], '0.1.2')
  assert.equal(profile.dsh.profile.bundles.includes('@patchwork/coding-agent'), true)
})
