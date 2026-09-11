import { registerActionFusion } from './action-fusion/index.mjs'

/** 机制的中文名与配置键一一对应，命名与 configure 键保持同一个概念一个名字。 */
const MECHANISM_LABELS = {
  actionFusion: 'Action Fusion',
  observationPack: 'ObservationPack',
  evidencePreservingReducer: 'Evidence-Preserving Reducer',
  onlineContextCompact: 'Online Context Compact',
}

/** 已实现的机制在这里登记。未登记即视为不可用。 */
const MECHANISM_REGISTRARS = new Map([
  ['actionFusion', registerActionFusion],
])

/**
 * 按配置注册机制。默认全部关闭。
 *
 * 一个开关被打开而对应机制不可用时必须显式失败：静默跳过会让配置与实际行为
 * 不一致，比直接报错更难排查。
 */
export function registerConfiguredMechanisms(ctx, config = {}) {
  for (const [key, label] of Object.entries(MECHANISM_LABELS)) {
    if (!config[key]) continue
    const register = MECHANISM_REGISTRARS.get(key)
    if (!register) throw new Error(`Patchwork config ${key} is enabled but ${label} is not available`)
    register(ctx, config)
  }
}
