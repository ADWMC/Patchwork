# 文档四象限

来源参考：[Diátaxis](https://diataxis.fr/)、[Write the Docs](https://www.writethedocs.org/guide/)、[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)。

## 四类文档，不混写

| 类型 | 回答 | 例子 |
|---|---|---|
| Tutorial | 我第一次怎么走通 | 快速开始 |
| How-to | 某个任务怎么做 | 配置代理、迁移步骤 |
| Reference | 准确查参数/接口 | API、配置项 |
| Explanation | 为什么这样设计 | 架构、取舍、背景 |

README 写“怎么用”，CHANGELOG 写“什么变化、谁需要动作”，报告写“如何验证”。同一事实用链接连接，不重复整段。

## 写作顺序

1. 确定读者和任务；
2. 核实际命令、默认值、错误路径、兼容范围；
3. 写最小可走通路径；
4. 再补参考和解释；
5. 检查链接、示例可执行性、数字/否定/时间/因果。

## 发布

- 未发布草稿不编版本/日期；
- 用户可见变化同轮维护 CHANGELOG；
- 迁移写升级动作和回退；
- 编辑文档不等于打 tag 或发布。
