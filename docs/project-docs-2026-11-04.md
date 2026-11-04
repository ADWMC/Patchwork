# 项目文档：AGENTS.md 与 DESIGN.md（2026-11-04）

AGENTS.md 和 DESIGN.md 会持续影响后续 agent 的行为，因此不能当普通文本随手覆盖。本轮把它们做成受控能力：模板、校验、hash CAS、审计。

## 为什么重要

- **AGENTS.md** 是给 agent 的项目 README：构建、测试、目录职责、提交/PR 约定。它决定模型下一次如何理解这个仓库。
- **DESIGN.md** 是给 agent 的设计契约：机器可读 token + 人读理由。它决定 UI 改版是否沿用同一套颜色、字体、间距和组件角色。
- 两者写错会长期污染后续任务，比一次代码改动更难发现。

参考标准/规范：

- [AGENTS.md](https://agents.md/)
- [Google DESIGN.md](https://github.com/google-labs-code/design.md)

## DSH 已自动读取 AGENTS.md/CLAUDE.md

`@deepseek-ai/dsh-agent-instructions` 在第一个请求注入用户全局和项目链（`$DSH_HOME/AGENTS.md` → `$DSH_AGENTS_HOME/AGENTS.md` → 项目根到 cwd 的 `AGENTS.md`/`CLAUDE.md`），更具体的优先，64KB 预算；结构化 `read/write/edit` 到更深目录会刷新嵌套文件，没有 watcher，shell `cd` 不触发。

因此：

- 不需要为了看规则重复 read AGENTS.md；它已在上下文里。
- `patchwork_project_docs` 的价值是 hash/CAS 写入、嵌套扫描和 DESIGN.md，不是替代自动注入。
- 通过 `patchwork_project_docs apply` 写完后，对目标文件做一次结构化 `read` 或重开会话，触发 DSH 刷新。
- DESIGN.md 不在 DSH 自动读取范围内，需要显式读。

## 工具：`patchwork_project_docs`

| 动作 | 行为 |
|---|---|
| `status` | 查找根目录/嵌套的 AGENTS.md、DESIGN.md，返回路径、字节、sha256 |
| `read` | 读取指定文件，返回内容和 hash |
| `validate` | 检查空内容、超限、明显密钥、基本结构；只警告，不硬判 |
| `apply` | 创建或更新；更新必须匹配 `expectedSha256`，原子写入 |

安全边界：

- 只允许 `AGENTS.md` / `DESIGN.md` 两个文件名；
- 路径必须留在当前工作区；`read`/`status` 拒绝或标记 symlink，写入前校验最近已存在父目录的 realpath；
- 已有文件没有正确 hash 就失败，不静默覆盖；
- 拒绝 PEM 私钥和明显 `sk-...` 密钥；
- 最大 64KB；
- 写入通过 `.patchwork/locks/` 文件锁串行化；锁超过 30 秒视为陈旧；拿不到锁返回 `PROJECT_DOC_LOCKED`；
- 不依赖代码检索开关；`codeEnabled:false` 时仍注册；
- 不自动创建、不自动改项目规则、不授予权限。

## 使用顺序

1. `status` 看现有文件和 hash；
2. `read` 读内容；
3. 只改受影响段落，保留用户内容；
4. `validate` 看警告；
5. `apply` 带 `expectedSha256` 写入；
6. 展示 diff 和验证结果。

## Skill 规则

`patchwork/references/project-docs.md` 记录：

- AGENTS.md 何时写、写什么、不写什么；
- DESIGN.md 何时写、token/理由/可访问性；
- 嵌套 AGENTS.md 最近优先；
- 修改前读现状、展示 diff、不静默覆盖；
- 项目规则不是权限。

`web-ui/references/design-contract.md` 记录 DESIGN.md 的 token + rationale + lint/diff 思路。

## 验证

- `tests/project-docs.test.mjs`：创建、CAS 更新、冲突、空内容、密钥、任意文件名、越界路径、标准 preset 拒绝；
- 原生组合测试确认 `patchwork_project_docs` 在 Patchwork scope 注册；
- UI 诊断/能力页显示两个文件的字节数和 hash 前缀。

这不是硬门禁：模型仍按任务判断是否创建/更新；工具只保证写入是显式、可审计、不会误覆盖。
