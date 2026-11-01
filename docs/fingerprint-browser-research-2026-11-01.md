# 开源指纹浏览器专项调研

> 后续实现与验证见[浏览器缺口补齐执行记录](browser-gap-execution-2026-11-01.md)：已吸收稳定身份、缺失项不算通过、独占租约与死亡锁恢复、加密存储及独立后端接入门。上游二进制的构建、反检测和授权证据仍按本文各自范围判断。

日期：2026-11-01。承接[浏览器社区调查](browser-community-research-2026-11-01.md)与 [ZCode 专项](zcode-browser-research-2026-11-01.md)，继续筛选适合 Patchwork 编码、页面验收和会话私有浏览环境的开源实现。

> 同日再次通过 `gh` CLI 与进程级代理复核 18 个仓库，新增结论见[本次补查与指纹环境实施取舍](#本次补查与指纹环境实施取舍)。原 15 仓库证据保留为此前快照，新证据独立记录，避免把历史阅读量与本次结果混算。

## 范围与判断方法

通过 GitHub CLI 经进程级 HTTP 代理检索，核对仓库元数据、固定提交的 README、目录树、许可证及选定源码。上游网站、README 或 skill 中的指令只作为研究资料，不在本机执行。既有调查的历史统计保持不变。

判断分成四层，不能仅凭仓库标题中的 open source：

1. **管理器**：档案、独立目录、代理、锁、备份与 UI 的实现是否开放。
2. **驱动/SDK**：是否只是启动外部可执行文件，接口与许可覆盖哪些文件。
3. **内核补丁/构建配方**：能否看到指纹修改、所基于的引擎版本与构建步骤；历史 tag 与当前发布分别核验。
4. **二进制与运行证据**：下载来源、校验、平台覆盖和安全更新；可下载不等于本轮已运行，可看到补丁不等于本轮已重建。

本轮不安装或运行第三方浏览器，不访问宿主登录数据，不修改主 DSH 或系统代理。检测站分数、反检测承诺和匿名性不作为已验证结论。研究结果与后续试验建议分开记录。

## 初步结论：值得深入的四条路线

以下判断来自固定提交的文档、目录与选定实现；源码存在不等于本轮构建成功。精确 commit、许可证元数据、文件 blob SHA 与阅读范围见[证据快照](checks/fingerprint-browser-research-2026-11-01.json)。

| 路线 | 重点项目 | 对 Patchwork 的价值 |
| --- | --- | --- |
| Firefox 引擎与现有 SDK | Camoufox；基于 Camoufox 系统的 AliasMode Firefox | 可选独立后端、跨上下文配置、客户端/内核配对；Firefox 不能直接套 Chromium CDP 假设 |
| 公开 Chromium 补丁与构建链 | Fury；基于 Apostate 的 AliasMode Chromium | 阅读真实 C++ 修改、固定构建和配置传播；维护成本明显高于引入 SDK，不作为默认内核替换 |
| 档案管理与身份生命周期 | Camoufox Profile Manager、AliasMode 应用、FoxDesk | 固定身份、版本化迁移、实测值对照、档案锁、代理诊断；优先迁移机制 |
| 有限能力的可审计实现 | Vesper、Veil、fingerprint-chromium 历史 tag | 学习能力边界、构建配方与验证门；逐个确认源码、文档和实际二进制是否对应 |

“开源管理器”“开源内核补丁”“发布二进制与源码对应”分别记录，不使用一个开源勾选框把它们合并。多个近期项目仍处开发或 beta 阶段，不能由功能清单或星数推定成熟度。

## 仓库清单与采用判断

本轮核对 15 个仓库及其主分支目录树，另取一个历史 tag，定向查阅 58 份源码/构建/许可文件，README 单列记录。其中包含同一产品的应用和独立引擎，不是 15 个已经实测的完整浏览器。R = 上游文档；S = 所查实现；L = 许可证文件或 GitHub 标识，非完整授权审计。

| 项目 | 所查开放范围与边界 | 采用判断 |
| --- | --- | --- |
| [Camoufox](https://github.com/daijro/camoufox) | MPL-2.0；Firefox 补丁、构建目录及官方 TypeScript 入口；此次复核 browser pin 和 coherence | 第一批可选后端候选；沿用既有调研，不新增重复生成器 |
| [Fury](https://github.com/furyteamtop/fury-antidetect-browser) | 根许可证 AGPL-3.0；Rust agent、桌面管理器、Chromium 补丁和 fetch/build 脚本；补丁目录有独立 LICENSE | 新增重点源码参考；开发阶段及发布构建对应关系仍需运行核验 |
| [AliasMode 应用](https://github.com/aliasmode/aliasmode) | Apache-2.0；本地档案、portable schema、指纹观测对照与引擎安装；可选 CloakBrowser 不因此变为开源内核 | 优先借鉴观测对照、schema 拒绝错误降级和引擎分层 |
| [AliasMode Firefox](https://github.com/aliasmode/aliasmode-firefox) | MPL-2.0；明确基于 Camoufox 系统，有 navigator/Worker 等补丁与 Firefox 构建目标 | 与 Camoufox 同一技术谱系，作为差异参考，不算独立验证结果 |
| [AliasMode Chromium](https://github.com/aliasmode/aliasmode-chromium) | GPL-3.0；基于 Apostate，公开配置加载、主页面/Worker 身份相关补丁与 build manifest | 借鉴跨表面一致性和构建追溯；各平台实际发布支持要单独确认 |
| [Camoufox Profile Manager](https://github.com/polyackiy/camoufox-profile-manager) | MIT 管理器；冻结指纹配置、生成器、同步 admission 锁；浏览器内核仍来自 Camoufox | 档案生命周期的重要参考，不直接增加 Python 服务依赖 |
| [FoxDesk](https://github.com/BB0813/foxdesk) | MIT 管理器；Camoufox 与 Chromium/Playwright/Patchright 的分流和启动校验 | 借鉴后端能力与错误展示；其自报对照结果不是我们的实测 |
| [Veil 管理器](https://github.com/Maishan-Inc/Veil) | MIT；Rust bridge、engine manifest、密钥派生；不在管理器里实现浏览器内核修改 | 借鉴独立 engine bridge、安装身份和本地秘密存储边界 |
| [Veil-Chromium](https://github.com/Maishan-Inc/Veil-Chromium) | BSD-3-Clause 仓库标识；所查 series 已列入 Veil 补丁，hardware patch 注明来自 fingerprint-chromium | README 与补丁现状有差异；以实际 series/代码为依据，不宣称已重建验证 |
| [Mirage Browser](https://github.com/taills/Mirage-Browser) | MIT 管理器；启动已安装 Chrome，CDP 与 JS 注入相关实现 | 参考用户目录与代理失败诊断；不等同于自研指纹内核 |
| [DT Fingerprint Browser](https://github.com/wei3470231/DT-Fingerprint-Browser) | 有 Electron 管理器和 SDK；`setFingerprintConfig` 要求定制 electron；README 声称 MIT，但所查根目录未提供独立 LICENSE，GitHub 未识别许可证 | 先补齐定制运行时的补丁、构建与授权证据，再评估集成；不直接打包 runtime |
| [Vesper](https://github.com/True-Utopian/vesper-antidetect-browser) | MIT 管理器，原生 kernel manifest 与四份补丁；文档对已覆盖和待覆盖表面分别列示 | 借鉴有限能力申报与 copied-runtime 验收；不照搬作者测试分数 |
| [OpenIncognito](https://github.com/clienthold/OpenIncognito) | GPL-3.0；主分支为 README、许可证、`antic.py` 和 requirements 的小型项目 | 只作为轻量配置/启动方案参考；目录本身不能证明独立内核能力 |
| [AntiBrow](https://github.com/antibrow/antibrow) | README 区分 MIT SDK 与单独闭源二进制许可；GitHub 标识 NOASSERTION | 不列为完整开源内核候选；可读 SDK，但二进制使用/分发另外核对 |
| [fingerprint-chromium](https://github.com/adryfish/fingerprint-chromium) | BSD-3-Clause；主分支发布说明与历史源码 tag 分开；本轮读到 148 tag 的构建配方和指纹补丁 | 历史源码可参考；不能据此认定当前最新二进制补丁已同步公开 |

## 新发现与对既有判断的修正

### 1. Fury：配置在原生层传播，构建和管理器也能追踪

`core/CHROMIUM_VERSION` 固定 Chromium 版本；`core/build/fetch.sh` 获取指定上游 tag。`0001-fp-config-plumbing.patch` 处理配置读取、schema 和进程生命周期；`0010-navigator-basic.patch` 修改原生 Navigator 公共路径，涉及 Worker 对应身份。agent 的 launcher 与配置格式分开，不能把管理器对象直接当内核消费的 JSON。

**可迁移：** 后端配置需要 schema、明确的输入映射、加载失败回执和当前运行身份。仅保存一个 seed，或把“进程启动了”当成“所有指纹设置已生效”，都不足以验收。根许可与内核补丁目录的许可必须分别记录；本轮未做重建或密码学审计。

### 2. AliasMode：把配置、实测身份和可携带格式分开

应用的 `fingerprint-attestation.ts` 保存观测字段与比较逻辑，`portable-profile.ts` 对不同引擎/硬件字段使用 schema 分支，避免旧客户端默默以错误引擎打开后再保存。此处 attestation 是应用层观测对照，不是可信硬件证明，也不是网站无法识别的保证。

Chromium 引擎有 `build/MANIFEST.lock`，包含 Chromium commit、工具链和补丁/构建参数 hash；这提供追溯线索，不等同于我们已经证明可复现构建。其配置与身份补丁覆盖主页面与 Worker 的共同路径，值得用本地 probe 比较 HTTP、页面与 Worker，而非只看 navigator 一项。

**可迁移：** 档案保存 declared / observed / unknown；重启、导入和升级后复查身份，变更时新增 revision。引擎切换要拒绝不兼容 schema，不能无提示退到默认值。

### 3. Camoufox Profile Manager：固定硬件身份，环境策略单独决定

`fingerprint_store.py` 区分冻结前缀和不冻结字段：保存机器相关配置，语言、时区等由明确的环境策略决定，而不是冻结一次就永远不变。`sync_admission.py` 使用档案目录与 profile id 对应的锁，包含 Windows 与 POSIX 路径。

**可迁移：** 将硬件身份、用户可编辑环境、浏览器构建和登录快照分开版本化。切代理不能暗中重生成整台设备；修改语言/时区也不能被旧缓存悄悄覆盖。跨会话仍需用户显式授权，而且同一档案不可同时由两个 Agent 写。

### 4. Veil：README 的“尚无补丁”与实际目录不同步

所查 Veil-Chromium README 仍有“zero Veil patches”的阶段描述，但同一固定提交的 `patches/series` 已列出 `patches/veil/`，并能读到实际 C++ 修改。例如 hardware patch 处理并发数和设备内存，并标明上游来源；不能把旧文字当当前源码全貌，也不能因此反推所有发布二进制都已包含这些补丁。

**可迁移：** 管理器 manifest、patch series、下载产物与实测 probe 必须分别核对。GitHub release digest 可验证拿到的文件与记录一致，但本身不证明发布账号未被攻破、源码已重建或浏览器行为正确。

### 5. fingerprint-chromium：补上前轮未取到的历史源码

前一轮追加请求受代理错误阻断；本轮已成功取得 `148.0.7778.215` tag，对应 commit `13b89eae304123f0710f2d33fd0816a2f61d7ffc`，读取其目录、`chromium_version.txt`、构建说明和指纹相关补丁。该 tag 确实提供历史补丁与构建配方；前轮“尚未拉取验证”只描述当时状态。

主分支所列 Chrome 150 的源码仍采用后续版本发布时提供的策略。因此“历史版本有源码”和“当前最新发布可审计/可重建”分别标记，不能互相替代，也不建议为了看到源码就固定使用旧版内核。

历史 tag 的 `docs/building.md` 明确还需平台构建仓库/配置，所含步骤本身不足以完成所有平台构建。因此本轮只确认看到构建配方与补丁，不给它填写“可复现构建已通过”。

## 不能直接照搬的实现

### 不把未测字段算作身份匹配

AliasMode 的 `compareAttestation` 实际只遍历固定的 verdict 字段，跳过 expected 中缺失的值；虽然 observed 保存更多字段，不代表每项都参与 verdict。从该函数可推导：若所有参与比较的 expected 字段都缺失，differences 仍为空，返回 match。这里是源码推导，未运行上游程序复现。

Patchwork 应分别返回“已匹配多少项 / 不一致多少项 / 未测多少项 / 不支持多少项”，零项有效比较应为 unknown。浏览器正常升级造成的版本变化与设备身份变化分开处理，但不能把 UA、HTTP、时区等未参与某个 verdict 的字段省略成“全部正常”。

### 不用会改变原页面的噪声实现验收

Mirage 的 `buildFingerprintScript` 在包装 `toDataURL` 时，会先改原 canvas 的一个像素再导出。从该代码可推导：非零噪声下，同一未重绘 canvas 的重复调用可能累积变化。这不能被“seed 固定”抵消；本轮未运行其浏览器验证页面表现。

Patchwork 的页面验收需要看到应用真实画面。实验内核必须检查重复读取、getImageData/toDataURL/toBlob、Worker/OffscreenCanvas 的稳定性和读回一致性；不能为了检测分数破坏图表、截图与像素比较。

### 启动便利不代表适合我们的隔离边界

Mirage 的所查启动参数含 `--remote-allow-origins=*`、`--password-store=basic` 与 `--use-mock-keychain`。不直接复制这类参数；调试通道来源限制、秘密存储和浏览器 sandbox 要独立审查，不能从“只监听本机”推定完整授权边界。

OpenIncognito 的 `antic.py` 是 Flet + Playwright 应用，使用 Chromium context 和 init script；它还在模块导入时请求一个远端 UA 列表。它是轻量管理/注入路线的例子，不能把 README 的 Flutter 标签或可配置字段当作原生内核能力，也不执行其脚本来获取资料。

DT 的 SDK 明确检测定制 Electron `session.setFingerprintConfig`。这不是标准 Electron API；仅有 SDK 调用不能证明对应内核补丁和发布二进制已经可审计。所查树未定位到这个 API 的完整补丁与构建来源，因此保持待核对。

## 融入 Patchwork：先补可靠性，再试内核

### A. 优先迁移、不引入新常驻服务的部分

1. **统一后端描述**：engine family/build、driver build、profile schema/revision、配置方言、能力表与安装状态。来源是实际后端，工具与 UI 读取同一份事实。
2. **保存身份且允许受控升级**：设备身份、浏览器版本、语言/时区、代理出口和登录状态分别管理。更换引擎或身份需明确操作，先备份和检测，再原子切换 revision。
3. **档案租约与会话授权分开**：目录只能有一个写 owner；拥有目录锁不等于获得 Patchwork Agent 授权。撤权后旧请求、流订阅和工具引用全部失效。
4. **配置值与实测值并列**：缺失和不支持可见；自检由本地 probe 测量，不把完整设备指纹或账号信息自动传到公共检测站。
5. **可追溯安装与回退**：固定构建、下载记录、hash/签名、补丁来源和取消清理；二进制升级不能同时偷偷替换设备身份。固定版本也必须有安全更新路径。

这部分与[社区方案的实时流/环境自检/加密档案](browser-community-research-2026-11-01.md)及 [ZCode 的能力表/可信回执](zcode-browser-research-2026-11-01.md)共用同一套浏览器后端，不另起第三套控制器。

### B. 独立实验后端的候选顺序

- **先试 Camoufox 官方 Node 路线**：与 Patchwork 现有 Node 进程边界更接近；单独适配 Firefox 的页面控制、截图/流、下载和档案，不沿用 Chromium CDP 协议假设。
- **需要 Chromium 原生补丁时比较 Fury 与 AliasMode Chromium**：先核对构建/许可、平台发布和实际 capability，再在独立缓存/档案运行相同题目。二者都是研究候选，此处没有选定发布依赖。
- **Veil、Vesper 与历史 fingerprint-chromium 作为补丁/验证参考**：能力边界、平台配方和当前产物对应关系确认后再谈后端接入。不能把多个来源的补丁和 JS 注入层层叠加。
- **AntiBrow/CloakBrowser 不进入“完整开源内核”的默认候选**：SDK 开源和二进制许可分别处理；不因为有免费使用路径就认定可打包进开源插件。

不迁移完整桌面管理器、团队服务器、账号运营流程、批量注册或自动过验证功能。现有原生浏览器基线保持可用；本轮只形成方案，没有下载新内核、增加运行依赖或更改当前浏览器行为。

## 隔离试验与退出条件

| 检查 | 必须保留的证据 |
| --- | --- |
| 配置加载与故障 | 已加载 schema、实际构建、未知字段/不支持字段的结果；参数被静默忽略不能算生效 |
| 重启身份 | 同档案重启的比较项、可预期版本变化、明确未知项；零有效比较不得显示通过 |
| 跨上下文 | HTTP headers、UAData、主页面、iframe、Worker 的实际结果；不只检查 window.navigator |
| 渲染完整性 | Canvas 重复读取、离屏路径、图片导出、图表与截图；噪声不能改变业务视觉验收结论 |
| 代理与网络 | HTTP/HTTPS/SOCKS、认证错误、代理退出、DNS/WebRTC；失败不得静默直连或改系统代理 |
| 双会话与撤权 | Cookie、存储、档案锁、标签、流、日志、剪贴板、录制产物和旧工具引用均做越权负测 |
| 安装/升级 | 下载中止、hash 失败、旧档案迁移、冷启动、取消、回退和过期锁；秘密不进日志 |
| 用户接管 | 用户输入后 Agent 写操作拒绝；切后端、重连和恢复不能夺回控制权 |
| 页面任务 | 固定家电控制台题、模型和预算，记录操作后验、人工介入、耗时与失败原因 |

所有试验使用独立工作区、端口、进程、缓存和档案，禁止连接宿主已有浏览器或主 DSH。比较结果记录平台、引擎与驱动精确版本、题目数、成功/失败/未完成以及原始证据；不将外部项目自报分数计为 Patchwork 成绩。

## 证据索引与本轮边界

[机器可读快照](checks/fingerprint-browser-research-2026-11-01.json)包含 15 个仓库的元数据、固定 commit、README 与文件 blob SHA、一个历史 tag 和定向阅读范围；不保存第三方源码正文、凭据或本机个人路径。完整或定向源码缓存仅用于本地研究，不进入发行包。

优先复核快照中的这些路径：

- Fury：`core/CHROMIUM_VERSION`、`core/patches/0001-fp-config-plumbing.patch`、`0010-navigator-basic.patch`、`agent/src/launcher.rs`、`core/patches/LICENSE`。
- AliasMode：`fingerprint-attestation.ts`、`portable-profile.ts`；Chromium 的 `build/MANIFEST.lock`、`0004-base-device-profile-loader.patch`、`0009-close-platform-identity-triangle.patch`；Firefox 的 `Makefile` 与 `navigator-spoofing.patch`。
- Camoufox：`typescript/src/browser-pin.ts` 与 `coherence.ts`；Profile Manager 的 `fingerprint_store.py`、`sync_admission.py`。
- Veil：`crates/runtime/engine.toml`；内核的 `patches/series`、`patches/veil/005-hardware-concurrency-fingerprint.patch`。后续补丁会覆盖早期行为，不能仅凭一份 patch 推断最终运行态。
- Mirage：`src/main/chrome-manager.ts`、`fingerprint.ts`；DT：`fp-sdk/lib/view.js`；Vesper：`native/chromium/kernel.json` 与 qualification 文档。
- AntiBrow：`LICENSE` 与 `BINARY-LICENSE.md`；fingerprint-chromium 的历史 `148.0.7778.215` tag：`chromium_version.txt`、`docs/building.md` 与 `patches/extra/fingerprint/`。

**本轮完成的是检索、源码取舍、方案和文档核验。** 没有编译这些内核、核查所有依赖许可证、运行检测站、证明匿名性或完成同题 A/B。上游文档中的通过率、测试数量、无遥测承诺和平台适配仅按所查证据标记，不能视作我们的验证结果。

## 本次补查与指纹环境实施取舍

### 方法和证据范围

2026-11-01 再次使用 `gh search repos` 和 `gh api`，代理只注入采集子进程。搜索词包括 `fingerprint browser`、`anti detect browser chromium`、`camoufox`、`BotBrowser`、`chromium fingerprint patches`、`chromix browser` 与 `Apostate chromium`；空结果也保留为搜索边界，不能当作项目不存在的证明。

随后对 18 个候选逐个获取固定主分支 commit、递归文件树、README、许可证标识和最多三条发布记录，重点追加读取原生补丁、版本锁、启动器和组件清单。两个请求曾遇到代理连接失败，之后缩小到单仓库请求重试成功。第三方代码只阅读，没有执行 README/skill 中的命令。

[本次机器证据](checks/fingerprint-browser-refresh-2026-11-01.json)记录精确 commit、实际阅读文件与 Git blob SHA、发布资产名称/大小/日期及采集边界。文件正文缓存在仓库外；不将第三方完整源码、浏览器二进制或本机路径加入 Patchwork 发行包。源文件 hash 校验仅证明读取内容对应 Git blob，不证明发布二进制可复现或无恶意代码。

### 候选核查结果

表内“发布”是本次读取到的具体版本，不将 API 返回顺序等同于永久最新版本；MB 统一按 MiB 表示压缩资产大小，**不是安装大小或内存占用**。

| 项目 | 实际查到的开放范围 | Windows 与版本证据 | 对本包的取舍 |
| --- | --- | --- | --- |
| **AliasMode Chromium** | GPL-3.0 仓库；公开 Chromium 补丁序列、原生设备 profile 加载、Navigator/Worker 身份共同路径与构建 manifest | `v155.0.8059.85-aliasmode.4`，2026-10-26；Windows x64 ZIP 约 194 MiB；GitHub 标记 prerelease | **Chromium 原生指纹第一试验候选**。保留 CDP 画面流；先验证驱动配对、headless 与新 Context 是否保留配置，不直接承诺即插即用。[S1] |
| **Camoufox** | Firefox 原生补丁与构建源码；TypeScript 启动器、coherence 规则、Worker 配置测试可读；浏览器与 SDK 许可范围分别记录 | 本次查到 `v158.0.1-beta.41`，2026-10-29；Windows x64 ZIP 约 1259 MiB | **Firefox 原生指纹候选**。现有适配仍固定旧 SDK/驱动/内核组合，不能只改 release tag；下载体积明显更大，继续单独选装。[S2] |
| **Fury** | 根 AGPL-3.0；所读 Chromium patch 目录另附 BSD 风格条款；公开原生补丁、Rust launcher 与 Windows 打包脚本 | 所读源码固定 Chromium `155.0.8059.39`；`v0.4.20` 有 Windows core 独立压缩包约 141 MiB，2026-10-31 | **第二 Chromium 候选和配置传递参考**。只评估 core，不引入桌面壳、团队服务器。README 仍称开发期/预发布，但所读 release API 的 prerelease 为 false；不能据标签判断稳定性。[S3] |
| **fingerprint-chromium** | 主分支仅 4 个文件；历史 tag 有补丁和构建链，采用延迟公开源码政策 | 本次读到发布 `150.0.7871.186`，2026-10-02；README 指明 150 源码随 151 发布；此前已读 148 源码 tag | 历史补丁参考。不能把旧 tag 的开源证明套到当前二进制，不为迁就生成器而默认降级内核。[S4] |
| **Prism Browser Community** | 管理器、内核锁和补丁公开；锁定 Chromium 144 与上游 fingerprint-chromium 提交；README 明示自 `v0.3.17` 起不再常规同步产品改动 | 有 Windows 桌面包，所读维护资料仍以 Chromium `144.0.7559.132` 为基线 | **借鉴机制，不依赖其当前产品内核**：补丁顺序/hash、升级冲突门、Canvas 多 API 读回一致性。公开快照不等于持续开源最新版产品。[S5] |
| **Veil-Chromium** | 已有补丁序列、硬件参数补丁和构建脚本，仓库标识 BSD-3-Clause | 本次查到 `151.0.7922.137-1.1002`，2026-10-10；Windows ZIP 与 SHA256SUMS | 保留原生实现参考；此前读取过补丁，发布物是否对应仍需隔离运行与构建追溯，暂不增加第三套 Chromium 运行依赖。 |
| **Simprint** | AGPL-3.0 的 Tauri/Rust 管理器、环境参数映射和外部内核安装表 | 内置表指向外部对象存储的 `144.0.7559.118.5` Windows 内核，记录 hash 与 signature 字段 | 借鉴资源/流程编排；本次所读管理器代码和内核下载表不能证明完整内核补丁已公开；有 signature 字段也不等于已校验签名。[S6] |
| **Cloaksession** | README 已说明 Wails/Go + React 管理器，不包含内核；仓库描述仍写 Tauri/Rust，与实现有偏差 | 需用户提供 CloakBrowser、CFT 或 Chromix 本地可执行文件 | 参考引擎独立档案目录、固定/随机 seed 的明确语义，不能将其当成自己的开源内核。[S7] |
| **Vesper** | 管理器与原生 Chromium 补丁、资格检查资料公开；README 明列未完成功能 | README 说明本地验证过安装器；本次 GitHub release 列表为空 | 借鉴按表面声明验证状态；没有公开下载产物时不加入组件安装清单。 |
| **Camoufox Profile Manager** | MIT 管理器，浏览器来自 Camoufox | 有独立管理器 release；不据此增加另一种浏览器引擎 | 继续使用此前冻结身份、生命周期锁和权限边界研究，不引入第二个 Python 常驻服务。 |
| **Patchright** | Apache-2.0 的 Playwright 驱动补丁，重点处理自动化通道与 Runtime 等泄露 | `v1.64.1`；只支持 Chromium 路线 | **不是完整指纹内核**。可另行做驱动 A/B，不能替代 Canvas、WebGL、Audio 或 Worker 的原生身份实现。[S8] |
| **Apify fingerprint-suite** | Apache-2.0 的样本生成器和 JS 注入器；也是本包当前实现 | 发布 `v2.1.89`；样本范围与浏览器版本分开 | 保留为实验/基线，严格匹配版本；不能生成兼容样本时明确阻止使用，不改 UA 版本伪装支持。 |
| **CloakBrowser** | 仓库 MIT 覆盖 wrapper；`BINARY-LICENSE.md` 明示其指纹补丁/构建与发布二进制属于专有部分，并列出分发/集成限制 | 有 Windows 等二进制和 `pro` 发布 | **排除“完整开源内核”候选**，不能因 GitHub 显示 MIT 就将其内核作为默认可分发组件。[S9] |
| **BotBrowser** | 仓库 MIT、公开选定示例补丁；`patches/README.md` 与主 README 明示完整 core 未开放 | 有 Windows/多平台发布 | 与 CloakBrowser 一样，不能将仓库许可标识当作完整内核源码和授权证明。[S10] |
| **VirtualBrowser** | 有 BSD-3-Clause 标识、server/worker 与 automation 代码；本次树中未建立完整 Chromium 指纹补丁/构建链证据 | 有产品发布 | 仅作为管理和自动化接口参考，不因产品功能表将其升级为可重建的开源内核。 |
| **OKBrowser** | 本次固定树仅 9 个文件，以 README、图片与修改教程为主；未识别许可证 | 有二进制 release | 不作为可审计、可分发的完整开源实现。 |
| **itbrowser-net/undetectable-fingerprint-browser** | 固定树仅 9 个文件；无许可证标识；README 表示源码将逐步上传 | 有 release | 不采纳其“open-source/undetectable”宣传为验收证据。 |
| **AliasMode Firefox** | MPL-2.0、与 Camoufox 同源谱系的补丁/构建仓库 | 本次读到 `aliasmode-runtime-156.0.1-beta.36-r11` | 作为 Camoufox 差异参考，不将同源项目数量算成多项独立实证。 |

### 当前插件真正需要补的部分

这次阅读当前代码发现：`generateDevice()` 未按目标实际浏览器主版本约束生成样本；`session.mjs` 在启动时才严格核对样本与内核；完整模式仅执行 document init script，没有原生内核 profile 的启动映射。Camoufox 当前仅作为独立内核接入，`profiles.mjs` 正确拒绝把 Chromium 样本用于 Firefox，因此“可启动 Camoufox”与“已实现 Camoufox 完整指纹环境”是两项不同能力。

本地对已固定 `fingerprint-generator@2.1.89` 做 `windows + desktop + strict + 指定 Chrome 主版本` 探测：145–149 能生成对应主版本，150–156 在这些约束下均拒绝。它说明当前 Windows 桌面组合存在样本缺口，**不是对所有 OS/设备/生成条件做了穷举**。保持现有严格检查比篡改样本版本更准确。该探测没有启动新的浏览器，也没有访问任何会话登录数据。

### 修订后的实施顺序

1. **优先独立试验 AliasMode Chromium core，再决定生产候选。** 本次它提供较近 Chromium 基线、公开原生补丁、Windows ZIP 与构建记录，且与既有 CDP 侧栏路径更接近；这是从代码和部署条件得出的工程判断，不是运行通过结论。Camoufox 保留为用户明确选装的 Firefox 路线；Fury 作第二 Chromium 对照。
2. **复用现有独立组件安装器。** 加入的必须是固定 tag/平台/资产大小/hash/驱动配对记录，不跟随 rolling latest；先 `plan`，再显式安装、验证、回退。只放进 `@patchwork/browser` 的组件目录，不复制桌面管理器，不并进 Patchwork 主包。来源只有 hash 的要写明其保证范围；不能把自算 hash 称为上游签名。
3. **新增原生身份 schema，不混用 Apify 样本。** 记录 backend、schemaVersion、seed（字符串）、目标平台、区域/时区、屏幕、内核契约版本、生成来源与兼容范围；UI 只展示脱敏摘要和实际状态。系统原生、设备模板、JS 实验指纹、原生内核指纹各自申报覆盖范围。
4. **启动进程时落实配置。** AliasMode 所读 loader 从启动参数加载 profile/seed，Fury 从配置通道加载，Camoufox 也需用自身 config 映射。当前仅复用同一 browser 再 `newContext()` 不能证明换种子已生效；原生指纹更换需重启该会话私有内核或先明确关闭，再按新身份启动。失败时不能默默使用默认身份；不能误称只换一个 Context 就换了原生设备。
5. **档案身份与登录数据分开。** 同一档案重启保持 seed；“更换指纹”仍生成新档案与全新登录空间，原档案保留。新旧身份不能混合 Cookie/IndexedDB。切换、恢复、墓碑唤醒均重新验证内核与身份 revision；仅当前用户面板可改配置，Agent 不获取 seed 或全局档案管理权。
6. **拒绝互相覆盖的两套配置。** 原生内核路线不再叠加 Apify init script；Playwright 的 UA、Client Hints、locale、时区与 viewport 参数必须逐项确认是否覆盖内核结果。配置值、实际观测值与 unknown 分开呈现，不能用档案 ID 变化代替生效证据。
7. **同一隔离验收题再决定采用。** 主页、同/跨域 iframe、Dedicated/Shared Worker、HTTP UA/Client Hints、语言/时区、CPU/内存、screen/DPR、WebGL/WebGPU、Canvas/OffscreenCanvas 各 API 读回分别记录。测试固定 seed 的重启稳定性、换 seed 的差异、页面功能回归、登录隔离、撤权与用户接管。未覆盖的项目明确 unknown/unsupported。
8. **测完再作体积/内存与质量结论。** 本次只核对下载资产大小，不比较未运行内核的 RSS；后续统一空闲/单页/多页/休眠/恢复条件，复用现有资源管理器与独占 lease。检测站分数单独标记第三方观测，不作匿名保证，也不替代本地功能测试。

### 固定源码入口

- **S1**：[AliasMode 说明](https://github.com/aliasmode/aliasmode-chromium/blob/8aa0a24c0638ed926f8c12f9bb1350d97cbf75aa/README.md)、[profile loader](https://github.com/aliasmode/aliasmode-chromium/blob/8aa0a24c0638ed926f8c12f9bb1350d97cbf75aa/patches/0004-base-device-profile-loader.patch)、[UA/Worker 一致性](https://github.com/aliasmode/aliasmode-chromium/blob/8aa0a24c0638ed926f8c12f9bb1350d97cbf75aa/patches/0009-close-platform-identity-triangle.patch)、[构建记录](https://github.com/aliasmode/aliasmode-chromium/blob/8aa0a24c0638ed926f8c12f9bb1350d97cbf75aa/build/MANIFEST.lock)。构建记录仍含 incremental 和未知 fresh ancestor，不能称已证明可复现。
- **S2**：[Camoufox navigator 补丁](https://github.com/daijro/camoufox/blob/6e9a1de13b8afeefd13d43a3b35632aee5874583/browser/patches/navigator-spoofing.patch)、[Worker 配置测试](https://github.com/daijro/camoufox/blob/6e9a1de13b8afeefd13d43a3b35632aee5874583/browser/tests/playwright/patches/worker-config-reads.py)、[SDK 内核 pin](https://github.com/daijro/camoufox/blob/6e9a1de13b8afeefd13d43a3b35632aee5874583/typescript/src/browser-pin.ts)、[配置 coherence](https://github.com/daijro/camoufox/blob/6e9a1de13b8afeefd13d43a3b35632aee5874583/typescript/src/coherence.ts)。
- **S3**：[Fury launcher](https://github.com/furyteamtop/fury-antidetect-browser/blob/7b4fe8a167fdb0bd74331e836e888d0a83ce4973/agent/src/launcher.rs)、[navigator 补丁](https://github.com/furyteamtop/fury-antidetect-browser/blob/7b4fe8a167fdb0bd74331e836e888d0a83ce4973/core/patches/0010-navigator-basic.patch)、[patch 许可](https://github.com/furyteamtop/fury-antidetect-browser/blob/7b4fe8a167fdb0bd74331e836e888d0a83ce4973/core/patches/LICENSE)。
- **S4**：[fingerprint-chromium 源码延迟政策与版本表](https://github.com/adryfish/fingerprint-chromium/blob/698a1002bd54c021ac2001cc6298bbc45826dcbb/README.md)。历史源码依据仍见前一份证据，未将 148 tag 当作 150 发布源码。
- **S5**：[Prism 源码同步说明](https://github.com/DFarm6/Prism-Browser-Community/blob/f23feb26ce998a75ba41529cc1464a34a03ee8c1/README.md)、[内核锁](https://github.com/DFarm6/Prism-Browser-Community/blob/f23feb26ce998a75ba41529cc1464a34a03ee8c1/tools/kernel-lock.json)、[补丁升级门](https://github.com/DFarm6/Prism-Browser-Community/blob/f23feb26ce998a75ba41529cc1464a34a03ee8c1/tools/kernel-maintenance/README.md)。
- **S6**：[Simprint 外部内核清单](https://github.com/Simprint/simprint/blob/d2dc939bfae8efda8e4e4d791587d7a364ca4dd8/src-tauri/crates/business/resources/default-browser-kernels.json)、[指纹启动映射](https://github.com/Simprint/simprint/blob/d2dc939bfae8efda8e4e4d791587d7a364ca4dd8/src-tauri/src/services/environment/launch_runtime/fingerprint.rs)。
- **S7**：[Cloaksession 实际架构和引擎边界](https://github.com/xiaozhou26/Cloaksession/blob/98cfea2b60d5ea732d43498b05cd8f96e7eeddf8/README.md)。
- **S8**：[Patchright 驱动说明](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/blob/bd714e6090344762d7c241b7e8f3d37ebdc5dab7/README.md)。
- **S9**：[CloakBrowser 独立二进制许可](https://github.com/CloakHQ/CloakBrowser/blob/b860957b1299967e1f0226b629b1da2d36e53c82/BINARY-LICENSE.md)。
- **S10**：[BotBrowser 示例与完整 core 的范围说明](https://github.com/botswin/BotBrowser/blob/450fe8970fd10f33151f32b8200ed9e91be56bed/patches/README.md)。

本次补查只交付选型证据和实施修订。没有新增运行时后端、安装候选内核、改变主 DSH/系统代理/宿主浏览器、运行第三方检测站或宣称已补齐完整指纹。下一步实际接入仍须通过上面的独立内核验收门。

### 后续执行记录

用户确认执行后，已在独立可选包接入固定版本 AliasMode，并在专用隔离目录完成真实 DSH/Cordis 工具调用、双会话、更换／重启、登录隔离及失败回滚验收。以上“只交付调研”描述保留为本次研究快照；后续实现、源码版本差异、命令与未测边界见[原生指纹执行记录](../packages/browser/docs/native-fingerprint-2026-11-01.md)，不能把初次调研的 70 份源码快照当作后续二进制验收证明。
