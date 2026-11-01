import { BrowserWorkspace, BrowserTitle } from './BrowserWorkspace.jsx'
import { BROWSER_CSS } from './styles.mjs'
import { annotationSender } from './annotation-send.mjs'

export const inject = ['slots', 'sidebarRightTabs', 'sessions']
export function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = '@patchwork/browser'; style.textContent = BROWSER_CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, 'browser: host theme styles')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'patchwork-browser', kind: 'patchwork-browser', title: () => '浏览器',
    guide: [{ id: 'patchwork-browser', order: 51, title: () => '浏览器', description: () => '打开当前会话的独立浏览器' }],
  }), 'browser: sidebar entry')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'patchwork-browser', inject: sessionId => {
      const sendAnnotations = annotationSender(ctx, sessionId)
      return { sessionId, sessionStore: ctx.sessions.list, ...(sendAnnotations ? { sendAnnotations } : {}) }
    } }, BrowserWorkspace),
  ), 'browser: sidebar body')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () =>
    ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: 'patchwork-browser' }, BrowserTitle),
  ), 'browser: sidebar title')
}
