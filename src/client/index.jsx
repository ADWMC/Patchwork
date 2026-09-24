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
const title = () => 'Patchwork'

/**
 * Cordis 服务名，不是包名。
 *
 * 两处 inject 用途不同，容易混：
 * - `package.json` 的 `dsh.client.inject` 是**包名**，供加载器先装载那些模块；
 * - 这个导出是**服务名**，由客户端 Cordis 用来等待服务就绪。
 * 填错的表现是客户端启动报 `pending (waiting for services: …)`。
 */
export const inject = ['slots', 'sidebarRightTabs']

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        // title 是必填字段：标签片上的初始文字。
        title,
        // 没有 guide 条目，这个 page 类型就没有任何入口能被打开——它既不匹配
        // 任何资源地址，也没有按钮。guide 就是那个入口。
        guide: [
          {
            // id 是 guide 条目的稳定标识（注册时按它查重），必须给。
            id: TAB_KIND,
            order: 50,
            title,
            description: () => '机制配置与本次运行的实际计量',
          },
        ],
      }),
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
