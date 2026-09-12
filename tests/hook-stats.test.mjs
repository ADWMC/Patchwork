import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerStructureHook } from '../src/hook/post-execute-hook.mjs'
import { reset, snapshot } from '../src/ui/mechanism-stats.mjs'

/**
 * 结构 Hook 触发告警时记一条维护计数，供面板第三屏展示「提醒过几次」。
 * 内容本身只进会话上下文，这里只验证「可数的事实」被记下。
 */
test('a structure warning is counted for the panel maintenance view', async () => {
  reset()
  const listeners = new Map()
  registerStructureHook({ on: (event, listener) => listeners.set(event, listener) })

  const work = mkdtempSync(join(tmpdir(), 'patchwork-hookstats-'))
  writeFileSync(join(work, 'main_final.cpp'), 'int main() {}\n')
  const decision = { additionalContexts: [] }
  const exec = {
    name: 'write',
    // 随机 sessionId：告警冷却状态按 sessionId 持久化在临时文件，固定 id 会命中上次运行的冷却。
    agent: { id: `agent-${Math.random().toString(16).slice(2)}`, session: { header: { cwd: work } } },
    arguments: { file_path: join(work, 'main_final.cpp'), content: 'int main() {}\n' },
  }
  const next = async () => decision

  const out = await listeners.get('tools/post-execute')(exec, null, next)
  assert.notEqual(out, decision, 'the hook must return a new decision')
  assert.equal(out.additionalContexts.length, 1, 'the warning context must be appended')
  assert.equal(snapshot().maintenance?.structureWarnings, 1)
  reset()
})
