# Real model audit: code-pre-fix-4ef7

## Scenario

Local code map and symbol search

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

- `patchwork_code` {"action":"map","tokenBudget":"[redacted]"}
- `patchwork_code` {"action":"find","symbol":"sum"}
- `patchwork_code` {"action":"search","query":"sum"}
- `patchwork_code` {"action":"search","mode":"word","query":"sum"}
- `patchwork_code` {"action":"search","query":"sum","path":"."}
- `patchwork_code` {"action":"references","symbol":"sum"}
- `patchwork_code` {"action":"search","glob":"*.mjs","query":"sum"}
- `glob` {"pattern":"**/*"}
- `patchwork_code` {"action":"outline","path":"sum.mjs"}
- `read` {"file_path":"sum.mjs"}
- `read` {"file_path":"README.md"}
- `read` {"file_path":"package.json"}
- `patchwork_code` {"action":"outline","path":"sum.test.mjs"}
- `read` {"file_path":"sum.test.mjs"}

## Assertions

- [passed] code-tool-used: 9 patchwork_code calls
- [passed] no-public-search-for-local-code: local code must not be routed to public search
- [failed] no-tool-errors: 5 tool errors

## Result

**failed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
