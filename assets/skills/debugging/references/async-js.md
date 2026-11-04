# JS 异步排查清单

来源参考：[冰可乐的前端笔记 · JavaScript 异步](https://note.bingkele.cc/content/docs/43)。这里只提炼排查顺序，不复制原文。

## 先定位调度

- 同一时刻只执行一段 JS（调用栈内）。
- 当前宏任务结束后，先清空微任务队列，再进入下一轮宏任务。
- `Promise.then` / `await` 后续是微任务；`setTimeout` 回调是宏任务。
- 输出顺序不符合预期时，先画“同步 → 微任务 → 宏任务”顺序，不要先怀疑框架。

## Promise 是状态机

- `pending` / `fulfilled` / `rejected`；`then` 返回新 Promise，`throw` 或 rejected 会进入后续 `catch`。
- 排查“为什么没进 catch”：确认是否漏了 `return`、是否在 `then` 里吞掉异常、是否没有 `await`。

## 并发策略

| 需求 | 选择 |
|---|---|
| 全部成功才继续 | `Promise.all` |
| 允许部分成功 | `Promise.allSettled` |
| 超时/先到先得 | `Promise.race` + 超时 Promise |
| 批量任务限流 | 并发池，不要一次发几百个请求 |

并发池的关键：维护执行集合，达到上限时等待任意一个完成，再继续调度；不要用 `forEach(async ...)` 误以为会等待。

## 取消与失败

- `fetch` 用 `AbortController`；取消应抛 `AbortError`，不要当成普通失败。
- 长链路要明确：超时、取消、重试、并发上限分别由谁负责。
- 在边界层统一兜底（API 封装、路由 loader、组件加载函数），并给用户加载/失败/重试反馈。

## 常见坑

- `forEach` 里 `await` 不会等待；顺序执行用 `for...of`，并发用 `Promise.all`。
- 忘记 `return` 导致链式 Promise 提前结束。
- 只处理成功分支，失败静默。
- 把超时当成业务失败，或把取消当成成功。

## 验证

- 用固定输入和可控计时器复现，不靠一次运行猜顺序。
- 分别测试成功、失败、取消、超时、部分成功。
- 只报告实际运行结果；未覆盖的异步路径明确标未知。
