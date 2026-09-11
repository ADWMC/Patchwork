import { createElement, useEffect, useState } from 'react'

const INJECTION_GLOBAL = '__PATCHWORK__'

const SWITCHES = [
  ['actionFusion', 'Action Fusion', '改文件与验证命令合并为一次调用'],
  ['observationPack', 'ObservationPack', '大结果换成句柄，可按字节精确召回'],
  ['evidencePreservingReducer', 'Evidence-Preserving Reducer', '诊断日志压成收据（会调用模型）'],
  ['onlineContextCompact', 'Online Context Compact', '在子任务边界压缩并在新 turn 续跑'],
]

const COUNTER_LABELS = {
  fusedCalls: '合并的调用',
  savedRequests: '省去的请求',
  packedResults: '打包的结果',
  packedBytes: '归档字节',
  receipts: '收据',
  reducedBytes: '压缩掉的字节',
  compactions: '压缩次数',
  boundaries: '语义边界',
  fallbacks: '降级次数',
}

const styles = {
  root: { padding: '12px 14px', fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: '12px', lineHeight: 1.6 },
  h: { fontSize: '13px', fontWeight: 600, margin: '14px 0 6px' },
  h1: { fontSize: '14px', fontWeight: 700, margin: '0 0 4px' },
  sub: { opacity: 0.6, marginBottom: '10px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '3px 0' },
  name: { opacity: 0.9 },
  on: { color: '#2ea043', fontWeight: 600 },
  off: { opacity: 0.45 },
  box: { border: '1px solid rgba(128,128,128,0.28)', borderRadius: '6px', padding: '8px 10px', marginTop: '6px' },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px' },
  muted: { opacity: 0.55, marginTop: '12px' },
  warn: { color: '#d29922', marginTop: '6px' },
}

function readInjected() {
  if (typeof window === 'undefined') return undefined
  return window[INJECTION_GLOBAL]
}

/**
 * 把每次插件加载推入的条目聚合成看板的一份数据。
 *
 * 一个部署里插件可能被挂载多次（实测 Web profile 同进程加载过两次），其中一次
 * 可能拿不到 profile 补丁的配置。这里把开关取「任一实例开启即为开启」，并记录
 * 实例数与是否出现分歧——分歧本身是要报出来的事实，不该被静默合并。
 */
function collect(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (list.length === 0) return undefined

  const config = {}
  const counters = {}
  let inconsistent = false

  for (const entry of list) {
    for (const [key, value] of Object.entries(entry?.config ?? {})) {
      if (typeof value === 'boolean') {
        if (key in config && config[key] !== value) inconsistent = true
        config[key] = config[key] === true || value === true
      } else if (!(key in config)) {
        config[key] = value
      }
    }
    for (const [mechanism, fields] of Object.entries(entry?.counters ?? {})) {
      if (!counters[mechanism]) counters[mechanism] = {}
      for (const [field, value] of Object.entries(fields)) {
        counters[mechanism][field] = (counters[mechanism][field] ?? 0) + value
      }
    }
  }

  return { config, counters, instances: list.length, inconsistent, generatedAt: list[list.length - 1]?.generatedAt }
}

export function PatchworkTitle() {
  return createElement('span', null, 'Patchwork')
}

export function PatchworkPanel() {
  const [data, setData] = useState(() => collect(readInjected))

  // 页面里的注入脚本可能晚于本组件挂载，而且同一进程可能注入多条。轮询重读
  // 比依赖某一个时刻的挂载顺序可靠；看板本来就允许滞后一秒。
  useEffect(() => {
    const timer = setInterval(() => {
      const next = collect(readInjected)
      if (!next) return
      setData(previous =>
        !previous || previous.instances !== next.instances || previous.generatedAt !== next.generatedAt ? next : previous,
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!data) {
    return createElement(
      'div',
      { style: styles.root },
      createElement('div', { style: styles.h1 }, 'Patchwork'),
      createElement('div', { style: styles.sub }, '这一页没有拿到宿主注入的数据。刷新一次页面即可。'),
    )
  }

  const counters = data.counters ?? {}
  const active = Object.entries(counters).filter(([, value]) => value && Object.keys(value).length > 0)

  return createElement(
    'div',
    { style: styles.root },
    createElement('div', { style: styles.h1 }, 'Patchwork'),
    createElement('div', { style: styles.sub }, '机制配置与本次运行的实际计量'),

    createElement('div', { style: styles.h }, '配置'),
    createElement(
      'div',
      { style: styles.box },
      ...SWITCHES.map(([key, label, hint]) => {
        const on = data.config?.[key] === true
        return createElement(
          'div',
          { key, style: styles.row, title: hint },
          createElement('span', { style: styles.name }, label),
          createElement('span', { style: on ? styles.on : styles.off }, on ? '开' : '关'),
        )
      }),
      createElement(
        'div',
        { style: { ...styles.row, marginTop: '4px' } },
        createElement('span', { style: styles.name }, '缓存写读比'),
        createElement('span', { style: styles.mono }, String(data.config?.cacheWriteReadRatio ?? '—')),
      ),
    ),
    createElement('div', { style: styles.muted }, `插件加载实例：${data.instances}`),
    data.inconsistent
      ? createElement(
          'div',
          { style: styles.warn },
          '配置不一致：同一进程里有实例没有收到本 profile 的配置（开关取任一实例开启即为开启）。',
        )
      : null,

    createElement('div', { style: styles.h }, '实际计量'),
    active.length === 0
      ? createElement('div', { style: styles.box }, '本次运行还没有机制动手。')
      : createElement(
          'div',
          { style: styles.box },
          ...active.map(([mechanism, fields]) =>
            createElement(
              'div',
              { key: mechanism, style: { padding: '4px 0' } },
              createElement('div', { style: { fontWeight: 600 } }, mechanism),
              ...Object.entries(fields).map(([field, value]) =>
                createElement(
                  'div',
                  { key: field, style: styles.row },
                  createElement('span', { style: styles.name }, COUNTER_LABELS[field] ?? field),
                  createElement('span', { style: styles.mono }, String(value)),
                ),
              ),
            ),
          ),
        ),

    createElement('div', { style: styles.muted }, `数据快照：${data.generatedAt ?? '未知'}（刷新页面即刷新）`),
  )
}
