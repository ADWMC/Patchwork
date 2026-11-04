# 源码探索协议

1. 不熟悉的仓库先 `patchwork_code map`，看入口、模块和测试分布；再用 `outline` 看单文件结构。
2. 查符号定义用 `find`，查引用用 `references`，查错误字符串/配置键用 `search`；结果有界，先看 `path:line` 和短片段。
3. 用 `path`/`glob` 缩小范围，只读命中片段；不要一上来全仓 grep，也不要反复读整文件。
4. 连续两次没命中，停下来重新看地图或 outline，不要换同义词硬撞。
5. 达到任务预算或没有可行动线索时，报告“未完成 + 卡点 + 已排除项”，不要无限试。
6. `patchwork_code` 只检索本地工作区；公网信息用 `patchwork_search`，不要混淆。
7. 宽泛、多方向的问题交给只读 explore 子代理；主会话只接收 findings 和引用，不接收大段原文。
8. 不要为了回答 Patchwork 自身工具行为去搜索插件源码；先看工具错误里的 `next`、inspect 或文档。
9. 文件创建/编辑/读取/搜索优先使用结构化工具（write/edit/read/glob/grep 或 `patchwork_code`）；shell 只用于包管理、版本控制、构建/测试等系统命令。不要用 `cat`、`sed`、`find`、`grep` 绕过结构化工具；结构化工具不可用时明确说明并只做只读回退。
10. Git 默认只读；commit/push/rebase/reset/revert 等写操作分别判断授权，不把“继续”当成提交或推送许可。

## 需要跨文件调用链或影响面时

先 `patchwork_code graph-status`；未启用则 `graph-enable`（写 `.patchwork/config.json`），再 `graph-start`，然后使用 `callers`/`callees`/`impact`/`affected`。代码图默认关闭，结果是词法近似，不是完整 LSP/动态分派证明。`graph-stop` 只停止当前进程会话；工作区配置保留。不要把它当作权限或安全边界。
