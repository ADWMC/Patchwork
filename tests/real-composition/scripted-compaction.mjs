import { Service } from '@deepseek-ai/cordis'

/**
 * Test-only 的脚本化宿主服务，用来在**真实 Loader 组合**里跑通 Online Context
 * Compact 的宿主集成那一步。
 *
 * 为什么需要它：触发窗口压力需要一段真实长会话，本机无法在不调用模型的情况下
 * 构造。所以这里替换掉两个非确定性边界——token 计量与压缩实现——而插件注册、
 * 事件派发、`runMaintenance`、`followup` 全部走真实代码。这与 plugin-test 对
 * 「脚本化 mock 只放在昂贵/不确定的边界上」的要求一致。
 */
export const calls = []

class ScriptedTokenMeter extends Service {
  constructor(ctx, totalTokens) {
    super(ctx, 'tokenMeter')
    this.totalTokens = totalTokens
  }

  measure() {
    return { totalTokens: this.totalTokens }
  }
}

class ScriptedCompaction extends Service {
  constructor(ctx) {
    super(ctx, 'compaction')
  }

  async compactNow(agent, signal, sourceCommandId) {
    calls.push({ sessionId: agent?.session?.header?.id, aborted: Boolean(signal?.aborted), sourceCommandId })
    return { ok: true, compactionId: 'scripted-1' }
  }
}

export const name = 'scripted-compaction'
export const provide = ['compaction', 'tokenMeter']

export function apply(ctx) {
  new ScriptedTokenMeter(ctx, 190_000)
  new ScriptedCompaction(ctx)
}
