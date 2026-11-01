import { Button, Input, Select, Toggle, Tooltip } from './controls.jsx'
import { useEffect, useRef, useState } from 'react'
import { readConnectionMetadata } from './connection.mjs'
import { consumeBrowserStream, consumeBinaryBrowserStream } from './browser-stream.mjs'
import { createInputQueue } from './input-queue.mjs'
import { BrowserFrame } from './BrowserFrame.jsx'
import { BrowserResources } from './BrowserResources.jsx'
import { BrowserChrome } from './BrowserChrome.jsx'
import { AnnotationOverlay, AnnotationEditor } from './BrowserAnnotations.jsx'
import { BrowserEnvironments } from './BrowserEnvironments.jsx'

const EMPTY = { active: false, url: '', viewport: null, tabs: [], profiles: [], profileId: 'native', control: 'agent', revision: 0 }
const MODES = { native: '原生环境', device: '设备模板', fingerprint: '指纹环境（实验）' }

function EnvironmentForm({ initial, busy, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({ name: '新环境', mode: 'device', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', colorScheme: 'light', viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 }, deviceScaleFactor: 1, persistStorage: false, proxy: null, ...initial }))
  const set = (key, value) => setDraft(previous => ({ ...previous, [key]: value }))
  function submit(event) {
    event.preventDefault()
    const { name, mode, locale, timezoneId, colorScheme, viewport, screen, deviceScaleFactor, persistStorage, proxy } = draft
    void onSave({ name, mode, backend: draft.backend ?? 'chromium', locale, timezoneId, colorScheme, viewport, screen, deviceScaleFactor, persistStorage, proxy })
  }
  return <form className="pw-browser-profile-form" noValidate onSubmit={submit}>
    <div className="pw-browser-form-grid">
      <label>环境名称<Input aria-label="环境名称" required maxLength={60} value={draft.name} onChange={event => set('name', event.target.value)} /></label>
      <label>浏览器内核<Select aria-label="环境内核" disabled={Boolean(initial.id)} value={draft.backend ?? 'chromium'} onChange={value => setDraft(previous => ({ ...previous, backend: value, ...(value === 'aliasmode' ? { mode: 'fingerprint' } : {}) }))} options={[{value:'chromium',label:'系统 Chromium'},{value:'chromium-portable',label:'便携 Chromium · 需独立安装'},{value:'camoufox',label:'Camoufox · 需独立安装'},{value:'aliasmode',label:'AliasMode 原生指纹 · Windows x64'}]}/></label>
      <label>身份模式<Select aria-label="身份模式" disabled={Boolean(initial.id) || draft.backend === 'aliasmode'} value={draft.mode} onChange={value => set('mode', value)} options={Object.entries(MODES).map(([value,label])=>({value,label}))}/></label>
      <label>语言<Input aria-label="环境语言" required value={draft.locale} onChange={event => set('locale', event.target.value)} /></label>
      <label>时区<Input aria-label="环境时区" required value={draft.timezoneId} onChange={event => set('timezoneId', event.target.value)} /></label>
      <label>外观<Select aria-label="环境外观" value={draft.colorScheme} onChange={value => set('colorScheme', value)} options={[{value:'light',label:'浅色'},{value:'dark',label:'深色'},{value:'no-preference',label:'无偏好'}]}/></label>
      <label>像素比<Input aria-label="环境像素比" type="number" min="1" max="3" step="0.25" value={draft.deviceScaleFactor} onChange={event => set('deviceScaleFactor', Number(event.target.value))} /></label>
      <label>视口宽<Input aria-label="环境视口宽" type="number" required min="240" max="2560" value={draft.viewport.width} onChange={event => set('viewport', { ...draft.viewport, width: Number(event.target.value) })} /></label>
      <label>视口高<Input aria-label="环境视口高" type="number" required min="240" max="1800" value={draft.viewport.height} onChange={event => set('viewport', { ...draft.viewport, height: Number(event.target.value) })} /></label>
      <label>屏幕宽<Input aria-label="环境屏幕宽" type="number" required min="240" max="2560" value={draft.screen.width} onChange={event => set('screen', { ...draft.screen, width: Number(event.target.value) })} /></label>
      <label>屏幕高<Input aria-label="环境屏幕高" type="number" required min="240" max="1800" value={draft.screen.height} onChange={event => set('screen', { ...draft.screen, height: Number(event.target.value) })} /></label>
    </div>
    <label>代理地址<Input aria-label="环境代理地址" placeholder="http://host:port 或 socks5://host:port" value={draft.proxy?.server ?? ''} onChange={event => set('proxy', event.target.value ? { ...draft.proxy, server: event.target.value } : null)} /></label>
    {draft.proxy && <div className="pw-browser-form-grid"><label>用户名环境变量<Input aria-label="代理用户名环境变量" value={draft.proxy.usernameEnv ?? ''} onChange={event => set('proxy', { ...draft.proxy, usernameEnv: event.target.value })} /></label><label>密码环境变量<Input aria-label="代理密码环境变量" value={draft.proxy.passwordEnv ?? ''} onChange={event => set('proxy', { ...draft.proxy, passwordEnv: event.target.value })} /></label></div>}
    <Toggle label="保存此会话的登录状态" checked={draft.persistStorage} disabled={busy} onChange={value => set('persistStorage', value)}/>
    <p>登录状态默认不保存。启用后使用 AES-GCM 加密；Windows 由当前系统用户的 DPAPI 保护密钥，其他系统需配置独立存储密钥。{draft.backend === 'aliasmode' ? '原生指纹使用固定身份种子，需先独立安装内核；切换时重启，不叠加 JS 注入。' : 'JS 指纹仅适用于兼容 Chromium 样本，Camoufox 暂不支持此模式。'}仍需运行环境自检。</p>
    <div className="pw-actions"><Button type="submit" variant="primary" disabled={busy}>保存环境</Button><Button type="button" disabled={busy} onClick={onCancel}>取消</Button></div>
  </form>
}

export function BrowserPanel({ sessionId, enabled = true, onDisable, disabling = false, sendAnnotations }) {
  const [state, setState] = useState(EMPTY)
  const [address, setAddress] = useState('')
  const [frame, setFrame] = useState(null)
  const [error, setError] = useState('')
  const [connectionError, setConnectionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [manage, setManage] = useState(false)
  const [resources, setResources] = useState(false)
  const [textEntry, setTextEntry] = useState(false)
  const [text, setText] = useState('')
  const [inspect, setInspect] = useState(false)
  const [transfer, setTransfer] = useState(false)
  const [uploadPath, setUploadPath] = useState('')
  const [uploadSelector, setUploadSelector] = useState('input[type=file]')
  const [transport, setTransport] = useState('JPEG')
  const [zoom, setZoom] = useState(0), [expanded, setExpanded] = useState(false)
  const [annotating, setAnnotating] = useState(false), [passthrough, setPassthrough] = useState(false)
  const shortcuts = useRef(null)
  const actionQueue = useRef(Promise.resolve())
  const pending = useRef(0)
  const latestFrame = useRef(null)
  const loadedFrame = useRef(null)
  const frameRef = useRef(null)
  const panelRef = useRef(null)
  const surfaceRef = useRef(null)
  const wheelInput = useRef(null)
  const api = useRef(null)
  const remoteFocus = useRef(null)
  const focusRevision = useRef(-1)
  const inputProxy = useRef(null), composing = useRef(false), dragging = useRef(false), lastPointer = useRef(null)
  const heldModifiers = useRef(new Set())
  const endpoint = readConnectionMetadata()
  const browserPath = endpoint?.browserPath
  const token = endpoint?.token

  useEffect(() => {
    if (!browserPath || !sessionId || !enabled) return
    const controller = new AbortController()
    const path = browserPath + '?sessionId=' + encodeURIComponent(sessionId)
    const headers = { 'x-patchwork-token': token }
    let timer
    let streamController, streamRunning = false, streamLive = false, retryStreamAt = 0, streamAttempt = 0
    let refreshTail = Promise.resolve()
    setState(EMPTY); setFrame(null); setAddress(''); setError('')
    function clearFrame() {
      latestFrame.current = null; frameRef.current?.clear()
      loadedFrame.current = null
      heldModifiers.current.clear()
      setFrame(null)
      remoteFocus.current = null
    }
    function showFrame(next) {
      const previous = latestFrame.current
      latestFrame.current = next
      frameRef.current?.show(next)
      if (previous?.frameId !== next.frameId || previous?.tabId !== next.tabId || previous?.width !== next.width || previous?.height !== next.height) setFrame({ frameId: next.frameId, tabId: next.tabId, epoch: next.epoch, width: next.width, height: next.height })
    }
    function stopStream() { streamAttempt++; streamController?.abort(); streamController = null; streamRunning = false; streamLive = false; retryStreamAt = 0; setTransport('JPEG') }
    function connectStream() {
      if (streamRunning || document.hidden || controller.signal.aborted || Date.now() < retryStreamAt) return
      streamRunning = true
      const stream = new AbortController(); streamController = stream
      const attempt = ++streamAttempt
      void (async () => {
        try {
          const receive = next => {
            if (controller.signal.aborted || stream.signal.aborted || document.hidden || attempt !== streamAttempt) return
            streamLive = true; showFrame(next)
          }
          try { setTransport('连接中'); await consumeBinaryBrowserStream(path, headers, next => { setTransport('实时'); receive(next) }, stream.signal) }
          catch { if (stream.signal.aborted || controller.signal.aborted) return }
          if (!stream.signal.aborted && !controller.signal.aborted) {
            const response = await fetch(path + '&view=stream', { headers, signal: stream.signal, cache: 'no-store' })
            await consumeBrowserStream(response, next => { setTransport('实时 · 兼容'); receive(next) }, stream.signal)
          }
        } catch { /* The authenticated JPEG path remains available. */ }
        finally { if (attempt === streamAttempt) { streamRunning = false; streamLive = false; retryStreamAt = Date.now() + 2500; if (!controller.signal.aborted) setTransport('JPEG') } }
      })()
    }
    async function refresh() {
      if (controller.signal.aborted || document.hidden) return
      const response = await fetch(path, { headers, signal: controller.signal, cache: 'no-store' })
      if (!response.ok) { stopStream(); clearFrame(); if (response.status === 403) setState(EMPTY); throw new Error(response.status === 403 ? '当前会话尚未授权浏览器' : `浏览器状态读取失败 (${response.status})`) }
      const next = await response.json()
      if (controller.signal.aborted) return
      if (latestFrame.current?.epoch !== undefined && latestFrame.current.epoch > next.epoch) return
      setState(next)
      if ((next.focusRevision ?? 0) >= focusRevision.current) { remoteFocus.current = next.focusId; focusRevision.current = next.focusRevision ?? 0 }
      if (latestFrame.current?.epoch !== undefined && latestFrame.current.epoch !== next.epoch) { stopStream(); clearFrame() }
      setAddress(previous => document.activeElement?.dataset?.pwBrowserAddress ? previous : next.url === 'about:blank' ? '' : next.url)
      if (!next.active) { stopStream(); clearFrame(); return }
      connectStream()
      if (streamLive) return
      const responseFrame = await fetch(path + '&view=frame', { headers, signal: controller.signal, cache: 'no-store' })
      if (responseFrame.status === 204) { clearFrame(); return }
      if (!responseFrame.ok) { clearFrame(); throw new Error(`浏览器画面读取失败 (${responseFrame.status})`) }
      const [width, height] = (responseFrame.headers.get('x-patchwork-viewport') ?? '').split(',').map(Number)
      const tabId = responseFrame.headers.get('x-patchwork-tab-id')
      const frameId = responseFrame.headers.get('x-patchwork-frame-id')
      if (!width || !height || !tabId || !frameId) throw new Error('浏览器画面身份缺失')
      const blob = await responseFrame.blob()
      if (controller.signal.aborted) return
      showFrame({ blob, width, height, tabId, frameId, epoch: Number(responseFrame.headers.get('x-patchwork-epoch') ?? next.epoch), focusId: responseFrame.headers.get('x-patchwork-focus-id') })
    }
    const queuedRefresh = () => {
      refreshTail = refreshTail.then(refresh, refresh)
      return refreshTail
    }
    const connection = { path, headers, signal: controller.signal, refresh: queuedRefresh }
    connection.input = createInputQueue({
      identity: () => loadedFrame.current && { ...loadedFrame.current, focusId: remoteFocus.current },
      send: async envelope => {
        const response = await fetch(path + '&view=input', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(envelope), signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.ok) throw new Error(result.reason ?? '浏览器输入失败')
        return result
      },
      onAck: result => {
        if (controller.signal.aborted) return
        remoteFocus.current = result.focusId
        focusRevision.current = result.focusRevision ?? focusRevision.current
        setState(previous => previous.control === 'user' ? previous : { ...previous, control: 'user' })
      },
      onError: caught => { if (!controller.signal.aborted) { setError(caught.message); void queuedRefresh().catch(() => {}) } },
    })
    api.current = connection
    async function poll() {
      try { await queuedRefresh(); if (!controller.signal.aborted) setConnectionError('') }
      catch (caught) { if (!controller.signal.aborted) setConnectionError(caught.message) }
      finally { if (!controller.signal.aborted) timer = setTimeout(poll, document.hidden ? 5000 : 2000) }
    }
    void poll()
    const blur = () => { inputProxy.current?.blur() }
    const visibility = () => { if (document.hidden) { blur(); stopStream(); clearFrame() } else { clearTimeout(timer); void poll() } }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', blur)
    return () => {
      controller.abort()
      connection.input.close()
      stopStream()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', blur)
      clearTimeout(timer)
      if (api.current === connection) api.current = null
      latestFrame.current = null; frameRef.current?.clear(); focusRevision.current = -1
      loadedFrame.current = null
    }
  }, [sessionId, browserPath, token, enabled])
  useEffect(() => { if (frame && latestFrame.current) frameRef.current?.show(latestFrame.current) }, [frame?.frameId, frame?.tabId])

  function fittedViewport() {
    const box = surfaceRef.current?.getBoundingClientRect()
    return { width: Math.max(240, Math.min(2560, Math.round(box?.width ?? 800))), height: Math.max(240, Math.min(1800, Math.round(box?.height ?? 600))) }
  }

  async function toggleAnnotations() {
    if (annotating) { setAnnotating(false); setPassthrough(false); return }
    if (state.control !== 'user' && !await act('control', { control: 'user' })) return
    setAnnotating(true)
  }
  shortcuts.current = { annotating, toggleAnnotations, act, state }
  useEffect(() => { if (state.control !== 'user' || !state.active) { setAnnotating(false); setPassthrough(false) } }, [state.control, state.active])
  useEffect(() => {
    const panel = panelRef.current
    const keydown = event => {
      const current = shortcuts.current
      if (event.isComposing) return
      if (event.key === 'Escape' && !current.annotating) { setExpanded(false); return }
      const editing = event.target.closest?.('input,textarea,[contenteditable=true]')
      if (current.annotating && event.code === 'Space' && !editing) { event.preventDefault(); event.stopPropagation(); setPassthrough(true); return }
      if (current.annotating && event.key === 'Escape' && !editing) { event.preventDefault(); event.stopPropagation(); setAnnotating(false); setPassthrough(false); return }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      const key = event.key.toLowerCase()
      if (!['l', 't', 'w', 'r'].includes(key)) return
      event.preventDefault(); event.stopPropagation()
      if (key === 'l') panel.querySelector('[data-pw-browser-address]')?.focus()
      else if (key === 't') void current.act('newTab')
      else if (key === 'w' && current.state.selectedTabId) void current.act('closeTab', { tabId: current.state.selectedTabId })
      else if (key === 'r' && current.state.active) void current.act('reload')
    }
    const release = event => { if (!event || event.code === 'Space') setPassthrough(false) }
    panel?.addEventListener('keydown', keydown, true)
    window.addEventListener('keyup', release); window.addEventListener('blur', release)
    return () => { panel?.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', release); window.removeEventListener('blur', release) }
  }, [])

  function act(action, fields = {}) {
    const connection = api.current
    if (!connection) return Promise.resolve(null)
    pending.current++; setBusy(true)
    const run = async () => {
      try {
        if (connection.signal.aborted) return null
        const response = await fetch(connection.path, { method: 'POST', headers: { ...connection.headers, 'content-type': 'application/json' }, body: JSON.stringify({ action, ...fields }), signal: connection.signal })
        const result = await response.json()
        if (!response.ok || !result.ok) throw new Error(result.reason ?? '浏览器操作失败')
        if (connection.signal.aborted) return null
        remoteFocus.current = result.focusId
        setState(result); setError('')
        await connection.refresh()
        return result
      } catch (caught) { if (!connection.signal.aborted) setError(caught.message); return null }
      finally { if (--pending.current === 0 && !connection.signal.aborted) setBusy(false) }
    }
    actionQueue.current = actionQueue.current.then(run, run)
    return actionQueue.current
  }

  function input(action, fields) {
    const shown = loadedFrame.current
    // Stream frames replace blob URLs while the document/viewport capability
    // stays valid. Comparing URLs can silently discard a real click mid-decode.
    if (!shown || shown.frameId !== latestFrame.current?.frameId || shown.tabId !== latestFrame.current?.tabId) return Promise.resolve(null)
    return api.current?.input.push({ action, ...fields, frameId: shown.frameId, tabId: shown.tabId }).catch(() => null) ?? Promise.resolve(null)
  }
  async function inspectElement(point, signal) {
    const connection = api.current, shown = loadedFrame.current
    if (!connection || connection.signal.aborted || !shown || shown.frameId !== frame?.frameId || shown.tabId !== state.selectedTabId || state.control !== 'user') return null
    const response = await fetch(connection.path, { method: 'POST', headers: { ...connection.headers, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'inspectElement', box: { ...point, width: 1, height: 1 }, frameId: shown.frameId, tabId: shown.tabId }), signal })
    if (!response.ok || connection !== api.current || connection.signal.aborted) return null
    const result = await response.json()
    return result.ok && result.frameId === loadedFrame.current?.frameId && result.tabId === loadedFrame.current?.tabId ? result : null
  }
  function onPointer(event, phase) {
    const shown = loadedFrame.current
    if (!shown) return
    if (phase === 'cancel') { dragging.current = false; void input('releaseInput', {}); return }
    if (phase === 'move' && !dragging.current && state.control !== 'user') return
    if (phase === 'down') { event.preventDefault(); dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); inputProxy.current?.focus({ preventScroll: true }) }
    const box = event.currentTarget.getBoundingClientRect()
    const point = { x: Math.max(0, Math.min(shown.width - 1, Math.floor((event.clientX - box.left) * shown.width / box.width))), y: Math.max(0, Math.min(shown.height - 1, Math.floor((event.clientY - box.top) * shown.height / box.height))) }
    lastPointer.current = point
    void input('pointer', { ...point, phase, button: ['left', 'middle', 'right'][event.button] ?? 'left' })
    if (phase === 'up') { dragging.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }
  }
  function onKeyDown(event) {
    if (!state.active || event.isComposing || event.key === 'Process' || event.keyCode === 229) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' || event.shiftKey && event.key === 'Insert') return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); void copySelection(); return }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      if (!heldModifiers.current.has(event.key)) { heldModifiers.current.add(event.key); void input('keyState', { value: event.key, phase: 'down' }) }
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) return
    event.preventDefault()
    {
      const modifiers = [event.ctrlKey && 'Control', event.altKey && 'Alt', event.metaKey && 'Meta', event.shiftKey && 'Shift'].filter(Boolean)
      input('key', { value: [...modifiers, event.key].join('+') })
    }
  }
  async function copySelection() {
    const connection = api.current
    if (!connection || connection.signal.aborted) return
    try {
      const response = await fetch(connection.path, { method: 'POST', headers: { ...connection.headers, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'readSelection' }), signal: connection.signal })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.reason ?? '读取选中文字失败')
      if (connection.signal.aborted) return
      if (result.text) await navigator.clipboard.writeText(result.text)
    } catch (caught) { if (!connection.signal.aborted) setError(caught.message) }
  }
  async function cancelNavigation() {
    const connection = api.current
    if (!connection || connection.signal.aborted) return
    try { await fetch(connection.path + '&view=cancel', { method: 'POST', headers: { ...connection.headers, 'content-type': 'application/json' }, body: '{}', signal: connection.signal }); await connection.refresh() }
    catch (caught) { if (!connection.signal.aborted) setError(caught.message) }
  }
  const currentProfile = state.profiles.find(profile => profile.id === state.profileId)
  const displayed = frame && frame.tabId === state.selectedTabId
  wheelInput.current = (deltaX, deltaY) => annotating && !passthrough ? null : input('scroll', { deltaX: Math.max(-2000, Math.min(2000, deltaX)), deltaY: Math.max(-2000, Math.min(2000, deltaY)) })
  useEffect(() => {
    const surface = surfaceRef.current
    if (!displayed || !surface) return
    const wheel = event => {
      if (event.ctrlKey) return
      event.preventDefault()
      const shown = loadedFrame.current, image = frameRef.current?.element?.()
      if (shown && image) {
        const box = image.getBoundingClientRect()
        const x = Math.max(0, Math.min(shown.width - 1, Math.floor((event.clientX - box.left) * shown.width / box.width)))
        const y = Math.max(0, Math.min(shown.height - 1, Math.floor((event.clientY - box.top) * shown.height / box.height)))
        void input('pointer', { x, y, phase: 'move', button: 'left' })
      }
      const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? surface.clientHeight : 1
      void wheelInput.current(event.deltaX * unit, event.deltaY * unit)
    }
    surface.addEventListener('wheel', wheel, { passive: false })
    return () => surface.removeEventListener('wheel', wheel)
  }, [displayed])
  if (!enabled) return <div className="pw-browser-empty">当前会话的浏览器尚未启用。</div>
  return <div className={`pw-browser${expanded ? ' pw-browser-expanded' : ''}`} ref={panelRef}>
    <BrowserChrome state={state} busy={busy} address={address} setAddress={setAddress} act={act}
      zoom={zoom} expanded={expanded} onZoom={setZoom} onExpand={() => setExpanded(value => !value)}
      onCopy={copySelection} onCancelNavigation={cancelNavigation}
      annotating={annotating} onAnnotate={toggleAnnotations}
      navigate={async () => { if (state.control !== 'user' && !await act('control', { control: 'user' })) return; await act('navigate', { url: address, ...((currentProfile?.mode ?? 'native') === 'native' ? fittedViewport() : {}) }) }}
      fit={async () => { if (state.control !== 'user' && !await act('control', { control: 'user' })) return; await act('resize', fittedViewport()) }}
      onManage={() => { setManage(value => !value); setInspect(false); setResources(false) }}
      onInspect={() => { setInspect(value => !value); setManage(false); setResources(false) }}
      onResources={() => { setResources(value => !value); setManage(false); setInspect(false) }}
      onTextEntry={() => setTextEntry(value => !value)} onDisable={onDisable} disabling={disabling}/>
    {manage && <BrowserEnvironments state={state} busy={busy} act={act} Form={EnvironmentForm}/>}
    {inspect && <div className="pw-browser-inspect">
      <div className="pw-browser-inspect-actions"><Button type="button" disabled={busy || state.recording} onClick={() => act('health')}>运行环境自检</Button><Button type="button" disabled={busy} onClick={() => act('exportTrace')}>导出操作记录</Button><Button type="button" disabled={busy || !state.active} onClick={() => act('exportScreenshot')}>保存截图</Button><Button type="button" disabled={busy || !state.recording && (!state.recorder?.installed || !state.active)} onClick={() => act(state.recording ? 'stopRecording' : 'startRecording')}>{state.recording ? '停止并交付录像' : '开启录像'}</Button><Button type="button" aria-expanded={transfer} onClick={() => setTransfer(value => !value)}>文件传输</Button>{state.active && <Button type="button" disabled={busy} onClick={() => act('suspendTab', { tabId: state.selectedTabId })}>休眠当前标签</Button>}{state.recoverableTabs > 0 && <Button type="button" disabled={busy} onClick={() => act('recoverTabs')}>恢复 {state.recoverableTabs} 个标签</Button>}</div>
      <p>{state.capabilities?.family ?? 'chromium'} · 驱动 {state.capabilities?.driverVersion ?? '—'} · 登录加密 {state.capabilities?.storageEncryption ?? '—'}</p>
      {state.backend && !state.backend.installed && <p role="status">当前内核尚未安装：按浏览器升级文档配置独立后端。</p>}
      {!state.recorder?.installed && <p>录像需在目标 DSH_HOME 显式运行 patchwork-browser-components install recorder --home 目标DSH_HOME。录像可能包含登录信息，仅在你启用后记录。</p>}
      {state.recording && <p role="status">正在以最高 4 帧/秒采样当前标签；忙碌或背压时会跳帧。停止后将有效 WebM 文件写入当前工作区。</p>}
      {state.recordingState?.state === 'failed' && <p role="alert">录像编码失败，请停止录制后检查独立录像依赖。失败文件不会作为交付产物。</p>}
      {state.recordingState?.state === 'limit-reached' && <p role="status">录像已到 15 分钟上限，点击停止以保存已录制内容。</p>}
      {state.health && <div className="pw-browser-health" aria-label="环境自检结果">{[['configuration', '配置'], ['iframe', '同源 iframe'], ['worker', 'Worker'], ['network', '本地请求头'], ['clientHints', 'Client Hints'], ['rendering', 'Canvas']].map(([id, label]) => <span key={id}>{label}：{({ match: '一致', mismatch: '不一致', unknown: '待确认' })[state.health[id]?.status] ?? '未测'}</span>)}<p>出口 IP、TLS、WebRTC、跨域 iframe 与 Worker 离屏 Canvas 未验证；不作为匿名性证明。</p></div>}
      {state.lastReceipt && <p role="status">最近操作：{state.lastReceipt.action} · {state.lastReceipt.outcome}{state.lastReceipt.noProgress ? ' · 重复操作没有进展，请改变方法' : ''}</p>}
      {transfer && <div className="pw-browser-transfer"><label>工作区文件路径<Input aria-label="上传文件路径" value={uploadPath} onChange={event => setUploadPath(event.target.value)} /></label><label>文件输入框选择器<Input aria-label="上传目标选择器" value={uploadSelector} onChange={event => setUploadSelector(event.target.value)} /></label><Button type="button" disabled={busy || !state.active || !uploadPath} onClick={() => act('upload', { path: uploadPath, selector: uploadSelector })}>上传到页面</Button><Button type="button" disabled={busy || !state.active} onClick={() => act('armDownload')}>允许下一次下载（60 秒）</Button><p>仅当前会话使用；下载写入工作区，未授权的下载会取消。单文件交付上限 50 MiB。</p></div>}
      {state.artifacts?.length > 0 && <ul className="pw-browser-artifacts" aria-label="已交付文件">{state.artifacts.map(item => <li key={item.id}><strong>{item.name}</strong><span>{item.bytes.toLocaleString()} 字节</span><code>{item.path}</code></li>)}</ul>}
    </div>}
    {resources && <BrowserResources state={state} busy={busy} act={act}/>}
    <AnnotationEditor items={state.annotations ?? []} busy={busy} act={act} onSend={sendAnnotations ? async text => { if (!api.current || api.current.signal.aborted) throw new Error('会话已切换'); await sendAnnotations(text) } : undefined} onContinue={() => setAnnotating(true)}/>
    {textEntry && <form className="pw-browser-text-input" onSubmit={async event => { event.preventDefault(); if (text && await input('type', { value: text })) setText('') }}><Input aria-label="发送到页面的文字" placeholder="先点页面输入框，再在这里输入文字" maxLength={2000} value={text} onChange={event => setText(event.target.value)} /><Button type="submit" disabled={busy || !text}>发送</Button><Button type="button" disabled={busy} onClick={() => input('key', { value: 'Enter' })}>回车</Button></form>}
    {(error || connectionError) && <p className="pw-browser-error" role="alert">{error || connectionError}</p>}
    {annotating && <p className="pw-browser-annotation-tip" role="status">{passthrough ? '正在操作网页，松开 Space 继续检查' : '悬停检查元素，点击选中后写说明；拖动可框选区域。Space 临时操作，Esc 退出。'}</p>}
    {displayed ? <div className="pw-browser-surface" ref={surfaceRef}><div className="pw-browser-page" style={zoom ? { width: frame.width * zoom } : undefined}>
      <BrowserFrame ref={frameRef} onLoaded={next => { loadedFrame.current = next }} onPointer={onPointer}/>
      <textarea ref={inputProxy} className="pw-browser-input-proxy" aria-label="网页键盘输入" autoComplete="off" autoCorrect="off" spellCheck={false} onKeyDown={onKeyDown}
        onKeyUp={event => { if (heldModifiers.current.delete(event.key)) void input('keyState', { value: event.key, phase: 'up' }) }}
        onChange={event => { if (!composing.current && event.target.value) { void input('type', { value: event.target.value.slice(0, 2000) }); event.target.value = '' } }}
        onCompositionStart={() => { composing.current = true }} onCompositionEnd={event => { composing.current = false; if (event.data) void input('type', { value: event.data.slice(0, 2000) }); event.currentTarget.value = '' }}
        onPaste={event => { event.preventDefault(); void input('type', { value: event.clipboardData.getData('text').slice(0, 2000) }) }} onBlur={() => { dragging.current = false; heldModifiers.current.clear(); void input('releaseInput', {}) }}/>
      <AnnotationOverlay enabled={annotating} passthrough={passthrough} frame={frame} items={state.annotations ?? []} onInspect={inspectElement} onPick={selection => { setAnnotating(false); setPassthrough(false); return input('pickAnnotation', selection) }}/>
    </div></div> : <div className="pw-browser-empty" ref={surfaceRef}>{state.active ? '正在读取画面…' : '输入地址打开页面，或让 Agent 开始浏览。'}</div>}
    <div className="pw-browser-status"><Tooltip label={`${currentProfile?.name ?? '临时环境'} · ${transport}${displayed ? ` · ${frame.width} × ${frame.height}` : ''}`} side="top" portal delayMs={350}><span>{state.control === 'user' ? '你在操作 · Agent 写操作已暂停' : '当前会话 · Agent 可操作'}{state.recording ? ' · 正在录像' : ''}</span></Tooltip><Button type="button" disabled={busy} onClick={() => act('control', { control: state.control === 'user' ? 'agent' : 'user' })}>{state.control === 'user' ? '恢复 Agent' : '接管浏览器'}</Button></div>
  </div>
}
