# Real model audit: explore-parent-ed19

## Scenario

Explore job submitted and no writes in parent

## Environment

- model: stepfun-isolated / step-5-preview
- DSH: 0.2.1-rc.5
- package: 0.2.0
- git: 9b606d10431de7550a54ab464179997ee83bc293
- preset: patchwork
- main DSH touched: no

## Prompt

Prompt omitted; hash only.

## Observed tool calls

- `skill` {"name":"patchwork"}
- `glob` {"pattern":"README.md"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\home\\profiles\\patchwork\\node_modules\\@patchwork\\coding-agent\\assets\\skills\\patchwork\\references\\superagent.md"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `patchwork_superagent` {"action":"inspect"}
- `patchwork_superagent` {"action":"submit","baseRevision":0,"concurrency":1,"jobs":[{"id":"readme-constraints","title":"读取 README.md 并总结三条约束（只读探索）","mode":"explore","prompt":"只读探索任务。读取工作区文件 C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md，从中总结三条约束，并为每条约束给出原文引用（逐字摘录对应行）。约束：不得修改任何文件，不得使用 shell。完成后按执行器规程用 patchwork_task 登记要求/产物，结束前调用 patchwork_superagent report 上报状态（ready/waiting/review/blocked/failed）与简短 summary；语义不确定时保留 unknown，不要自评通过。"}
- `patchwork_superagent` {"action":"inspect"}

## Assertions

- [passed] explore-submitted: mode=explore observed
- [passed] no-parent-writes: 0 parent write/edit calls

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
