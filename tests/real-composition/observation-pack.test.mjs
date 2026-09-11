import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'

const skip = hostAvailable() ? false : 'DSH host packages are not installed'

/** 生成远超 10 KiB 阈值的确定性输出。 */
const LARGE_COMMAND = 'for ($i = 1; $i -le 2000; $i++) { "diagnostic-line-$i" }'
const SESSION_ID = 'observation-pack-session'

const textOf = content => content.filter(block => block?.type === 'text').map(block => block.text).join('\n')

/** pwsh 工具要求 command 与 description 都非空。 */
const pwshArgs = command => ({ command, description: 'Run a deterministic command for the observation test' })

async function runCommand(config, callId) {
  const handle = await bootPatchwork(config)
  try {
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ sessionId: SESSION_ID })
    const result = await tools.execute({
      callId,
      rootCallId: callId,
      name: 'pwsh',
      arguments: pwshArgs(LARGE_COMMAND),
      agent,
      signal: new AbortController().signal,
    })
    assert.equal(result.isError, false, 'the pwsh call must succeed')
    return { text: textOf(result.content), tools, agent }
  } finally {
    await handle.dispose()
  }
}

test('a large tool result becomes a handle and its original is archived byte for byte', { skip }, async () => {
  const plain = await runCommand({}, 'call-plain')
  assert.ok(plain.text.length > 10 * 1024, 'the command must exceed the packing threshold')

  const observations = await bootPatchwork({ observationPack: true })
  try {
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ sessionId: SESSION_ID })

    const result = await tools.execute({
      callId: 'call-packed',
      rootCallId: 'call-packed',
      name: 'pwsh',
      arguments: pwshArgs(LARGE_COMMAND),
      agent,
      signal: new AbortController().signal,
    })
    const projected = textOf(result.content)

    // 模型侧只剩占位符：句柄、体积与召回入口都在，原始正文不在。
    const handle = projected.match(/obs_[a-f0-9]{24}/)?.[0]
    assert.ok(handle, `the projection must carry a handle, got: ${projected.slice(0, 120)}`)
    assert.match(projected, /bytes, \d+ lines/)
    assert.match(projected, /obs_recall/)
    assert.ok(!projected.includes('diagnostic-line-2000'), 'the full body must not be replayed')
    assert.ok(projected.length < 2048, 'the projection must be small')

    // 外部世界核对：磁盘上的归档对象就是原始输出本身。
    const archived = await readFile(dshHomePath('patchwork', 'observation-pack', SESSION_ID, 'objects', `${handle}.txt`), 'utf8')
    assert.equal(archived, plain.text)

    // 分页召回逐页拼回，必须与原文逐字节相等。
    let offset = 0
    const pages = []
    for (let guard = 0; guard < 100; guard += 1) {
      const page = await tools.execute({
        callId: `call-recall-${guard}`,
        rootCallId: `call-recall-${guard}`,
        name: 'obs_recall',
        arguments: { id: handle, offset },
        agent,
        signal: new AbortController().signal,
      })
      assert.equal(page.isError, false, 'obs_recall must succeed')
      pages.push(page.value.chunk)
      if (page.value.done) break
      assert.ok(page.value.nextOffset > offset, 'recall must advance')
      offset = page.value.nextOffset
    }
    assert.equal(pages.join(''), plain.text)
  } finally {
    await observations.dispose()
  }
})

test('a small tool result is left alone', { skip }, async () => {
  const boot = await bootPatchwork({ observationPack: true })
  try {
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ sessionId: SESSION_ID })
    const result = await tools.execute({
      callId: 'call-small',
      rootCallId: 'call-small',
      name: 'pwsh',
      arguments: pwshArgs('Write-Output "small"'),
      agent,
      signal: new AbortController().signal,
    })
    const projected = textOf(result.content)
    assert.match(projected, /small/)
    assert.doesNotMatch(projected, /obs_[a-f0-9]{24}/)
  } finally {
    await boot.dispose()
  }
})

test('with ObservationPack disabled the large result stays inline', { skip }, async () => {
  const plain = await runCommand({}, 'call-disabled')
  assert.ok(plain.text.includes('diagnostic-line-2000'))
  assert.doesNotMatch(plain.text, /obs_[a-f0-9]{24}/)
})
