# Real model audit: D

## Scenario

Read-only explore returns findings without writes

## Environment

- model: stepfun / step-5-preview
- DSH: 0.2.1-rc.5
- package: 0.2.0
- git: 9b606d10431de7550a54ab464179997ee83bc293
- preset: patchwork
- main DSH touched: no

## Prompt

Prompt omitted; hash only.

## Observed tool calls

- `patchwork_superagent` {"action":"inspect"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `patchwork_superagent` {"action":"submit","baseRevision":0,"concurrency":1,"jobs":[{"id":"readme-constraints","mode":"read","prompt":"读取当前工作区根目录下的 README.md 文件（绝对路径：C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md）。逐行阅读其内容，从中总结出恰好三条约束/规则，每条用一行中文概括，并附上原文引用。不要修改任何文件。最终以 JSON 对象返回：{\"file\": \"README.md\", \"constraints\": [{\"summary\": \"...\", \"quote\": \"...\"}, ...]}。","title":"读取 README.md 并总结三条约束"}]}
- `list_agents` {"scope":"children"}
- `job_output` {"job_id":"session-pw-7da3793a-d0b4-49f6-a8d4-3747b4f27641","wait":true}
- `patchwork_superagent` {"action":"inspect"}
- `pwsh` {"command":"Get-FileHash -Algorithm SHA256 \"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md\" | Select-Object -ExpandProperty Hash","description":"Compute SHA-256 of README.md to verify unchanged"}

## Assertions

- [passed] superagent-submitted: 1 submit calls
- [passed] no-writes: 0 write/edit calls

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
