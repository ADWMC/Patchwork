import { snapshot } from './mechanism-stats.mjs'

export const STATS_ELEMENT_ATTRIBUTE = 'data-patchwork-stats'

/**
 * 把配置与机制计数注入页面本身，而不是新开一个 HTTP 端点。
 *
 * 为什么不加路由：这个 profile 的 webserver 绑在 `0.0.0.0`，一个无鉴权的
 * `/api/...` 端点会暴露到局域网；而页面本身已经在 token 网关之后。注入的数据
 * 只有开关状态与计数，不含任何凭据。
 *
 * 注入的是**页面加载时**的快照；页面刷新即刷新。这是刻意的取舍：避免为了
 * 实时性去开一条新的、需要自己鉴权的通道。
 */
export function registerStatsInjection(ctx, config = {}) {
  const server = ctx?.get?.('webServer')
  if (!server?.tapIndex) return

  const payload = () => ({
    config: {
      actionFusion: config.actionFusion === true,
      observationPack: config.observationPack === true,
      evidencePreservingReducer: config.evidencePreservingReducer === true,
      onlineContextCompact: config.onlineContextCompact === true,
      cacheWriteReadRatio: config.cacheWriteReadRatio ?? null,
      reducerProvider: config.reducerProvider ?? null,
      reducerModel: config.reducerModel ?? null,
    },
    counters: snapshot(),
    generatedAt: new Date().toISOString(),
  })

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
