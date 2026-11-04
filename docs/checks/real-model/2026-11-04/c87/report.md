# Real model audit: c87

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

- `pwsh` {"command":"Write-Output OK","description":"运行 Write-Output OK 并查看输出"}
- `pwsh` {"command":"Write-Output OK","description":"重试 Write-Output OK 命令"}
- `pwsh` {"command":"$PSVersionTable.PSVersion.ToString()","description":"检查 PowerShell 版本以测试可用性"}
- `pwsh` {"command":"Write-Output OK","description":"在 DSH 检出目录下测试 pwsh","workdir":"C:\\Users\\Administrator\\AppData\\Local\\Temp\\patchwork-latest-20261103\\home\\profiles\\patchwork"}
- `pwsh` {"command":"Write-Output OK","description":"后台模式运行 Write-Output OK","run_in_background":true}
- `job_output` {"job_id":"pwsh-60c493122f554187","wait":true}
- `pwsh` {"command":"Write-Output OK","description":"以 danger-full-access 重试 Write-Output OK","justification":"用户明确要求运行命令 Write-Output OK，但当前沙箱的 Windows Job runner 无法启动任何子进程（连续 4 次相同故障），需要更宽的权限执行这条命令。","sandbox_permissions":"danger-full-access"}

## Assertions

- [passed] assistant-response: 4 assistant messages
- [failed] no-tool-errors: 4 tool errors

## Result

**failed**

## Limitations

This is a single real-model run unless the manifest says otherwise. Model output is nondeterministic; passing assertions are evidence for this run, not a universal correctness claim.
