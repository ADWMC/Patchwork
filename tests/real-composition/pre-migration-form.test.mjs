import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bootPatchwork, hostAvailable } from './harness.mjs'

/**
 * Stage 0 判决的**可复现证据**。
 *
 * `dsh-benchmark-case` 要求一道考题的 fixture 满足「装旧形态必有可观察故障」。
 * 本文件把机制改造前的那一版插件（从它之前的那次提交里取）装进真实 Loader
 * 组合，验证它在当前目标宿主（现为 DSH 0.1.7-alpha.2）上**能否激活**。
 *
 * 若能激活，就不存在「必需迁移」，按规范应当退回升级卡形态而不是编一道题。
 * 因此这个测试断言的正是「旧形态可以激活」——它是一条会阻止我们伪造考题的护栏。
 */
const PRE_MIGRATION_COMMIT = '54bdd5c'
const TRACKED = ['src', 'hooks', 'assets', 'package.json', 'cordis.patch.yml']

const here = dirname(fileURLToPath(import.meta.url))
const skip = hostAvailable() ? false : 'DSH host packages are not installed'

function materializePreMigrationForm() {
  const dir = mkdtempSync(join(tmpdir(), 'patchwork-premigration-'))
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', PRE_MIGRATION_COMMIT, '--', ...TRACKED], {
    cwd: join(here, '..', '..'),
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
  for (const file of files) {
    const content = execFileSync('git', ['show', `${PRE_MIGRATION_COMMIT}:${file}`], {
      cwd: join(here, '..', '..'),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    const target = join(dir, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf8')
  }
  return { dir, files }
}

test('the pre-migration plugin form still activates on the target host', { skip }, async () => {
  const { dir } = materializePreMigrationForm()

  const boot = await bootPatchwork({}, { pluginEntry: pathToFileURL(join(dir, 'src', 'index.mjs')).href })
  try {
    const tools = boot.ctx.get('tools')
    assert.ok(tools, 'the tool registry must exist')
    assert.deepEqual(tools.schemas().map(schema => schema.name).sort(), ['edit', 'pwsh', 'read', 'write'])
    assert.equal(typeof boot.ctx.get('systemPrompt'), 'object', 'the plugin must have claimed its prompt section')
    assert.equal(typeof boot.ctx.get('commands'), 'object')
  } finally {
    await boot.dispose()
  }
})
