import { forwardRef, useEffect, useState } from 'react'
import { Button as HostButton, Input as HostInput, Menu, Switch as HostSwitch, Tooltip, DisclosureRow } from '@deepseek-ai/dsh-client-ui-primitives'

// Host controls own their appearance; these adapters only supply browser defaults.
export const Button = forwardRef(function Button({ title, size = 'sm', variant = 'ghost', ...props }, ref) {
  const button = ref ? <HostButton ref={ref} size={size} variant={variant} {...props}/> : <HostButton size={size} variant={variant} {...props}/>
  return title ? <Tooltip label={title} side="bottom" portal delayMs={350}>{button}</Tooltip> : button
})
export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <HostInput ref={ref} className={`pw-browser-input ${className}`} {...props}/>
})
export { Menu, Tooltip }

export const TextArea = forwardRef(function TextArea({ className = '', ...props }, ref) {
  // DSH's InlineEditor saves on Enter; annotation notes must keep ordinary multiline editing.
  return <textarea ref={ref} className={`pw-browser-field-textarea ${className}`} {...props}/>
})

export function Toggle({ label, className = '', ...props }) {
  return <div className={`pw-browser-switch-row ${className}`}><span>{label}</span><HostSwitch label={label} {...props}/></div>
}

export function Select({ value, options, onChange, disabled = false, 'aria-label': label, className = '' }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  const selected = options.find(option => String(option.value) === String(value))
  return <Menu className={`pw-browser-select ${className}`} listClassName="pw-browser-select-menu" compact portal autoFocus
    open={open && !disabled} selectedId={String(value)} onClose={() => setOpen(false)}
    items={options.map(option => ({ id: String(option.value), label: option.label, disabled: option.disabled }))}
    onSelect={next => { setOpen(false); onChange(next) }}
    anchor={<Button variant="outline" className="pw-browser-select-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open && !disabled} disabled={disabled}
      onClick={() => setOpen(previous => !previous)} onKeyDown={event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true) } }}>
      <span>{selected?.label ?? '请选择'}</span><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
    </Button>}/>
}

export function Disclosure({ title, open, onToggle, children, className = '', count }) {
  return <DisclosureRow className={className} rowClassName="pw-browser-disclosure-heading" title={title} open={open} onToggle={onToggle} expandable expandOnRowClick
    icon={<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" aria-hidden="true"><path d="m5 3 5 5-5 5"/></svg>}
    keepContentWhenOpen collapsedContent={count ? <span className="pw-browser-disclosure-count">{count}</span> : undefined}>{children}</DisclosureRow>
}
