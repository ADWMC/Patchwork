# 隔离 DSH 真实验证记录

日期：2026-10-29至2026-10-30，时区 Asia/Shanghai。结论仅覆盖实际执行项，不把/models探测、模拟Agent或设计截图算作真实模型验收。

**最终状态**：144/144测试通过；Patchwork preset正向、standard负向的真实隔离验收见文末“最终隔离验收补充”和[隔离审计](isolation.md)。以下早期全局插件验收是历史记录。

## 隔离配置与保护范围

- 运行：官方 DSH 0.2.1-rc.2 web，127.0.0.1:4321，独立Node进程；复用已有可执行文件，没有升级全局安装。
- 根目录：C:/Users/Administrator/AppData/Local/Temp/patchwork-dsh-isolated-20261029。
- DSH_HOME：上述目录/home；DSH_AGENTS_HOME：上述目录/agents；包缓存指定至上述目录/pnpm-store。
- 最终测试工作区：上述目录/workspace，通过DSH“添加工作区”目录选择器建立。
- 插件仅加到隔离web profile，link指向本仓库。没有执行主profile插件安装、主配置写入或主会话迁移。
- 首次测试会话使用宿主自动建立的默认工作区条目，但所有工具文件路径明确限定lab/workspace；后续write/edit验收改在显式lab工作区进行。
- 只重启核对过命令行及端口4321的隔离监听进程，没有停止其他DSH/Node进程。
- overlay不含密钥。用户提供的StepFun key只经PATCHWORK_STEPFUN_KEY进程环境变量读取，没有写入仓库、文档或overlay。
- telemetry session-telemetry-otel 在隔离overlay中关闭。

可复用启动形式（先在当前终端自行设置环境变量，不把密钥填到脚本）：

~~~powershell
$lab = 'C:/Users/Administrator/AppData/Local/Temp/patchwork-dsh-isolated-20261029'
$env:DSH_HOME = "$lab/home"
$env:DSH_AGENTS_HOME = "$lab/agents"
$env:npm_config_store_dir = "$lab/pnpm-store"
# PATCHWORK_STEPFUN_KEY 必须已存在于当前进程环境
Set-Location "$lab/workspace"
dsh web --patch "$lab/isolated.overlay.yml" --no-open --host 127.0.0.1 --port 4321
~~~

访问使用启动器提供的本机认证或本轮保留的浏览器页；本文不记录认证token。

## 真实模型与工具链

- provider：stepfun-isolated；模型step-3.5-flash。
- OpenAI兼容路由：https://api.stepfun.com/step_plan/v1。
- 使用“标准模式 + Patchwork插件”，通过DSH聊天输入并发送，不是绕过DSH直接请求completion。
- /models曾返回200，只作为连接发现；真正验收依据是模型产生的原生工具调用、宿主回执、实际文件和面板状态。

### 首次融合验证

23:03—23:05，在首次隔离会话 session-0dbc2b71-646b-4301-94a4-9806346f5d23：

| 工具 | 实际结果 | 根callId |
|---|---|---|
| write smoke.txt + then_run | PATCHWORK_FUSION_OK，exit0 | chatcmpl-tool-a26d100d07eceb9c |
| write failure-probe.txt + then_run | PATCHWORK_EXPECTED_EXIT_7，exit7，failed | chatcmpl-tool-8781454f6a4a2139 |

二者文件内容通过本机精确字符串检查。此阶段凭证热重载问题随后在主题切换时发现并修复。

### 最终工作区 write 验收

23:11，在显式lab工作区的 session-4c9aa7a5-93f4-4421-84a7-1baae7a53db1：

- write final-success.txt：严格内容核对后输出PATCHWORK_FINAL_OK，exit0。
- write final-failure.txt：输出PATCHWORK_FINAL_EXIT_7，exit7；工具修改成功但跟进验证失败，不能整体冒称成功。
- 当时state采集4条回执：两条根write、两条嵌套pwsh。AF fusedCalls=2、succeededCalls=1、failedCalls=1、successfulRootFusions=1。
- 保存快照：lab/evidence/runtime-state-native-write.json。

### 最终 tools/result 与 edit 验收

23:16—23:18，代码改为观察宿主最终tools/result后，仅重启隔离实例，恢复同一lab会话：

| 路径 | 行为/关键输出 | canonical exit | 根callId |
|---|---|---|---|
| final-success.txt | edit后严格核对新内容；PATCHWORK_EDIT_OK | 0 | chatcmpl-tool-a44e0f4efae662bf |
| final-failure.txt | edit成功，跟进PATCHWORK_EDIT_EXIT_7，预期failed | 7 | chatcmpl-tool-bded17126532a1dc |

真实宿主首先拒绝两次未读取文件的edit（read-before-edit）；模型随后只读上述两文件，再执行融合edit。原生保护没有被绕过。预期exit7后没有修复或重跑该命令。

最终文件逐字核对：
- final-success.txt = patchwork-isolated-final-ok
- final-failure.txt = intentional-failure-verified

最终进程的会话store有8条回执：2次read-before-edit拒绝、2次read、2次edit和2次嵌套pwsh。4条failed不等于4个失败任务：包含2次原生防护拒绝，以及同一exit7命令的根/嵌套回执。未知退出码保留null。

最终context由宿主tokenMeter读取12382 tokens，模型窗口配置262144；窗口是本次配置值，不在此宣称厂商规格。UI显示的会话累计usage为约68.5K tok，不是账单或节省量。

## 浏览器验收

真实路径：DSH右侧栏“开始”→Patchwork→总览/机制/证据/设置。

| 场景 | 实际观察 |
|---|---|
| 原生入口/模块加载 | keyed slot正文与标题加载成功；Button/Switch/SegmentedTabs正常 |
| 数据通道 | 真实工具结果增加时面板自动更新，2秒轮询标识明确 |
| 证据展开/搜索 | 能读callId、根/嵌套、exit0/7和原文；筛选命令生效 |
| 宿主浅色/深色 | 通过账号菜单→设置→外观切换；插件继承宿主token，无独立theme开关 |
| 外观热重载 | 初测曾出现403；修复后再次切换，保持连接、8条证据保留、metadata仅一份 |
| 配置保存/刷新 | OP草稿由false改true保存，刷新仍为true；加载仍false并显示待重载 |
| 双页冲突 | 第二页保留ratio=13.5草稿；第一页先保存OP；第二页POST409，草稿13.5仍在并显示重新载入 |
| 测试后恢复 | OP保存回false；冲突草稿显式丢弃，ratio仍12.5；OCC/EPR/OP保持关闭 |
| 同目录会话切换 | lab工作区新会话显示0条工具结果；切回验收会话恢复8条，不显示上一会话证据 |
| 宿主展开布局 | 原生“全屏”将面板从约366.7px扩至822.7px，进入四指标+双列，无横向溢出 |
| 控制台 | 旧日志含主动重启4321期间connection lost；最终稳定验证区间无新增相关框架错误，未声称历史日志全空 |

本轮没有做完整屏幕阅读器审计、全设备矩阵或所有断网/取消场景。会话隔离另有同目录双session回归；不把一次正常切页替代全面并发验证。

截图为实际DSH实例，不是fixture：
- lab/evidence/dsh-native-dark.png
- lab/evidence/dsh-native-light.png
- lab/evidence/dsh-native-expanded.png
- lab/evidence/dsh-native-conflict.png

运行证据：
- lab/evidence/runtime-state.json：最终tools/result快照，不含API密钥/页面鉴权凭证。
- lab/home/sessions/--C-Users-Administrator-AppData-Local-Temp-patchwork-dsh-isolated-20261029-workspace--/session-4c9aa7a5-93f4-4421-84a7-1baae7a53db1/session.v4.jsonl.zstd：宿主原生会话记录。

## 自动检查

| 命令 | 实际结果 |
|---|---|
| pnpm install --frozen-lockfile | 初始基线成功 |
| node scripts/build-client.mjs | 成功，最终bundle30209字节 |
| node docs/upgrade/2026-10-29/checks/host-probes.mjs | exit0；真实0.2.0工具包+synthetic Agent，write+then_run succeeded/exit0 |
| node --test --test-reporter=spec | 135项，134pass、1fail、0skip；exit1 |
| 新增回归 | canonical退出码、同目录会话隔离、有界去重、鉴权、并发revision、route/tap释放与热重载凭证 |
| git diff --check、客户端构建一致性及凭证扫描 | 检查当前差异、bundle与源码一致；本轮密钥/启动认证token未出现在仓库文件 |

全量唯一失败：tests/preset.test.mjs 的 committed preset rows match the installed host standard verbatim。旧preset与机器全局0.2.1 standard在planning/工具行等不同；这是既有版本漂移问题，本轮未跳过或伪造通过。全量日志：C:/Users/Administrator/AppData/Local/Temp/patchwork-upgrade-final-tests-20261029.log。

## 未验收部分

未完成依赖/preset整体迁移；未在新宿主验收所有旧Patchwork preset条目；未启用OCC做真实压缩；OP/EPR未做真实模型策略对照；未证明任何请求/成本收益。EV/OCC剩余正确性问题见[audit.md](audit.md)。未部署到主DSH，未自动commit/push或发布。

# 最终隔离验收补充 · 2026-10-30

当前结论以[Agent隔离审计](isolation.md)为准：root只保留Web桥接，真实Patchwork preset正向、standard负向均经DSH+StepFun调用验证；144项测试全部通过。下文早期“标准模式+全局插件”与135项测试记录保留为历史，不能作为最终隔离通过证据。

| 最终检查 | 结果 |
|---|---|
| `node --test --test-reporter=spec` | 144/144 pass，0fail、0skip；日志C:/Users/Administrator/AppData/Local/Temp/patchwork-isolation-all-20261030.log |
| `node scripts/build-client.mjs --check` | 31307字节，源码与bundle一致 |
| `node docs/upgrade/2026-10-29/checks/host-probes.mjs` | exit0，真实工具服务+synthetic Agent的融合write成功 |
| standard接口/能力 | 合法page token仍state403/config403；无七技能、review、obs_recall、then_run |
| standard真实模型 | 800行pwsh exit0，末行0800，完整正文、无Patchwork提示或归档；Patchwork调用后再跑短命令，STANDARD_STILL_ISOLATED exit0 |
| Patchwork真实模型 | skill加载，write严格内容校验，嵌套pwsh输出FUSION_SCOPE_OK exit0，长输出归档 |
| OP追加修复 | 首次召回被重新打包，未算通过；修复后两页返回1–800行，next offset15200，拼回30400字节与归档逐字节相同 |
| 草稿隔离 | 未保存17.5草稿→standard锁定→Patchwork恢复12.5且保存禁用 |
| 原生请求与提示词 | 从zstd逐frame读取request/header、system/message、skill-catalog与tool/result；standard无插件目录/notice，system无插件指令 |
| 宿主原生模式对照 | standard→PTC→standard同样出现subagent暂失；minimal对照完整恢复；保留为宿主recompose待查，不声称工具往返完全一致 |

本次范围仅为lab；临时探针已从overlay移除，不部署主DSH、不发布、不commit/push。早期探针把agent/request路由配置当provider body的字段已撤销，用宿主原生日志替代；没有声称做过网络抓包。

---
