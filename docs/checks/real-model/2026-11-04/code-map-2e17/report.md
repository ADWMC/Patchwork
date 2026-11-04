# Real model audit: code-map-2e17

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

- `patchwork_code` {"action":"map"}
- `patchwork_code` {"action":"find","symbol":"sum"}
- `patchwork_code` {"action":"references","symbol":"sum"}
- `patchwork_code` {"action":"search","query":"sum"}
- `read` {"file_path":"sum.mjs"}
- `read` {"file_path":"sum.test.mjs"}

## Assertions

- [passed] code-tool-used: 4 patchwork_code calls
- [passed] no-public-search-for-local-code: local code must not be routed to public search
- [passed] no-tool-errors: 0 tool errors

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
