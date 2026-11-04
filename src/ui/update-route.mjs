import { nativeFetch } from '../retrieval/http-client.mjs'
import { webRuntime } from './web-runtime.mjs'
import { isNewer, packageVersion, releaseApiUrl, repositoryUrl } from '../util/version.mjs'

export const UPDATE_ROUTE_PATH = '/api/plugins/patchwork-coding-agent/update-check'
const routeKey = `exact\u0000${UPDATE_ROUTE_PATH}`

/** 测试用：清空进程级注册表，让每个测试从干净状态开始。 */
export function resetUpdateRouteRegistry() {
  webRuntime.routes.delete(routeKey)
}

/**
 * Check the published GitHub Release for a newer version.
 *
 * The check is explicit and bounded: the UI calls it from a button, the request
 * is a single GET to `releases/latest`, and redirects stay manual. It never
 * runs on page load and never sends credentials or session state.
 */
export async function checkForUpdate({ fetchImpl = nativeFetch, now = () => new Date().toISOString() } = {}) {
  const feed = releaseApiUrl(repositoryUrl)
  if (!feed) return { ok: true, supported: false, current: packageVersion, reason: 'release-feed-unavailable' }
  const response = await fetchImpl(feed, {
    redirect: 'manual',
    timeoutMs: 8000,
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': `Patchwork-update-check/${packageVersion}`,
    },
  })
  const text = await response.text()
  if (!response.ok) return { ok: false, supported: true, current: packageVersion, reason: `update-check-http-${response.status}` }
  let payload
  try { payload = JSON.parse(text) } catch { return { ok: false, supported: true, current: packageVersion, reason: 'update-check-invalid-json' } }
  const latest = String(payload.tag_name ?? '').replace(/^v/, '')
  if (!latest) return { ok: false, supported: true, current: packageVersion, reason: 'update-check-missing-tag' }
  return {
    ok: true,
    supported: true,
    current: packageVersion,
    latest,
    updateAvailable: isNewer(latest, packageVersion),
    url: typeof payload.html_url === 'string' ? payload.html_url : null,
    publishedAt: typeof payload.published_at === 'string' ? payload.published_at : null,
    checkedAt: now(),
  }
}

export function registerUpdateRoute(ctx, { token } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.register || !token || webRuntime.routes.has(routeKey)) return
  webRuntime.routes.add(routeKey)

  const register = () => {
    const dispose = server.register({
      kind: 'exact',
      path: UPDATE_ROUTE_PATH,
      handler: async (req, res) => {
        const reply = (status, payload) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(payload))
        }
        if (req.method !== 'POST') return reply(405, { ok: false, reason: 'method-not-allowed' })
        if (req.headers['x-patchwork-token'] !== token) return reply(403, { ok: false, reason: 'forbidden' })
        try {
          const result = await checkForUpdate()
          return reply(200, result)
        } catch (error) {
          // A failed upstream check is an ordinary result, not an HTTP failure:
          // the panel should explain it without tripping response monitoring.
          return reply(200, { ok: false, supported: true, current: packageVersion, reason: error instanceof Error ? error.message : String(error) })
        }
      },
    })
    return () => { dispose?.(); webRuntime.routes.delete(routeKey) }
  }
  if (ctx.effect) ctx.effect(register, 'patchwork: update check endpoint')
  else return register()
}
