# DSH Web 插件契约（0.1.5-rc.1 实测）

本文件记录构建 Patchwork 的 Web 半边时**实测出来**的宿主契约。每条都来自本机安装
（`~/.dsh/profiles/**/node_modules`、全局 `@deepseek-ai/dsh`、以及前端产物
`dsh-web-frontend/dist/assets/*.js`），不是从示例推导的。

> **状态（2026-09-12）**：以下契约实测自 **0.1.5-rc.1**。插件目标契约已升级到
> **0.1.5-rc.2**（仓库依赖与全局 CLI 均已同步）。rc.1→rc.2 的核对已完成：
> 对照升级版本卡（DSH-0.1.5-RC2-01~06）与本仓库七类触点扫描，Host 面零变化、
> 本插件未命中 feedback/FileTypeIcon/turnTail 等 Web Client 面；打包产物已在
> 隔离 profile `pw-iso-rc2`（DSH 0.1.5-rc.2）冷启动，`[patchwork] loaded` 正常。
> 本文件的契约条目在 rc.2 上仍成立，无需改动。

## 1. 浏览器半边必须被打包

它不是普通 ESM，而是模块加载器载荷：

```js
window.__ModuleLoader__.load({ id: '<package-name>', factory: (require) => { … return module.exports } })
```

- 产物要用打包器生成（这里用 esbuild，**只构建 client 半边**，Node 半边保持零构建）。
- 宿主侧共享依赖保持外置，由加载器的 `require` 提供：`react`、`react-dom`、
  `react/jsx-runtime`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、
  `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`、
  `@deepseek-ai/cordis`。
- 模块必须导出 `apply(ctx)` 与 `inject`。

## 2. 两处 `inject` 含义不同（踩过）

| 位置 | 内容是 | 例子 |
|---|---|---|
| `package.json` 的 `dsh.client.inject` | **包名**，供加载器先装载模块 | `@deepseek-ai/dsh-client-ui-sidebar-right` |
| 客户端模块导出的 `inject` | **Cordis 服务名** | `['slots', 'sidebarRightTabs']` |

把包名填进服务位，浏览器会报
`pending (waiting for services: @deepseek-ai/… )`。

## 3. 包声明形状

```json
"exports": { ".": …, "./client": …, "./package.json": … },
"dsh": { "client": { "inject": ["<包名>"], "platform": "web" } }
```

`dsh-client-modules` 扫描 Loader entries 里声明 `dsh.client` 的包，组成
`window.__DSH_BOOT__`。**可核验的宿主侧信号**：`__DSH_BOOT__.entries` 里出现
`<pkg>/client.js&rev=…`（URL 按 `exports` 的 key 拼，与文件真实路径无关）。

## 4. 右侧栏标签：注册三步，且必须有入口

`SidebarRightTabDefinition` 必填 `id`、`kind`、`title`；`patterns` 省略即为 page 类型。

- 定义 → `ctx.sidebarRightTabs.register({ id, kind, title, guide })`
- 正文 → seat `sidebar.right.pane.tab`，**keyed by `id`**
- 标题 → seat `sidebar.right.pane.tab.title`，keyed by `id`

**`guide` 是入口**：没有它，page 类型的标签没有任何办法被打开（它既不匹配资源地址，
也没有按钮）。参照实现 `dsh-client-ui-sidebar-documentpreview` 靠「打开 .md 资源」
触发，属于另一类。

## 5. 配置属于「设置 → 插件」，不属于侧栏

平台自带完整的插件配置面，且明确支持**仓库外插件**接入（`slot-contract` 原话）：
*"it registers its own settings namespace on the Host and its own card under that key in
the browser, and the tab pairs the two without ever learning what the namespace means."*

| 侧 | 做什么 |
|---|---|
| Host | 用 `ctx.settings` 注册一个**命名空间 schema**；解析顺序 = schema 默认值 → 组合层 `base` → 用户文档段 |
| Browser | 往 seat `settings.plugin.item` 注册卡片，`key` = 该命名空间 |
| 结果 | 内置的「设置 → 插件」列出并渲染，无需自造面板 |

卡片表单契约（`card-form.d.ts`）：

- 卡片**只暂存，保存时才写**；每次写是对设置文档的一次带版本栅栏的变更。
- 字段用 `CardFieldSpec { field, format, parse }`：`parse` 返回
  `{kind:'set', value}` / `{kind:'clear'}` / `undefined`（非法则阻止保存）。
- 字段状态 `CardFieldState { text, overridden, invalid }`；`overridden` 看的是
  **用户层有没有这一项**，不是值是否相同。
- `PluginCard` 是卡片外壳样板：头部按钮（名称 + 说明）、就地展开、暂存编辑跨折叠保留、
  命名空间不可用时**整张卡片不渲染**。

## 6. 设计系统：复用 `@deepseek-ai/dsh-client-ui-primitives`

组件清单（从前端产物里读出的导出，非推测）：

- 控件：`Button`、`Input`、`Switch`、`Menu`、`Modal`、`Tooltip`、`HoverCard`、`Toast`
- 展示：`Tag`、`Pill`、`StateDot`、`DisclosureRow`、`MarkdownText`、`CodeBlock`、
  `JsonBlock`、`JsonTree`、`DiffBlock`、`ReadBlock`、`SearchBlock`、`TerminalBlock`、`WebBlock`
- 品牌：`BrandWordmark`、`FishLogo`、`FileTypeIcon`
- 图标：约 60 个 `Icon*Outline16`（如 `IconGaugeOutline16`、`IconSparkle16`、
  `IconWarningOutline16`、`IconRefreshOutline16`）
- 工具：`classifyFileType`、`diffTotals`、`fileSizeText`、`extractMarkdownPlainText` 等

自造行内样式会与产品设计脱节；配置类界面应直接用上述控件。

## 7. 明确不采用

- **`@deepseek-ai/dsh-client-schema-form`（schema 驱动表单）**：按用户决定不使用。
  配置界面手写卡片，但用第 6 节的组件。

## 8. 打包与加载的两个坑

- **补丁一条被 `insert:` 插入的行**：只给 `id` + `config` 会让运行时出现**两份实例**
  （一份带配置、一份默认）。补丁层要**整行重新声明**（`id` + `name` + `config`）。
  实测日志：`[patchwork] loaded … mechanisms: actionFusion, observationPack` 与
  `… mechanisms: none` 同时出现。
- **web profile 里插件会被加载多次**，其中一次可能拿不到 profile 补丁的配置。因此
  注入与展示必须**按多实例聚合**，并把分歧显示出来，而不是让后写者覆盖先写者。
