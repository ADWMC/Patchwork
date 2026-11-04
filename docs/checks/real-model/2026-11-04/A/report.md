# Real model audit: A

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

- `working_directory` {}
- `glob` {"pattern":"**/*"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.test.mjs"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\package.json"}
- `skill` {"name":"evidence"}
- `skill` {"name":"standards"}
- `skill` {"name":"patchwork"}
- `patchwork_task` {"action":"inspect"}
- `patchwork_task` {"action":"define","baseRevision":1,"phase":"implement","requirements":[{"id":"fix","kind":"artifact","label":"sum.mjs 的 sum(a,b) 返回 a + b（最小改动，一行）","required":true,"targets":["sum-mjs"]},{"id":"test","kind":"command","label":"npm test（node --test）全通过：sum(2,3)===5","required":true,"coverage":["all"]}],"title":"按 README 约束修复 sum.mjs 加法并用 npm test 验收"}
- `pwsh` {"command":"npm test 2>&1; \"EXIT_CODE=$LASTEXITCODE\"","description":"Run baseline npm test before fix","workdir":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace"}
- `edit` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs","new_string":"  return a + b","old_string":"  return a - b"}
- `patchwork_task` {"action":"artifact","baseRevision":4,"id":"sum-mjs","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `patchwork_task` {"action":"check","baseRevision":5,"command":"npm test","description":"在工作区执行 package.json 的 test 脚本（node --test），验证 sum(2,3)===5 通过","id":"test","tool":"pwsh"}
- `pwsh` {"command":"node --version; npm --version; npm test 2>&1; \"EXIT_CODE=$LASTEXITCODE\"","description":"Run npm test after fix and show versions","workdir":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `patchwork_task` {"action":"artifact","baseRevision":6,"id":"sum-mjs","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\sum.mjs"}
- `patchwork_task` {"action":"check","baseRevision":7,"id":"fix","rules":{"anchors":["export function sum(a, b)","return a + b"]}}
- `patchwork_task` {"action":"check","baseRevision":7,"command":"npm test","description":"在工作区执行 package.json 的 test 脚本（node --test --test-isolation=none），验证 sum(2,3)===5","id":"test","tool":"pwsh"}

## Assertions

- [passed] check-executed: 3 check calls
- [failed] no-standalone-shell: 2 standalone shell calls
- [passed] task-not-blocked: task=ready

## Result

**failed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
