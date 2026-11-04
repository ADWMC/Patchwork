import { CONFIG_ROUTE_PATH } from './config-route.mjs'
import { STATE_ROUTE_PATH } from './runtime-state.mjs'
import { SETTINGS_ROUTE_PATH } from './settings-route.mjs'
import { UPDATE_ROUTE_PATH } from './update-route.mjs'
import { LOGS_ROUTE_PATH } from '../logging/route.mjs'
import { MEMORY_ROUTE_PATH } from '../memory/route.mjs'
import { IMPROVEMENT_ROUTE_PATH } from '../improvement/route.mjs'
import { SUPERAGENT_ROUTE_PATH } from '../superagent/route.mjs'
import { EVIDENCE_ROUTE_PATH } from '../retrieval/route.mjs'

export const STATS_ELEMENT_ATTRIBUTE = 'data-patchwork-stats'

/**
 * Only bridge paths and the page credential belong in the global HTML.
 * Configuration and receipts are returned by session-authorized routes.
 */
export function registerStatsInjection(ctx, { token } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.tapIndex) return

  const payload = () => {
    return {
      // No configuration, counters, skill text or receipts in the global page.
      // Session-addressed endpoints perform their own host composition check.
      writePath: CONFIG_ROUTE_PATH,
      statePath: STATE_ROUTE_PATH,
      settingsPath: SETTINGS_ROUTE_PATH,
      updatePath: UPDATE_ROUTE_PATH,
      logsPath: LOGS_ROUTE_PATH,
      memoryPath: MEMORY_ROUTE_PATH,
      improvementPath: IMPROVEMENT_ROUTE_PATH,
      superagentPath: SUPERAGENT_ROUTE_PATH,
      evidencePath: EVIDENCE_ROUTE_PATH,
      token: token ?? null,
      generatedAt: new Date().toISOString(),
    }
  }

  const register = () => server.tapIndex(html => {
    let json
    try {
      json = JSON.stringify(payload())
    } catch {
      return html
    }
    // 转义 `<` 与行分隔符，避免 JSON 里的内容提前闭合脚本标签。
    const safe = json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
    // Metadata is DOM-backed; do not accumulate stale copies on plugin reload.
    const element = `<script type="application/json" ${STATS_ELEMENT_ATTRIBUTE}>${safe}</script>`
    const head = html.indexOf('</head>')
    return head < 0 ? `${element}${html}` : `${html.slice(0, head)}${element}${html.slice(head)}`
  })
  if (ctx.effect) ctx.effect(register, 'patchwork: authenticated page metadata')
  else return register()
}
