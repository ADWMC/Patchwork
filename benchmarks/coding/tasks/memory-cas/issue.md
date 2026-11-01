# Issue

修复 `src/store.mjs` 的 CAS。`put(value, expectedRevision)` 只有在 expectedRevision 等于当前 revision 时成功，否则抛出 `REVISION_CONFLICT`。
