# DSH 原生 Web UI 设计与实现

2026-10-29。交付是 **DSH 右侧栏里的真实插件面板**，不是独立网站。旧独立 HTML 原型已经退役，不作为本轮设计或验收依据。

## 沿宿主源码定位入口

固定读取 deepseek-harness tag dsh-v0.2.1-rc.2，commit 687f282e8625c6b8d11ff58211a90524be2e4317。

| 目的 | DSH 源码位置 | 实现决策 |
|---|---|---|
| 发现入口 | packages/client/ui-sidebar-right/src/client/tab-registry.ts、tabs/guide/GuideBody.tsx | 注册 guide 条目，从右栏“开始”打开 Patchwork |
| 宿主面板 | packages/client/ui-sidebar-documentpreview/src/client/index.ts | 复用 sidebarRightTabs.register；正文/标题 keyed slots 使用同一 id |
| 当前会话 | 同上正文 slot 的 inject 参数 | 从宿主注入 sessionId，不猜 DOM 标题或全局选中项 |
| 原生控件 | packages/client/ui-primitives/src/{Button,Switch,SegmentedTabs}.tsx | 直接导入宿主 Button、Switch、SegmentedTabs |
| 设计 token | packages/client/ui-theme/src/styles/{base,design-platform}.css | 颜色、字体、圆角使用宿主变量，样式只限 .pw-* |
| 主题状态 | packages/client/ui-theme/src/client/{index,styles,AppearanceRow}.*、boot-theme.ts | 外观状态由 ui-theme / ThemeRuntime 持有 |
| 主题应用 | packages/client/ui-layout/src/client/theme-presenter.ts | ThemePresenter 设置 body[data-ds-dark-theme]；插件继承 |

不覆盖 :root、body、宿主导航或聊天区域。没有插件自己的主题开关、品牌底色或独立页面外框。最大化、收回、分栏沿用右栏能力。

## 已采用的 token

| 语义 | DSH token |
|---|---|
| 正文/代码字体 | --dsw-font-family / --ds-font-family-code |
| 画布/次级面 | --dsw-alias-bg-base / --dsw-alias-bg-layer-1 |
| 文字层级 | --dsw-alias-label-primary / secondary / tertiary |
| 分隔线 | --dsw-alias-border-l3 |
| 控件圆角 | --dsw-radius-xs / sm / md / lg |
| 成功/警告/错误 | --dsw-alias-state-success-primary / --dsw-alias-state-warn-label / --dsw-alias-state-error-primary |
| 焦点 | --dsw-alias-link |

原生控件自己消费其余交互 token。原生分段标签提供键盘切换，表单有 label，保存/冲突结果通过 role=status / alert 呈现。

## 信息架构

| 页面 | 已实现内容 |
|---|---|
| 总览 | 当前会话、连接时间、真实回执数、失败回执数、宿主 tokenMeter 测量、待重载配置、注册能力、最近证据 |
| 机制 | 加载配置与已保存配置并列；AF 用实际 write schema 核对注册；其他机制未知时明确待观察；不展示跨会话进程计数 |
| 证据 | 搜索命令/路径/工具；展开原文，显示 tool、根/嵌套、callId、exitCode、时间、字节；未知退出码不补0 |
| 设置 | DSH_HOME 作用域、局部草稿、revision、数值校验、保存/丢弃、409 冲突及显式重新载入 |

窄侧栏采用单列和2×2指标。容器达到650px时总览变为四指标与双列，由 container query 判断面板宽度。输出可滚动、折行，操作区可换行。

## 三种配置状态

- loadedConfig：最近一次插件加载时的有效配置，不等于现有 Agent 每项能力都已变更。
- config + revision：当前 DSH_HOME 已保存用户覆盖，与 preset 的runtime行配置合并后的结果。
- draft：本面板未保存的变更，首个编辑捕获 baseRevision。

保存只更新用户覆盖，不动态改写现有 Agent。插件重新加载或实例重启会重读配置；宿主外观设置也可能引发插件重载，因此使用“待重载”。AF 以当前 Agent schema 为实际能力依据。

同进程写入排队；不同页面以 expected revision 检测冲突。409/网络失败保留草稿，重新载入明确丢弃草稿。不同进程共享同一 DSH_HOME 的并发尚不保证。

## 当前数据通道

- 页面注入经宿主鉴权保护的 endpoint metadata 与进程内凭证；计量改读真实 GET state，不再重读旧 DOM 统计。
- GET /api/plugins/patchwork-coding-agent/state?sessionId=…：仅Patchwork会话2秒轮询；no-store、凭证+宿主真实组合校验及AbortController。不是订阅。
- POST /api/plugins/patchwork-coding-agent/config?sessionId=…：patch + x-patchwork-revision；同样校验真实Patchwork组合；成功返回config/revision，冲突409，其他Agent即使凭证有效也403。
- 证据观察宿主最终 tools/result，不在 post-execute 策略尚未结算时宣称完成。
- 最多64会话，每会话100回执，单条16000字符预览。原始会话由 DSH 保存；插件进程重启不回填旧工具记录。
- 主题热重载时凭证和有界证据在进程内保留；route/tap 由 ctx.effect 释放重建，避免旧鉴权与重复注入。

根工具和嵌套then_run各有一条回执，一条失败命令可能产生两条失败回执。数量不是独立失败任务数，也不是节省的模型请求数。不输出全局计数，不展示未经对照的请求/成本收益。

原生guide入口是静态注册；其他Agent打开只看到锁定说明。客户端以宿主sessions projection的agentPreset授权；切走即卸载SessionPanel，其快照、未保存草稿与异步轮询随之清理。服务端单独验证真实组合，不依赖该前端判断。详见[隔离审计](isolation.md)。

## 验收与后续范围

真实 DSH 内验证：guide入口、原生控件、write/edit融合、成功/非零退出、主题跟随、配置保存刷新、双页冲突及草稿保留。精确范围见 [verification.md](verification.md)。

后续再实现宿主 settings namespace 的 profile 隔离、订阅/分页、机制决策解释、持久证据索引、离开会话的草稿提示，以及完整键盘和屏幕阅读器审计；这些不冒充当前能力。
