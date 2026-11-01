# Issue

修复 `src/dedupe.mjs`。URL 规范化规则：host 小写、删除 hash、非根 pathname 删除尾部 `/`；无效 URL 保留原值但只按原值去重。返回第一次出现的完整 source 对象。
