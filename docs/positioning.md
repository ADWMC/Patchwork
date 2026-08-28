# Patchwork 定位

## 项目是什么

Patchwork 是一个面向 DeepSeek Harness 的写代码插件项目。第一个基础是
`Agent + Hook`：

- **Agent** 负责理解任务、调查代码、实施修改、调试和汇报。
- **Hook** 是预留的独立生命周期扩展，不负责 Agent 提示词注入。

它的目标不是生成一段看起来可行的代码，而是让代码修改可维护、可回归、
可解释，并且有真实证据支撑。

## 经验基线

工程行为以[工程代理工作规范](engineering-agent-guide.md)为第一手项目经验，
核心是“真实、克制、可验证”：

1. 先理解目标、边界和现状。
2. 先调查调用关系、配置来源和现有测试。
3. 只实施满足需求的最小正确改动。
4. 沿原始失败路径和受影响行为验证。
5. 如实报告已验证、未验证和残余风险。

## 参考项目与资料

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：插件宿主、
  Cordis 组合模型、生命周期和工具接入方式。
- [helm-d](https://github.com/ADWMC/helm-d)：实际 DSH 插件的 bundle、preset、
  安装和发布经验；Patchwork 不复制其安全领域能力。
- [可维护代码代理提示词](maintainable-coding-agent-prompt.md)：将上述文章中的
  解耦、主人翁式维护和全流程回归验证转成 Agent 可执行的行为约束。
- 原始参考：[维护好一个复杂项目](https://github.com/ascoders/weekly/blob/master/%E5%89%8D%E6%B2%BF%E6%8A%80%E6%9C%AF/264.%E7%B2%BE%E8%AF%BB%E3%80%8A%E7%BB%B4%E6%8A%A4%E5%A5%BD%E4%B8%80%E4%B8%AA%E5%A4%8D%E6%9D%82%E9%A1%B9%E3%80%8B.md)。

## 当前边界

当前先实现写代码 Agent 的基础，不提前承诺完整自主编程、复杂知识库、
发布自动化或特定语言工具链。后续每项能力都必须能在 DSH 中加载，并通过
一个真实的代码维护任务验收。
