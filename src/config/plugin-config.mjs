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
  reducerMaxTokens: Schema.number().min(256).max(8192).step(1),
  cacheWriteReadRatio: Schema.number().default(12.5),
  skillsEnabled: Schema.boolean().default(true),
  skillsMode: Schema.union(['core', 'expanded']).default('core'),
  evidenceGate: Schema.boolean().default(true),
  taskPolicyMode: Schema.union(['structured', 'strict']).default('structured'),
  nativeSearch: Schema.boolean().default(true),
  nativeSearchProviders: Schema.array(Schema.union(['bing-html', 'brave-html', 'duckduckgo-html'])).default(['bing-html', 'brave-html', 'duckduckgo-html']),
  nativeSearchMaxResults: Schema.number().min(1).max(12).step(1).default(8),
  nativeSearchTimeoutMs: Schema.number().min(1000).max(30000).step(1).default(15000),
  nativeFetch: Schema.boolean().default(true),
  nativeFetchAllowedHosts: Schema.array(Schema.string()).default([]),
  nativeFetchTimeoutMs: Schema.number().min(1000).max(30000).step(1).default(15000),
  nativeFetchMaxBytes: Schema.number().min(1024).max(2000000).step(1).default(2000000),
  nativeFetchMaxChars: Schema.number().min(256).max(12000).step(1).default(6000),
  nativeFetchRobots: Schema.boolean().default(true),
  memoryEnabled: Schema.boolean().default(true),
})
