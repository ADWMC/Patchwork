/**
 * Online Context Compact：把「子任务完成」当作压缩时机，但只在未来节省能偿还
 * 重写成本时才动手，压缩后自动继续任务。
 *
 * 职责边界：`plan.mjs` 判定语义边界，`economics.mjs` 判定值不值得，
 * `state.mjs` 持久化，`tools.mjs` 提供 `update_plan`，`lifecycle.mjs` 是唯一
 * 有副作用的一层（也是唯一接触宿主生命周期与压缩服务的地方）。
 */
export { registerOnlineContextCompact } from './lifecycle.mjs'
