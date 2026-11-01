import { useEffect, useState } from 'react'
import { Button, Input, Menu, DisclosureRow } from '@deepseek-ai/dsh-client-ui-primitives'
export { Input }
export function Select({ value, options, onChange, disabled = false, 'aria-label': label }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  return <Menu compact portal autoFocus open={open && !disabled} selectedId={String(value)} onClose={() => setOpen(false)}
    items={options.map(option => ({ id: String(option.value), label: option.label }))} onSelect={value => { setOpen(false); onChange(value) }}
    anchor={<Button size="sm" variant="outline" aria-label={label} aria-haspopup="menu" aria-expanded={open && !disabled} disabled={disabled} onClick={() => setOpen(previous => !previous)} onKeyDown={event => { if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setOpen(true) } }}>{options.find(option => String(option.value) === String(value))?.label ?? '请选择'}</Button>}/>
}
export function Disclosure({ title, children, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen)
  const icon = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  return <DisclosureRow className="pw-technical" icon={icon} title={title} open={open} onToggle={() => setOpen(value => !value)} expandable expandOnRowClick keepContentWhenOpen>{children}</DisclosureRow>
}
