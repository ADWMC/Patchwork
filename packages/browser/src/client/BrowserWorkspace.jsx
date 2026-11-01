import { Button } from './controls.jsx'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BrowserPanel } from './BrowserPanel.jsx'
import { readConnectionMetadata } from './connection.mjs'

export function BrowserTitle() { return <span>浏览器</span> }

export function BrowserWorkspace({ sessionId, sessionStore, useTabInfo, sendAnnotations }) {
  const preset = useSyncExternalStore(sessionStore.subscribe,
    () => sessionStore.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset ?? '', () => '')
  const { tab } = useTabInfo()
  if (!tab.visible) return null
  return <div className="pw-panel pw-browser-workspace"><div className="pw-panel-inner">
    {sessionId ? <SessionWorkspace key={`${sessionId}:${preset}`} sessionId={sessionId} sendAnnotations={sendAnnotations}/>
      : <div className="pw-browser-permission"><strong>选择一个会话</strong><p>选中会话后打开独立浏览器。</p></div>}
  </div></div>
}

function SessionWorkspace({ sessionId, sendAnnotations }) {
  const [access, setAccess] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const active = useRef(false), request = useRef(null)
  const metadata = readConnectionMetadata()
  const path = metadata && `${metadata.browserPath}?sessionId=${encodeURIComponent(sessionId)}&view=access`
  const token = metadata?.token
  useEffect(() => {
    active.current = true
    const abort = new AbortController()
    let timer
    const refresh = async () => {
      try {
        if (!path) throw new Error('浏览器连接不可用，请重新加载页面。')
        const response = await fetch(path, { headers: { 'x-patchwork-token': token }, signal: abort.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('无法读取当前会话的浏览器权限。')
        const next = await response.json()
        if (!abort.signal.aborted) { setAccess(next); setError('') }
      } catch (error) { if (!abort.signal.aborted) { setAccess(null); setError(error.message) } }
      finally { if (!abort.signal.aborted) timer = setTimeout(refresh, 1500) }
    }
    void refresh()
    return () => { active.current = false; abort.abort(); request.current?.abort(); clearTimeout(timer) }
  }, [path, token])
  async function change(enabled) {
    setBusy(true); setError('')
    const controller = new AbortController(); request.current = controller
    try {
      const response = await fetch(path, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-patchwork-token': token }, body: JSON.stringify({ action: enabled ? 'enable' : 'disable', preset: access.preset, accessId: access.accessId }) })
      const next = await response.json()
      if (!response.ok) throw new Error(next.reason || '浏览器权限修改失败。')
      if (active.current) setAccess(next)
    } catch (error) { if (active.current) setError(error.message) }
    finally { if (active.current) setBusy(false) }
  }
  return <>
    {!access?.enabled && <header className="pw-header"><div className="pw-scope"><strong>浏览器</strong><span>当前会话</span></div></header>}
    {error && <p role="alert" className="pw-browser-error">{error}</p>}
    <div className="pw-scroll">{access?.enabled ? <BrowserPanel sessionId={sessionId} onDisable={() => change(false)} disabling={busy} sendAnnotations={sendAnnotations ? async text => {
      const response = await fetch(path, { headers: { 'x-patchwork-token': token }, cache: 'no-store' })
      const current = await response.json()
      if (!active.current || !response.ok || !current.enabled || current.accessId !== access.accessId || current.preset !== access.preset) throw new Error('浏览器授权已变化，请重新打开当前会话')
      await sendAnnotations(text)
    } : undefined}/>
      : <div className="pw-browser-permission"><strong>{access ? '为当前会话启用浏览器' : '正在连接浏览器服务'}</strong>
        <p>启用后，当前模式的 Agent 可使用浏览器工具。页面、登录状态与其他会话独立，切换模式后需重新授权。</p>
        <Button type="button" disabled={!access || busy || access.closing} onClick={() => change(true)}>{access?.closing ? '正在关闭浏览器…' : busy ? '正在启用…' : '启用当前会话浏览器'}</Button></div>}</div>
  </>
}
