# 验证阶梯与发布

来源参考：[Google Engineering Practices](https://google.github.io/eng-practices/review/)、[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)、[SemVer](https://semver.org/)、[Conventional Commits](https://www.conventionalcommits.org/)。

## 验证阶梯

1. **单元**：纯逻辑、边界、错误分支。
2. **集成**：真实边界、文件/网络/数据库、权限与取消。
3. **契约**：外部接口、序列化、兼容性。
4. **端到端**：用户实际路径和状态变化。

先跑最近、最能区分假设的检查，再扩大范围。测试通过不等于语义正确；结构检查不等于行为正确。报告实际命令、退出码和未覆盖路径。

## 测试设计

- 一个测试只验证一个行为；失败信息能指出原因。
- 覆盖成功、失败、空值、边界、取消、重试、部分成功。
- 不 mock 被测逻辑本身；只 mock 外部依赖。
- 避免为覆盖率写无意义测试；关键路径优先。

## TDD 门禁（行为改动）

新增功能、修 bug、重构时，优先走红-绿-重构：

1. 写一个最小失败测试；
2. 运行并确认它因预期原因失败；
3. 写最小实现让它通过；
4. 重构，保持测试绿。

没有亲眼看到失败，不能确定测试测的是正确行为。文档、配置、生成代码、一次性原型可豁免，但要说明理由；不要用“这次特殊”绕过。

## 发布

- 用户可见变化写 CHANGELOG；使用方式/安装变化再更新 README/指南。
- 按 SemVer 判断 major/minor/patch；未发布草稿不编日期或版本。
- 提交信息用 Conventional Commits；一个逻辑一个提交。
- 发布前确认迁移、回滚、兼容范围和验证证据。
