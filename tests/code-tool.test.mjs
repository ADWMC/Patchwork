import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { registerCodeTool } from '../src/code/tool.mjs'
import { buildCodeIndex, callersOf, searchCode } from '../src/code/code-index.mjs'

async function fixture() {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-code-tool-'))
  const root = await mkdtemp(join(tmpdir(), 'patchwork-code-work-'))
  await mkdir(join(root, 'src'))
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true })
  await mkdir(join(root, '.patchwork'), { recursive: true })
  await writeFile(join(root, '.patchwork', 'config.json'), '{"not":"code"}\n')
  await writeFile(join(root, 'src', 'math.mjs'), [
    "import { readFile } from 'node:fs/promises'",
    'export function sum(a, b) { return a + b }',
    'export class Calculator { add(a, b) { return sum(a, b) } }',
    'export const VERSION = "1.0.0"',
  ].join('\n'))
  await writeFile(join(root, 'src', 'app.mjs'), "import { sum } from './math.mjs'\nexport function main() { return sum(2, 3) }\n")
  await writeFile(join(root, 'src', 'math.test.mjs'), "import { sum } from './math.mjs'\nif (sum(2, 3) !== 5) throw new Error('bad')\n")
  await writeFile(join(root, 'README.md'), '# Demo\n\nsum is documented here.\n')
  await writeFile(join(root, 'node_modules', 'pkg', 'index.js'), 'export const sum = () => "dependency"\n')
  await writeFile(join(root, '.env'), 'SECRET=do-not-index\n')
  await writeFile(join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3]))
  let tool, dispose
  const ctx = { tools: { register(value) { tool = value } }, effect(fn) { dispose = fn() } }
  const agent = scopedAgent({ session: { header: { id: `code-${Date.now()}`, cwd: root } }, ctx })
  registerCodeTool(ctx)
  return { root, agent, tool, dispose: () => dispose?.() }
}

test('code tool maps the workspace, outlines symbols and finds definitions without dependencies or secrets', async () => {
  const f = await fixture()
  try {
    const map = await f.tool.execute({ action: 'map' }, { agent: f.agent })
    assert.equal(map.status, 'ok')
    assert.match(map.text, /src\/math\.mjs/)
    assert.doesNotMatch(map.text, /node_modules/)
    assert.doesNotMatch(map.text, /\.env/)
    const outline = await f.tool.execute({ action: 'outline', path: 'src/math.mjs' }, { agent: f.agent })
    assert.equal(outline.status, 'ok')
    assert.ok(outline.symbols.some(symbol => symbol.name === 'sum' && symbol.kind === 'function'))
    assert.ok(outline.symbols.some(symbol => symbol.name === 'Calculator' && symbol.kind === 'class'))
    assert.ok(outline.imports.includes('node:fs/promises'))
    const find = await f.tool.execute({ action: 'find', symbol: 'sum' }, { agent: f.agent })
    assert.equal(find.status, 'ok')
    assert.ok(find.matches.some(match => match.path === 'src/math.mjs' && match.kind === 'definition'))
  } finally { f.dispose() }
})

test('code tool searches literals, regex and references with bounded results', async () => {
  const f = await fixture()
  try {
    const literal = await f.tool.execute({ action: 'search', query: 'sum(2, 3)' }, { agent: f.agent })
    assert.equal(literal.status, 'ok')
    assert.ok(literal.matches.some(match => match.path === 'src/app.mjs'))
    for (const match of literal.matches) assert.equal(Object.values(match).some(value => value === undefined), false)
    const dotted = await f.tool.execute({ action: 'search', query: 'sum', path: '.' }, { agent: f.agent })
    assert.equal(dotted.status, 'ok')
    assert.ok(dotted.totalFiles > 0)
    const regex = await f.tool.execute({ action: 'search', query: 'return\\s+sum', mode: 'regex' }, { agent: f.agent })
    assert.equal(regex.status, 'ok')
    assert.ok(regex.matches.length >= 1)
    const refs = await f.tool.execute({ action: 'references', symbol: 'sum' }, { agent: f.agent })
    assert.equal(refs.status, 'ok')
    assert.equal(refs.lexical, true)
    assert.ok(refs.matches.some(match => match.path === 'src/math.test.mjs'))
  } finally { f.dispose() }
})

test('code tool rejects path traversal, invalid regex and non-Patchwork scope', async () => {
  const f = await fixture()
  try {
    const invalidRegex = await f.tool.execute({ action: 'search', query: '(', mode: 'regex' }, { agent: f.agent })
    assert.equal(invalidRegex.status, 'failed')
    assert.equal(invalidRegex.failureCode, 'CODE_INVALID_REGEX')
    const outside = await f.tool.execute({ action: 'outline', path: join(f.root, '..', 'outside.mjs') }, { agent: f.agent })
    assert.equal(outside.status, 'failed')
    assert.equal(outside.failureCode, 'CODE_PATH_OUTSIDE_WORKSPACE')
    f.agent.selectPreset('standard')
    await assert.rejects(f.tool.execute({ action: 'map' }, { agent: f.agent }), /Patchwork/)
  } finally { f.dispose() }
})

test('code graph scans all indexed files, not only the first result page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'patchwork-code-scan-'))
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'src', 'target.mjs'), 'export function target() { return 1 }\n')
  for (let i = 0; i < 60; i++) {
    const body = i === 59
      ? "import { target } from './target.mjs'\nexport function lastCaller() { return target() }\n"
      : `export const v${i} = ${i}\n`
    await writeFile(join(root, 'src', `z${String(i).padStart(2, '0')}.mjs`), body)
  }
  const index = await buildCodeIndex(root, { refresh: true })
  const callers = await callersOf(index, { symbol: 'target' })
  assert.ok(callers.callers.some(caller => caller.name === 'lastCaller'))
  const search = await searchCode(index, { query: 'lastCaller', mode: 'word' })
  assert.ok(search.scanned < index.files.length, 'bloom prefilter should avoid scanning unrelated files')
})
