# SoL-Pi 机制复刻设计

本文记录在 Patchwork 内复刻 SoL-Pi 四个运行时机制的职责树、落点与取舍。
实现依据是目标宿主的真实契约，而不是 SoL-Pi（Pi 宿主）的写法。

## 实现状态

- **已完成**：职责树重构；配置层；结构检查拆分与误报修复；四个运行时机制
  （Action Fusion、ObservationPack、Evidence-Preserving Reducer、
  Online Context Compact）。
- **未开始**：auto-research 方法论、规范形态的 benchmark 考题。

验证边界（逐个机制，不夸大）：

| 机制 | 已验证 | 未验证 |
|---|---|---|
| Action Fusion | 单元 + 真实组合（遮蔽生效、经真实 `ctx.fs` 写文件） | — |
| ObservationPack | 单元 + 真实组合（归档逐字节相同、分页拼回一致） | 与原生 `dsh-spill-policy` 同时挂载时的组合行为 |
| Evidence-Preserving Reducer | 单元 + 真实组合（脚本化 reducer、真实诊断命令、判断日志落盘） | 真实模型产出的收据质量；`cacheWriteReadRatio` 之外的缓存语义 |
| Online Context Compact | 单元（计划/经济性/时序全覆盖）+ 真实组合（`update_plan` 经真实管线执行；挂上压缩服务后**边界确实触发一次压缩并 `followup` 续跑**；无压缩服务时事件被安静吸收） | **真实压缩实现**（`dsh-compaction-basic` 的实际摘要）：触发窗口压力需要一段真实长会话，本机无法在不调用模型的情况下构造 |

ObservationPack 的生命周期按决定取**首次即换占位符**：`tools/post-execute` 的替换
只影响首次入库的内容，所以模型从第一次请求起看到的就是占位符 + 头部摘录。SoL-Pi 的
「前 N 次全量」需要追加**表面替换事件**（见下方宿主事实），这是同一机制内可选的
后续增强，不是宿主限制。

### 已验证的宿主事实

以下都由 `tests/real-composition/` 的真实 Loader 组合实测得到，并固化为测试：

- **嵌套作用域可遮蔽祖先同名工具**（`ACCEPTED`），而**同作用域重名注册抛错**
  （`tool "X" is already registered in this scope`）。遮蔽只作用于该作用域：
  根层与其它作用域仍解析到原生定义。
- **`agent.ctx.tools` 可访问**。原先担心 Cordis 的「未声明 inject 就拿不到服务属性」
  会挡住这条路，实测不成立：作用域上下文继承了上层 ctx 的 inject 链。
- **Loader 的 entry 是并发挂载的**：插件 `apply` 期间兄弟 entry（如 `dsh-tool-fs`）
  尚未注册工具。因此 agent 必须在 boot settle **之后**创建——这也符合真实部署
  （agent 在会话开始时才创建）。
- **真实组合需要完整 shell 链**：`dsh-subprocess-local`（提供 `subprocess`）→
  `dsh-pwsh-local`（提供 `shell`）→ `dsh-shell-env`（提供 `shellEnv`）→
  `dsh-tool-pwsh`（注册 `pwsh` 工具）。缺任一环 entry 都会 pending，
  `boot` 会以 `entries did not activate` 失败。嵌套派发 `pwsh` 时
  `command` 与 `description` 都是必填。
- **`cordis.yml` 里 DSH 包必须写成 `file://` URL**：不传 `bareModuleBaseUrl` 时
  Loader 用的是普通 `Include`，不把绝对路径转成 file URL。
- **DSH 没有「按请求重写历史消息」的投影钩子**：`agent/request` 明确
  「cannot mutate messages」，`agent/pre-step` 只能替换进站的 user 消息。
  因此改变**未来请求**所见工具结果内容的唯一公开途径，是
  `Session.append(type, data, { surfaceOp, sourceEventSeqs })` 追加一个**表面替换
  事件**去遮蔽更早的消息事件（原生 `dsh-compaction-tool-result-pruner` 正是此机制）。
  这条路可用来复刻 SoL-Pi「前 N 次全量、之后换占位符」的生命周期；
  `tools/post-execute` 的 `{kind:'accept', content}` 则只影响**首次**入库的内容。

### 已推翻的假设

- 原计划「不自造归档后端，复用 `ctx.spillStore`」。核实后不成立：
  `ctx.spillStore` 只暴露 `saveText()`，返回 locator 与召回指引，
  **没有任何读取 API**（服务文档明确「owns NO retrieval or search API」）。
  ObservationPack 要求按字节偏移精确分页召回，因此必须自建可读归档；
  `ctx.spillStore` 只能在「只需 locator、不需要回读」的场合复用。

## 目标契约

- 目标宿主：**DSH 0.1.5-rc.1**，唯一 target。本机全局安装即此版本。
- 只使用该版本 `lib/types/*.d.ts` 声明过的导出与事件；不使用 Pi 的 API。
- 保持 Patchwork 既有形态：纯 ESM、无构建步骤、`src/` 直接作为包入口。

## 与 DSH 原生机制的关系

DSH 自带的机制与 SoL-Pi 有重叠。复刻的职责是**补齐 SoL-Pi 独有的语义**并与原生机制
组合，而不是重造一遍。核实到的原生件：

| DSH 原生 | 它做什么 | 与 SoL-Pi 的差异（即复刻要补的部分） |
|---|---|---|
| `dsh-spill-policy` | `tools/post-execute` 转换器：结果超过 `maxInlineBytes` 就存全文到 `ctx.spillStore`，模型侧换成首尾预览 + locator | 按**体积**立即溢出；ObservationPack 按**重复次数**延迟替换（前 N 次全量），且需要**按字节偏移的精确分页召回** |
| `dsh-compaction-tool-result-pruner` | 按 `thresholdChars`/`headChars`/`tailChars` 裁剪历史中的工具结果 | 静态阈值；Online Context Compact 按**语义边界 + 未来收益能否偿还写入成本**决定是否压缩 |
| `dsh-compaction-basic` + `/compact` | 原生摘要式压缩 | 由上下文压力或人工触发；OCC 由**子任务完成**触发并做经济性判定 |
| `dsh-output-retention`（库） | `TextRetainer`：按字节有界保留文本，UTF-8 边界安全，给出精确 `omittedBytes` | 无业务语义，可**直接复用** |
| `ctx.spillStore`（服务） | `saveText()` 持久化全文，返回 locator + 字节长度 + 召回指引 | 可**直接复用**作为归档后端 |

因此复刻不新增存储后端，优先复用 `ctx.spillStore` 与 `dsh-output-retention`。

## 职责树

一个文件一个可说明职责。桥接层只转发，纯逻辑不碰 IO，注册层不写业务。

```text
src/
  index.mjs                       入口：只做装配与生命周期（提示词段、命令、各机制注册）
  config/
    plugin-config.mjs             Config 值：Schemastery Schema + 默认值 + 显式校验
  structure/
    structure-check.mjs           结构与命名检查（纯逻辑，无 IO 决策）
    warning-cooldown.mjs          同一问题每 30 轮的冷却状态（唯一持久化点）
  hook/
    post-execute-hook.mjs         平台桥接：tools/post-execute → 结构警告
    hook-stdin.mjs                独立 stdin 运行器（无业务）
  review/
    review-command.mjs            /patchwork-review 命令
  mechanisms/
    action-fusion/
      index.mjs                   注册：以追加 then_run 的定义遮蔽原生 edit/write
      fused-mutation.mjs          编排：edit/write → 可选 then_run
      file-queue.mjs              per-file 临界区（本实例内的 fused 操作）
      mutation-guard.mjs          执行命令前的目标哈希守卫
    observation-pack/
      index.mjs                   注册：post-execute 投影 + obs_recall 工具
      observation.mjs             纯逻辑：候选判定、handle、字节分页
      archive.mjs                 归档（复用 ctx.spillStore）
      ledger.mjs                  审计日志（append-only JSONL）
    evidence-preserving-reducer/
      index.mjs                   注册：diagnostic 工具结果 → receipt 投影
      candidate.mjs               候选判定与精确原文提取
      receipt.mjs                 请求体、校验、渲染（引用必须精确匹配）
      provider.mjs                嵌套模型调用与 usage 归一
      archive.mjs                 原文归档
      journal.mjs                 决策日志（走 session 日志，不进上下文）
      config.mjs                  本机制固定常量与模式
    online-context-compact/
      index.mjs                   注册：update_plan 工具 + 生命周期钩子
      lifecycle.mjs               边界判定、压缩触发、压缩后继续（唯一有副作用层）
      economics.mjs               纯函数：收益/成本/视界判定
      plan.mjs                    纯函数：计划 schema 与状态转移
      state.mjs                   计划与统计的快照持久化
      tools.mjs                   update_plan 工具定义
  util/
    safe-path.mjs                 无业务工具：路径归一与会话根校验
```

### 分层规则

- `index.mjs` 不承载业务：只注册与释放。
- 机制内部依赖单向：`index → 编排 → 纯逻辑/存储`，纯逻辑不反向依赖。
- 每个注册都通过效应用户（`ctx.on` / `ctx.tools.register` 的 disposer），卸载即清理。
- 一切模型可见内容必须能从 session 日志重建。

## 四个机制的落点

| 机制 | DSH 扩展点 | 关键约束（已核实） |
|---|---|---|
| Action Fusion | `ctx.tools.register`：先 `ctx.tools.get('edit'/'write')` 取原生定义，再注册**同 scope 遮蔽**的新定义，透传原 `execute` 并在其后跑 `then_run` | 同 scope 重复注册工具名会失败；scoped 注册遮蔽 global。`tools/pre-execute` **不能**改参数（参数已入库并呈现），所以必须换定义而不是拦截 |
| ObservationPack | `tools/post-execute` 返回 `{kind:'accept', content}` 替换模型侧内容；另注册 `obs_recall` 工具 | `accept` 可替换 `content` 而保留程序可用的 `value`。必须与 `dsh-spill-policy` 组合：它的 `next()` 结果再被有界化 |
| Evidence-Preserving Reducer | `tools/post-execute` + 嵌套模型调用 | 只处理 diagnostic 命令的长输出；任何校验失败都必须原样放行（fail-open） |
| Online Context Compact | 自注册 `update_plan` 工具 + 压缩服务 + `agent/*` 事件 | 需先确认 0.1.5-rc.1 的压缩服务与上下文计量 API（核实中） |

## 取舍记录

保留（不裁）：

- 可维护代码提示词（`assets/prompts/maintainable-coding-agent-prompt.md`，单一真源）。
- `/patchwork-review` 命令。
- 结构 Hook 能力（但见下条修复）。

修改：

- **修复已确证的结构 Hook 误报**：现在 `pathsIn` 会从**任意**工具参数里抽源码路径，
  读取一个第三方 817 行 `.d.ts` 也会报 `large-file`，并给出「拆分文件」的建议——
  而该文件 Agent 既没写也不拥有。最小复现已保留（见 tests）。
  修复方向：只检查**本次改动落点在内的工作区文件**，读取不触发。
- `src/maintenance-session.mjs` 目前只有测试引用、运行时未接线。按「不留假装在跑的
  脚手架」处理：要么接入真实流程门，要么移除。本次先不动，另立任务。

不新增：

- 不引入 TypeScript 构建链（保持既有布局）。
- 不注册新的 Cordis 服务，除非确有跨模块协调需求。
- 归档不复用 `ctx.spillStore`（它没有读取 API，见上文「已推翻的假设」）。

## 验证策略（plugin-test）

- 纯逻辑（结构检查、分页、经济性、计划转移）→ 单元测试。
- 注册契约（工具名、事件名、disposer 清理）→ 单元测试 + HMR 安全测试（dispose 后资源消失）。
- 机制行为（内容替换、fail-open、遮蔽后仍能改文件）→ 真实组合测试，走真实 Loader。
- 模型可见行为（Schema、渲染文本）→ 免凭据快照。
- 打包产物 → 打包后在**隔离 profile** 内用真实 DSH 0.1.5-rc.1 冷启动，跑一次核心路径。

真实验证不得在本会话所用的 web profile 上进行（它用的是已安装 tarball 且
`patchReload: live`）；必须建隔离 profile。
