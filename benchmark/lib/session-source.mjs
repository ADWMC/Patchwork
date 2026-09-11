import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { readSessionLogText } from '@deepseek-ai/dsh-session-log-export'
import { extractFacts, parseEvents } from './session-facts.mjs'

/** 会话存储根遵循宿主的 `$DSH_HOME`，不硬编码绝对路径。 */
export function defaultSessionsRoot() {
  return dshHomePath('sessions')
}

/**
 * 启动一个只挂载会话持久化的最小 DSH 组合，然后用 `ctx.get()` 在 Node 侧读取。
 *
 * 为什么不把读取写进一个插件的 `apply`：Cordis 不等待 `apply` 返回的 Promise，
 * 读取一旦比 boot 慢就会被静默截断。`ctx.get(name)` 不受 inject 限制，因此
 * 挂载完成后在 Node 侧直接调用既正确又简单。
 */
export async function collectSessions({
  cwdIncludes = 'Patchwork',
  limit = 5,
  sessionsRoot = defaultSessionsRoot(),
  boot = defaultBoot,
} = {}) {
  const work = await mkdtemp(join(tmpdir(), 'patchwork-benchmark-'))
  const configPath = join(work, 'cordis.yml')
  await writeFile(
    configPath,
    [
      `- id: projections`,
      `  name: '${import.meta.resolve('@deepseek-ai/dsh-session-projection')}'`,
      `- id: token-meter`,
      `  name: '${import.meta.resolve('@deepseek-ai/dsh-token-meter')}'`,
      `- id: persistence`,
      `  name: '${import.meta.resolve('@deepseek-ai/dsh-session-persistence-jsonl')}'`,
      `  config:`,
      `    root: '${sessionsRoot.replace(/\\/g, '/')}'`,
      ``,
    ].join('\n'),
    'utf8',
  )

  const { ctx, dispose } = await boot(configPath)
  try {
    const persistence = ctx.get('sessionPersistence')
    if (!persistence) throw new Error('the persistence backend did not register sessionPersistence')

    // token 估算用宿主自己的计量器：口径与 harness 内部一致，而不是我发明的换算。
    const meter = ctx.get('tokenMeter')
    const estimate =
      typeof meter?.estimateMessage === 'function'
        ? text => meter.estimateMessage({ role: 'user', content: [{ type: 'text', text }] })
        : undefined

    const listed = await persistence.list({})
    const selected = listed
      .filter(entry => String(entry.header.cwd ?? '').includes(cwdIncludes))
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, limit)

    const sessions = []
    for (const entry of selected) {
      const text = await readSessionLogText(persistence, entry.header.id)
      if (!text) continue
      const events = parseEvents(text)
      const facts = extractFacts(events, estimate)
      sessions.push({
        id: entry.header.id,
        cwd: entry.header.cwd,
        createdAt: entry.header.createdAt,
        agentPreset: entry.header.agentPreset,
        sizeBytes: entry.sizeBytes,
        eventCount: events.length,
        tokensMeasured: Boolean(estimate),
        ...facts,
      })
    }
    return { listed: listed.length, selected: selected.length, sessions }
  } finally {
    await dispose()
    await rm(work, { recursive: true, force: true })
  }
}

async function defaultBoot(configPath) {
  const { boot } = await import('@deepseek-ai/dsh-app-boot')
  const ctx = await boot('patchwork-benchmark', configPath)
  return {
    ctx,
    dispose: async () => {
      await ctx.fiber?.dispose?.()
    },
  }
}
