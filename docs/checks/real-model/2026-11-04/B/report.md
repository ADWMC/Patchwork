# Real model audit: B

## Scenario

Project-shared memory requires explicit scope

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

- `patchwork_memory` {"action":"propose","key":"deployment-dsh-home-isolation","value":"本项目所有部署都必须使用隔离的 DSH_HOME，不能改动主 DSH。","visibility":"project-shared","kind":"policy","conditions":"适用于本项目的所有部署场景"}
- `patchwork_memory` {"action":"recall","includeProject":true,"query":"DSH_HOME 部署 隔离"}
- `patchwork_memory` {"action":"inspect","id":"mem_732d2672a7d74f6b817256fe"}
- `patchwork_memory` {"action":"list","status":"proposed","validity":"all","limit":5}
- `patchwork_memory` {"action":"list","includeProject":true,"status":"proposed","validity":"all","limit":5}

## Assertions

- [passed] memory-proposed: propose call observed
- [failed] scope-required-error: [patchwork_memory]
{"status":"failed","failureCode":"MEMORY_NOT_FOUND"}
- [failed] scoped-inspect: missing scoped inspect call
- [passed] no-tool-errors: 0 tool errors

## Result

**failed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
