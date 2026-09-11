import { createElement, useEffect, useState } from 'react'

/**
 * 看板与配置面板。
 *
 * 样式只用产品自己的设计 token（`--dsw-*`），不写死颜色：写死就会在浅色/深色主题
 * 之间脱节，这正是上一版「跟 DSH 设计不匹配」的原因。
 */
const STATS_SELECTOR = 'script[data-patchwork-stats]'

const MECHANISMS = [
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
}

const styles = {
  root: {
    padding: '12px 14px 20px',
    fontFamily: 'var(--dsw-font-family)',
    fontSize: '12px',
    lineHeight: 1.6,
    color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-base)',
    height: '100%',
    overflowY: 'auto',
  },
  title: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
  subtitle: { color: 'var(--dsw-alias-label-tertiary)', marginBottom: '14px' },
  section: {
    margin: '0 0 6px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: 'var(--dsw-alias-label-tertiary)',
  },
  card: {
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '8px',
    padding: '2px 10px',
    marginBottom: '16px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '7px 0',
    borderBottom: '1px solid var(--dsw-alias-border-l1)',
  },
  rowLast: { borderBottom: 'none' },
  label: { color: 'var(--dsw-alias-label-primary)' },
  hint: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '11px' },
  mono: { fontFamily: 'var(--dsw-font-markdown-code-font-family)', color: 'var(--dsw-alias-label-secondary)' },
  on: { color: 'var(--dsw-alias-state-success-primary)', fontWeight: 600 },
  off: { color: 'var(--dsw-alias-label-tertiary)' },
  empty: { color: 'var(--dsw-alias-label-tertiary)', padding: '10px 0' },
}

/**
 * 把每次插件加载推入的条目聚合成一份数据。
 *
 * 一个部署里插件可能被挂载多次（实测 Web profile 同进程加载过两次），其中一次
 * 可能拿不到配置。开关取「任一实例开启即为开启」，计数求和。
 */
function collect(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (list.length === 0) return undefined

  const config = {}
  const counters = {}
  for (const entry of list) {
    for (const [key, value] of Object.entries(entry?.config ?? {})) {
      if (typeof value === 'boolean') config[key] = config[key] === true || value === true
      else if (!(key in config)) config[key] = value
    }
    for (const [mechanism, fields] of Object.entries(entry?.counters ?? {})) {
      if (!counters[mechanism]) counters[mechanism] = {}
      for (const [field, value] of Object.entries(fields)) {
        counters[mechanism][field] = (counters[mechanism][field] ?? 0) + value
      }
    }
  }
  return { config, counters }
}

/**
 * 从注入的 data 元素里读，而不是读全局变量。
 *
 * 全局变量有竞态：后来的实例会覆盖先写的，组件挂载与脚本执行的先后也不保证。
 * DOM 元素按加载次数累积，面板每次重读都拿到完整的集合。
 */
function readInjected() {
  if (typeof document === 'undefined') return []
  const entries = []
  for (const node of document.querySelectorAll(STATS_SELECTOR)) {
    try {
      entries.push(JSON.parse(node.textContent))
    } catch {
      // 单个元素损坏不应让整块看板失去数据
    }
  }
  return entries
}

export function PatchworkTitle() {
  return createElement('span', null, 'Patchwork')
}

export function PatchworkPanel() {
  const [data, setData] = useState(() => collect(readInjected))

  useEffect(() => {
    const timer = setInterval(() => setData(collect(readInjected)), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!data) {
    return createElement(
      'div',
      { style: styles.root },
      createElement('div', { style: styles.title }, 'Patchwork'),
      createElement('div', { style: styles.subtitle }, '正在等待宿主数据…'),
    )
  }

  const active = MECHANISMS.filter(([key]) => data.config?.[key] === true).length

  return createElement(
    'div',
    { style: styles.root },
    createElement('div', { style: styles.title }, 'Patchwork'),
    createElement('div', { style: styles.subtitle }, `${active} / ${MECHANISMS.length} 个机制已启用`),

    createElement('div', { style: styles.section }, '机制'),
    createElement(
      'div',
      { style: styles.card },
      ...MECHANISMS.map(([key, label, hint], index) => {
        const enabled = data.config?.[key] === true
        return createElement(
          'div',
          { key, style: index === MECHANISMS.length - 1 ? { ...styles.row, ...styles.rowLast } : styles.row },
          createElement(
            'span',
            null,
            createElement('div', { style: styles.label }, label),
            createElement('div', { style: styles.hint }, hint),
          ),
          createElement('span', { style: enabled ? styles.on : styles.off }, enabled ? '已启用' : '未启用'),
        )
      }),
    ),

    createElement('div', { style: styles.section }, '本次运行的计量'),
    createElement('div', { style: styles.card }, renderCounters(data.counters)),
  )
}

function renderCounters(counters) {
  const entries = Object.entries(counters ?? {}).filter(([, fields]) => fields && Object.keys(fields).length > 0)
  if (entries.length === 0) {
    return createElement('div', { style: styles.empty }, '本次运行还没有机制动手。')
  }

  const rows = []
  for (const [mechanism, fields] of entries) {
    rows.push(createElement('div', { key: `${mechanism}-name`, style: { ...styles.label, paddingTop: '8px' } }, mechanism))
    for (const [field, value] of Object.entries(fields)) {
      rows.push(
        createElement(
          'div',
          { key: `${mechanism}-${field}`, style: styles.row },
          createElement('span', { style: styles.hint }, COUNTER_LABELS[field] ?? field),
          createElement('span', { style: styles.mono }, String(value)),
        ),
      )
    }
  }
  return rows
}
