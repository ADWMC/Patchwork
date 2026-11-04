# 来源评估与检索

来源参考：[SIFT](https://hapgood.us/2019/06/19/sift-the-four-moves/)、[Google Search operators](https://support.google.com/websearch/answer/2466433)、[arXiv](https://arxiv.org/)。

## SIFT

1. **Stop**：先停，不被标题和摘要带走。
2. **Investigate the source**：谁写的、何时、目的、是否有利益冲突。
3. **Find better coverage**：找一手文档、原始论文、官方仓库固定提交。
4. **Trace claims**：回到原文，核对上下文和限定条件。

## 证据分级

一手官方文档/原始论文 > 官方仓库固定提交 > 二手文章 > 搜索摘要。搜索摘要不是已读页面；引用必须能定位到段落、行或文件。

## 检索

- 先拆问题：实体、版本、错误码、限定词。
- 用 `site:`、引号、`filetype:`、`before:/after:` 收窄；记录查询与日期。
- 代码问题优先官方文档、变更日志、issue/PR、固定 commit。
- 多来源冲突时并列展示，不强行合并；说明各自时间和适用范围。

## 输出

主张 → 来源链接 → 精确引用 → 证据强度 → 未验证/冲突。没有找到就报告搜索范围和失败原因，不编造来源。
