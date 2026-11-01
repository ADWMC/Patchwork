import { forwardRef, memo, useImperativeHandle, useRef, useCallback } from 'react'

// Pixels update only this DOM node; neither the toolbar nor annotations render
// once per video frame. One decode in flight plus one latest pending frame.
export const BrowserFrame = memo(forwardRef(function BrowserFrame({ onLoaded, onPointer }, ref) {
  const element = useRef(null), state = useRef({ current: null, pending: null, loading: false, url: null, disposed: false })
  const callbacks = useRef({ onLoaded, onPointer }); callbacks.current = { onLoaded, onPointer }
  function show(frame) {
    const s = state.current
    if (!element.current || s.disposed) { s.pending = frame; return }
    if (frame.capture?.id && s.current?.capture?.id === frame.capture.id) return
    if (s.loading) { s.pending = frame; return }
    s.loading = true; s.current = frame
    const old = s.url; s.url = URL.createObjectURL(frame.blob)
    element.current.width = frame.width; element.current.height = frame.height
    element.current.src = s.url
    if (old) URL.revokeObjectURL(old)
  }
  useImperativeHandle(ref, () => ({ show, element: () => element.current, clear() {
    const s = state.current; s.pending = null; s.current = null; s.loading = false
    element.current?.removeAttribute('src'); if (s.url) URL.revokeObjectURL(s.url); s.url = null
  } }), [])
  // Tie object URLs to the actual DOM lifetime. StrictMode replays effects
  // without remounting the node; an effect cleanup would revoke a live image.
  const attach = useCallback(node => {
    element.current = node
    const s = state.current
    s.disposed = !node
    if (!node) { if (s.url) URL.revokeObjectURL(s.url); s.url = null; s.loading = false; s.current = null; s.pending = null }
    else if (s.pending) { const next = s.pending; s.pending = null; show(next) }
  }, [])
  const loaded = () => {
    const s = state.current; s.loading = false
    if (s.current) { callbacks.current.onLoaded(s.current); s.current.ack?.() }
    if (s.pending) { const next = s.pending; s.pending = null; show(next) }
  }
  return <img ref={attach} alt="当前会话浏览器页面" draggable="false" onLoad={loaded} onError={() => { state.current.current?.ack?.(); state.current.loading = false; if (state.current.pending) { const next = state.current.pending; state.current.pending = null; show(next) } }}
    onPointerDown={event => callbacks.current.onPointer(event, 'down')} onPointerMove={event => callbacks.current.onPointer(event, 'move')} onPointerUp={event => callbacks.current.onPointer(event, 'up')} onPointerCancel={event => callbacks.current.onPointer(event, 'cancel')}
    onContextMenu={event => event.preventDefault()}/>
}))
