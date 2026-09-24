# Patchwork 架构设计 v2 — DSH 原生 Skill · 最少导航

> 状态：**按 DSH 源码修订 → 可实现**  
> 包名：`@patchwork/coding-agent` · MIT · 非商用  
> 硬约束：**零 systemPrompt 注入**  
> 依据：`deepseek-harness` `docs/subsystems/skills.zh.md`、`packages/skill/*`、`.agents/.../skill-system.zh.md`

---

## 1. DSH 官方否决 systemPrompt 段

Skill 系统决策原文要点：

- **否决**「把完整 skill 正文注入每条系统提示词」——破坏渐进披露，每轮为无关指令付费。
- **否决**「使用 system prompt 段落」——目录应是 **user-role `<system-reminder>`**，不是 system 字符串。

**结论**：Patchwork **禁止** `ctx.systemPrompt.section`。Agent 仍可用：宿主默认 system prompt + skill 目录 + 按需 `skill` 工具 + 一行 Hook。

---

## 2. 最低导航（DSH 原生通道）

```
常驻（唯一固定成本）
  skill 目录 = name + description（每条 ≤500 字符）
  形状：agent/pre-step · user-role system-reminder
  不含正文 / 路径 / 触发提示

按需
  skill({ name }) → <skill_content> 正文
  userInvocable → TUI 斜杠（无需自造列表命令）

机械一行
  tools/post-execute → [pw:structure] / [pw:evidence]
```

### 注册契约

```js
export const inject = ['skills', 'commands', 'tools']  // 无 systemPrompt

ctx.skills.register({
  name,            // kebab-case
  description,     // 目录唯一文案，≤500
  content,         // 仅 skill 工具加载
  invocation: { modelInvocable: true, userInvocable: true },
})
```

参考实现：`packages/skill/skill-badge/src/index.ts`。

### 体量纪律（DSH progressive disclosure 教训）

- description：**≤160 字符**（目标）
- 正文：**≤3KB**（曾有 skill 超 8192 被修剪器截断）
- **禁止**整仓粘贴 hallmark / taste / 天枢等外部 SKILL.md

---

## 3. 七 Skill（融合改写，不搬运）

| name | 目录 description（导航） | 正文来源 |
|---|---|---|
| `patchwork` | 任务开始先加载：总规则（身份+不变量）与技能导航 | 原提示词身份/工作原则 + 六技能索引 |
| `anti-slop` | 写文案/汇报时拒模板句与谄媚 | 外部反 slop **规则改写** |
| `web-ui` | 改界面时：层次/对比/反模板 | 设计 skill **要点改写** |
| `architecture` | 职责树、拆分、命名、何时 ADR | 本仓结构提示压缩 |
| `collaborator` | 冲突时事实优先，A/B+推荐 | engineering-guide + 反迎合契约 |
| `standards` | 提交/命名/验证/文档唯一权威 | `docs/*` 清单化 |
| `evidence` | 完成必须命令+退出码 | 审查纪律 fail-closed |

旧 86 行 `maintainable-coding-agent-prompt.md` **不再进 systemPrompt**，拆进上述 skill。

---

## 4. 模块职责树

```
src/
  index.mjs              # apply：skills + commands + hook；禁 systemPrompt
  skills/register.mjs    # 读 assets/skills/*/SKILL.md → register
  quality/evidence-gate.mjs
  structure/             # 短码警告
  hook/post-execute-hook.mjs
  review/ mechanisms/ ui/ config/

assets/skills/<name>/SKILL.md   # frontmatter + 短正文
```

---

## 5. 信息流

1. 会话首轮：DSH 注入 6 条 name+description 目录。  
2. 模型需要规则 → `skill({name})` 拉正文（一次性）。  
3. write/edit 结构问题 → 一行 `[pw:structure] skill: architecture`。  
4. 输出含完成断言且无 shell 证据 → 一行 `[pw:evidence]`。  
5. systemPrompt：**无 Patchwork 段**。

---

## 6. 配置

```js
Config = {
  actionFusion: true,
  observationPack: false, // 可后续默认 true
  evidencePreservingReducer: false,
  onlineContextCompact: false,
  skillsEnabled: true,
  evidenceGate: true,
}
```

无 systemPrompt 开关（架构移除，不可选）。

---

## 7. 命令

| 命令 | 作用 |
|---|---|
| `/patchwork-review` | 用户视角评审（followup） |
| DSH 原生 skill 斜杠 | userInvocable skill，不自造 `/patchwork-skill` |

---

## 8. 实施顺序

| Phase | 内容 |
|---|---|
| 0 | 去掉 systemPrompt；inject 改 skills/commands/tools |
| 1 | 七 SKILL.md + register.mjs |
| 2 | 结构一行码 + EvidenceGate |
| 3 | 测试断言更新 |
| 4 | README / index.html 对齐 |

---

## 9. 成功定义

1. `sections.length === 0`（测试断言）。  
2. 恰 7 个 skill；description ≤500；正文 <4KB。  
3. 结构/证据 Hook ≤1 行。  
4. `node --test` 全绿。  
5. 未要求不 push。

---

## 10. DSH 源码索引（本地）

- `deepseek-harness/docs/subsystems/skills.zh.md`
- `deepseek-harness/packages/skill/skill/README.zh.md`
- `deepseek-harness/packages/skill/skill-badge/src/index.ts`
- `.agents/notes/archived/feature/2026-07-05-skill-system.zh.md`
- `.agents/notes/implemented/architecture/2026-09-21-creator-skills-progressive-disclosure.zh.md`
