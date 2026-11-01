# 浏览器工作台与指纹环境升级

> 后续实施已更新至[浏览器缺口补齐执行记录](browser-gap-execution-2026-11-01.md)。本文保留前一阶段的设计与验收快照；其中“未加密、无死亡锁恢复、无流/文件传输”等历史限制已由后续实现替代。以执行记录和当前代码核对现有能力。

日期：2026-11-01。目标是改善用户与 Agent 共用浏览器的真实工作体验。ZCode 是交互参照；未执行同题、同模型、同环境对照前，不宣称性能或质量已经超越 ZCode。

## 调研与选择

开源指纹浏览器候选、管理器/内核许可边界与身份升级策略见[指纹浏览器专项](fingerprint-browser-research-2026-11-01.md)；其中新后端均为待验证方案，不属于本文已实装的档案功能。

ZCode 的浏览器承载、共享登录分区、命令隔离、标签恢复和证据交付现另有[专项源码调研与融合方案](zcode-browser-research-2026-11-01.md)。专项是待实施建议，不改变本文已验收功能的范围；特别是其标签 handoff 不能等同于我们现有的用户强接管。

通过 GitHub CLI 和本机 Git HTTP 代理核对：

| 项目 | 可迁移能力 | 本轮决定 |
| --- | --- | --- |
| [ZCode](https://github.com/zai-org/ZCode) | 可见共享页面、标签身份、生命周期和会话所有权 | 延续此前本地源码调研，补齐标签、用户接管和帧身份 |
| [Apify fingerprint-suite](https://github.com/apify/fingerprint-suite) | 贝叶斯指纹生成、HTTP headers 与 JS 环境注入，Node / Playwright 接口，Apache-2.0 | 选用 `fingerprint-generator` / `fingerprint-injector` 2.1.89；保存完整生成样本，避免每次访问随机变化 |
| [Camoufox](https://github.com/daijro/camoufox) | Firefox 原生环境修改；当前上游有官方 Node 接口、fpgen 与一致性检查 | 需要独立 Firefox 构建和部署链；不替换当前用户安装的 Edge / Chrome；补充源码依据见[社区再调研](browser-community-research-2026-11-01.md) |
| [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) | 修改 Chromium 自动化驱动 | 不把驱动补丁等同于环境一致性，保留独立后端扩展的可能 |

Apify 依据：根 README、`packages/fingerprint-injector/src/fingerprint-injector.ts` 和 generator 源码。其 context helper 同时设置 UA、viewport 和 Accept-Language，并在文档创建前注入 JS 环境。必须实测 Chromium 主版本、HTTP UA、JS UA、语言、时区、screen / viewport 和 resize 行为；不把“注入成功”视为所有检测点一致。

## 本轮交付与验收

1. 多标签：Agent 与侧栏共享 tab id、标题、地址和选择状态；限制数量；关闭一个标签不影响其他标签。
2. 环境档案：用户创建和切换会话私有档案；保存环境参数或完整指纹样本、语言、时区、视口、外观和代理地址。模型只读脱敏摘要，档案 API 不返回原始 Cookie、存储或代理凭据；网页自身显示的信息仍可被正常快照和截图观察。
3. 存储：默认临时环境；显式开启时保存当前会话、当前档案的 Cookie / localStorage / IndexedDB 状态；其他会话和同目录 Agent 均不可复用。关闭持久化和删除有明确效果。
4. 接管：用户可暂停 Agent 写操作，观察工具继续可用；恢复由用户操作，Agent 不得自行抢回。
5. 并发与画面：操作串行化，画面携带标签与代次，拒绝旧画面的点击和键盘输入；隐藏面板停止请求。
6. 验证：单元隔离、真实 Chromium 环境探针、独立 DSH_HOME 的宿主调用和侧栏渲染。记录未覆盖项；维护 README、CHANGELOG 和第三方声明。

## 边界

此方案是隐私与可重复测试的环境管理能力。JS 注入不是原生浏览器内核修改，不保证 TLS、网络出口、WebGL、Canvas、Audio、Worker 与所有检测面完全一致；不自动猜测代理 IP 地区，不通过环境档案授予更多网络或文件权限。已有主 DSH 和宿主浏览器保持独立。

## 执行结果

本轮实现与隔离验证已完成，尚未发布新版本。完整指纹模式为实验能力；本机实际可用的是原生环境、设备模板和私有环境管理。

### 环境模式与兼容决定

| 模式 | 已实现行为 | 验证与限制 |
| --- | --- | --- |
| 原生环境 `native` | 保留真实引擎 UA，配置语言、时区、视口、屏幕、DPR、外观和代理；内置临时环境不保存登录 | 真实 Edge 已验证 HTTP UA 与 navigator UA 一致；不声称所有硬件特征均已随机化 |
| 设备模板 `device` | 保存稳定的设备环境参数；未显式指定屏幕和 DPR 时从 Apify 样本取值，保留真实引擎身份 | 真实 Edge 已验证语言、时区、外观、屏幕、视口及 resize；不是每档案一套独立 CPU/GPU 指纹 |
| 完整指纹 `fingerprint`（实验） | 保存 Apify 完整样本；启动前核对 Chromium 主版本，使用公开脚本接口注入，保留原生可调整视口 | 本机 Edge `156.0.4314.50` 无匹配样本，实际启用被明确拒绝，原页面保留；匹配版本下的完整注入尚未实测 |

兼容门当前只核对 Chromium 主版本。版本相同不等于 Edge/Chrome 品牌、HTTP client hints、UAData、Worker 等全部一致；需要逐项验证后才可扩大能力声明。没有静默回退为旧版 UA，也没有修改主机安装的浏览器内核。

### 实现位置与使用流程

- `src/browser/policy.mjs`：导航与工作区真实路径校验、浏览器启动环境白名单、参数边界和错误脱敏。
- `src/browser/profiles.mjs`：会话私有档案、版本校验、目录锁与原子写入、代理引用及有界登录状态。
- `src/browser/session.mjs`：独立浏览器和 context、最多 8 个标签、popup 数量限制、服务端动作队列、用户接管与画面身份。
- `src/browser/tool.mjs` / `route.mjs`：Agent 工具与侧栏共用同一实例；请求前后核验真实 Agent 身份和 preset。
- `src/client/BrowserPanel.jsx` / `panel-styles.mjs`：跟随 DSH token 与明暗外观的侧栏、多标签、环境表单、中文输入、控制权提示和窄屏适配；`lib/client.js` 同步构建。

使用：选择 Patchwork preset → 侧栏 Patchwork → 浏览器 → 输入地址。可在“管理环境”创建或编辑未使用的档案，再选择环境。切换环境会关闭该环境当前标签，切换前先校验新 context；不兼容时保留原页面。点击页面、键入、导航或切标签会自动接管，Agent 只能继续观察；点击“恢复 Agent”才允许 Agent 再操作。中文可点击“文”，先在远端页面选中输入框，再发送文字。

每帧带有 tab id、文档/视口代次和 frame id，动作必须携带对应身份。导航、标签或视口变化后拒绝旧画面的输入；同一代次的轮询保留 frame id，避免连续键入被轮询打断。图像坐标按画面自身视口换算，帧和状态共用服务端动作队列。

### 存储与代理边界

档案按真实 session id 的 SHA256 分目录，位于 `DSH_HOME/patchwork/browser/<session-id-hash>/`，不按 cwd 共享。最多 8 个用户档案，另有内置临时环境。元数据上限 512 KiB，登录快照上限 2 MiB；登录保存默认关闭。

显式开启后，在关闭浏览器、切换环境、仍获授权且空闲的正常释放时保存 Cookie / localStorage / IndexedDB。崩溃、忙碌中释放或切走 preset 不保证保存；不保存 sessionStorage、下载或完整浏览器用户目录。关闭保存会删除磁盘副本，清除登录会关闭该档案当前 context 并删除快照。配置编辑和存储写入共用锁，写回前复核当前开关，避免关闭后迟到写回。快照未加密，不是 OS 级秘密隔离；同机具有文件权限的进程仍能访问。崩溃遗留目录锁的自动恢复尚未实现。

HTTP(S)/SOCKS5 代理属于单个 context。凭据只接受环境变量名称，模型只见 `configured` 摘要，不返回地址和凭据引用；用户管理表单可见配置地址和变量名，不返回密码值。SOCKS5 认证明确拒绝。代理地区与语言、时区不自动推断或强行匹配。

### 实际验收记录

| 层级 | 已执行内容 | 结果 |
| --- | --- | --- |
| 全仓测试 | `npm test` | 243/243 通过，0 失败、0 跳过 |
| 浏览器单元 | `node --test tests/browser-tool.test.mjs` | 12 项通过；覆盖隔离、撤权、标签上限、接管、旧帧、稳定帧身份、档案版本、存储边界、代理脱敏、启动取消、正常释放保存和队列恢复 |
| 真实 Edge 探针 | 独立 headless Edge `156.0.4314.50` | 8 组通过；环境与 HTTP/JS UA、真实像素点击、接管和旧帧拒绝、三类存储恢复、跨会话隔离、多标签与超限 popup、清登录、HTTP 代理、不兼容指纹保留页面和 preset 释放 |
| 真实 DSH 工具 | 独立 `DSH_HOME`，DSH `0.2.1-rc.2`；仓库内 `docs/experiments/2026-11-01-browser/probe.mjs` 与 overlay | 两个 Patchwork Agent 有工具，普通 Agent 无工具；`firstSeesSecond: false`；侧栏 JPEG 与 Agent 同页、390×844 视口、截图 image block、关闭 A 不影响 B、本地文件允许/拒绝均通过 |
| 完整侧栏 UI | 独立 DSH Web，由独立 Playwright 操作真实侧栏 | 真实 JPEG 点击触发远端页面回执；英文及中文输入、多标签、创建并切换欧区设备档案、接管与恢复通过；控制台错误 0 |
| 布局 | 1440×1000 / 1000×760，宿主浅色与深色；窄侧栏实际视口 543×392 | 无横向溢出，底部状态栏在宿主 footer 上方，截图目视复核通过 |

完整侧栏验收没有使用宿主现有浏览器标签，也没有修改主 DSH。临时 DSH Web 已停止。UI 测试是固定测试页面的交互验收，不是模型生成页面的质量评分；没有新跑 Step5 回合、营销分数、ZCode 同条件对照或完整指纹反检测测试。

### 升级注意与后续验收

HTTP `/frame` 仍返回 JPEG，新增 `x-patchwork-frame-id`、`x-patchwork-tab-id` 和 `x-patchwork-viewport` 响应头。内部 `client.frame()` 改为 `{ image, frameId, tabId, viewport, epoch }`，`client.status()` 改为异步；自定义控制器调用方需同步更新。DSH 工具 schema 中空的标签/引擎字段使用空字符串，避免不支持的联合类型。

仍待单独完成：匹配 Chromium 的完整注入及品牌/client hints/UAData 一致性、跨平台启动、认证代理与 HTTPS CONNECT、滚轮专项、复杂快捷键、长期并发与崩溃恢复。JPEG 当前不提供原生 DOM 选择、拖放、文件上传下载或完整视频流；不因实现了环境档案而声称具备这些能力。
