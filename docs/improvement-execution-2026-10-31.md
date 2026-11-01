# Patchwork 受控改进执行记录

日期：2026-10-31（Asia/Shanghai）

本轮把“自进化”收敛为可审查的改进账本，不把模型自评或静态实验档案当作已经生效的规则。

## 已执行

- 工具失败或未验证回执会在当前 Patchwork Agent 会话内生成脱敏 Incident。记录只保留问题类型、来源回执指纹、短说明和范围，不保存提示词、凭据或完整工具输出。
- `patchwork_improvement` 只在 Patchwork Agent scope 注册，支持列出问题、提出候选、登记实验和查看准入结果。候选必须引用已有 Incident，实验必须由真实宿主运行档案提供 baseline、candidate、tuning、held-out、相同环境条件、成本、延迟、正确性、维护门槛和回退点。
- 新增隔离边界校验和 shell-free runner：`DSH_HOME`、工作区、结果目录必须是绝对且互不相同的路径；端口必须独立；模型和预算必须明确；不能复用当前进程的 `DSH_HOME`。runner 使用独立环境、无 shell 派发、有界 stdout/stderr、超时和退出码回执。
- 新增带 token 和 session scope 的改进管理路由。批准、试用和回滚需要用户确认、候选实验准入和 revision CAS；切换 Agent 后旧引用失效。
- 原生侧栏的“改进”页展示 Incident、候选、实验准入、用户决定和回滚状态。页面明确标注自动激活关闭，审批目前只记录项目/会话范围的决定，不会把任意候选自动写入规则、权限、提示词或记忆。

## 验证

- 单元和 UI 构建回归通过，包含 scope、来源、留出集重叠、real-host、revision 冲突、审批确认和隔离路径负测。
- 官方 DSH 组合测试验证 `patchwork_improvement` 只在 Patchwork Agent 可见；standard Agent 不可见，切换后保留的旧工具引用拒绝执行；真实宿主 Incident 写入成功。
- 真实检索与记忆隔离证据仍见 `docs/checks/`。主 DSH 未用于本轮验证。

## 尚未声称完成

当前没有自动运行改进实验、自动发布候选或自动改变运行行为。实际 baseline/candidate/held-out 任务仍必须由独立 DSH runner 执行并把真实回执导入账本；没有该证据的候选保持 `proposed`。SoL 机制收益也仍需独立对照实验。
