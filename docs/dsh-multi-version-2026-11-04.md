# DSH 多版本支持（2026-11-04）

本轮目标：让 Patchwork 在 **DSH 0.2.1-rc.2、0.2.1-rc.5** 和 **0.2.2-alpha.3** 上使用同一份发布包，而不是只靠“旧版本也许能跑”的推断。

## 1. 先看 DSH 的规则

DSH 的 `dsh-app-boot` 在导入插件前检查清单：

- 如果包声明了 `engines.dsh`，只用这个范围判定，忽略 `@deepseek-ai/dsh*` peer 范围；
- 没有 `engines.dsh` 时，才逐个检查 DSH peer 包；
- 预发布版本参与 SemVer 匹配；无效或空范围视为不兼容；
- 拒绝只影响该组合边界，不会改写 profile 依赖或 patch 文件。

官方插件市场也按每个版本的 `engines.dsh` 计算兼容性。因此“支持多版本”的第一件事不是加运行时分支，而是给出准确的 `engines.dsh`。

来源：

- DSH `packages/boot/app-boot/README.md` 的 Profiles / compatibility 段；
- DSH `docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.md`；
- DSH `docs/user/develop/basic/publish.md`；
- DSH `packages/boot/plugin-market/README.md`。

## 2. 社区项目怎么做的

用 `gh` 搜索了带 `dsh.bundle.patch` 的公开插件，并读取清单：

| 项目 | 做法 | 取舍 |
|---|---|---|
| `Anionex/dsh-turn-rewind` | 显式列出 `dsh.compatibility.dsh` 和逐个 `dshReleases` 状态，同时保留 peer 范围 | **借**：把支持范围写成可读的清单。**不借**：自建 `dsh.compatibility` 不是 DSH 安装器的判定源，不能替代 `engines.dsh` |
| `Hilbert-beinghappy/seektty` | 把几十个 DSH 包精确锁在 `0.2.0-rc.2`，用 `dsh.compatibility.minimum/tested` 说明 | **不借**：精确锁死单个宿主版本，升级即断；Patchwork 继续用 peer + `engines.dsh` |
| `GoPlusSecurity/agentguard`、`MeteorNOX/DeepSeek-Balance-Whale-Widget` | 只声明 `dsh.bundle.patch`，没有版本范围 | **不借**：安装器无法判断兼容性，用户只能试错 |

社区里没有成熟的“同一预设自动适配两代宿主 API”的通用方案；主流做法仍是声明范围，再按宿主版本维护兼容层。

## 3. 实际差异

0.2.1-rc.2 与 rc.5 的 standard preset 内容相同，工具执行仍是单次 `tools.execute(exec)`；rc.2 因此不需要额外运行时分支。0.2.2-alpha.3 对 Patchwork 有四处实质影响：

1. **工具执行 API 改成批处理**：`tools.execute(exec)` 变成 `tools.execute({ calls, agent, signal })`，返回 `{ results: [{ callId, result }] }`。Patchwork 的验收命令和 `then_run` 融合调用不使用模型驱动的批处理，必须适配。
2. **子代理配置改名**：`modelSelectionSettings` 拆成 `modelSelection` + `modelDiscovery`。
3. **移除子路径**：`@deepseek-ai/dsh-tool-subagent-control/list-agents` 不再导出；`list_agents` 由主 control 包注册。
4. **执行器变成显式行**：alpha 的 base bundle 挂 `@deepseek-ai/dsh-tool-executor-native`；rc.2/rc.5 内建。测试 harness 需要按存在性补这一行，发布插件不需要。

## 4. 实现

- `package.json` / `packages/browser/package.json` 增加 `engines.dsh: ">=0.2.1-rc.2 <0.3.0-0"`，作为安装和 profile 启动的唯一兼容声明。
- 新增 `src/util/tool-execute.mjs`。用 `tools.selectExecutor` 是否存在识别批处理 API；批处理时把单次调用包成一条 raw call，取回 `results[0].result`。`src/task/acceptance.mjs` 与 `src/mechanisms/action-fusion/index.mjs` 改用该封装。
- `scripts/gen-preset.mjs` 增加跨版本归一化：删除已移除的 `tool-subagent-list-agents` 行；在 spawn 子代理配置中同时写三种键。Schemastery 会保留未知键但不读取，因此各代宿主各取所需。生成器可从 `DSH_HOST_VERSION` 选择 fixture。
- 新增 `tests/fixtures/dsh-v0.2.1-rc.2.standard.patch.yml` 与 `dsh-v0.2.2-alpha.3.standard.patch.yml`，保留 rc.5 fixture；preset 测试检查三代 fixture 都能生成同一条 runtime 行且不再引用被移除子路径。
- 新增 `scripts/set-dsh-version.mjs`：按目标版本重写开发依赖、cordis/schemastery，并在可用时安装 alpha 执行器；`--dry-run` 只打印，`--install` 才改锁文件。
- `pnpm-workspace.yaml` 显式拒绝 alpha 依赖树里的 `@google/genai` 与 `protobufjs` 安装脚本（`allowBuilds: false`）；测试不需要它们，避免 pnpm 12 的严格构建检查中断安装。
- 新增 `DSH compatibility` 工作流：每周和 PR 路径变更时，在 rc.2 与 alpha.3 宿主上重跑同一套测试；`Validate` 继续覆盖 rc.5。
- 测试 harness 仅在 `@deepseek-ai/dsh-tool-executor-native` 可解析时挂载执行器行；测试侧用代理把单次 `tools.execute` 接到同一封装。

## 5. 证据

| 宿主 | 命令 | 结果 |
|---|---|---|
| 0.2.1-rc.2 | `node scripts/set-dsh-version.mjs 0.2.1-rc.2 --install` + `npm test` | 452 pass / 0 fail |
| 0.2.1-rc.5 | `npm test` | 452 pass / 0 fail |
| 0.2.2-alpha.3 | `node scripts/set-dsh-version.mjs 0.2.2-alpha.3 --install` + `npm test` | 452 pass / 0 fail |

真实入口验证：

- rc.2：用全局 rc.2 CLI 在独立 `DSH_HOME` 创建 `patchwork-rc2` profile，安装本地 tarball，`--dump-config` 含 `preset-patchwork`，`--no-open --port 0` 启动成功；
- alpha.3：用 alpha CLI 在独立 `DSH_HOME` 创建 `patchwork-alpha` profile，安装本地 tarball，`--dump-config` 含 `preset-patchwork`，`--no-open --port 0` 启动成功；
- 两者都没有连接或修改主 DSH。

机器证据见 [dsh-compat-2026-11-04.json](checks/dsh-compat-2026-11-04.json)。

## 6. 边界

- 当前把 **0.2.1-rc.2、0.2.1-rc.5 与 0.2.2-alpha.3** 作为测试版本；没有声称覆盖 rc.2 之前或未来的 0.3。
- `profiles/patchwork/package.json` 仍是 rc.5 基线模板；其他版本用 `dsh plugin add` 创建 profile，或运行 `set-dsh-version`。模板不会自动跟随宿主，避免静默改写用户的 profile。
- 跨版本 preset 采用交集能力：rc.2/rc.5 上不再单独挂 `list-agents` 子路径；alpha 上沿用主 control 包注册。`modelDiscovery` 在 rc.2/rc.5 被忽略，属于预期差异。
- rc.2 与 alpha 只验证了组合挂载、CLI 启动与 `--dump-config`；没有创建真实会话或调用模型，因此预设子行的运行时激活仍由单元/组合测试覆盖，不是端到端模型证据。
- UI、浏览器可选包和真实模型调用没有在 rc.2/alpha 上重新做完整人工验收；本轮只验证确定性测试、组合挂载和 CLI 启动。
- `engines.dsh` 只做版本准入，不是沙箱；不兼容的插件仍可能因 API 变化在运行时失败。
