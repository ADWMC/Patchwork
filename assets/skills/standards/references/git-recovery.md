# Git 恢复与提交边界

来源参考：[冰可乐的前端笔记 · Git 从入门到进阶](https://note.bingkele.cc/content/docs/42)。这里只保留恢复判断，不复制原文。

## 三个区域

- 工作区：正在改的文件。
- 暂存区：本次准备提交的改动。
- 提交历史：不可变快照链；分支是指向提交的指针，HEAD 是当前位置。

`git add` 把工作区搬到暂存区，`git commit` 把暂存区写入历史。先确认改动在哪个区域，再选恢复命令。

## 同步主线

- `git fetch`：只下载，不改工作区。
- `git pull`：fetch + merge，可能产生合并提交。
- `git rebase`：把当前提交移到主线之后，历史更线性，但会改写提交 SHA。

项目要求线性历史时用 rebase；不确定或团队要求 merge 时不要擅自改写历史。

## 撤销判断

| 情况 | 安全做法 |
|---|---|
| 加错文件，尚未 commit | `git restore --staged <file>` |
| 工作区改乱，尚未 add | `git restore <file>` |
| 提交信息/漏文件，尚未 push | `git commit --amend` |
| 已经 push，想撤回效果 | `git revert <sha>`，不要 `reset --hard` 后强推 |
| reset/rebase 后提交不见了 | 先 `git reflog` 找到位置，再谨慎恢复 |

`reflog` 是恢复线索，不是授权；恢复前确认目标提交、当前分支和未提交改动。

## 冲突

1. `git status` 找冲突文件；
2. 处理 `<<<<<<<` / `=======` / `>>>>>>>`；
3. 运行相关测试；
4. `git add` 标记解决，再提交。

不要用“全部接受一边”代替理解冲突；冲突解决后要沿受影响路径验证。

## 提交前

- `git status` 只包含本次要提交的改动；
- 提交信息符合项目 Conventional Commits 约定；
- 相关测试和 `git diff --check` 已跑；
- 推送前确认用户明确要求推送；提交、推送、强推分别判断授权。
- 不把格式化、重命名或无关清理混入功能提交。
