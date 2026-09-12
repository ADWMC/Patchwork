# benchmark/

在**真实 DSH 轨迹**上度量四个机制的效果。

## 它是什么，不是什么

**是**：同一条真实轨迹的**反事实**——「如果机制当时开着，会少花多少」。数据源是本机
DSH 自己的会话日志，含 provider 报的每次请求 usage 与每个工具结果的宿主估算 token。

**不是**：重跑测量。没有重新调用模型，因此不产生新的消耗，也没有 Pi 侧对照——
按决定，对比只在 DSH 内部（机制关 vs 机制开）成立。

这与 SoL-Pi 自己的报告方式一致（它称之为 trajectory-derived counterfactual）。

## 怎么跑

```sh
node benchmark/analyze.mjs [--cwd Patchwork] [--limit 5] [--json]
```

- `--cwd`：只分析 `cwd` 含该子串的会话（默认 `Patchwork`）。
- `--limit`：取最大的 N 个会话。
- `--json`：输出机器可读结果。

需要 `@deepseek-ai/dsh@0.1.5-rc.2` 的若干包（见 `package.json` 的 devDependencies）。
脚本会启动一个只挂载「会话持久化 + 投影 + token 计量」的最小 DSH 组合，读完后立即
销毁，不落任何工作产物。

## 数字从哪来

分两类，报告中分开呈现：

| 类别 | 内容 |
|---|---|
| **事实** | 会话日志记录的 provider usage（输入/输出/缓存读取/推理）；每次工具调用的名称与命令；每个工具结果的字节数 |
| **假设** | 由事实推导反事实时用到的取值，逐条列在下面与代码里 |

### 各项假设

- **Action Fusion**：一步只改文件（`edit`/`write`）、下一步只跑 shell 命令的相邻步对，
  融合后**下一步那次模型请求整体消失**，省下它的全部上下文成本
  （非缓存输入 + 缓存读取 + 输出）。忽略融合调用自身略增的输出，故为**上限**。
- **ObservationPack**：超过 10 KiB 的纯文本结果，在其之后每次请求都以句柄替代全文；
  句柄按 `placeholderTokens = 300` 计。本机制是**首次即换**，而 SoL-Pi 前两次仍发全文，
  所以这里的节省**高于**同语义的 SoL-Pi 实现，是上限。
- **Evidence-Preserving Reducer**：只统计命令匹配诊断正则、且超过 4 KiB 的 shell 结果；
  收据大小在轨迹里无从得知，按 `receiptTokens = 400` 计。被替换掉的原文量作为事实
  单独给出，便于换假设重算。
- **Online Context Compact**：**不报 token 数字**。压缩净收益取决于经济性判定
  （写入成本 vs 未来节省），轨迹里没有足够信息支撑一个数字，因此只报上下文增长与
  轮次边界数量。

token 一律来自宿主自己的估算器（`dsh-token-meter` 的 `estimateMessage`），不是自造
换算率。若该服务不可用，结果里的 token 字段为 `null`，报告会显式标注
`host token estimator UNAVAILABLE`，不会拿 0 冒充。

## 一次真实运行（示例，非承诺）

本机 4 个最大会话的聚合：

```
requests 541 / turns 38 / tool results 905 / tool output 1.77 MiB
tokens total=118,592,382  input=3,055,527  output=537,559  cacheRead=114,999,296
action fusion    29 candidates -> 29 requests removed ->  8,636,844 tokens (7.3%)
observation pack 29 oversized    -> 29 replays avoided  -> 16,801,744 tokens (14.2%)
reducer           0 diagnostic logs
context peak 512,287 tokens
```

解读时注意两点：缓存读取占了 token 总量的 97%，因此 token 数量的下降**不等于**同等
比例的账单下降；不同会话的机制命中率差异很大（例如有的会话 0 个融合候选）。

## 规范形态的考题交付物（Harbor 题）：**未交付，依据规范主动不做**

`dsh-benchmark-case` 的 Stage 0 有一道硬门槛：**装旧形态必有可观察故障**，否则
「答不出就退回升级卡形态，不做题」。

本仓库唯一可考的迁移是「机制改造前的插件形态 → 现在的插件形态」。我把那一版从
它的前一次提交里取出来，装进真实 Loader 组合实测，结果是**它能正常激活**：
`systemPrompt` / `commands` 正常解析，工具面 `read/write/edit/pwsh` 完整。

既然旧形态装上去就能跑，**就不存在必需迁移**，这道题不成题。按规范应当退回升级卡
形态而不是编一道；而升级卡属于 skill 仓库的知识体系（现有卡只到 `v0.1.3-alpha.2`，
没有 `0.1.5-rc.2` 的卡），在 Patchwork 内没有对应载体。

判决由测试固化，不是断言：

```sh
node --test tests/real-composition/pre-migration-form.test.mjs
```

如果哪天旧形态真的在目标宿主上装不起来了，这条测试会失败，那时 Stage 0 的前提
才成立，题目也才值得做。

### 已定的相关决定

| 决定 | 取值 | 说明 |
|---|---|---|
| 宿主版本 | **`0.1.5-rc.2`** | **对规范的显式偏离**：规范把 Dockerfile 钉死 `@deepseek-ai/dsh@0.1.2-alpha.2` 并写明「改了等于换题」。本仓库的插件 target 就是 `0.1.5-rc.2`。 |
| 交付位置 | 本仓库 `benchmark/`（按目标要求） | 规范原文的落点是 skill 仓库（走 fork+PR）。 |
| 容器验证 | 不做 | 本机无 docker/harbor，规范的「oracle 在容器里跑出 100/100」与「不绿不交付」无法满足。 |

## 已知边界

- 只覆盖本机存储里存在的会话，且默认取最大的若干个；这不是抽样意义上的全量。
- 反事实不含模型行为变化：若机制改变了模型的下一步行为，真实轨迹会与这里假设的不同。
- 没有容器与真实产品入口的端到端验证（本机无 docker/harbor），见仓库根 README 的状态表。
- `--cwd` 过滤基于会话头里的工作目录，无法区分同一目录下的不同任务类型。
