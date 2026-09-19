import { effectiveConfig, mergeUserConfig, validatePatch } from '../config/user-config.mjs'

export const CONFIG_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/config'
export const CONFIG_TOKEN_HEADER = 'x-patchwork-token'
const MAX_BODY_BYTES = 64 * 1024

/**
 * 侧边栏保存配置的唯一写入口。
 *
 * 为什么需要密钥：这个 profile 的 webserver 绑在 `0.0.0.0`，一个无鉴权的写端点
 * 等于把配置暴露给局域网。密钥每次进程启动随机生成，只经**页面注入**到达浏览器，
 * 而页面本身在应用自己的 token 网关之后。
 *
 * 为什么按**进程级路由键**去重：插件在 profile 补丁与 agent preset 隔离 realm 会各
 * 加载一份，而 `ctx.get('webServer')` 在隔离 realm 解析到的是**不同的服务实例**——
 * 按服务实例去重拦不住第二次注册。但这些实例共享同一张路由表，exact 路由重复注册
 * 会直接失败（duplicate exact route）。所以用进程级注册表：`exact /api/plugins/patchwork-coding-agent/config`
 * 全局只注册一次，后到的实例直接跳过。
 */
const registeredRouteKeys = new Set()

/** 测试用：清空进程级注册表，让每个测试从干净状态开始。 */
export function resetRouteRegistry() {
  registeredRouteKeys.clear()
}

export function registerConfigRoute(ctx, { token, rowConfig = {}, onSaved } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token) return
  const routeKey = `exact\u0000${CONFIG_ROUTE_PATH}`
  if (registeredRouteKeys.has(routeKey)) return
  registeredRouteKeys.add(routeKey)

  server.register({
    kind: 'exact',
    path: CONFIG_ROUTE_PATH,
    handler: async (req, res) => {
      const reply = (status, payload) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(payload))
      }

      if (req.method !== 'POST') return reply(405, { ok: false, reason: 'method-not-allowed' })
      if (req.headers[CONFIG_TOKEN_HEADER] !== token) return reply(403, { ok: false, reason: 'forbidden' })

      let raw
      try {
        raw = JSON.parse(await readBody(req))
      } catch {
        return reply(400, { ok: false, reason: 'body-not-json' })
      }

      const validated = validatePatch(raw)
      if (!validated.ok) return reply(400, { ok: false, reason: validated.reason })

      try {
        const stored = await mergeUserConfig(validated.value)
        const config = effectiveConfig(rowConfig, stored)
        await onSaved?.(config)
        return reply(200, { ok: true, config })
      } catch (error) {
        return reply(500, { ok: false, reason: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
