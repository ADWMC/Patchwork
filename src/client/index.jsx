import { PatchworkPanel, PatchworkTitle } from './PatchworkPanel.jsx'

/**
 * 浏览器半边：往右侧栏注册一个 `patchwork` 类型的标签。
 *
 * 注册只走公开路径（`ui-sidebar-documentpreview` 是同一条路的参照实现）：
 * 类型定义进 `ctx.sidebarRightTabs`，正文与标题各自进 keyed seat
 * `sidebar.right.pane.tab` / `sidebar.right.pane.tab.title`，三处用同一个 id。
 */
const TAB_ID = 'patchwork-agent'
const TAB_KIND = 'patchwork'

export const inject = ['@deepseek-ai/dsh-client-ui-sidebar-right', '@deepseek-ai/dsh-client-ui-session']

export function apply(ctx) {
  ctx.effect(
    () => ctx.sidebarRightTabs.register({ id: TAB_ID, kind: TAB_KIND }),
    'patchwork: sidebar tab definition',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.right.pane.tab', () =>
        ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, PatchworkPanel),
      ),
    'patchwork: sidebar tab body',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.right.pane.tab.title', () =>
        ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: TAB_ID }, PatchworkTitle),
      ),
    'patchwork: sidebar tab title',
  )
}
