import { Button, TextArea, Disclosure } from './controls.jsx'
import { useEffect, useRef, useState } from 'react'
import { createElementInspector } from './element-inspector.mjs'

export function AnnotationOverlay({ enabled, passthrough, frame, items, onPick, onInspect }) {
  const [drag, setDrag] = useState(null)
  const [hover, setHover] = useState(null)
  const start = useRef(null)
  const selected = useRef(null), picker = useRef(null), inspect = useRef(onInspect)
  inspect.current = onInspect
  useEffect(() => {
    if (!enabled || passthrough) { setHover(null); return }
    const next = createElementInspector({ request: (point, signal) => inspect.current?.(point, signal), onChange: setHover })
    picker.current = next
    return () => { next.dispose(); if (picker.current === next) picker.current = null }
  }, [enabled, passthrough, frame.frameId, frame.tabId])
  const point = event => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: Math.floor(Math.max(0, Math.min(frame.width - 1, (event.clientX - box.left) * frame.width / box.width))), y: Math.floor(Math.max(0, Math.min(frame.height - 1, (event.clientY - box.top) * frame.height / box.height))) }
  }
  function down(event) {
    if (!enabled || passthrough || event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
    start.current = point(event); selected.current = hover
    picker.current?.clear()
  }
  function move(event) {
    if (!enabled || passthrough) return
    const end = point(event)
    if (!start.current) { picker.current?.inspect(end); return }
    if (Math.abs(end.x - start.current.x) < 6 && Math.abs(end.y - start.current.y) < 6) return
    setDrag({ x: Math.min(start.current.x, end.x), y: Math.min(start.current.y, end.y), width: Math.max(1, Math.abs(end.x - start.current.x)), height: Math.max(1, Math.abs(end.y - start.current.y)) })
  }
  function up(event) {
    if (!start.current) return
    event.preventDefault(); event.stopPropagation()
    const end = point(event), first = start.current
    start.current = null; setDrag(null)
    if (passthrough) return
    const region = Math.abs(end.x - first.x) >= 6 || Math.abs(end.y - first.y) >= 6
    const box = region ? { x: Math.min(first.x, end.x), y: Math.min(first.y, end.y), width: Math.max(1, Math.abs(end.x - first.x)), height: Math.max(1, Math.abs(end.y - first.y)) } : { x: end.x, y: end.y, width: 1, height: 1 }
    const targetId = !region && selected.current?.point.x === end.x && selected.current?.point.y === end.y ? selected.current.targetId : undefined
    selected.current = null
    void onPick({ kind: region ? 'region' : 'element', box, ...(targetId ? { targetId } : {}) })
  }
  useEffect(() => { start.current = null; setDrag(null) }, [frame.frameId, enabled, passthrough])
  const style = box => ({ left: `${box.x / frame.width * 100}%`, top: `${box.y / frame.height * 100}%`, width: `${box.width / frame.width * 100}%`, height: `${box.height / frame.height * 100}%` })
  const tooltipAbove = hover && hover.box.y > 42
  return <div className="pw-browser-annotation-layer" data-active={enabled && !passthrough} role="region" aria-label="页面标注层" tabIndex={enabled ? 0 : -1} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => picker.current?.clear()} onPointerCancel={() => { start.current = null; selected.current = null; setDrag(null); picker.current?.clear() }} onClick={event => event.stopPropagation()}>
    {items.map((item, index) => !item.stale && <div className="pw-browser-annotation-box" key={item.id} style={style(item.box)}><span>{index + 1}</span></div>)}
    {drag && <div className="pw-browser-annotation-box" data-dragging="true" style={style(drag)}/>}
    {hover && enabled && !passthrough && !drag && <>
      <div className="pw-browser-element-highlight" aria-hidden="true" style={style(hover.box)}><div style={{ top: `${hover.padding.top / hover.box.height * 100}%`, right: `${hover.padding.right / hover.box.width * 100}%`, bottom: `${hover.padding.bottom / hover.box.height * 100}%`, left: `${hover.padding.left / hover.box.width * 100}%` }}/></div>
      <div className="pw-browser-element-label" role="tooltip" aria-label="检查的页面元素" data-above={tooltipAbove} style={{ left: `${Math.min(hover.box.x / frame.width * 100, 65)}%`, maxWidth: `calc(${100 - Math.min(hover.box.x / frame.width * 100, 65)}% - 4px)`, top: `${(tooltipAbove ? hover.box.y : hover.box.y + Math.min(hover.box.height, 38)) / frame.height * 100}%` }}><code>{hover.selector}</code><span>{hover.size.width} × {hover.size.height}</span>{hover.frameBoundary && <small>iframe 边界</small>}</div>
    </>}
  </div>
}

export function AnnotationEditor({ items, busy, act, onSend, onContinue }) {
  const [notes, setNotes] = useState({}), [message, setMessage] = useState(''), [sending, setSending] = useState(false)
  const [open, setOpen] = useState(true)
  const [pendingDelivery, setPendingDelivery] = useState(null)
  const active = useRef(true), editor = useRef(null), previousIds = useRef(new Set())
  const itemIds = items.map(item => item.id).join(',')
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { if (itemIds) setOpen(true); setMessage('') }, [itemIds])
  useEffect(() => {
    const added = items.filter(item => !item.stale && !item.submitted && !previousIds.current.has(item.id))
    previousIds.current = new Set(items.map(item => item.id))
    if (added.length) {
      const index = items.indexOf(added.at(-1))
      const frame = requestAnimationFrame(() => editor.current?.querySelectorAll('textarea')[index]?.focus({ preventScroll: true }))
      return () => cancelAnimationFrame(frame)
    }
  }, [itemIds])
  useEffect(() => { setNotes(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => itemIds.split(',').includes(id)))) }, [itemIds])
  useEffect(() => { setPendingDelivery(previous => previous?.ids.some(id => !items.some(item => item.id === id && !item.stale)) ? null : previous) }, [items])
  if (!items.length) return null
  const drafts = items.filter(item => !item.stale && !item.submitted)
  const note = item => notes[item.id] ?? item.note
  async function submit(send) {
    setSending(true); setMessage('')
    try {
      let delivery = pendingDelivery
      if (!delivery) {
        const entries = drafts.map(item => ({ id: item.id, note: note(item) }))
        const result = await act('submitAnnotations', { entries })
        if (!result) return
        const feedback = result.annotations.filter(item => entries.some(entry => entry.id === item.id))
        delivery = { ids: feedback.map(item => item.id), text: `请根据这些浏览器标注处理当前页面。先用 patchwork_browser 的 annotations 读取说明，按需要用 annotationId 查看区域截图，再核对当前页面。\n${JSON.stringify(feedback.map(({ id, note }) => ({ id, note })))}` }
      }
      if (send) {
        if (active.current) setPendingDelivery(delivery)
        await onSend(delivery.text)
        if (active.current) setPendingDelivery(null)
      }
      if (active.current) setMessage(send ? '已发送到当前会话；浏览器保持用户接管，可在底栏恢复 Agent。' : '已提交，当前 Agent 可读取这些标注。')
    } catch (error) { if (active.current) setMessage(`发送失败，已提交的标注仍保留：${error.message}`) }
    finally { if (active.current) setSending(false) }
  }
  return <div ref={editor} className="pw-browser-feedback"><Disclosure title="页面标注" count={`${items.length} / 8`} open={open} onToggle={() => setOpen(previous => !previous)}>
    <ol>{items.map((item, index) => <li key={item.id} data-stale={item.stale}>
      <div><strong>{index + 1}. {item.target?.name || (item.kind === 'element' ? item.target?.tag : '选定区域')}</strong><span>{item.stale ? '已过期' : item.submitted ? '已提交' : '草稿'}</span><Button type="button" aria-label={`移除标注 ${index + 1}`} disabled={busy || sending} onClick={() => act('removeAnnotation', { annotationId: item.id })}>移除</Button></div>
      <TextArea aria-label={`标注 ${index + 1} 的说明`} rows={2} maxLength={600} placeholder="这里需要改成什么？" disabled={item.stale || item.submitted || sending} value={note(item)} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))}/>
    </li>)}</ol>
    <div className="pw-browser-feedback-actions"><Button type="button" disabled={busy || sending || (pendingDelivery ? pendingDelivery.ids.some(id => !items.some(item => item.id === id && !item.stale)) : !drafts.length || drafts.some(item => !note(item)?.trim()))} onClick={() => submit(Boolean(onSend))}>{sending ? '正在提交…' : pendingDelivery ? '重试发送' : onSend ? '发给当前 Agent' : '提交标注'}</Button><Button type="button" disabled={busy || sending} onClick={onContinue}>继续标注</Button><small>选区截图与说明仅提供给当前已授权会话。</small></div>
    {message && <p role="status">{message}</p>}
  </Disclosure></div>
}
