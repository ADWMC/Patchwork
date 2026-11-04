import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedAgent } from './helpers/agent.mjs'
import { registerProjectDocsTool } from '../src/project-docs/tool.mjs'

async function fixture() {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-docs-home-'))
  const root = await mkdtemp(join(tmpdir(), 'patchwork-docs-work-'))
  await mkdir(join(root, 'src'))
  let tool, dispose
  const ctx = { tools: { register(value) { tool = value } }, effect(fn) { dispose = fn() } }
  const agent = scopedAgent({ session: { header: { id: `docs-${Date.now()}`, cwd: root } }, ctx })
  registerProjectDocsTool(ctx)
  return { root, agent, tool, dispose: () => dispose?.() }
}

test('project docs tool creates and CAS-updates AGENTS.md', async () => {
  const f = await fixture()
  try {
    const missing = await f.tool.execute({ action: 'status', kind: 'agents' }, { agent: f.agent })
    assert.equal(missing.status, 'ok'); assert.deepEqual(missing.docs, [])
    const content = '# AGENTS\n\n## Build\n\n- Run `npm test` before commit.\n'
    const created = await f.tool.execute({ action: 'apply', kind: 'agents', content }, { agent: f.agent })
    assert.equal(created.status, 'ok'); assert.equal(created.mode, 'created')
    assert.equal(await readFile(join(f.root, 'AGENTS.md'), 'utf8'), content)
    const blocked = await f.tool.execute({ action: 'apply', kind: 'agents', content: '# Changed\n' }, { agent: f.agent })
    assert.equal(blocked.failureCode, 'PROJECT_DOC_EXISTS')
    const conflict = await f.tool.execute({ action: 'apply', kind: 'agents', content: '# Changed\n', expectedSha256: 'bad' }, { agent: f.agent })
    assert.equal(conflict.failureCode, 'PROJECT_DOC_CONFLICT')
    const updated = await f.tool.execute({ action: 'apply', kind: 'agents', content: '# AGENTS\n\n- Use `pnpm test`.\n', expectedSha256: created.sha256 }, { agent: f.agent })
    assert.equal(updated.mode, 'updated'); assert.equal(updated.expectedSha256, created.sha256)
    const read = await f.tool.execute({ action: 'read', kind: 'agents' }, { agent: f.agent })
    assert.equal(read.status, 'ok'); assert.match(read.content, /pnpm test/)
  } finally { f.dispose() }
})

test('project docs tool validates and refuses secrets or arbitrary files', async () => {
  const f = await fixture()
  try {
    const empty = await f.tool.execute({ action: 'validate', kind: 'agents', content: '   ' }, { agent: f.agent })
    assert.equal(empty.failureCode, 'PROJECT_DOC_CONTENT_REQUIRED')
    const secret = await f.tool.execute({ action: 'apply', kind: 'agents', content: '# AGENTS\nsk-1234567890abcdef\n' }, { agent: f.agent })
    assert.equal(secret.failureCode, 'PROJECT_DOC_SECRET')
    const wrongName = await f.tool.execute({ action: 'apply', kind: 'agents', path: 'README.md', content: '# x\n' }, { agent: f.agent })
    assert.equal(wrongName.failureCode, 'PROJECT_DOC_NAME_REQUIRED')
    const outside = await f.tool.execute({ action: 'apply', kind: 'agents', path: '../AGENTS.md', content: '# x\n' }, { agent: f.agent })
    assert.equal(outside.failureCode, 'PROJECT_DOC_PATH_OUTSIDE')
    const design = await f.tool.execute({ action: 'apply', kind: 'design', content: '---\ncolors:\n  primary: "#111111"\n---\n\nPrimary ink.\n' }, { agent: f.agent })
    assert.equal(design.status, 'ok'); assert.equal(design.mode, 'created')
    assert.equal(JSON.parse(JSON.stringify(design)).status, 'ok')
    f.agent.selectPreset('standard')
    await assert.rejects(f.tool.execute({ action: 'status' }, { agent: f.agent }), /Patchwork/)
  } finally { f.dispose() }
})

test('project docs tool rejects symlinks and stays available when code search is disabled', async t => {
  const f = await fixture()
  try {
    const outside = await mkdtemp(join(tmpdir(), 'patchwork-docs-outside-'))
    await writeFile(join(outside, 'AGENTS.md'), 'OUTSIDE SECRET\n')
    try { await symlink(join(outside, 'AGENTS.md'), join(f.root, 'AGENTS.md')) }
    catch { t.skip('symlink unavailable on this platform'); return }
    const status = await f.tool.execute({ action: 'status', kind: 'agents' }, { agent: f.agent })
    assert.equal(status.docs[0].symlink, true)
    const read = await f.tool.execute({ action: 'read', kind: 'agents' }, { agent: f.agent })
    assert.equal(read.failureCode, 'PROJECT_DOC_SYMLINK')
    let disabledTool, dispose
    registerProjectDocsTool({ tools: { register(value) { disabledTool = value } }, effect(fn) { dispose = fn() } }, { codeEnabled: false })
    assert.ok(disabledTool)
    dispose?.()
  } finally { f.dispose() }
})

test('concurrent creates serialize through the project document lock', async () => {
  const f = await fixture()
  try {
    const content = '# AGENTS - npm test'
    const [a, b] = await Promise.all([
      f.tool.execute({ action: 'apply', kind: 'agents', content }, { agent: f.agent }),
      f.tool.execute({ action: 'apply', kind: 'agents', content }, { agent: f.agent }),
    ])
    assert.equal([a, b].filter(item => item.status === 'ok' && item.mode === 'created').length, 1)
    assert.equal([a, b].filter(item => item.failureCode === 'PROJECT_DOC_EXISTS').length, 1)
  } finally { f.dispose() }
})
