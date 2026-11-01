# 浏览器独立可选包与迁移

日期：2026-11-01。状态：本地实现，未发布到 npm，未安装到主 DSH。

## 包边界

| 内容 | `@patchwork/coding-agent` | `@patchwork/browser` |
| --- | --- | --- |
| 编码 Agent、记忆、机制、日志与检索 | 保留 | 不依赖、不加载 |
| 浏览器控制、档案、画面流、回执与资源管理 | 移除 | 独立提供 |
| 浏览器界面 | 不再注册入口 | DSH 右侧栏独立“浏览器”入口 |
| Playwright、fingerprint-generator/injector、yauzl | 无直接或 optional 运行时依赖 | 由可选包声明 |
| 内核和录像组件下载器 | 无 bin 或安装脚本 | `patchwork-browser-components` |
| 原生 Electron 嵌入 | 无 | 无；按用户选择保留 DSH 画面流 |

源码在 `packages/browser`。这是一个独立可安装的 DSH 插件，不是主包默认安装的 optionalDependency。两包可一起装，也可以只装浏览器。

## 授权与交互

- 只有安装浏览器包后，才注册浏览器侧栏和自己的鉴权路由、页面连接元数据。
- 打开侧栏不会启动内核或授权模型。用户点击“启用当前会话浏览器”后，才在该 Agent 原生工具作用域注册 `patchwork_browser`。
- 标准、Patchwork 和其他有效模式都可授权；其他会话不会因此获得浏览器工具，更不会加载 Patchwork 记忆、技能或机制。
- 授权绑定实际 Agent、会话 ID、工作区和当前组合。切换模式、停用、销毁和插件卸载会撤权。关闭尚未完成时显示“正在关闭”，阻止并行重开。
- 新授权不能使旧 client、画面或观察引用复活。停用请求携带授权版本，旧页面的迟到请求不能撤销新授权。
- 与 ZCode 一样采用观察优先的交互流程：DOM/ARIA 快照 → 从实际内容提取语义目标 → 唯一性检查 → 执行动作。语义定位需要最新 `observationId`；歧义、消失或过期时必须重新观察。视觉任务按需截图。
- 显示继续使用真实浏览器的鉴权画面流；本次没有引入 Electron，也没有声称后台冻结已经可用。

## 安装与旧配置

在根目录执行 `pnpm install`；分别执行 `pnpm build:client` 和 `pnpm --filter @patchwork/browser build:client` 构建两包界面。浏览器包可在自己的目录运行 `npm pack --ignore-scripts --pack-destination <绝对目录>`，通过 DSH 插件管理安装到明确选择的 profile。

命令行安装必须明确设置目标 `DSH_HOME`，再运行 `dsh plugin --profile <名称> add <浏览器包绝对路径>`。本轮没有代选主 profile 或执行安装。

原有浏览器配置项从 Patchwork 设置页移除。读取旧 `patchwork/config.json` 时会忽略遗留浏览器字段，保留其他合法配置；新写入浏览器字段会被拒绝。部署默认值应明确迁移到浏览器插件行的配置：

| 旧字段 | 浏览器包字段 |
| --- | --- |
| `browserEnabled` | 由可选包是否安装、是否启用当前会话控制 |
| `browserMaxInstances` | `maxInstances` |
| `browserMaxTabs` | `maxTabs` |
| `browserIdleTimeoutMs` | `idleTimeoutMs` |
| `browserMemoryTargetMiB` | `memoryTargetMiB` |
| `browserAutoReclaim` | `autoReclaim`，默认仍关闭 |

没有自动移动用户的 Cookie 或档案。浏览器包继续使用目标 `DSH_HOME/patchwork/browser` 及原有按会话哈希的档案路径；加密与会话归属检查继续生效。旧 `patchwork-components` bin 改为本包的 `patchwork-browser-components`，内核、录像和 Camoufox 仍按需显式安装。

## 验证与限制

验证包含两包单元/原生注册表组合测试、实际 npm pack 内容检查，以及独立临时 `DSH_HOME` 下的真实 Edge 测试。原生工具实际执行了 DOM 观察、填写、点击和负测；UI 验证覆盖启用、导航、用户接管、模式切换、重新授权、停用、窄栏和暗色主题。

本次全仓回归为 300 项通过、0 失败、0 跳过；真实隔离测试产生 9 次原生工具调用，包含预期拒绝。两个 tgz 还分别在临时项目安装并成功导入：只装浏览器不会安装编码 Agent，只装主包不会带入浏览器依赖。安装检查关闭安装脚本和 peer 自动安装，宿主 peer 由 DSH 提供；首次离线检查缺少传递依赖缓存，改用进程级代理解析依赖后通过，未更改全局代理。所有临时安装目录已清理。

这不是完整 DSH App 的端到端运行，也没有请求模型或运行 ZCode 产品对照。UI 使用实际组件和 DSH 主题，HTTP carrier 与会话投影由隔离测试夹具提供；浏览器和工具执行是真的。测试使用私有 Playwright 实例，因为当前会话没有 Browser plugin。测试结束清理所有临时内核与 `DSH_HOME`，未操作用户浏览器或主 DSH。

机器可读结果、工具调用次数、截图、包内容检查及脚本/源码哈希见 [拆包验证记录](checks/browser-optional-package-2026-11-01.json)。浏览器包自身说明与更新日志位于 `packages/browser/README.md` 和 `packages/browser/CHANGELOG.md`。历史浏览器调研保留作为设计依据，其中旧源码位置、安装命令和主包内置描述以本篇迁移记录为准。

验证记录随主包分发。为避免包中记录对自身 tarball 哈希形成递归，最终 tgz 的大小和 SHA-256 单独记录在外部测试目录的 `distribution-result.json`；压缩包大小不包含安装后依赖和浏览器内核。
