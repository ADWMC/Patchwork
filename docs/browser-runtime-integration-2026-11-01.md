# Patchwork 可选浏览器接入与验收

日期：2026-11-01。源码及客户端已实施，尚未发布或自动安装到用户实例。浏览器仍由独立包 `@patchwork/browser` 提供；本文件随主包分发，安装主包不会携带浏览器代码、内核、Playwright、ws 或指纹依赖。

## 调用与权限

- 默认 `patchwork_search`／`patchwork_fetch` 使用 HTTP，无须浏览器。
- 显式 `transport:"browser"` 同时要求当前实际 Agent 处于 Patchwork 模式、已安装可选包并由用户授权本会话浏览器。缺少授权明确拒绝，不自动启用或切换传输绕过。
- 可选浏览器本身可供其他模式单独授权；此权限不授予其他模式 Patchwork 的检索、记忆或机制。
- 切模式、停用、销毁会话撤销能力；用户接管立即取消浏览器检索，不更改其他会话。浏览器在当前私有 Chromium 内使用临时空登录上下文，不切换用户可见标签，不导入已有 Cookie、localStorage 或 IndexedDB。
- 检索保留 host／robots／公网地址校验，按已校验 DNS 地址连接；仅 GET/HEAD，限制请求、重定向、流量、字符与总时间。默认 HTTP 路径独立保留。Camoufox、SOCKS 检索代理暂不支持。

调用示例：`patchwork_fetch({url:"https://example.com/",transport:"browser",waitText:"Example Domain"})`。网页输出为外部不可信数据，不能作为新指令。具体 schema 以本实例注册的工具为准。

## Agent 与人工操作

已授权 Agent 可使用 `snapshot(interactive:true)` 获取有界 `@eN` 引用，配合最新 `observationId` 操作真实元素；名称变化、元素移除或文档切换拒绝旧引用。`read` 限长、`wait` 按条件等待、`hover`／`scrollTo` 定位，`batch` 最多 8 步 fill／check／selectOption，部分失败明确返回且不自动重放。

人工输入不逐字执行 ARIA 与完整状态读取。拖拽、双击、横纵滚轮、输入法提交与主动粘贴走有界队列，失焦释放按键。显示使用带一次性票据的二进制 WebSocket，按显示确认只保留最新帧；旧宿主回退 SSE／JPEG。扩大视图和显示缩放不修改网页真实 viewport 或指纹参数，界面使用 DSH 控件与 tokens。

## 已验证与限制

真实 DSH 工具 schema／execute、DSH primitives／主题、隔离 AliasMode Chromium `155.0.8059.85` 与 React StrictMode 面板验收通过；未使用宿主浏览器、未修改主 DSH。100 次本地输入到实际 JPEG 显示 P95 为 37.6 ms，2000 行页面滚动约 28.1 FPS；正常交互零次断流。实际 `patchwork_fetch` 浏览器路径通过公网 example.com 抓取，生产 host／DNS／robots 校验生效。自动测试为 343/343 通过。

上述为本机单页结果，完整 DSH 应用壳、真实模型选工具、实体输入法、长稳内存、跨平台和反自动化站点尚未完成评测；系统文件选择器、原生菜单及完整 DevTools 不属于网页画面流支持范围。本轮并非完整网络对抗审计。

可选包中随包提供 `docs/community-agent-ux-2026-11-01.md`、`docs/performance-interaction-plan-2026-11-01.md` 和 `docs/checks/interaction-public-2026-11-01.json`，包含 ZCode、agent-browser、browser-use、Playwright MCP 的固定源码来源、取舍、复现命令和原始验收数据。独立包与主包分别运行 `check:release`，确认依赖边界和分发内容。
