# Real model audit: native-graph-pre-fix-1477

## Scenario

Opt-in workspace graph started by the model

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

- `patchwork_code` {"action":"graph-status"}
- `patchwork_code` {"action":"graph-enable"}
- `patchwork_code` {"action":"graph-start"}
- `patchwork_code` {"action":"graph-status"}
- `patchwork_code` {"action":"callers","symbol":"addChain"}
- `patchwork_code` {"action":"callees","symbol":"addChain"}
- `patchwork_code` {"action":"impact","symbol":"addChain"}
- `patchwork_code` {"action":"callers","symbol":"addChain"}
- `patchwork_code` {"action":"find","symbol":"addChain"}
- `patchwork_code` {"action":"outline","path":"chain.mjs"}
- `patchwork_code` {"action":"callers","path":"chain.mjs","symbol":"addChain"}
- `patchwork_code` {"action":"map"}
- `glob` {"pattern":"**/*.test.*"}
- `patchwork_code` {"action":"affected","path":"chain.mjs"}

## Assertions

- [passed] graph-status-observed: observed
- [passed] graph-start-observed: observed
- [passed] callers-observed: observed
- [passed] callees-observed: observed
- [passed] impact-observed: observed
- [passed] affected-observed: observed
- [passed] no-writes-or-shell: 0 write/edit/shell calls
- [failed] no-tool-errors: 4 tool errors

## Result

**failed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
