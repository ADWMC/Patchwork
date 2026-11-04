# Patchwork Agent 内置浏览器：项目调研与真实隔离验证

> 后续功能与当前验证见[浏览器缺口补齐执行记录](browser-gap-execution-2026-11-01.md)。本文保留初期集成与隔离试验事实；后续已加入实时流、受控文件传输、加密登录快照与可选采样录像，不再以本文早期限制描述当前版本。

日期：2026-11-01。目标是让 Patchwork Agent 与用户在侧栏看到并操作同一页面，不使用 DSH 宿主浏览器标签页，也不把浏览器工具或页面状态带到其他会话。使用 GitHub CLI 经本机代理核对仓库、功能和许可。

## 候选项目

| 项目 | 适用性与取舍 |
| --- | --- |
| [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) | 提供完整的导航、快照、交互和截图工具；Apache-2.0。直接把同一个 MCP 服务挂在 Patchwork preset 后，两个 Patchwork Agent 实测共用页面，因此不能直接满足会话隔离。 |
| [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli) | CLI 和命名 session 适合代码 Agent；仍需在 Patchwork 生命周期内明确分配与回收每个 session。 |
| [Vercel agent-browser](https://github.com/vercel-labs/agent-browser) | 浏览器自动化 CLI，支持快照、交互和会话；Apache-2.0。适合做低 token 基线，但会引入额外 CLI 与进程协调。 |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 网络和性能调试更完整；家居页面验收暂不需要这套较宽的工具面。 |
| [Browser Use](https://github.com/browser-use/browser-use) | Python 浏览器 Agent；与 Patchwork 已有 Agent 规划循环重叠。 |
| [BrowserOS](https://github.com/browseros-ai/BrowserOS) | AGPL-3.0 的完整 Agent 浏览器产品；更适合独立桌面浏览器，不适合在 DSH 插件里为每个 Agent 提供轻量验证实例。 |

最终采用 [Playwright Core](https://github.com/microsoft/playwright) 作为浏览器驱动，工具和生命周期由 Patchwork runtime 管理。仓库锁定 `playwright-core@1.64.1`。先实现了 Agent 无头工具；随后按用户对 ZCode 的纠正，增加同一页面的可见侧栏与用户操作。

## ZCode 与 DSH 载体的差异

ZCode 的桌面端由 Electron `BrowserGuestManager` 持有 guest，右侧可见面板与 Agent CDP 命令使用同一 guest。其会话、工作区、窗口和 tab 身份参与所有权判定，截图要明确进入模型工具结果才算模型看过。OpenClaude 调研主要涉及提示词与编码流程，没有提供可直接移植到 DSH 的共享浏览器载体；参见 [ZCode / OpenClaude 调研](zcode-openclaude-prompt-engineering-research-2026-10-31.md)。

本机 DSH `0.2.1-rc.2` 的 `@deepseek-ai/dsh-client-ui-sidebar-browser` 是用户浏览器页签：Web 用 iframe，Desktop 用 Electron webview；其 README 明确“模型体验：无”，不注册 Agent 工具。Web iframe 跨域内容不可供 Agent 读取。直接打开该页签会产生另一份页面状态，无法满足“用户和 Agent 共用同一页”。

Patchwork 因此让既有 Agent Playwright 页面成为唯一页面状态源。`src/browser/tool.mjs` 将控制器绑定到真实 Agent 对象；`src/browser/route.mjs` 在会话与 preset 核验后向该会话的侧栏提供有界操作和 JPEG 画面。`src/client/BrowserPanel.jsx` 只在当前可见的 Patchwork 页签轮询画面；用户点击的像素坐标转换回真实视口，键盘和滚动输入发送到同一个 Playwright `Page`。用户从地址栏导航时适配侧栏宽度，Agent 显式设置的视口在观察时不会被自动覆盖。没有向网页注入 DSH 权限，也没有页面脚本执行入口。

这是 ZCode 的“可见、共用、可接管”交互目标在 DSH Web 插件边界内的实现，不是 Electron guest 的逐项复制。初版只管理一个页面；本轮已增加最多 8 个标签、受数量和导航校验限制的 popup、用户独占接管、画面身份与会话私有环境档案，详见[浏览器工作台升级及验收](browser-workspace-upgrade-2026-11-01.md)。仍没有原生 DOM 文本选择、拖放、文件上传下载或完整视频流。可见时约每 800ms 轮询 JPEG，忙碌和网络延迟可能拉长间隔，高动态页面会有画面延迟。Agent 仍需显式调用截图工具，侧栏画面不会自动塞进模型上下文。

## 发现与修正

初版 `@playwright/mcp@0.0.84` 虽只在 Patchwork preset 暴露工具，真实 DSH 双会话探针仍发现 `firstSeesSecond: true`：第二个 Agent 导航后，第一个 Agent 快照读到了第二个页面。原因是 preset 内的 MCP 服务被 DSH 复用，`--isolated` 只隔离该服务与既有浏览器配置，不能把服务状态按 Agent 分开。初版因此撤回。

现在 `src/browser/tool.mjs` 在 Patchwork runtime 注册单一 `patchwork_browser` 工具，按 Agent 对象按需启动独立的 headless Edge（Windows）或 Chrome（其他平台）。每个 Agent 有自己的 browser/context/标签与默认临时存储；不连接宿主标签页或共享 CDP 端口。用户可显式开启当前会话私有档案的登录快照；模型不能管理档案或读取原始存储。启动器仅传递运行浏览器所需的 OS 环境变量，不继承模型密钥等任意进程环境。`agent/disposed`、离开 Patchwork preset 和 runtime 卸载时回收；每次调用前后复核真实 preset 组合。浏览器提供导航、可访问性快照、点击、输入、按键、视口、刷新、后退／前进、截图、标签管理、列出及选择已有档案和关闭。用户接管后 Agent 只能观察。截图通过 DSH 附件服务进入当前工具结果。没有开放页面 JS 执行工具。

`http(s)://` 可直接访问；`file://` 仅允许当前会话工作目录内的文件，并复核实际路径。网页文本作为不可信数据返回。该工具不是 OS 沙箱；Patchwork Agent 原有 shell 权限和页面网络请求仍按 DSH/OS 的权限运行。

## 验证

在独立 `DSH_HOME` 中运行官方 DSH `0.2.1-rc.2`，并用 `dsh headless --patch docs/experiments/2026-11-01-browser/probe.overlay.yml` 调用真实探针。两个 Patchwork Agent 均只看到 `patchwork_browser`；普通 Agent 看不到。两个 Agent 分别导航到 `/first` 和 `/second` 后，第一个仍看到 `First session`（`firstSeesSecond: false`）。390×844 视口切换、PNG 截图图像块、关闭第一个 Agent 后第二个继续运行、工作目录内 `file://` 导航和目录外文件拒绝均通过。退出后未发现残留的 Playwright headless Edge/Chrome 进程。主 DSH 配置、会话及当前宿主浏览器未改动。

初版单元测试覆盖标准 Agent 拒绝调用、两个 Patchwork Agent 状态分离及切走后的关闭。真实探针的一次中间运行出现第二个会话导航失败，未捕获到错误详情；随后连续三次完整通过。本轮扩展为 12 项浏览器单元测试，全仓 243 项全部通过，并完成 8 组真实 Edge 环境探针；具体断言与边界见[升级验收记录](browser-workspace-upgrade-2026-11-01.md)。长期并发压力、偶发启动失败和非 Windows 浏览器发现仍需单独验证；这些探针不等于模型 UI 质量验收。家居题结果见 实验记录。

可见浏览器初版另在独立 `DSH_HOME` 运行真实 DSH `0.2.1-rc.2` 验证：Agent 打开的页面可由侧栏拿到 JPEG；通过同一控制器模拟用户点击后，Agent 快照出现 `Clicked by user`；用户侧导航后 Agent 快照出现 `Shared page`；第二个 Patchwork Agent 仍保留自己的页面，普通 Agent 没有工具。初版 1440×900 窗口的侧栏导航与画面渲染通过。

本轮进一步使用独立 Playwright 打开隔离 DSH Web，选择 Patchwork preset，操作真实侧栏而非仅调用控制器。实际点击 JPEG 中的按钮后，远端页面向本地服务器发送回执；英文 `Kitchen 01` 和中文 `客厅一号` 均到达远端输入框。新建/切回标签、创建并选择 `en-GB` / `Europe/London` / 深色设备档案、接管/恢复 Agent 均通过。1440×1000 与 1000×760、宿主浅深色均检查；窄侧栏实际视口 543×392，没有横向溢出，状态栏在 footer 上方，控制台错误为 0。复杂快捷键、滚轮专项和长期高频帧仍待验证。临时 DSH Web 已停止，主 DSH 与当前宿主浏览器未改动。
