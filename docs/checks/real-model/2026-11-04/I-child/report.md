# Real model audit: I-child

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

- `read` {"file_path":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md"}
- `patchwork_superagent` {"action":"report","status":"ready","summary":"已通读 README.md（路径：C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\documents\\deepseek-harness\\default-workspace\\README.md，共 5 行），总结出三条约束如下：\n\n约束一：本项目必须使用 pnpm 作为包管理器。\n原文依据：\"- 包管理器：pnpm\"（第 3 行）\n\n约束二：本项目必须通过 `npm test` 命令执行测试。\n原文依据：\"- 测试命令：npm test\"（第 4 行）\n\n约束三：部署时必须使用隔离的 DSH_HOME，不得改动主 DSH。\n原文依据：\"- 部署约束：必须使用隔离的 DSH_HOME，不能改动主 DSH。\"（第 5 行）\n\n本次任务仅为读取与总结，未修改、创建或删除任何文件。"}

## Assertions

- [passed] assistant-response: 3 assistant messages
- [passed] no-tool-errors: 0 tool errors

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
