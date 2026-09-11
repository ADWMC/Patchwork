import { effectiveConfig, mergeUserConfig, validatePatch } from '../config/user-config.mjs'

export const CONFIG_ROUTE_PATH = '/api/patchwork/config'
export const CONFIG_TOKEN_HEADER = 'x-patchwork-token'
const MAX_BODY_BYTES = 64 * 1024

/**
 * 侧边栏保存配置的唯一写入口。
 *
 * 为什么需要密钥：这个 profile 的 webserver 绑在 `0.0.0.0`，一个无鉴权的写端点
 * 等于把配置暴露给局域网。密钥每次进程启动随机生成，只经**页面注入**到达浏览器，
 * 而页面本身在应用自己的 token 网关之后。
 */
export function registerConfigRoute(ctx, { token, rowConfig = {}, onSaved } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token) return

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
