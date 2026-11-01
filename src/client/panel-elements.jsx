import { createElement } from 'react'
import { icons } from './panel-icons.mjs'

export function PanelIcon({ name, className = '', ...props }) {
  return <svg className={`pw-icon ${className}`} width="16" height="16" viewBox="0 0 512 512" fill="currentColor" stroke="none" aria-hidden="true" {...props}>{(icons[name] ?? icons.activity).map(([tag, attributes], index) => createElement(tag, { ...attributes, key: index }))}</svg>
}
export function EmptyState({ title, children, icon = 'activity' }) {
  return <div className="pw-empty"><PanelIcon name={icon}/><h3>{title}</h3><div>{children}</div></div>
}
export function SectionHeading({ title, description, children }) {
  return <div className="pw-section-heading"><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{children}</div>
}
export function TechnicalDetails({ children, title = '技术字段', open }) {
  return <details className="pw-technical" open={open}><summary><PanelIcon name="chevron" className="pw-event-chevron"/>{title}</summary>{children}</details>
}
