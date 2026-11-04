# Real model audit: task-check-db31

## Scenario

Task check returns output and no standalone shell

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

- `patchwork_task` {"action":"define","baseRevision":0,"brief":{"assumptions":["sum.mjs 存在于当前工作区","npm test 可在工作区直接运行"],"budget":{"maxSearchCalls":4,"maxSteps":10,"maxTokens":"[redacted]"},"goal":"验证 sum 与 npm test","successCriteria":["npm test 通过"],"unknowns":["无"]},"phase":"verify","requirements":[{"id":"sum-anchor","kind":"artifact","label":"sum.mjs 包含 return a + b 锚点","required":true,"targets":["sum-mjs"]},{"id":"npm-test","command":"npm test","kind":"command","label":"运行 npm test","required":true}],"title":"只
- `patchwork_task` {"action":"inspect"}
- `patchwork_task` {"action":"define","baseRevision":1,"brief":{"assumptions":["sum.mjs 存在于当前工作区","npm test 可在工作区直接运行"],"budget":{"maxSearchCalls":4,"maxSteps":10,"maxTokens":"[redacted]"},"goal":"验证 sum 与 npm test","successCriteria":["npm test 通过"],"unknowns":["无"]},"phase":"verify","requirements":[{"id":"sum-anchor","kind":"artifact","label":"sum.mjs 包含 return a + b 锚点","required":true,"targets":["sum-mjs"]},{"id":"npm-test","command":"npm test","kind":"command","label":"运行 npm test","required":true}],"title":"只
- `glob` {"pattern":"sum.mjs"}
- `glob` {"pattern":"*.{json,mjs,js}"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `patchwork_task` {"action":"artifact","baseRevision":2,"id":"sum-mjs","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `patchwork_task` {"action":"check","baseRevision":3,"id":"sum-anchor","rules":{"anchors":["return a + b"]}}
- `patchwork_task` {"action":"check","baseRevision":3,"command":"npm test","description":"运行 npm test 验证 sum 模块","id":"npm-test"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\package.json"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\test.mjs"}
- `patchwork_task` {"action":"check","baseRevision":3,"command":"npm test","description":"重试 npm test","id":"npm-test","tool":"bash"}
- `patchwork_task` {"action":"check","baseRevision":3,"command":"npm test","description":"重试 npm test（默认 pwsh）","id":"npm-test"}
- `patchwork_task` {"action":"inspect"}

## Assertions

- [passed] check-executed: 4 check calls
- [passed] no-standalone-shell: 0 standalone shell calls
- [failed] task-not-blocked: task=blocked

## Result

**failed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
