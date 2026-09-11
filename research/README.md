# research/

复刻 SoL-Pi 的 **auto-research 方法论**：以「约束式效率」为目标，把机制候选放进
可判定的流程里，只留下能力不下降且确有增益的那些。

## 方法论

SoL-Pi 的搜索不是「想到功能就加」，而是把「改 harness」当成一个带约束的搜索问题。
这里复刻的是它的**判定骨架**（不复制它的模型调用与 rollout 规模）：

1. **提案池**：每条提案是一个可证伪的主张——它声称 harness 里存在可避免的工作。
   写在 `proposals.json`：`id` / `mechanism` / `claim` / `capabilityFloor` /
   `efficiencyMetrics`。
2. **能力下限（capability floor）**：预先声明每个能力指标的下限。省成本不能靠早停、
   跳过验证或删证据换取——那道门就是为了把「省下来的活没干」挡在外面。
3. **效率增益**：至少一个效率指标相对基线变好。两道门都过才留下。
4. **非支配保留**：在通过能力门的候选里，保留没有别的候选在**每一个**效率维度上都不差
   且至少一维更好的那些。
   刻意不做加权总分：加权会把「用一点能力换很多效率」压成一个数，从而掩盖它动了能力下限。
5. **账本**：每个判决（留下/淘汰/尚未评估）连同原因写进 `ledger/ledger.jsonl`。
   一次搜索的价值取决于能否回头核对「当时为什么这样判」。

## 怎么跑

```sh
node research/run.mjs --measurements <file.json> [--baseline <file.json>] [--json] [--no-record]
```

测量文件形状：

```json
{
  "P-002-observation-pack": {
    "capability": { "taskCompletionRate": 1, "evidenceRecallable": 1 },
    "efficiency": { "tokens": 8900000 }
  }
}
```

基线形状：`{ "efficiency": { "tokens": 118592382 } }`。

**本命令不调用模型。** 它只判定别人测出来的数字。可用 `benchmark/analyze.mjs` 提供
轨迹反事实，或由真实 A/B 提供测量。没有测量就不判——判为 `not-measured` 并写进账本，
而不是猜一个通过。

## 与 SoL-Pi 的差异

| 项 | SoL-Pi | 这里 |
|---|---|---|
| 提案来源 | 152 条由 agent 在自动循环里生成 | 人工/外部写入 `proposals.json`（本仓库的四条即四个机制） |
| 实现与验证 | Ralph Loop + 独立 reviewer + 留出集 | 由本仓库的开发流程承担；本目录只负责**判定** |
| 规模 | 535 个训练环境、多次 rollout | 无 rollout；测量必须外部提供 |
| 判定 | 能力门 + 效率门 + 非支配保留 | **一致** |

也就是说：这一层复刻的是方法论中**可判定、可复核**的部分。搜索的规模与自动化不在
本目录内，也不声称具备。

## 已知边界

- 没有自动生成提案的循环，也没有真实 rollout 编排。
- 测量缺失时只会判 `not-measured`，不会给出任何效率结论。
- 非支配筛选不含统计显著性：单次测量上的差异被当作真实差异，因此测量本身的质量
  直接决定判决的质量。
