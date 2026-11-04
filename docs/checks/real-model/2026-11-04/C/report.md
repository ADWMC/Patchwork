# Real model audit: C

## Scenario

Public fetch and evidence citation

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

- `patchwork_fetch` {"url":"https://example.com"}
- `patchwork_evidence` {"action":"cite","claim":"example.com 声明该域名用于文档示例，无需许可即可使用。","claimKey":"example-domain-usage","evidenceId":"ev_83c3beab98be4598b13239fc","quote":"This domain is for use in documentation examples without needing permission."}

## Assertions

- [passed] fetch-used: 1 fetch calls
- [passed] evidence-cited: cite call expected
- [passed] no-tool-errors: 0 tool errors

## Result

**passed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
