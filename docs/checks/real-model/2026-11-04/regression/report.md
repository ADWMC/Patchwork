# Real model audit: regression

## Scenario

Task check returns output and no standalone shell

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

- `skill` {"name":"patchwork"}
- `patchwork_task` {"action":"inspect"}
- `glob` {"pattern":"*"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\package.json"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.test.mjs"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `patchwork_task` {"action":"define","baseRevision":1,"phase":"verify","requirements":[{"id":"sum-anchor","kind":"artifact","label":"sum.mjs 包含锚点 return a + b","required":true,"targets":["sum-mjs"]},{"id":"npm-test","kind":"command","label":"npm test 通过","required":true}],"title":"登记并验收 sum.mjs 锚点与 npm test"}
- `patchwork_task` {"action":"artifact","baseRevision":2,"id":"sum-mjs","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `patchwork_task` {"action":"check","baseRevision":3,"id":"sum-anchor","rules":{"anchors":["return a + b"]}}
- `patchwork_task` {"action":"check","baseRevision":3,"command":"npm test","description":"Run npm test in the workspace and bind the real host receipt","id":"npm-test","tool":"pwsh"}

## Assertions

- [passed] check-executed: 2 check calls
- [passed] no-standalone-shell: 0 standalone shell calls
- [passed] task-not-blocked: task=ready

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
