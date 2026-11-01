import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { EmptyState, PanelIcon, TechnicalDetails } from './panel-elements.jsx'
import { levelLabels, logFacts, logReason, logTime, logTitle, logTone, matchesLog, mechanismLabels } from './log-presentation.mjs'

function LogDetail({ entry }) {
  const facts = logFacts(entry)
  return <section className="pw-log-detail" aria-label="所选日志详情" id="pw-log-detail">
    <h3>{logTitle(entry)}</h3><p className="pw-muted">{mechanismLabels[entry.mechanism] ?? entry.mechanism} · {levelLabels[entry.level] ?? entry.level} · {logTime(entry.at)}</p>
    <p className="pw-log-reason">{logReason(entry)}</p>
    {facts.length > 0 && <dl className="pw-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="pw-mono">{value}</dd></div>)}</dl>}
    <TechnicalDetails title="关联指纹与原始元数据"><dl className="pw-facts"><div><dt>宿主序号</dt><dd>{entry.seq == null ? '内存记录' : entry.seq}</dd></div><div><dt>原因码</dt><dd>{entry.reason}</dd></div>{Object.entries({ callIdHash: '调用指纹', rootCallIdHash: '根调用指纹', commandHash: '命令指纹', source: '原文 SHA256', handle: '归档句柄' }).filter(([key]) => entry[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{entry[key]}</dd></div>)}</dl><pre>{JSON.stringify(entry, null, 2)}</pre></TechnicalDetails>
  </section>
}

export function LogPanel({ diagnostics, exportLogs, connected }) {
  const [mechanism, setMechanism] = useState('all')
  const [level, setLevel] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState('')
  const [exporting, setExporting] = useState(false)
  const entries = diagnostics?.entries ?? []
  // Memory-only records have no native seq. Match the record itself so a newly
  // inserted entry does not move the selection to a different record.
  const occurrences = new Map()
  const visible = entries.map(entry => {
    const identity = entry.seq != null ? `seq-${entry.seq}` : JSON.stringify(entry)
    const occurrence = occurrences.get(identity) ?? 0
    occurrences.set(identity, occurrence + 1)
    return { entry, id: identity + '-' + occurrence }
  }).filter(({ entry }) => matchesLog(entry, { mechanism, level, query }))
  const selected = visible.find(row => row.id === selectedId) ?? visible[0]
  const persistence = diagnostics?.persistence
  const native = persistence === 'native'
  async function download() {
    setExporting(true); setMessage('')
    try {
      const data = await exportLogs()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = 'patchwork-diagnostics.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('已导出当前会话的诊断元数据。')
    } catch { setMessage('导出失败或授权已撤销，请刷新后重试。') }
    finally { setExporting(false) }
  }
  return <>
    <div className="pw-page-heading pw-heading-actions"><div><h2>运行日志</h2><p>查看机制决策，定位执行中的问题。</p></div><Button size="sm" variant="outline" icon={<PanelIcon name="download"/>} aria-label="导出诊断元数据" disabled={!connected || exporting} onClick={download}>{exporting ? '导出中…' : '导出'}</Button></div>
    <section className="pw-card pw-log-controls" aria-label="日志筛选"><div className="pw-search"><PanelIcon name="search"/><input type="search" aria-label="搜索日志" placeholder="搜索事件、原因或指纹" value={query} onChange={event => setQuery(event.target.value)}/></div>
    <div className="pw-toolbar"><select className="pw-input pw-select" aria-label="日志级别" value={level} onChange={event => setLevel(event.target.value)}><option value="all">全部级别</option>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="pw-input pw-select" aria-label="日志机制" value={mechanism} onChange={event => setMechanism(event.target.value)}><option value="all">全部机制</option>{Object.entries(mechanismLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></section>
    <section className="pw-card" aria-label="日志列表"><div className="pw-list-meta"><span>{visible.length} 条记录{visible.length !== entries.length ? ` / 共 ${entries.length} 条` : ''}</span><span className="pw-storage"><span className="pw-dot" data-tone={native ? 'success' : 'warn'}/>{native ? '已写入会话' : persistence === 'failed' ? '写入失败 · 内存保留' : '仅本次运行'}</span></div>
    <div className="pw-log-list" aria-label="日志记录">{visible.length ? visible.map(({ entry, id }) => <button type="button" className="pw-log-row" aria-pressed={selected.id === id} aria-controls="pw-log-detail" onClick={() => setSelectedId(id)} key={id}><time dateTime={entry.at}>{logTime(entry.at)}</time><span className="pw-log-level" data-tone={logTone(entry)}>{String(entry.level ?? '未知').toUpperCase()}</span><span>{logTitle(entry)}</span></button>) : <EmptyState title={entries.length ? '没有匹配的记录' : '还没有运行记录'}>{entries.length ? '试试其他机制、级别或搜索关键词。' : '执行任务后，机制决策会显示在这里。'}</EmptyState>}</div></section>
    {selected && <LogDetail entry={selected.entry}/>}
    {message && <p className="pw-live-note" role="status">{message}</p>}
    {diagnostics?.failures > 0 && <p className="pw-warning" role="status">原生写入失败 {diagnostics.failures} 次，未写入的记录仅保留在本次运行中。</p>}
    <TechnicalDetails title="记录范围与隐私"><p>最多显示最近 {diagnostics?.limit ?? 200} 条。首次恢复检查尾部 {diagnostics?.historyScanLimit ?? 5000} 个宿主事件，较早记录可能不出现在此列表。</p><p>{native ? '诊断保存于 DSH 原生会话。' : persistence === 'failed' ? '原生写入失败，目前使用有界内存记录。' : '当前宿主未提供可用的原生插件记录，重启后内存记录不可恢复。'}导出范围与预览一致，不受当前筛选影响。</p><p>只记录白名单元数据；命令与调用 ID 使用 SHA256 指纹。不包含提示词或原文证据，完整原文仍由证据归档保留。</p></TechnicalDetails>
  </>
}
