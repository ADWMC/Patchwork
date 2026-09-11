import Schema from '@deepseek-ai/schemastery'

/**
 * Patchwork 的可配置行为。全部机制默认关闭：缺失配置即不注册任何机制，
 * 只保留提示词、命令与结构检查。
 *
 * reducer 的 provider/model 留空表示使用宿主的默认模型路由，避免把某个
 * 供应商的模型名硬编码进插件。
 */
export const Config = Schema.object({
  actionFusion: Schema.boolean().default(false),
  observationPack: Schema.boolean().default(false),
  evidencePreservingReducer: Schema.boolean().default(false),
  onlineContextCompact: Schema.boolean().default(false),
  reducerProvider: Schema.string(),
  reducerModel: Schema.string(),
  cacheWriteReadRatio: Schema.number().default(12.5),
})
