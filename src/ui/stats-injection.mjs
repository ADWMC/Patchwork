import { snapshot } from './mechanism-stats.mjs'
import { CONFIG_ROUTE_PATH } from './config-route.mjs'

export const STATS_ELEMENT_ATTRIBUTE = 'data-patchwork-stats'

/**
 * 把配置、机制计数与写入密钥注入页面本身。
 *
 * 为什么注入而不是让面板去请求：页面本身已经在应用自己的 token 网关之后，注入
 * 天然继承了这层保护。写入口另有一条带共享密钥的 POST 路由（见 config-route）。
 *
 * `readConfig` 每次渲染都重新读：用户在侧边栏保存后刷新页面，看到的就是保存后的
 * 值，不必等重启。机制**行为**的变化仍需重启才能生效，面板会写明这一点。
 */
export function registerStatsInjection(ctx, { readConfig, token } = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.tapIndex || typeof readConfig !== 'function') return

  const payload = () => {
    const config = readConfig() ?? {}
    const counters = snapshot()
    return {
      config: {
        actionFusion: config.actionFusion === true,
        observationPack: config.observationPack === true,
        evidencePreservingReducer: config.evidencePreservingReducer === true,
        onlineContextCompact: config.onlineContextCompact === true,
        cacheWriteReadRatio: typeof config.cacheWriteReadRatio === 'number' ? config.cacheWriteReadRatio : null,
      },
      counters,
      // 维护提醒计数与机制计数器同源（进程内、不落盘）。
      maintenance: counters.maintenance ?? {},
      writePath: CONFIG_ROUTE_PATH,
      token: token ?? null,
      generatedAt: new Date().toISOString(),
    }
  }

  server.tapIndex(html => {
    let json
    try {
      json = JSON.stringify(payload())
    } catch {
      return html
    }
    // 转义 `<` 与行分隔符，避免 JSON 里的内容提前闭合脚本标签。
    const safe = json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
    // 用 data 元素而不是全局变量。全局会被后来的实例覆盖，而且「组件挂载」与
    // 「脚本执行」的先后顺序无法保证——实测两者都出过问题。DOM 元素按加载次数
    // 自然累积，面板只依赖解析顺序。
    const element = `<script type="application/json" ${STATS_ELEMENT_ATTRIBUTE}>${safe}</script>`
    const head = html.indexOf('</head>')
    return head < 0 ? `${element}${html}` : `${html.slice(0, head)}${element}${html.slice(head)}`
  })
}
