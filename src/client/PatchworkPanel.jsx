import { createElement, useEffect, useState } from 'react'

/**
 * 三屏看板：实测节省 → 配置 → 维护提醒。
 *
 * 第一屏回答产品价值的问题「它到底省了什么」：只放本次运行**实测**的计数，不放
 * 反事实预估；第二屏是配置（暂存 → 保存两步，机制行为重启才变）；第三屏是结构
 * Hook 给出的维护提醒次数（内容只进会话上下文，这里只留一个可数的事实）。
 *
 * 样式只用产品自己的设计 token（`--dsw-*`）。
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
  title: { fontSize: '13px', fontWeight: 600 },
  subtitle: { color: 'var(--dsw-alias-label-tertiary)', marginBottom: '14px' },
  section: { margin: '0 0 6px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--dsw-alias-label-tertiary)' },
  card: {
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '8px',
    padding: '2px 10px',
    marginBottom: '14px',
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
  empty: { color: 'var(--dsw-alias-label-tertiary)', padding: '10px 0' },

  // 第一屏的主数字：大字号，回答「省了多少」。
  hero: { fontSize: '22px', fontWeight: 700, lineHeight: 1.2, color: 'var(--dsw-alias-label-primary)' },
  heroHint: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', marginTop: '2px' },

  // 开关：轨道 + 圆钮，用状态色与边框 token。
  switchTrack: enabled => ({
    width: '32px',
    height: '18px',
    borderRadius: '9px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: enabled ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-bg-layer-2)',
    position: 'relative',
    cursor: 'pointer',
    padding: 0,
    flex: '0 0 auto',
  }),
  switchKnob: enabled => ({
    position: 'absolute',
    top: '1px',
    left: enabled ? '15px' : '1px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: 'var(--dsw-alias-label-primary-inverted)',
    transition: 'left 120ms ease',
  }),
  input: {
    width: '68px',
    textAlign: 'right',
    fontFamily: 'var(--dsw-font-markdown-code-font-family)',
    color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-specific-input-major)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '6px',
    padding: '2px 6px',
    outline: 'none',
  },
  inputInvalid: { borderColor: 'var(--dsw-alias-state-error-primary)' },
  actions: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' },
  button: disabled => ({
    fontFamily: 'var(--dsw-font-family)',
    fontSize: '12px',
    padding: '3px 12px',
    borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: disabled ? 'var(--dsw-alias-bg-layer-2)' : 'var(--dsw-alias-button-primary-fill)',
    color: disabled ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-label-primary-inverted)',
    cursor: disabled ? 'default' : 'pointer',
  }),
  badge: { color: 'var(--dsw-alias-state-warn-primary)' },
  ok: { color: 'var(--dsw-alias-state-success-primary)' },
  error: { color: 'var(--dsw-alias-state-error-primary)' },
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

/**
 * 把多次加载推入的条目聚合成一份数据。
 * 开关取「任一实例开启即为开启」，计数求和；写入口与密钥取最后一个非空值。
 */
function collect(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (list.length === 0) return undefined

  const config = {}
  const counters = {}
  const maintenance = {}
  let writePath
  let token
  for (const entry of list) {
    for (const [key, value] of Object.entries(entry?.config ?? {})) {
      if (typeof value === 'boolean') config[key] = config[key] === true || value === true
      else if (!(key in config)) config[key] = value
    }
    for (const [mechanism, fields] of Object.entries(entry?.counters ?? {})) {
      if (mechanism === 'maintenance') continue
      if (!counters[mechanism]) counters[mechanism] = {}
      for (const [field, value] of Object.entries(fields)) {
        counters[mechanism][field] = (counters[mechanism][field] ?? 0) + value
      }
    }
    for (const [field, value] of Object.entries(entry?.maintenance ?? {})) {
      maintenance[field] = (maintenance[field] ?? 0) + value
    }
    if (entry?.writePath) writePath = entry.writePath
    if (entry?.token) token = entry.token
  }
  return { config, counters, maintenance, writePath, token }
}

function bytesText(value) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1024 / 1024).toFixed(1)} MiB`
}

/**
 * 第一屏：本次实测节省。数字全部来自机制真正动手时记下的计数，
 * 不放反事实预估——「省了多少」必须是可复核的事实。
 */
function renderStatsPower(counters) {
  const af = counters.actionFusion ?? {}
  const op = counters.observationPack ?? {}
  const epr = counters.evidencePreservingReducer ?? {}
  const occ = counters.onlineContextCompact ?? {}
  const savedRequests = af.savedRequests ?? 0

  const contributions = []
  if ((af.fusedCalls ?? 0) > 0) contributions.push(['Action Fusion', `${af.fusedCalls} 次读写+验证合并为一次调用`])
  if ((op.packedResults ?? 0) > 0) {
    const archived = bytesText(op.packedBytes)
    contributions.push(['ObservationPack', `${op.packedResults} 个大结果换成句柄${archived ? ` · 归档 ${archived}` : ''}`])
  }
  if ((epr.receipts ?? 0) > 0) {
    const reduced = bytesText(epr.reducedBytes)
    contributions.push(['Evidence-Preserving Reducer', `${epr.receipts} 份诊断收据${reduced ? ` · 压缩 ${reduced}` : ''}`])
  }
  if ((occ.compactions ?? 0) > 0) contributions.push(['Online Context Compact', `${occ.compactions} 次上下文压缩`])

  return createElement(
    'div',
    { style: styles.card },
    createElement(
      'div',
      { style: { ...styles.row, ...styles.rowLast } },
      createElement(
        'span',
        null,
        createElement('div', { style: styles.hero }, savedRequests > 0 ? `省去 ${savedRequests} 次模型请求` : '还没省下请求'),
        createElement('div', { style: styles.heroHint }, '本会话实测计数，不是预估；长任务进行中看这里'),
      ),
    ),
    contributions.length === 0
      ? createElement('div', { style: styles.empty }, '还没有机制动手。保存配置并继续跑任务，这里会显示实际省下的请求与归档量。')
      : contributions.map(([name, text], index) =>
          createElement(
            'div',
            { key: name, style: index === contributions.length - 1 ? { ...styles.row, ...styles.rowLast } : styles.row },
            createElement('span', { style: styles.label }, name),
            createElement('span', { style: styles.hint }, text),
          ),
        ),
  )
}

/**
 * 第三屏：维护提醒。内容只进会话上下文（模型可见、可从日志重建），
 * 这里只留一个可数的事实：它提醒过几次。
 */
function renderMaintenance(maintenance) {
  const count = maintenance.structureWarnings ?? 0
  return createElement(
    'div',
    { style: styles.card },
    createElement(
      'div',
      { style: { ...styles.row, ...styles.rowLast } },
      createElement('span', null, createElement('div', { style: styles.label }, '结构维护提醒')),
      createElement('span', { style: styles.mono }, `${count} 次`),
    ),
    createElement(
      'div',
      { style: { ...styles.hint, paddingBottom: '8px' } },
      '修正结构或命名问题时 Hook 给的提醒次数；提醒内容进入该次会话上下文，不在此落盘。',
    ),
  )
}

export function PatchworkTitle() {
  return createElement('span', null, 'Patchwork')
}

export function PatchworkPanel() {
  const [data, setData] = useState(() => collect(readInjected))
  // 暂存区：用户改过但还没保存的值。与 data 分开，免得每秒重读把编辑冲掉。
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState(null)

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

  const baseline = data.config ?? {}
  const value = key => (draft && key in draft ? draft[key] : baseline[key])
  const dirty = Boolean(draft) && Object.keys(draft).length > 0
  const ratio = value('cacheWriteReadRatio')
  const ratioInvalid = typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < 0

  const stage = (key, next) => setDraft(current => ({ ...(current ?? {}), [key]: next }))

  const save = async () => {
    if (!data.writePath || !data.token) {
      setStatus({ kind: 'error', text: '这个部署没有开放写入口。' })
      return
    }
    setStatus({ kind: 'saving', text: '保存中…' })
    try {
      const response = await fetch(data.writePath, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-patchwork-token': data.token },
        body: JSON.stringify(draft ?? {}),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.ok !== true) {
        setStatus({ kind: 'error', text: `保存失败：${payload.reason ?? response.status}` })
        return
      }
      setDraft(null)
      setStatus({ kind: 'ok', text: '已保存。机制行为需重启后生效。' })
      setData(current => (current ? { ...current, config: payload.config ?? current.config } : current))
    } catch (error) {
      setStatus({ kind: 'error', text: `保存失败：${String(error?.message ?? error)}` })
    }
  }

  const active = MECHANISMS.filter(([key]) => value(key) === true).length

  return createElement(
    'div',
    { style: styles.root },
    createElement('div', { style: styles.title }, 'Patchwork'),
    createElement('div', { style: styles.subtitle }, `${active} / ${MECHANISMS.length} 个机制已启用`),

    // 第一屏：本次实测节省
    createElement('div', { style: styles.section }, '本次实测节省'),
    renderStatsPower(data.counters, styles),

    // 第二屏：配置
    createElement('div', { style: styles.section }, '机制'),
    createElement(
      'div',
      { style: styles.card },
      ...MECHANISMS.map(([key, label, hint], index) =>
        createElement(
          'div',
          { key, style: index === MECHANISMS.length - 1 ? { ...styles.row, ...styles.rowLast } : styles.row },
          createElement(
            'span',
            null,
            createElement('div', { style: styles.label }, label),
            createElement('div', { style: styles.hint }, hint),
          ),
          createElement(
            'button',
            {
              type: 'button',
              role: 'switch',
              'aria-checked': value(key) === true,
              'aria-label': label,
              style: styles.switchTrack(value(key) === true),
              onClick: () => stage(key, value(key) !== true),
            },
            createElement('span', { style: styles.switchKnob(value(key) === true) }),
          ),
        ),
      ),
    ),

    createElement('div', { style: styles.section }, '压缩经济性'),
    createElement(
      'div',
      { style: styles.card },
      createElement(
        'div',
        { style: { ...styles.row, ...styles.rowLast } },
        createElement(
          'span',
          null,
          createElement('div', { style: styles.label }, '缓存写读比'),
          createElement('div', { style: styles.hint }, '写入相对读取的额外代价；越高越不轻易压缩'),
        ),
        createElement('input', {
          type: 'number',
          min: '0',
          step: '0.5',
          'aria-label': '缓存写读比',
          value: ratio === null || ratio === undefined ? '' : String(ratio),
          onChange: event => {
            const text = event.target.value
            stage('cacheWriteReadRatio', text === '' ? null : Number(text))
          },
          style: ratioInvalid ? { ...styles.input, ...styles.inputInvalid } : styles.input,
        }),
      ),
    ),

    createElement(
      'div',
      { style: styles.actions },
      createElement(
        'button',
        { type: 'button', style: styles.button(!dirty || ratioInvalid), disabled: !dirty || ratioInvalid, onClick: save },
        '保存',
      ),
      dirty && !ratioInvalid ? createElement('span', { style: styles.badge }, '有未保存的改动') : null,
      status && !dirty ? createElement('span', { style: status.kind === 'error' ? styles.error : styles.ok }, status.text) : null,
    ),
    dirty ? null : createElement('div', { style: styles.hint }, '保存后刷新页面即见；机制行为需重启后生效。'),

    // 第三屏：维护提醒
    createElement('div', { style: { ...styles.section, marginTop: '16px' } }, '维护提醒'),
    renderMaintenance(data.maintenance),
  )
}