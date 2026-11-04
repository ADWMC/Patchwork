# 项目文档：AGENTS.md 与 DESIGN.md

来源参考：[AGENTS.md](https://agents.md/)、[Google DESIGN.md](https://github.com/google-labs-code/design.md)。

这两个文件会持续影响后续 agent 行为，创建/修改前先读现状、确认目的，不能静默覆盖。

## DSH 已经自动读取 AGENTS.md/CLAUDE.md

- 第一个请求会注入用户全局和项目链：`$DSH_HOME/AGENTS.md` → `$DSH_AGENTS_HOME/AGENTS.md` → 项目根到 cwd 的 `AGENTS.md`/`CLAUDE.md`，更具体的优先。
- 有 64KB 预算；宽泛文件先被省略，最具体的文件才可能被截断。
- 结构化 `read`/`write`/`edit` 到更深目录会触发新嵌套文件；文件变化在下次请求刷新；没有 watcher；shell `cd` 不算。
- 不要为了“看看规则”重复 read AGENTS.md；它已经在上下文里。只有核对 hash、嵌套文件被预算省略、或 DESIGN.md 才需要显式读。
- `patchwork_project_docs apply` 不是宿主的 first-party write；写完后对目标文件做一次结构化 `read`（或重开会话）触发刷新。

DESIGN.md 不在 DSH 自动读取范围内。

## AGENTS.md

### 何时写

- 新项目没有项目级 agent 指令；
- 构建/测试/发布命令变了；
- 目录职责、边界或禁止事项需要长期说明；
- 用户明确要求创建/更新。

简单任务、一次性配置、能从代码直接看出的内容不写。

### 写什么

- 项目是什么、主要技术栈；
- 安装、构建、测试、lint 的**实际命令**；
- 目录职责和关键入口；
- 代码风格、提交/PR 约定；
- 安全、权限、外部副作用的边界；
- 已知坑和验证方式。

不写：密钥、个人环境路径、会过期的版本号、与代码不符的愿望清单、整套 skill 正文。

### 修改规则

1. 先读最近的 `AGENTS.md`；嵌套目录更近的优先。
2. 保留用户已有内容，只改受影响段落；不重排全文。
3. 先展示 diff，再 apply；已有文件必须带 `expectedSha256`，冲突就停下。
4. 不把项目规则写成权限；AGENTS.md 不授予工具、目录或发布权限。
5. 不自动创建/覆盖；用户要求才写。

## DESIGN.md

### 何时写

- 已有品牌/设计系统需要让 agent 稳定复用；
- 跨页面改版需要统一的 token 和理由；
- 用户明确要求建立设计契约。

单个按钮、局部样式修复不新建 DESIGN.md。

### 写什么

- 机器可读 token：颜色、字体、圆角、间距、组件角色；
- 人读理由：为什么这样设计、如何应用、哪些场景不用；
- 可访问性约束：对比度、焦点、动效；
- 版本/迁移说明（如有）。

### 修改规则

1. 先读现有 DESIGN.md 和实际 token/CSS；代码与文档冲突时先核对。
2. 不发明品牌色、字体或用户研究；未知保持未知。
3. 改 token 时检查引用、对比度和受影响页面；能 lint/diff 就先跑。
4. 先展示 diff，再 apply；已有文件必须带 `expectedSha256`。
5. 契约不是截图替代品；最终仍要在目标尺寸看真实渲染。

## 工具

`patchwork_project_docs`：

- `status`：查找根目录/嵌套的 AGENTS.md、DESIGN.md，返回 hash；
- `read`：读取现有内容；
- `validate`：检查空内容、超限、明显密钥、基本结构；
- `apply`：创建或更新，更新必须匹配 `expectedSha256`，原子写入。

工具只写这两个受控文件名，不接受任意路径或任意文件名；它不授予权限，也不自动执行。
