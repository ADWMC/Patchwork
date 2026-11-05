import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildShortcutNotice, extractShortcuts } from '../src/structure/shortcut-ledger.mjs'

// 冷却状态默认落在共享 tmp 文件，会跨运行残留；测试指到独立文件保证可重复。
process.env.PATCHWORK_HOOK_STATE = join(await mkdtemp(join(tmpdir(), 'patchwork-shortcut-state-')), 'state.json')

test('extracts shortcut registrations with line numbers and both comma forms', () => {
  const text = [
    'const re = /x/',
    '// shortcut: 正则不是解析器，漏嵌套定义；符号索引需要精确时升级',
    'export const a = 1',
    '# shortcut: 先跑通再补文档, 文档评审前补上',
  ].join('\n')
  assert.deepEqual(extractShortcuts(text), [
    { line: 2, limit: '正则不是解析器', upgrade: '漏嵌套定义；符号索引需要精确时升级' },
    { line: 4, limit: '先跑通再补文档', upgrade: '文档评审前补上' },
  ])
  assert.deepEqual(extractShortcuts('no registrations here'), [])
})

test('notice surfaces registered compromises in changed files and cools down per session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-shortcut-'))
  const file = join(dir, 'sample.mjs')
  await writeFile(file, 'export const v = 1\n// shortcut: 先写死，配置化时收敛到 config\n', 'utf8')
  const first = await buildShortcutNotice({ cwd: dir, files: ['sample.mjs'], sessionId: 'ledger-a' })
  assert.equal(first.shortcuts.length, 1)
  assert.match(first.prompt, /sample\.mjs:2/)
  assert.match(first.prompt, /shortcut: 先写死, 配置化时收敛到 config/)
  assert.match(first.prompt, /不要静默删除登记/)

  const second = await buildShortcutNotice({ cwd: dir, files: ['sample.mjs'], sessionId: 'ledger-a' })
  assert.equal(second.shortcuts.length, 1)
  assert.equal(second.prompt, undefined, '同一会话同一登记不重复注入')

  const other = await buildShortcutNotice({ cwd: dir, files: ['sample.mjs'], sessionId: 'ledger-b' })
  assert.match(other.prompt, /shortcut:/)
})

test('missing files and non-registrations produce no notice', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-shortcut-empty-'))
  await writeFile(join(dir, 'plain.mjs'), 'export const v = 1\n', 'utf8')
  const plain = await buildShortcutNotice({ cwd: dir, files: ['plain.mjs'], sessionId: 's1' })
  assert.deepEqual(plain.shortcuts, [])
  assert.equal(plain.prompt, undefined)
  const missing = await buildShortcutNotice({ cwd: dir, files: ['gone.mjs'], sessionId: 's2' })
  assert.deepEqual(missing.shortcuts, [])
  const none = await buildShortcutNotice({ cwd: dir, files: [], sessionId: 's3' })
  assert.deepEqual(none.shortcuts, [])
})
