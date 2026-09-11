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
}

function readInjected() {
  if (typeof window === 'undefined') return undefined
  return window[INJECTION_GLOBAL]
}

export function PatchworkTitle() {
  return createElement('span', null, 'Patchwork')
}

export function PatchworkPanel() {
  const [data, setData] = useState(readInjected)

  // 注入的是页面加载时的快照；若本组件挂载早于脚本执行，再取一次。
  useEffect(() => {
    if (!data) setData(readInjected())
  }, [data])

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
