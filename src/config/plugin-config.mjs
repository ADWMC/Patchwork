import Schema from '@deepseek-ai/schemastery'

/**
 * Patchwork 的可配置行为。actionFusion 默认开启：缺省配置即启用它——它不改变
 * 模型可见内容，是最安全的机制；其余机制默认关闭，缺失配置不注册。
 *
 * 无 systemPrompt 开关：系统提示注入已从架构移除，技能走 DSH ctx.skills。
 * reducer 的 provider/model 留空表示使用宿主的默认模型路由。
 */
export const Config = Schema.object({
  actionFusion: Schema.boolean().default(true),
  observationPack: Schema.boolean().default(false),
  evidencePreservingReducer: Schema.boolean().default(false),
  onlineContextCompact: Schema.boolean().default(false),
  reducerProvider: Schema.string(),
  reducerModel: Schema.string(),
  cacheWriteReadRatio: Schema.number().default(12.5),
  skillsEnabled: Schema.boolean().default(true),
  evidenceGate: Schema.boolean().default(true),
})
