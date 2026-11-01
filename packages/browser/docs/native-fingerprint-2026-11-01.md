# AliasMode 原生指纹：实现与隔离验收

日期：2026-11-01。独立可选包 `@patchwork/browser@0.2.0`，本地未发布。承接[社区指纹浏览器研究](../../../docs/fingerprint-browser-research-2026-11-01.md)及此前[指纹更换记录](fingerprint-switching-2026-11-01.md)，不是重新设计另一套浏览器。

## 固定内核与分发

| 项目 | 本轮实际值 |
| --- | --- |
| 平台 | Windows x64；其他平台尚未验收，安装器明确拒绝 |
| AliasMode 发布 | `v155.0.8059.85-aliasmode.4` |
| 实际浏览器版本 | `155.0.8059.85`，启动时精确校验 |
| 驱动 | 既有 `playwright-core@1.64.1`；未增加驱动依赖 |
| 下载资产 | `aliasmode-chromium-155.0.8059.85-windows-x64.zip` |
| 下载字节 | `203519527`，约 194.1 MiB；不是插件包大小或运行内存 |
| SHA256 | `cfea275e4b7f3274b701e64c0483b46cbf6cd12ead9a6cfda6ff77b2680e7a23` |
| 发行源码 | [3900a207abab317348c5c5c43adbaf0c2d47c725](https://github.com/aliasmode/aliasmode-chromium/tree/3900a207abab317348c5c5c43adbaf0c2d47c725) |

初次调研的仓库快照为 `8aa0a24…`，实现使用发布资产对应的 `3900a207…`，不混用两个源码版本。摘要来自上游 release 元数据并在下载后核对；它不是签名或可复现构建证明。AliasMode 项目标记 GPL-3.0，Chromium 与依赖保留自己的 notice，见[第三方说明](../THIRD_PARTY_NOTICES.md)。

二进制不进入主包或可选插件包，无 postinstall／首次运行静默下载。使用明确的隔离目录：

```powershell
node packages/browser/scripts/browser-components.mjs plan aliasmode --home C:\path\to\isolated-dsh
node packages/browser/scripts/browser-components.mjs install aliasmode --home C:\path\to\isolated-dsh --proxy http://127.0.0.1:7897
node packages/browser/scripts/browser-components.mjs verify aliasmode --home C:\path\to\isolated-dsh
```

安装器继续支持下载／离线安装／显式替换／上一版本回退／卸载／清缓存，组件在用时拒绝修改。Windows 实测发现 ZIP 原长目录使 renderer 出现 `Render process gone`；现统一扁平为版本目录下的 `runtime/chrome.exe`，保留资源与 notice。不能仅以 launch 返回就判断可用，必须实际建页。

## 身份与会话契约

- 新增“原生指纹”使用 `aliasmode-seed-v1`、正 uint32 种子、固定 release 与 Windows 平台。档案输入不接受任意 seed／内核配置；读取校验 schema，拒绝 JS 样本和原生身份混用。
- 原始身份保存在当前会话的私有档案中，公开的是摘要 ID、revision、schema 和 release。面板／模型结果不含种子，启动参数错误也作脱敏；配置目录仍应按用户私有数据保护。
- 同档案重读和改语言／时区保留 seed 与设备摘要；屏幕／DPR 变化递增身份 revision。“更换指纹”生成新 UUID、新 seed、新存储命名空间，沿用区域／代理／保存偏好，**不复制旧登录**。
- 原生身份固定于进程，启动参数由受控字段构造。context 不覆盖 UA，不加载 Apify 注入。旧 JS 路径继续严格检查样本主版本，不把它应用到 Firefox 或原生内核。
- 组件缺失／文件损坏在关旧页前拒绝。正常切换先保存已授权持久登录，最多 2 MiB 回滚状态只留内存；关闭本会话旧进程后再启动新身份，不同时占两个资源槽。
- 目标启动失败尝试用旧身份、旧网址与旧登录重开。回滚也失败时保留恢复网址并明确报错。录像／文件传输／下载授权期间拒绝切换；未提交表单、JS 内存和浏览历史不承诺恢复。
- 档案编辑／更换仅允许用户面板；授权仍按实际 DSH Agent 作用域注册。停用或切模式撤权，旧 client 不能继续调用；其他会话的页面、身份和工具不受影响。

## 原生界面

仍复用 DSH Button、Input、Menu、Switch 和主题 token。顶部“指纹”中新增原生入口，单独保留 JS 指纹入口；显示组件安装状态，未装时禁用使用并提示显式安装命令。已有档案锁定内核／身份模式，改类型需新建隔离登录环境。

真实 UI 验证通过新增、外观选择、保存、使用、确认生成替代身份和切换。1100／900／380／320px、浅／深色无横向溢出，无原生 select 弹层，控制台错误为零。已实际查看桌面和 320px 截图；界面不注入用户访问的网页。

## 真实验收与复跑

机器证据见 [native-fingerprint-2026-11-01.json](checks/native-fingerprint-2026-11-01.json)。测试使用专用 `fingerprint-native-home`，不修改主 DSH、不连接用户宿主浏览器。原生内核与查看 UI 的私有 Edge 都独立启动；Browser 插件不可用，因此 UI 使用私有 Playwright 验证。

测试通过实际 DSH/Cordis Loader、原生工具注册表与 Agent 作用域执行，未加载 Patchwork 主运行时、未发模型请求，也不是完整 DSH 客户端端到端模型回合。

```powershell
node packages/browser/tests/native-browser.acceptance.mjs --home C:\path\to\isolated-dsh --output C:\path\to\native-acceptance.json
node --test "tests/*.test.mjs" "tests/real-composition/*.test.mjs" "packages/browser/tests/*.test.mjs"
node packages/browser/scripts/build-client.mjs
node packages/browser/scripts/check-release.mjs
```

验收脚本不安装组件，要求先显式安装；创建两条专用测试会话，结束时关闭它们的进程。它保留测试会话的私有档案以便追溯，不改用户原有会话。

| 验收项 | 实际观测 |
| --- | --- |
| 真实工具操作 | 通过 DSH `patchwork_browser` 填设备名、设置省电开关；另一会话的输入保持为空 |
| 新身份是否真正变化 | 生成时源页面不变，显式使用后重启进程，Canvas 输出哈希变化；不只检查配置 ID |
| 同身份重启 | UA／高熵 UAData／平台／CPU／内存／GPU／语言／时区／screen／DPR／Canvas 与重启前一致 |
| 登录隔离与恢复 | 新身份 Cookie／localStorage／IndexedDB 均为空；回到源身份恢复三类已允许保存的登录标记 |
| 两会话 | 换身份、重启、注入启动失败和撤权期间，另一个私有原生会话的实测身份与页面保持可用 |
| 回滚 | 一次性注入目标 launch 失败，原身份、URL 和三类登录恢复；两条会话运行时从未出现第三套内核 |
| 画面能力 | 真实截图和 CDP 帧均有数据，组件退出后测试剩余引擎为零 |
| 数据边界 | 用户状态与模型 profiles 结果没有原始 seed；停用后工具消失、旧 client 被拒绝 |

专项单元测试另外覆盖无效 seed／schema／release、JS 混用、跨会话档案、禁止模型编辑、固定种子／revision、缺组件／文件篡改／错版本、取消与撤权时晚到进程清理、双重启动失败保留恢复网址。它们验证控制逻辑，不替代上述真实内核验收。

本轮全仓回归 **329 项通过，0 失败、0 跳过**。可选包客户端已重新构建；主包与可选包的发布 dry-run 均通过，主包无浏览器文件／运行依赖／客户端入口，两包均无安装钩子，可选包无内核二进制。未发布 npm。

## 自检覆盖与明确限制

本地健康检查实测：配置 5 项、同源 iframe 8 项、Dedicated Worker 4 项、本地 UA／语言请求头 2 项、Canvas 重复读回／toBlob／主线程 OffscreenCanvas 3 项，以及 Client Hints 8 项。Client Hints 比较 JS 和实际收到的低／高熵请求头、品牌／完整版本／平台／platformVersion，并与实际内核版本核对；缺字段保持 unknown，不因“存在请求头”判通过。

尚未验收跨域 iframe、Shared／Service Worker、Worker 内 OffscreenCanvas、WebGPU、Audio／字体全部表面、WebRTC、出口 IP、TLS 或第三方反检测站。屏幕与视口按档案设置，显式 resize 可能改变几何，自检会反映差异；不以重写 getter 掩盖。没有运行统一条件内存基准，本轮不宣称降低内存占用、匿名或绕过站点检测。

这次接入补齐了可用的原生指纹路径、真实更换和隔离验证；它没有让 JS 旧样本兼容性问题自动消失，也不把未测表面宣传为完整覆盖。
