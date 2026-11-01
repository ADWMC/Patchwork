# Issue

修复 `src/redact.mjs`。脱敏键不区分大小写，递归覆盖对象和数组；敏感值统一替换为 `[REDACTED]`，不要改变普通字段。
