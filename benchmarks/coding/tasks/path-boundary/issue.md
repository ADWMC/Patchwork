# Issue

修复 `src/safe-path.mjs` 的路径边界。任何结果不在 root 内都抛出 `PATH_OUTSIDE_ROOT`；root 自身和普通子路径保持可用。不要修改测试。
