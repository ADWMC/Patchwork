# 实验设计与改进

来源参考：[Trustworthy Online Controlled Experiments](https://experimentguide.com/)、[Microsoft ExP](https://exp-platform.com/)、[Google SRE · Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)。

## 先写假设

格式：因为观察到 X，如果做 Y，预期 Z 会改善；用 A 指标判断，B/C 是护栏。没有可证伪的假设，不做实验。

## 设计

- 固定基线、变量、样本、环境、模型/宿主版本和预算。
- 训练/调优集与留出集分开；不反复用同一批样本调参。
- 同时看效果、成本、延迟、失败率和维护负担；不要只报准确率。
- 需要统计功效；小样本或单次运行只作探索，不作结论。
- 实验必须可回滚；记录停止条件和回退点。

## 分析

- 区分相关与因果；检查混杂变量和选择偏差。
- 保留反例、退化样本和未覆盖路径，不只报成功。
- 不把模型自评、一次演示或等长文本分数当成能力提升。

## 事故/纠正

时间线 → 影响 → 直接原因 → 贡献因素 → 已采取/待办动作。动作要有负责人、期限和验证方式；不把“加强注意”当修复。
