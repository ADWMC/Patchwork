import assert from 'node:assert/strict'
import test from 'node:test'
import { record, reset, snapshot } from '../src/ui/mechanism-stats.mjs'
import { registerStatsInjection, STATS_ELEMENT_ATTRIBUTE } from '../src/ui/stats-injection.mjs'

function fakeCtx() {
  const taps = []
  return {
    taps,
    ctx: {
      get(name) {
        if (name !== 'webServer') return undefined
        return {
          tapIndex(transform) {
            taps.push(transform)
            return () => {}
          },
        }
      },
    },
  }
}

test('counters accumulate per mechanism and per field', () => {
  reset()
  record('observationPack', 'packedResults')
  record('observationPack', 'packedBytes', 20480)
  record('observationPack', 'packedBytes', 1024)
  record('actionFusion', 'fusedCalls')

  assert.deepEqual(snapshot(), {
    observationPack: { packedResults: 1, packedBytes: 21504 },
    actionFusion: { fusedCalls: 1 },
  })

  // 零与非法值不该产生噪音条目
  record('onlineContextCompact', 'compactions', 0)
  record('onlineContextCompact', 'compactions', Number.NaN)
  assert.equal(snapshot().onlineContextCompact, undefined)
  reset()
})

test('the host injects config and counters into the page instead of opening a route', () => {
  reset()
  record('observationPack', 'packedResults')
  const { ctx, taps } = fakeCtx()
  const config = { actionFusion: true, observationPack: true, cacheWriteReadRatio: 12.5 }
  registerStatsInjection(ctx, { readConfig: () => config, token: 'write-token' })

  assert.equal(taps.length, 1, 'the plugin must register exactly one index tap')
  const html = taps[0]('<html><head><title>t</title></head><body>x</body></html>')

  // 注入的是 data 元素而不是可执行脚本：多个实例自然累积，也没有覆盖竞态。
  assert.match(html, new RegExp(`<script type="application/json" ${STATS_ELEMENT_ATTRIBUTE}>`))
  assert.ok(html.indexOf('</head>') > html.indexOf(STATS_ELEMENT_ATTRIBUTE), 'the data element must land inside head')
  assert.match(html, /"actionFusion":true/)
  assert.match(html, /"evidencePreservingReducer":false/, 'a mechanism that is off must read as off')
  assert.match(html, /"cacheWriteReadRatio":12\.5/)
  assert.match(html, /"observationPack":\{"packedResults":1\}/)
  // 维护提醒计数与机制计数器同源注入，供面板第三屏展示。
  assert.match(html, /"maintenance":\{\}/)
  // 写入口与密钥随页面一起下发，面板保存时要用。
  assert.match(html, /"writePath":"\/api\/patchwork\/config"/)
  assert.match(html, /"token":"write-token"/)
  reset()
})

test('the injected config is read fresh on every render, so a save shows without a restart', () => {
  reset()
  const { ctx, taps } = fakeCtx()
  let current = { actionFusion: false }
  registerStatsInjection(ctx, { readConfig: () => current })
  const html = () => taps[0]('<head></head>')

  assert.match(html(), /"actionFusion":false/)
  current = { actionFusion: true }
  assert.match(html(), /"actionFusion":true/)
  reset()
})

test('injected JSON cannot close the script tag early', () => {
  reset()
  const { ctx, taps } = fakeCtx()
  registerStatsInjection(ctx, { readConfig: () => ({}) })
  // 计数器字段来自机制内部，仍按「不可信」处理：`<` 必须被转义。
  record('weird', '</script><script>alert(1)</script>', 1)
  const html = taps[0]('<head></head>')
  assert.doesNotMatch(html, /<\/script><script>alert\(1\)/, 'no raw closing script may appear')
  // 只转义 `<`，因此 `<` 变成 \u003c 而 `>` 保持原样。
  assert.match(html, /\\u003c\/script>/)
  reset()
})

test('without a webserver the injection is a silent no-op', () => {
  assert.doesNotThrow(() => registerStatsInjection({ get: () => undefined }, {}))
  assert.doesNotThrow(() => registerStatsInjection({}, {}))
  assert.doesNotThrow(() => registerStatsInjection(undefined, {}))
})
