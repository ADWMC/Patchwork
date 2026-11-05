import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bm25Score, computeBM25Stats, rankDocuments, tokenize } from '../src/code/bm25.mjs'
import { searchChunks } from '../src/code/chunks.mjs'
import { buildCodeIndex } from '../src/code/code-index.mjs'

test('tokenize splits identifiers and keeps CJK single characters', () => {
  assert.deepEqual(tokenize('getUserNameID 中文注释'), ['get', 'user', 'name', 'id', '中', '文', '注', '释'])
  assert.deepEqual(tokenize('snake_case and $dollar'), ['snake', 'case', 'and', 'dollar'])
  assert.deepEqual(tokenize(''), [])
})

test('bm25 ranks the document with more query terms higher and is deterministic', () => {
  const docs = [
    ['search', 'engine', 'index'],
    ['search'],
    ['unrelated', 'words', 'here'],
  ]
  const stats = computeBM25Stats(docs)
  const first = bm25Score(['search', 'engine'], 0, stats)
  const second = bm25Score(['search'], 1, stats)
  assert.ok(first > second, '同时含两个查询词的文档得分应更高')
  assert.equal(bm25Score(['search'], 2, stats), 0, '不含查询词的文档零分')
  assert.equal(rankDocuments('search engine', docs)[0].index, 0)
  assert.deepEqual(rankDocuments('nothing', docs), [])
  assert.deepEqual(rankDocuments('search', []), [])
})

test('chunk search ranks the relevant code block first with anchors and previews', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-chunks-'))
  await mkdir(join(dir, 'src'), { recursive: true })
  await writeFile(join(dir, 'src', 'auth.mjs'), [
    '// 登录与令牌签发',
    'export async function issueToken(user) {',
    '  const secret = readSecret()',
    '  return sign({ sub: user.id }, secret)',
    '}',
    '',
    'export function logout(session) {',
    '  session.destroy()',
    '}',
  ].join('\n'), 'utf8')
  await writeFile(join(dir, 'src', 'math.mjs'), 'export const add = (a, b) => a + b\n\nexport const sub = (a, b) => a - b\n', 'utf8')
  const index = await buildCodeIndex(dir)
  const hits = await searchChunks({ cwd: dir, index, query: 'issueToken sign secret' })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].path, 'src/auth.mjs')
  assert.equal(hits[0].startLine, 1)
  assert.equal(hits[0].enclosingSymbol, 'issueToken@2')
  assert.match(hits[0].preview, /issueToken/)
  assert.ok(hits[0].score > 0)

  const logout = await searchChunks({ cwd: dir, index, query: 'logout session destroy' })
  assert.equal(logout[0].enclosingSymbol, 'logout@7')

  const none = await searchChunks({ cwd: dir, index, query: 'completely unrelated zebra' })
  assert.deepEqual(none, [])

  const narrowed = await searchChunks({ cwd: dir, index, query: 'add', path: 'src/math.mjs' })
  assert.equal(narrowed[0].path, 'src/math.mjs')
  const missed = await searchChunks({ cwd: dir, index, query: 'add', path: 'src/auth.mjs' })
  assert.deepEqual(missed, [])
})

test('test files are excluded from chunk candidates like the repo map', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-chunks-skip-'))
  await writeFile(join(dir, 'app.mjs'), 'export const run = () => 1\n', 'utf8')
  await writeFile(join(dir, 'app.test.mjs'), 'test(\'run\', () => { assert.equal(run(), 1) })\n', 'utf8')
  const index = await buildCodeIndex(dir)
  const hits = await searchChunks({ cwd: dir, index, query: 'run assert equal' })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].path, 'app.mjs')
})
