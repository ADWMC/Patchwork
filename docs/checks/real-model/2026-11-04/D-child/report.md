# Real model audit: D-child

## Scenario

Session and model smoke

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

- `patchwork_task` {"action":"inspect"}
- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `skill` {"name":"patchwork"}
- `skill` {"name":"evidence"}
- `patchwork_task` {"action":"define","baseRevision":2,"phase":"analysis","requirements":[{"id":"readme-constraints-source","kind":"artifact","label":"README.md 原文包含三条约束行（pnpm / npm test / 隔离 DSH_HOME）","required":true,"targets":["readme-md"]},{"id":"constraint-summaries","kind":"semantic","label":"三条中文概括忠实且恰好覆盖原文三条约束","required":true}],"title":"README.md 约束提取（只读验收）"}
- `patchwork_task` {"action":"artifact","baseRevision":3,"id":"readme-md","path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `patchwork_task` {"action":"check","baseRevision":4,"id":"readme-constraints-source","rules":{"anchors":["- 包管理器：pnpm","- 测试命令：npm test","- 部署约束：必须使用隔离的 DSH_HOME，不能改动主 DSH。"]}}
- `patchwork_task` {"action":"assessment","baseRevision":4,"id":"constraint-summaries","verdict":"unknown"}
- `patchwork_superagent` {"action":"report","status":"review","summary":"README.md 已逐行读取（共 5 行，未修改任何文件）。提取恰好三条约束并附原文引用：1) 包管理器必须使用 pnpm——引用「包管理器：pnpm」；2) 测试命令为 npm test——引用「测试命令：npm test」；3) 部署必须使用隔离的 DSH_HOME，不能改动主 DSH——引用「部署约束：必须使用隔离的 DSH_HOME，不能改动主 DSH。」。交付 JSON：{\"file\":\"README.md\",\"constraints\":[{\"summary\":\"包管理器必须使用 pnpm\",\"quote\":\"包管理器：pnpm\"},{\"summary\":\"测试命令为 npm test\",\"quote\":\"测试命令：npm test\"},{\"summary\":\"部署必须使用隔离的 DSH_HOME，不能改动主 DSH\",\"quote\":\"部署约束：必须使用隔离的 DSH_HOME，不能改动主 DSH。\"}]}。验收：ar
- `patchwork_superagent` {"action":"inspect"}

## Assertions

- [passed] assistant-response: 7 assistant messages
- [passed] no-tool-errors: 0 tool errors

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
