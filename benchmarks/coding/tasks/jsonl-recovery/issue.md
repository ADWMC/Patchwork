# Issue

修复 `src/jsonl.mjs` 的增量读取：允许末尾没有换行且 JSON 不完整，返回之前完整记录；空白行跳过；非末尾损坏行必须抛出 `INVALID_JSONL`。
