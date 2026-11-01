# 参与维护 Patchwork

仓库维护一个长期分支 `main`。维护者在本地验证后提交；外部贡献可以 fork 后向 `main` 提交 PR，合并后自动删除本仓库中的临时来源分支。不重写已发布历史，不使用 force push 清理主分支。

## 开发环境

CI 使用 Node.js 24、pnpm 12.4.2 和 Windows。包的运行时版本范围仍以各自 `package.json` 为准。

```powershell
npm install --global pnpm@12.4.2
pnpm install --frozen-lockfile
node scripts/build-client.mjs --check
node packages/browser/scripts/build-client.mjs --check
npm test
npm run check:release
npm --prefix packages/browser run check:release
```

修改客户端后先运行对应包的 `build:client`，再检查已提交的构建产物。CI 只执行确定性测试和发行预检，不使用模型密钥、不下载浏览器内核，也不把单元测试成绩作为模型能力评测。

## 变更与验证

- 先阅读对应实现、调用方和现有测试，保留工作区已有的其他修改。
- 专属工具、技能、记忆、主控及浏览器权限必须保持 Agent / 会话边界；独立浏览器继续作为可选包。
- 真模型或浏览器测试使用隔离的 `DSH_HOME`；凭据通过进程环境传入，不能提交模型密钥、会话原文、Cookie 或本地状态。
- 面向使用者的变化同步维护使用说明和 [CHANGELOG](CHANGELOG.md)，依据见[更新日志指南](docs/changelog-guide.md)。
- 提交遵循 [Conventional Commits 与仓库约定](docs/git-commit-conventions.md)。验证结果需要说明实际执行入口、失败和未覆盖范围。

调研、方案和历史验证见[文档导航](docs/README.md)。安全问题按 [SECURITY.md](SECURITY.md) 私密报告。
