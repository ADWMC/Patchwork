# 家居控制台 Step 5 实验记录

日期：2026-11-01。目标是让隔离 DSH 中的 StepFun Step 5 完成原始家居控制台题，并区分 Agent 交付与独立验收。主 DSH、用户当前浏览器和既有会话未参与。

## 模型运行

- 首次运行：Patchwork preset、独立 `DSH_HOME`、空任务工作区。模型请求 39 次，900 秒超时。Agent 在超时前写出了页面，但没有完成自己的浏览器验收或最终交付；原稿保存在 `artifacts/home-control-step5-v2-raw.html`，SHA256 为 `7FF73CD2DB4D1133ECE2FE0395DA131D4EF630EBB045C9EF9C9DC31638E5B379`。
- 初版 MCP 浏览器接入后的第二次运行：模型请求 7 次，约 255 秒后因 `max-tokens` 结束；只进行了技能与任务检查，没有写出 `home-control.html`。因此不能记为浏览器增强后的模型完成案例。原生浏览器修复后尚未重新进行模型端到端 UI 任务。

## 独立验收

用 `docs/experiments/2026-11-01-browser/validate-home-control.mjs` 对首次运行的原稿复核。桌面与手机视口、四设备操作、亮度和风扇设置保留、离家模式刷新后恢复、全部关闭与重置、键盘焦点、无外部网络请求和无页面错误均通过。验证产物截图为 `artifacts/home-control-step5-v2-desktop.png` 与 `artifacts/home-control-step5-v2-mobile.png`。

独立功能通过不等于 Agent 任务完成。视觉复核仍发现四张等权卡、说明横幅和桌面空白偏多；应交由用户审查，不计作技能质量改善数据。浏览器工具本身的双会话隔离验证见 [接入报告](../../browser-integration-research-2026-11-01.md)。
