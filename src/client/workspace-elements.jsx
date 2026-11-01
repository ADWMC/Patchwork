import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Input } from './controls.jsx'
import { PanelIcon } from './panel-elements.jsx'

export function SearchField({ label, value, onChange, placeholder = '搜索', ...props }) {
  return <div className="pw-search"><PanelIcon name="search"/><Input type="search" aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} {...props}/></div>
}
export function Facets({ label, value, onChange, items }) {
  return <div className="pw-facets" role="group" aria-label={label}>{items.map(item => <Button size="sm" variant="ghost" key={item.value} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{item.label}{item.count != null && <span className="pw-facet-count">{item.count}</span>}</Button>)}</div>
}
export function SummaryStrip({ label, items }) {
  return <dl className="pw-summary-strip" aria-label={label}>{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd data-tone={item.tone}>{item.value ?? '未测量'}</dd></div>)}</dl>
}
export function CopyButton({ value, label = '复制' }) {
  const [message, setMessage] = useState('')
  return <span className="pw-copy-action"><Button size="sm" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(value); setMessage('已复制') } catch { setMessage('复制不可用，请手动选择文本') } }}>{label}</Button>{message && <span role="status" className="pw-muted">{message}</span>}</span>
}
export function RecordStatus({ children, tone }) { return <span className="pw-record-status" data-tone={tone}><span className="pw-dot" data-tone={tone}/>{children}</span> }
