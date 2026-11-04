import { effectiveConfig, readUserConfig, configRevision } from '../config/user-config.mjs'
import { webRuntime } from './web-runtime.mjs'
import { packageVersion } from '../util/version.mjs'

export const SETTINGS_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/settings'
const routeKey = `exact\u0000${SETTINGS_ROUTE_PATH}`

/** 测试用：清空进程级注册表，让每个测试从干净状态开始。 */
export function resetSettingsRouteRegistry() {
  webRuntime.routes.delete(routeKey)
}

/**
 * 全局只读设置视图。
 *
 * state 路由返回会话态任务/证据/记忆，必须绑定 Patchwork Agent；但“设置”只是
 * 当前 DSH_HOME 的用户配置快照。没有会话时也允许读，可以让用户在切换 Agent 前
 * 先核对配置；保存仍然走 config 路由，保留 Patchwork 会话鉴权。
 */
export function registerSettingsRoute(ctx, { token, rowConfig, loadedConfig } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)

  const register = () => {
    const dispose = server.register({
      kind: 'exact',
      path: SETTINGS_ROUTE_PATH,
      handler(req, res) {
        const reply = (status, payload) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(payload))
        }
        if (req.method !== 'GET') return reply(405, { ok: false, reason: 'method-not-allowed' })
        if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
        const userConfig = readUserConfig()
        const baseRow = rowConfig ?? webRuntime.rowConfig ?? {}
        const baseLoaded = loadedConfig ?? webRuntime.loadedConfig ?? {}
        return reply(200, {
          ok: true,
          version: packageVersion,
          config: effectiveConfig(baseRow, userConfig),
          loadedConfig: baseLoaded,
          revision: configRevision(userConfig),
        })
      },
    })
    return () => { dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(register, 'patchwork: global settings endpoint')
  else return register()
}
