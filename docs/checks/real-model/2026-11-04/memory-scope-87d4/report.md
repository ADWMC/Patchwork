# Real model audit: memory-scope-87d4

## Scenario

Project-shared memory requires explicit scope

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

- `patchwork_memory` {"action":"propose","key":"real-model-scope-check","value":"部署必须使用隔离 DSH_HOME","visibility":"project-shared"}
- `patchwork_memory` {"action":"inspect","id":"mem_527c3324c066436abc6d96a4"}
- `patchwork_memory` {"action":"inspect","id":"mem_527c3324c066436abc6d96a4","includeProject":true}
- `patchwork_memory` {"action":"list","includeProject":true}

## Assertions

- [passed] memory-proposed: propose call observed
- [passed] scope-required-error: [patchwork_memory]
{"status":"failed","failureCode":"MEMORY_PROJECT_SCOPE_REQUIRED"}
- [passed] scoped-inspect: inspect with includeProject observed
- [passed] no-tool-errors: 0 tool errors

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
