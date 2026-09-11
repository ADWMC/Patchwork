import assert from 'node:assert/strict'
import test from 'node:test'
import { record, reset, snapshot } from '../src/ui/mechanism-stats.mjs'
import { INJECTION_GLOBAL, registerStatsInjection } from '../src/ui/stats-injection.mjs'

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
  registerStatsInjection(ctx, { actionFusion: true, observationPack: true, cacheWriteReadRatio: 12.5 })

  assert.equal(taps.length, 1, 'the plugin must register exactly one index tap')
  const html = taps[0]('<html><head><title>t</title></head><body>x</body></html>')

  assert.match(html, new RegExp(`window\\.${INJECTION_GLOBAL}=`))
  assert.ok(html.indexOf('</head>') > html.indexOf(INJECTION_GLOBAL), 'the script must land inside head')
  assert.match(html, /"actionFusion":true/)
  assert.match(html, /"evidencePreservingReducer":false/, 'a mechanism that is off must read as off')
  assert.match(html, /"cacheWriteReadRatio":12\.5/)
  assert.match(html, /"observationPack":\{"packedResults":1\}/)
  reset()
})

test('injected JSON cannot close the script tag early', () => {
  reset()
  const { ctx, taps } = fakeCtx()
  registerStatsInjection(ctx, {})
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
