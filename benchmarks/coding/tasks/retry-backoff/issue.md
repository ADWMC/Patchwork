# Issue

`retry` 的 `retries` 参数表示失败后的额外尝试次数。当前实现把它当成总尝试次数，且 `retries=0` 不执行操作。修复 `src/retry.mjs`，不要修改测试文件。
