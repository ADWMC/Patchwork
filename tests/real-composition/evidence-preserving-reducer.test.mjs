import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { bootPatchwork, hostAvailable, loadDriver } from './harness.mjs'

// 归档与判断日志落在宿主用户数据根下；指到临时目录，测试不污染真实 ~/.dsh。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'patchwork-epr-host-home-'))

const here = dirname(fileURLToPath(import.meta.url))
const skip = hostAvailable() ? false : 'DSH host packages are not installed'
const SESSION_ID = 'epr-host-session'

/** 命令文本要匹配诊断命令正则，同时确定性地产出远超阈值的输出。 */
const DIAGNOSTIC_COMMAND = 'Write-Output start; cargo test ; for ($i = 1; $i -le 900; $i++) { "log-line-$i" }'
const pwshArgs = command => ({ command, description: 'Run a deterministic diagnostic command' })

const textOf = content => content.filter(block => block?.type === 'text').map(block => block.text).join('\n')

async function runConversation(config, { extraRows = [] } = {}) {
  const boot = await bootPatchwork(config, { extraRows })
  try {
    const { createAgent } = await loadDriver()
    const { agent, tools } = createAgent({ sessionId: SESSION_ID })
    const result = await tools.execute({
      callId: 'call-diagnostic',
      rootCallId: 'call-diagnostic',
      name: 'pwsh',
      arguments: pwshArgs(DIAGNOSTIC_COMMAND),
      agent,
      signal: new AbortController().signal,
    })
    assert.equal(result.isError, false, 'the diagnostic call must succeed')
    return { text: textOf(result.content), boot }
  } finally {
    await boot.dispose()
  }
}

test('a long diagnostic log becomes a receipt whose quotes came from the log', { skip }, async () => {
  const plain = await runConversation({})
  assert.ok(plain.text.length > 4096, 'the command must exceed the reduction threshold')
  assert.match(plain.text, /log-line-900/)

  const llmUrl = pathToFileURL(join(here, 'scripted-llm.mjs')).href
  const reduced = await runConversation(
    { evidencePreservingReducer: true, reducerProvider: 'scripted', reducerModel: 'scripted-model' },
    { extraRows: [['scripted-llm', llmUrl]] },
  )

  // 模型侧只剩收据：标记、状态与 reducer 路由都在，原始正文不再回放。
  assert.ok(reduced.text.startsWith('[evidence-preserving-reducer]'), reduced.text.slice(0, 160))
  assert.match(reduced.text, /reducer_model=scripted-model/)
  assert.match(reduced.text, /reducer_provider=scripted/)
  assert.doesNotMatch(reduced.text, /log-line-900/)
  assert.ok(reduced.text.length < plain.text.length / 10, 'the receipt must be far smaller than the log')

  // 脚本化模型确实拿到了原文与哈希，而不是被插件绕开。
  const { scriptedLlm } = await import(llmUrl)
  const call = scriptedLlm().calls.at(-1)
  assert.equal(call.provider, 'scripted')
  assert.equal(call.model, 'scripted-model')
  assert.match(JSON.stringify(call.messages), /log-line-900/)

  // 外部世界核对：归档原文与会话判断日志都真实存在。
  const root = dshHomePath('patchwork', 'evidence-preserving-reducer', SESSION_ID)
  const journal = await readFile(join(root, 'journal.jsonl'), 'utf8')
  const entries = journal.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(entries.at(-1).kind, 'applied')
  assert.match(entries.at(-1).reason, /retained-1-quotes/)
})

test('with the reducer disabled the diagnostic log stays inline', { skip }, async () => {
  const plain = await runConversation({})
  assert.match(plain.text, /log-line-900/)
  assert.doesNotMatch(plain.text, /evidence-preserving-reducer/)
})
