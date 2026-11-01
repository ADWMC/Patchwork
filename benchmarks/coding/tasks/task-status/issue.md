# Issue

修复 `src/status.mjs` 的验收判断。失败、unknown、cancelled 和非零退出都不能通过；只接受 `outcome=passed` 且 `exitCode=0`。
