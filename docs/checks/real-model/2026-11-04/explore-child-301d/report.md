# Real model audit: explore-child-301d

## Scenario

Explore executor returns findings without writes

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

- `glob` {"pattern":"**/README.md"}
- `working_directory` {}
- `patchwork_code` {"action":"map","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace","tokenBudget":"[redacted]"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `grep` {"path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md","pattern":"."}
- `patchwork_code` {"action":"search","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace","query":"约束"}
- `patchwork_superagent` {"action":"report","status":"ready","summary":"EXPLORE 只读完成，未修改任何文件、未使用 shell。\n\n目标文件：C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md（共 5 行，已完整读取至 EOF）。\n\nfindings（三条约束，均逐字摘录）：\n1. claim=包管理器必须使用 pnpm。path=README.md, line=3, quote=\"- 包管理器：pnpm\"\n2. claim=测试命令必须为 npm test。path=README.md, line=4, quote=\"- 测试命令：npm test\"\n3. claim=部署约束：必须使用隔离的 DSH_HOME，不能改动主 DSH。path=README.md, line=5, quote=\"- 部署约束：必须使用隔离的 
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md","limit":20,"offset":1}
- `patchwork_code` {"action":"outline","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `patchwork_superagent` {"action":"report","status":"review","summary":"EXPLORE 只读任务完成：未修改任何文件、未使用 shell、未做任何写操作。\n\n【目标与范围】\n文件：C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md\n已完整读取至 EOF（total 5 lines），并在本次回合重新读取复核，内容与首次一致、未过期。\n\n【findings：三条约束，逐字摘录】\n1. claim=包管理器必须使用 pnpm\n   path=README.md, line=3, quote=\"- 包管理器：pnpm\"\n2. claim=测试命令必须为 npm test\n   path=README.md, line=4, quote=\"- 测试命令：npm test\"\n3. claim=部署约束：必须使用隔离的 DSH_HOM

## Assertions

- [passed] code-tool-used: 3 code calls
- [passed] report-ready: 2 report calls
- [passed] no-writes-or-shell: 0 write/edit/shell calls

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
