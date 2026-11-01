# 可公开使用的验证文案

以下文案只对应 `public-marketing` 题集的确定性结果。发布时同时标注题集版本、执行日期、
DSH/Node 版本和隔离条件。

## 推荐主文案

> Patchwork 在官方 DSH 组合中通过了 16/16 项插件合同验收：Patchwork Agent 与 standard
> Agent 的能力目录隔离，切换后旧引用失效；检索、记忆、日志和改进闭环均有可回查证据；
> SSRF、错误 token、伪造 scope 和旧 revision 等安全负测全部正确拒绝。每道题都在独立
> 临时 DSH_HOME 中运行，不改主 DSH。

## 可以拆成短句的事实

- **只对当前 Agent 生效**：Patchwork 工具和侧栏数据跟随宿主 scope，切换会话后停止轮询。
- **失败可见**：失败回执、来源、耗时和拒绝原因进入证据视图，日志不复制提示词和凭据。
- **记忆有边界**：记忆先提议、再确认；session/project scope 分开，删除有 CAS 和 tombstone。
- **搜索不绑死密钥**：没有 web_search key 时仍可使用有界多源 fallback，网页内容始终标为不可信。
- **改进可回滚**：失败形成候选，经过 baseline/candidate/held-out 和用户确认后才进入试用或批准。

## 禁止使用的说法

- “Patchwork 让模型变得更聪明”；
- “节省固定比例 token/成本”；
- “通过官方 Terminal-Bench/SWE-bench 排行榜”；
- “完全防止所有提示词泄露或拥有 OS 级沙箱”；
- “记忆自动理解并永久学习用户”。

这些结论需要独立的模型能力对照、长期运行测量或更强的安全审计，不能由本题集推出。
