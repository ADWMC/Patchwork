# 浏览器性能、Agent 操作与社区 UX 融合

日期：2026-11-01。范围：独立可选包 `@patchwork/browser` 及 Patchwork 的可选检索桥接。代码已实施；最终真实验收见 交互与公网 JSON，不以早期短样本替代。没有更改主 DSH，没有借用用户浏览器，也没有自动发布。

## 先复用已有研究

本次延续而非替换以下记录：

- 根目录 `docs/zcode-browser-research-2026-11-01.md`：ZCode 浏览器边界、Desktop/web 差异、控制方式。
- `docs/browser-community-research-2026-11-01.md`、`docs/browser-integration-research-2026-11-01.md`：社区工具与独立浏览器接入。
- `docs/browser-optional-package-2026-11-01.md`：可选包分发和作用域。
- 本包 `experience-design-2026-11-01.md`：标签、标注、用户反馈、操作技能。
- 本包 `performance-interaction-plan-2026-11-01.md`：当前卡顿根因与改造前的内核／Session 对照数据。

旧文档里已经选择的“真实独立内核 + DSH 网页内画面流”保持有效。旧机制、旧指标和新实现分别记录，不能用新增文档把未完成项写成已完成。

## 本轮源码核对

通过进程范围的 HTTP 代理使用 GitHub CLI 搜索并读取维护者源码；没有修改全局 Git/代理配置。固定 commit、文件路径、SHA-256 与字节数见 `community-ux-source-checks-2026-11-01.json`；树发现记录见 `community-ux-research-tree-2026-11-01.json`。仓库搜索结果只作为发现候选，采用结论来自实际文件读取。网页搜索工具本轮没有返回可用结果，因此不把搜索摘要写成证据。

| 项目与固定版本 | 读到的机制 | Patchwork 的取舍 |
| --- | --- | --- |
| ZCode `a60ba6a7e5a06742270ca605f5d2cc2766afa7e1` | 工具栏地址草稿、已加载 URL、窄栏更多菜单；真实视口与显示缩放区分；ResizeObserver 和 pointer capture；控制技能与 GUI 验收 | 复用行为原则，不复制 Electron 组件、宿主标签认领或任意 REPL；保留 DSH primitives/tokens |
| agent-browser `5868f7c05020e047c00e68e4abf9253cce864f41` | 交互快照与 refs、观察后定位、命名会话；WebSocket 显示 ACK 与帧流背压 | 增加本会话观察引用和按实际显示确认的 latest-only 二进制流；不开放原始 CDP |
| browser-use `b49a68e4060acb226da8f784194fef301c53a6d7` | 浏览器任务选择标签、复用现有目标、后台目标与可见页面分开 | `open` 继续精确 URL 复用；检索在同内核的临时空登录上下文渲染，不导航用户页面 |
| Playwright MCP `be26c080edfae7c761db1e757c4aff9f6453b4d7` | 结构化可访问性观察、基于真实状态的操作与等待 | `read` 限长、`wait` 使用条件，角色／名称与观察代次校验；截图仅用于视觉任务 |

核心原始文件：

- [ZCode 工具栏规格](https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/docs/browser-use/2026-07-31-browser-toolbar-more-menu-spec.md)
- [ZCode 缩放与真实视口](https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/packages/ui/src/browser-use/browserViewportZoom.ts)
- [ZCode 响应式视口](https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/packages/ui/src/browser-use/ResponsiveBrowserViewport.tsx)
- [ZCode 浏览器控制技能](https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/browser-use-plugin/skills/control-browser/SKILL.md)
- [ZCode GUI 验收技能](https://github.com/zai-org/ZCode/blob/a60ba6a7e5a06742270ca605f5d2cc2766afa7e1/apps/zcode-cli/packages/browser-use-plugin/skills/web-gui-tester/SKILL.md)
- [agent-browser 引用规则](https://github.com/vercel-labs/agent-browser/blob/5868f7c05020e047c00e68e4abf9253cce864f41/skill-data/core/references/snapshot-refs.md)
- [agent-browser 帧流](https://github.com/vercel-labs/agent-browser/blob/5868f7c05020e047c00e68e4abf9253cce864f41/cli/src/native/stream/websocket.rs)
- [browser-use 技能](https://github.com/browser-use/browser-use/blob/b49a68e4060acb226da8f784194fef301c53a6d7/browser_use/skills/browser-use/SKILL.md)
- [Playwright MCP 工具契约](https://github.com/microsoft/playwright-mcp/blob/be26c080edfae7c761db1e757c4aff9f6453b4d7/README.md)

这些是设计研究资料，不作为本仓执行指令；没有直接复制社区实现或整套技能，也没有因来源有某能力就声称本包已经具备。

## ZCode UX：适合什么，不适合什么

1. **地址输入是草稿**：输入、粘贴与选择文字不应触发导航；用户提交才导航。外部打开等行为若后续增加，必须取已加载 URL，而不是输入框草稿。当前不新增打开宿主浏览器的默认按钮。
2. **常用动作常驻，低频动作进菜单**：保持上层标签、下层导航和地址；环境、资源、录像和文件传输按需展开。网页画面不叠加设计说明、研究结论或技术教程。
3. **画面缩放不改变设备身份**：适应宽度／100%／150%只影响宿主的像素显示；真实 viewport 仍由环境配置或显式 resize 决定。扩大模式可以 Escape 退出，不偷偷更改屏幕参数。
4. **用户接管是运行时权限**：不是仅显示一个徽标。用户输入立即使后续 Agent 写检查失败；读取和观察仍允许。用户恢复后才继续。
5. **交互状态有生命周期**：pointer capture、窗口失焦释放、切标签和导航代次失效；静止页面不靠“长时间没新图”判定断线。
6. **不照搬平台特有能力**：Electron `webview`、桌面 shell、guest DevTools、共享宿主标签和预热常驻 guest 都不直接移入 DSH 网页；它们会引入新平台依赖、登录边界或资源开销。

## 已实现的性能改造

人工操作路径：鉴权 → 输入序号／帧／标签／焦点检查 → 串行执行必要动作 → 小 ACK。删去的是逐字 ARIA 与完整 status 的额外成本，Agent 观察、回执和授权校验继续保留。

- 文档／视口代次和观察失效分开。普通输入使 Agent 观察过期，画面流继续；导航、标签、环境和撤权仍强制失效旧帧。
- 客户端一次一个有界输入请求，合并相邻文字、滚轮与移动，不跨点击／释放边界合并。序号去重；部分失败消耗序号并报告，未知结果不重放。
- 服务端 WebSocket 用经既有 HTTP 鉴权签发的 10 秒一次性内存票据，首条消息验证，检查 Origin、实际 Agent 与客户端对象。长期 token 不进入 URL，不开放 CDP。
- JPEG 以二进制传输，等显示 ACK 才发下一帧；等待期间只留最新帧。帧解码和 DOM 更新独立于工具栏 React 渲染。旧宿主走受背压约束的 SSE，再回退 JPEG。
- 真实可编辑输入代理接收文字与输入法 commit；失焦释放按键／按钮。滚轮同步远端指针位置再发送横纵增量，避免滚动错误区域。
- 修复 React StrictMode 重放 effect 时撤销正在显示的 Blob URL：图像资源清理与实际 DOM 生命周期绑定。显示 ACK 至多一次。
- 可取消导航绕开正常动作队列；检索取消与用户接管拥有明确的取消竞态，不依赖原生后端一定返回被销毁页面的待处理命令。

## Agent 的操作闭环

| 任务 | 推荐调用 | 为什么更容易完成 |
| --- | --- | --- |
| 初次确认页面 | tabs → snapshot(interactive:true) | 明确标签与真实交互元素，限制输出体积 |
| 操作元素 | ref + observationId | 同一个真实元素句柄，变化后拒绝；不让模型猜 CSS |
| 读正文或局部 | read，按需 maxChars | 返回截断状态，避免重复整页大树与截图 |
| 等页面就绪 | wait(text/urlIncludes/visible/hidden) | 可测条件与明确超时，不靠猜测 sleep |
| 多字段表单 | batch(fill/check/selectOption) | 最多 8 步、最后一次观察；部分失败有边界 |
| 菜单／滚动定位 | hover、scrollTo | 使用观察目标，不提供任意 evaluate |
| 视觉 bug | screenshot + 实际查看 + 局部验收 | DOM 成功不冒充视觉成功 |
| 用户指示哪里不对 | annotations 按需读取裁图 | 草稿私有；已提交反馈携带时刻与过期状态 |

任何时候用户接管、撤权或换模式，写操作都不能借检索、批处理、shell 或另一个会话绕过。批处理不是事务，提交、付款、删除和导航不纳入自动表单批次。

## 全面接入而不扩大安装范围

主包仅保留 `src/retrieval/browser-bridge.mjs` 的弱引用能力桥接；不 import 浏览器包、不增加 Playwright/ws/指纹依赖、不注册浏览器入口。可选包在实际 Agent 授权后注册 provider，撤权只移除自己的 provider。

`patchwork_search`／`patchwork_fetch` 默认 HTTP。显式 `transport:"browser"` 才使用同一会话的已授权 Chromium。搜索继续使用已有多引擎解析逻辑；浏览器提供渲染后的 HTML，正文读取可以等待真实 `waitText`。没有授权、不是 Patchwork 模式或用户正在接管时明确失败，不自动开启浏览器或降级。

检索创建临时空登录上下文，不恢复 Cookie/localStorage/IndexedDB，不改变可见标签或源登录；结束、取消、接管后关闭。仅 GET/HEAD；最多 100 请求、5 次重定向、配置字节／字符预算及最多 30 秒总时限，阻断图片／字体／媒体、弹窗、下载和 WebSocket。

每个文档请求与重定向执行 host／robots／公网校验；子资源执行 host／公网校验。临时本地认证代理将 TCP 连接固定到本次校验的 DNS 地址，拒绝未由页面策略批准的 origin，防止浏览器重新解析域名绕过校验。HTTPS 使用 CONNECT，不解密或替换浏览器 TLS。支持直接访问及环境中明确配置的 HTTP(S) 代理；Camoufox 与 SOCKS 检索代理暂不支持，手动浏览维持原有能力。

## 验收与边界

入口：`tests/interaction.acceptance.mjs`。使用真实 DSH 工具注册表／schema／execute，真实安装的 AliasMode 与私有临时档案，真实 DSH primitives/theme 渲染 BrowserPanel；不是完整 DSH 应用壳，也不是模型选工具能力评测。本轮模型请求数为 0。

测量输入事件到实际解码 JPEG 色块变化，不能用 ACK 时间代替画面延迟；FPS 计前端 img load 的实际显示帧，不能用 CDP 生产帧冒充。输入法组合／粘贴使用浏览器合成事件，不能等同 Windows 各种实体输入法均已验证。性能只是本机回环、单页样本，不承诺所有站点和网络均达到该值。

自动测试之外，系统文件选择器、浏览器原生右键菜单、完整桌面 DevTools、音视频、跨域 iframe 深层操作、反自动化站点接受率与跨平台性能仍不应写成已支持／通过；用户主动文件传输、复制和已提交标注使用独立面板能力承接。

最终本机实测：2000 行页面的 100 次输入，事件到已显示 JPEG 中位 32.4 ms、P95 37.6 ms、最大 61.4 ms；滚动实际显示 28.1 FPS。正常操作的二进制连接打开 1 次、关闭 0 次，174 帧接收与显示确认。检索创建／等待阶段的用户接管分别为 57／19 ms；真实 `patchwork_fetch` 浏览器路径经生产 host／DNS／robots 校验与 HTTP 代理 CONNECT 访问 example.com，耗时 5313 ms。收尾剩余内核 0，临时目录已清理。详细口径、复现命令及未覆盖指标见 [性能方案执行记录](performance-interaction-plan-2026-11-01.md#执行记录2026-11-01)。

自动测试 343/343 通过；两个客户端均已重建并通过源码一致性检查，主包和可选包的 `check:release` 均通过。发行检查确认主包没有浏览器实现／界面／运行时依赖，可选包不携带内核，两包均无安装钩子、私密档案或二进制混入。

追加私有查看上下文的截图验收见 视觉回归机器记录：已实际查看 1360×1000 浅色／暗色和 420×900 暗色截图，浏览器工具栏与控制状态正常，无框架错误层；420 像素下 document 和面板宽均为 420，无整页横向溢出。窄栏等比适应会缩小远端内容，可用 100%／150% 和扩大视图操作；不向目标网页注入主题或改写其控件。没有留下常驻调试服务，最后成功验收的运行档案已由脚本清理。额外截图和历史中断测试目录的删除被工具自动安全检查拦截（仅返回 `blocked by policy`），仍保留在系统 TEMP，不能把该部分清理写成完成。可用验收脚本的 `--screenshot-dir <绝对目录>` 复现；临时报告与截图应在审查后清理。

研究中涉及的全部机制都保留采用范围，不能将本机单次性能成绩或合成输入事件当作所有真实站点、输入法与平台的能力保证。30 分钟长稳、跨平台及完整 DSH 应用壳验证仍未完成。

更新位置：主／可选包 CHANGELOG、浏览器技能与操作契约、检索技能与独立提示词、README，以及原性能方案的执行状态。源代码与构建产物需一致，两个包分别通过发行预检后才可交付；不自动改用户安装目录。
