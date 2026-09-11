/** 计划：模型自己写的子任务列表，是压缩时机的语义依据。 */
export const MAX_STEPS = 64
export const MAX_STEP_CHARS = 400
export const STEP_STATUSES = ['pending', 'in_progress', 'completed']

/**
 * 窗口压力保护：上下文逼近窗口时，经济性不再是唯一判据。
 * 与 SoL-Pi 取的同一档预留量。
 */
export const WINDOW_RESERVE_TOKENS = 16_384

/** 压缩后必须留在上下文里的近期 token 量：压缩不该把刚做过的事也抹掉。 */
export const KEEP_RECENT_TOKENS = 20_000

/** 首次压缩视界放宽的倍数：还没有边界间隔样本时只能保守外推。 */
export const FIRST_COMPACTION_HORIZON_FACTOR = 2

/** 后续压缩要求更长的视界，避免为一次压缩反复付写入成本。 */
export const HORIZON_MARGIN = 1.5

/** 少于这么多边界间隔样本时，视界估计减半。 */
export const MIN_INTERVAL_SAMPLES = 3

/** 状态与工具条目的稳定标识。 */
export const PLAN_TOOL_NAME = 'update_plan'
export const STATE_ENTRY_KIND = 'patchwork-online-context-compact'
