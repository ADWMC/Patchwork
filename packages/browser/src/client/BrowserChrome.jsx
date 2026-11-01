import { Button, Input, Menu } from './controls.jsx'
import { useEffect, useRef, useState } from 'react'

const paths = {
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></>,
  back: <path d="m13 5-7 7 7 7M6 12h15"/>,
  forward: <path d="m11 5 7 7-7 7M18 12H3"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  plus: <path d="M12 4v16M4 12h16"/>,
  fit: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  annotate: <path d="M8 3H4v4m12-4h4v4M4 15v5h4m12-8-8 8-1-5 7-7 2 4Z"/>,
  fingerprint: <><path d="M4 10a8 8 0 0 1 16 0M7 19c2-3 1-6 1-9a4 4 0 0 1 8 0c0 5 0 7 2 10M12 9c-1 4 1 9-2 13M4 14c0 3-1 4-1 5M20 14v3M15 21l-1-4"/></>,
}

function Icon({ name }) {
  return <svg className="pw-browser-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function BrowserChrome({ state, busy, address, setAddress, act, navigate, fit, annotating, onAnnotate, onManage, onInspect, onResources, onTextEntry, onDisable, disabling, zoom, expanded, onZoom, onExpand, onCopy, onCancelNavigation }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const tabsRef = useRef(null)
  useEffect(() => {
    const selected = tabsRef.current?.querySelector('[aria-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [state.selectedTabId])
  const menuItems = [
    { type: 'label', id: 'scope', text: '当前会话' },
    { id: 'environment', label: '环境与指纹' },
    { id: 'resources', label: '资源管理' },
    { id: 'inspect', label: '检查与记录' },
    { id: 'text', label: '输入文字（支持中文）', disabled: !state.active },
    { id: 'copy', label: '复制网页选中文字', disabled: !state.active || state.control !== 'user' },
    { type: 'separator', id: 'display-separator' },
    { id: 'zoom-fit', label: '画面适应宽度', disabled: !state.active },
    { id: 'zoom-100', label: '画面原始尺寸 100%', disabled: !state.active },
    { id: 'zoom-150', label: '放大画面 150%', disabled: !state.active },
    { id: 'expand', label: expanded ? '收起浏览器' : '展开浏览器' },
    { type: 'separator', id: 'separator' },
    { id: 'close', label: '关闭浏览器内核', disabled: busy || !(state.active || state.resources?.state === 'active') },
    ...(onDisable ? [{ id: 'disable', label: '停用并关闭', disabled: busy || disabling }] : []),
  ]
  function choose(id) {
    setMenuOpen(false)
    const callbacks = { environment: onManage, resources: onResources, inspect: onInspect, text: onTextEntry, copy: onCopy, close: () => act('close'), disable: onDisable, 'zoom-fit': () => onZoom?.(0), 'zoom-100': () => onZoom?.(1), 'zoom-150': () => onZoom?.(1.5), expand: onExpand }
    callbacks[id]?.()
  }
  function tabKeys(event) {
    if (busy || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const index = state.tabs.findIndex(tab => tab.id === state.selectedTabId)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? state.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + state.tabs.length) % state.tabs.length
    const tab = state.tabs[next]
    if (!tab) return
    event.preventDefault()
    tabsRef.current.querySelectorAll('[role="tab"]')[next]?.focus()
    void act(tab.state === 'suspended' ? 'resumeTab' : 'selectTab', { tabId: tab.id })
  }
  return <div className="pw-browser-chrome">
    <div className="pw-browser-tabbar">
      <div ref={tabsRef} role="tablist" aria-label="浏览器标签页" onKeyDown={tabKeys}>
        {state.tabs.length ? state.tabs.map(tab => <div className="pw-browser-tab" data-selected={tab.id === state.selectedTabId} key={tab.id}>
          <Button type="button" role="tab" aria-selected={tab.id === state.selectedTabId} tabIndex={tab.id === state.selectedTabId ? 0 : -1} title={tab.url} disabled={busy} onClick={() => act(tab.state === 'suspended' ? 'resumeTab' : 'selectTab', { tabId: tab.id })}><Icon name="globe"/><span>{tab.state === 'suspended' ? '休眠 · ' : ''}{tab.title || '新标签页'}</span></Button>
          <Button type="button" className="pw-browser-tab-close" aria-label={`关闭标签 ${tab.title || '新标签页'}`} disabled={busy} onClick={() => act('closeTab', { tabId: tab.id })}><Icon name="close"/></Button>
        </div>) : <div className="pw-browser-tab pw-browser-tab-placeholder" data-selected="true"><Icon name="globe"/><span>新标签页</span></div>}
      </div>
      <Button type="button" className="pw-browser-new-tab" title="新建标签页" aria-label="新建标签页" disabled={busy || state.tabs.length >= (state.resources?.maxTabs ?? 8)} onClick={() => act('newTab')}><Icon name="plus"/></Button>
      <Button type="button" className="pw-browser-identity" title="环境与指纹" aria-label="环境与指纹" onClick={onManage}><Icon name="fingerprint"/><span>指纹</span></Button>
    </div>
    <div className="pw-browser-toolbar">
      <div className="pw-browser-navigation" role="group" aria-label="页面导航">
        <Button type="button" title="后退" aria-label="后退" disabled={!state.active || busy} onClick={() => act('back')}><Icon name="back"/></Button>
        <Button type="button" title="前进" aria-label="前进" disabled={!state.active || busy} onClick={() => act('forward')}><Icon name="forward"/></Button>
        <span className="pw-browser-navigation-divider"/>
        <Button type="button" title={busy || state.loading ? '停止加载' : '刷新'} aria-label={busy || state.loading ? '停止加载' : '刷新页面'} disabled={!state.active} onClick={() => busy || state.loading ? onCancelNavigation?.() : act('reload')}><Icon name={busy || state.loading ? 'close' : 'refresh'}/></Button>
      </div>
      <Button type="button" className="pw-browser-annotate" aria-label="标注页面" aria-pressed={annotating} title="像检查元素一样悬停高亮，点击后标注；按住 Space 临时操作网页" disabled={!state.active || busy} onClick={onAnnotate}><Icon name="annotate"/><span>标注</span></Button>
      <form className="pw-browser-address" onSubmit={event => { event.preventDefault(); event.currentTarget.querySelector('input')?.blur(); void navigate() }}>
        <Input data-pw-browser-address="true" aria-label="浏览器地址" placeholder="输入网址" value={address} onChange={event => setAddress(event.target.value)} onFocus={event => event.currentTarget.select()} spellCheck="false" autoCapitalize="none" autoCorrect="off" autoComplete="off" inputMode="url"/>
      </form>
      <Button type="button" className="pw-browser-fit" title={expanded ? '收起浏览器' : '展开浏览器'} aria-label={expanded ? '收起浏览器' : '展开浏览器'} onClick={onExpand}><Icon name="fit"/></Button>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={choose} items={menuItems} compact autoFocus portal align="end" className="pw-browser-menu-anchor" listClassName="pw-browser-host-menu"
        anchor={<Button type="button" className="pw-browser-menu-trigger" title="浏览器菜单" aria-label="浏览器菜单" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><Icon name="more"/></Button>}/>
    </div>

  </div>
}
