# 可选组件下载与安装

日期：2026-11-01。当前为未发布本地实现。用户显式操作安装器；运行 Agent、打开侧栏或安装插件依赖不会自动下载内核。

## 三个组件，一个入口

| 组件 ID | 安装内容 | 固定版本 | 如何使用 |
| --- | --- | --- | --- |
| `chromium` | 便携 Chrome Headless Shell，完整运行目录及原分发声明 | Playwright Core 1.64.1 / revision 1248 / Chromium 156.0.8078.4 | 环境档案中显式选择「便携 Chromium」 |
| `recorder` | 采样录像编码器及原分发声明 | Playwright FFmpeg revision 1013，按该驱动的平台 revision 解析 | 用户开启采样录像；最高 4 fps，停止后交付有效 WebM |
| `camoufox` | 配对的官方内核、独立 SDK 和独立 Playwright 驱动树 | 内核 v156.0.1-beta.36 / SDK 0.5.8 / driver 1.62.0 | 环境档案中显式选择 Camoufox；无 CDP，画面使用 JPEG |

Camoufox Windows x64 压缩包为 **1,311,638,126 bytes（约 1.22 GiB）**，不是小插件；安装前检查约三倍压缩包大小加 256 MiB 的可用磁盘。它不会随插件安装，也不会默认与另一内核同时启动。`plan` 返回本平台资产、来源、固定版本和已知大小；Playwright 资产没有在本目录承诺固定下载字节数。

## 使用

PowerShell，源码仓库根目录。以下目录仅为示例，请填明确要操作的独立实例目录：

```powershell
# 先看下载计划，不创建活动安装。
npm run components -- plan chromium --home 'C:\Temp\patchwork-components'
npm run components -- plan camoufox --home 'C:\Temp\patchwork-components'

# 只准备、校验，不激活；随后离线安装，不再请求网络。
npm run components -- download chromium --home 'C:\Temp\patchwork-components' --proxy 'http://127.0.0.1:7897'
npm run components -- install chromium --offline --home 'C:\Temp\patchwork-components'

# 也可以一步安装；缺少已校验下载时自动下载这个组件。
npm run components -- install recorder --home 'C:\Temp\patchwork-components' --proxy 'http://127.0.0.1:7897'
npm run components -- install camoufox --home 'C:\Temp\patchwork-components' --proxy 'http://127.0.0.1:7897'

npm run components -- list --home 'C:\Temp\patchwork-components'
npm run components -- verify chromium --home 'C:\Temp\patchwork-components'
```

已安装 npm 包提供 `patchwork-components` bin。可从装有插件的 profile 包目录用 `npx --no-install patchwork-components ...` 调用，同样必须传 `--home` 或显式设置 `DSH_HOME`。不传目录会失败，不推断主 DSH。源码兼容入口 `npm run setup:browser-recorder -- --home ...` 转到同一安装器。

安装后在对应实例的浏览器环境档案中选择内核。安装成功不改变默认系统 Edge/Chrome、不切换已有会话档案；内核缺失或损坏明确报错。运行中的内核先在面板关闭，再修改组件。

## 更新、回退与移除

```powershell
# 重新下载固定目录中的版本，再显式替换。
npm run components -- download chromium --refresh --home 'C:\Temp\patchwork-components'
npm run components -- install chromium --offline --replace --home 'C:\Temp\patchwork-components'
npm run components -- rollback chromium --home 'C:\Temp\patchwork-components'

# 卸载已管理的安装；另行清理下载缓存。
npm run components -- remove chromium --home 'C:\Temp\patchwork-components'
npm run components -- clean-cache chromium --home 'C:\Temp\patchwork-components'
```

- 默认重复安装先完整校验，已有正确安装直接复用。损坏的下载使用 `download --refresh`，损坏的活动安装使用 `install --replace`。
- 每个组件保留当前和一个 previous，使用原子选择文件切换。回退也核对平台、驱动、SDK、内核 pin 和完整清单；**不承诺未来不同驱动/SDK 之间直接回退**，升级目录须另行维护兼容策略。
- 替换、回退、卸载遇到运行读租约会拒绝；不会替用户关闭浏览器或录像。一个组件允许多个运行读者。
- 下载目录通过同盘 rename 交给安装目录，避免每次复制两份大内核；提交前失败恢复下载，活动选择不变。成功安装后清理可识别的孤立版本，保留一个 previous。`clean-cache` 同时清理该组件的下载和中断遗留 staging/previous，不清理其他组件。
- Ctrl+C / SIGTERM 取消流式下载和解压，停止本次官方安装器的进程树。失败清理 staging，释放操作锁；断电硬退出遗留的锁在后续操作按 PID 存活状态恢复。
- `remove` 写入显式移除标记，防止又读回旧安装；不会删除 `backends/` 中的 legacy 安装，也不会删除会话档案、Cookie 或登录密钥。legacy 数据需用户自行迁移/清理。

## 校验与边界

数据仅写入目标 `<DSH_HOME>/patchwork/browser` 下的 `components`、`component-downloads`、`component-locks`、`component-readers`。版本 manifest 存相对可执行路径、平台/架构、驱动/SDK/内核 pin、来源和完整 SHA256 文件清单。下载后、安装前、显式 verify 和进程启动前均核验；完整哈希会带来磁盘读取成本，不承诺零启动开销。

- Playwright 走固定 npm 驱动自带的官方 CLI，仅执行 `chromium-headless-shell` 或 `ffmpeg`，固定独立缓存并关闭浏览器 GC。不会调用 `install chrome/msedge` 或修改系统浏览器、全局缓存。
- Camoufox 根据 SDK 的 `browser-pin.json` 选择 beta.36，拒绝混用当时更新的 beta.41。只允许指定的 GitHub HTTPS 发行域及有限跳转；流式计算精确字节数和官方资产 SHA256，完整性错误不盲重试。没有任意 URL、镜像或 HTTP 降级入口。
- 大 ZIP 使用 yauzl 的懒条目和流式文件写入，不整体读入 Node 堆。拒绝越界路径、外部链接、重复文件、特殊文件类型和超过 8 GiB / 50,000 条目的展开；临时目录失败时清理。
- Camoufox 的 npm SDK 使用固定版本、独立缓存、独立 npm 配置、`ignore-scripts`，核对 SDK integrity 和实际 SDK/driver/browser pin。安装子进程的环境使用白名单，不继承模型 API key；代理只传给本次下载/安装。
- HTTPS 来源和本地文件清单不等于发行签名；Camoufox 官方资产 digest 也不替代签名。安装器不是供应链审计系统。
- 安装命令仅在用户 CLI 侧提供，不扩充 Agent 的浏览器 action。普通 preset 不会因此获得插件工具；切走 Patchwork、用户接管仍按既有授权规则拒绝写入。
- Windows 安装压平官方 runtime 目录，避免不必要的长路径；仍建议使用较短的实例目录。Linux 系统库、macOS 执行限制和其他架构需各自验收，不自动提权或安装系统依赖。

## 官方依据

- [Playwright 浏览器文档](https://playwright.dev/docs/browsers)及安装到本地的 `playwright-core@1.64.1/browsers.json`、registry worker 输出：驱动、revision 与官方下载地址。
- [Camoufox SDK 0.5.8](https://www.npmjs.com/package/camoufox/v/0.5.8)中的 `dist/data-files/browser-pin.json`：SDK 与内核配对来源。
- [官方配对发行](https://github.com/daijro/camoufox/releases/tag/v156.0.1-beta.36)的资产元数据：平台资产、大小和 SHA256。固定六个平台条目见 `src/browser/components/catalog.mjs`，不跟随 latest。
- [yauzl](https://github.com/thejoshwolfe/yauzl)：懒条目、条目大小检查和流式解压 API。依赖固定 3.2.0，许可证随 npm 依赖分发。

本轮验证及明确未验证范围见 组件验收报告。旧的资源/缺口报告保持其历史验收范围，不能替代本轮报告。
