# 浏览器与插件分发

日期：2026-11-01。当前为未发布本地实现；本文准备发行路径，不执行 npm/GitHub 发布，也不更改主 DSH。

## 采用的分层方式

| 层 | 当前状态 | 内容与边界 |
| --- | --- | --- |
| 插件 npm/tgz | 已有，并增加预检和安全打包入口 | 源码、已构建侧栏、技能、许可证和必要文档；不带浏览器、缓存、用户配置与登录状态 |
| 系统内核 | 默认路径已实现 | Windows 独立启动已安装 Edge；其他配置平台使用 Chrome；不连接现有窗口/用户登录目录 |
| 录像组件 | 可选安装器已有 | 在明确指定的 DSH_HOME 独立下载 Playwright ffmpeg，记录 hash；运行时不自动下载 |
| Camoufox | 统一下载/安装器和 Windows x64 真实内核已验 | 官方固定资产按 SDK pin 配对下载，核对发行 SHA256；独立 SDK/驱动，不塞进插件包 |
| Portable Chromium | 统一下载/安装器和启动适配已实现 | 官方 headless-shell 按平台单独获取；固定 Playwright 驱动与 revision，环境中显式选择 |

发行默认不捆绑 Chromium 整包，避免所有用户重复下载内核。插件包体和依赖安装体积分别列出；`npm pack` 的压缩大小不含生产依赖，不能宣传为完整安装体积。内存与磁盘体积也分别报告。

## 官方依据与本仓库决定

通过进程级代理 `gh api` 阅读 Playwright 官方 browsers 文档、npm 官方 `npm-pack` 文档，并核对本地固定 `playwright-core@1.64.1` 的 `browsers.json` 和实际 DSH 包版本：

- [Playwright 浏览器管理](https://playwright.dev/docs/browsers)：驱动与下载内核版本相关，支持品牌 channel、独立 `PLAYWRIGHT_BROWSERS_PATH` 缓存及 headless shell 安装选项。源码参考 [browsers.md](https://github.com/microsoft/playwright/blob/41d368a5c7e7a2f32f6109ba736af9f25cfacd3d/docs/src/browsers.md)。
- 同一文档明确提示 `install chrome/msedge` 会安装到操作系统默认全局位置；本插件安装器不调用这些命令替换系统浏览器。
- [npm pack](https://docs.npmjs.com/cli/commands/npm-pack)用于制作 tarball，区别于发布；官方[源码文档](https://github.com/npm/cli/blob/9ceb9c1d18d2c52a5c3328b4939e979baca7edea/docs/lib/content/commands/npm-pack.md)。本地 CLI 的 JSON/dry-run 结果用于本轮预检，不手拼包文件清单。
- 当前固定驱动包的 Chromium/headless-shell revision 为 `1248`，browserVersion 为 `156.0.8078.4`；本轮已通过独立安装器下载并真实启动验收。此前资源报告使用系统 Edge `156.0.4314.58`，两者报告口径分开。

系统 Edge/Chrome 会自行更新，因此系统模式不是逐字节可复现运行环境。发行说明固定记录驱动及验收时的系统内核版本；需要严格复现时再选择经验证的 portable runtime。

## 当前打包与试装

PowerShell，在仓库根目录：

```powershell
npm run build:client
node scripts/build-client.mjs --check
npm test
npm run check:release
npm run pack:local -- --pack-destination 'C:\Temp\patchwork-release'
```

`check:release` 运行 `npm pack --dry-run --json --ignore-scripts`，核对必需入口、许可证、资源模块、说明文档和报告，拒绝用户状态目录、常见凭据文件、日志、浏览器二进制/压缩包，并核对 profile 引用与插件版本、无安装生命周期下载钩子。路径检查不能替代人工凭据审查和第三方依赖审计。

`pack:local` 默认只把 tgz 放到系统临时目录的 `patchwork-pack`，不会安装、启动 DSH 或发布。历史 `scripts/publish.mjs` 仍保留入口，但行为已改为默认只打包。安装必须显式同时提供 `--install --profile NAME` 和环境变量 `DSH_HOME`：

```powershell
# 使用新的独立目录；先按 DSH 的 profile 初始化流程准备验收实例。
$env:DSH_HOME = 'C:\Temp\patchwork-release-test'
npm run pack:local -- --pack-destination 'C:\Temp\patchwork-release' --install --profile patchwork-test
```

以上仅为目标目录已准备好的操作示例。本轮没有执行安装步骤；主 DSH 不在自动验收范围内。试装后在该独立实例中明确选择 Patchwork preset，再检验普通会话工具不可见、切走撤权、默认资源限制和可选组件缺失提示。

随包 profile 模板已从过期的插件 `0.1.2` 改为当前包版本 `0.2.0`，宿主依赖对齐本机核对到的 `dsh-base/dsh-web-app@0.2.1-rc.2`。**当前变更尚未发布，模板不是获取本轮源码的在线安装地址**；验证本轮必须使用本地 tgz。正式发行应先定新版本、同步 profile 引用、再验收，不覆盖已发布版本。

## 可选组件已实现合同

统一 CLI 已实现以下边界，完整用法见[组件安装说明](browser-components-2026-11-01.md)：

1. 环境明确选择系统 Chromium、便携 Chromium 或 Camoufox，缺失 runtime 明确报错；不静默切换身份或下载。
2. 安装器支持 plan/list/download/install/verify/rollback/remove/clean-cache，使用目标 `DSH_HOME/patchwork/browser/components/<id>/versions/<uuid>`，通过 staging、读写租约和原子 `current.json` 选择切换。与系统浏览器目录及主缓存隔离。
3. manifest 包含平台/架构、驱动、revision、来源、分发文件/关键文件 hash 与验证日期；启动验证 hash 和路径归属。不能把仅本机算出的 hash 宣传成上游签名或供应链证明。
4. 本轮真实验收 Windows x64；Linux、macOS 和其他架构仍需分别验收。缺系统库时报告人工安装要求，不自动请求管理员权限。headless-shell 已验证导航、点击、截图、静态页面实时流和内存采样，不能等同于完整 Chromium 的全部能力。
5. `download` 准备包含干净运行文件、manifest、原分发声明和来源的组件，`install --offline` 只消费这些已校验文件；manifest 使用相对路径。未实现独立签名的离线 runtime 分发包。搬运仅可针对兼容平台/架构/驱动的组件下载目录，不复制 `profiles`、Cookie、DPAPI 密钥、日志或用户配置。
6. 保留一个 previous 供显式回退；核对当前 catalog/driver/SDK，不承诺任意跨版本回退。组件仍有运行读租约时，替换/回退/卸载均拒绝；不会扫描或杀死用户浏览器。取消安装仅停止本次创建的官方安装器进程树。

浏览器、字体、媒体组件等携带各自的第三方声明；Patchwork 的 AGPL-3.0-only 不替代它们的许可。发布 runtime 资产前核对原分发许可和必要声明，不在本轮作二进制再分发权利的扩大承诺。

## 验收与发行门槛

资源管理阶段记录见原报告；统一安装器和真实 portable/Camoufox/录像验证见组件报告。完整新 tgz 的干净实例安装、完整原生侧栏端到端、跨平台及长期内存压力测试仍是后续发行门槛，不以组件探针代替。
