import { MODEL_PRESETS, detectModelPreset } from './model-presets.mjs'
export { MODEL_PRESETS, detectModelPreset }

export const SETTING_FIELDS = [
  ['actionFusion', 'boolean', true, '接续执行', 'mechanism'], ['observationPack', 'boolean', false, '大输出归档', 'mechanism'], ['evidencePreservingReducer', 'boolean', false, '证据约简', 'mechanism'], ['onlineContextCompact', 'boolean', false, '上下文压缩', 'mechanism'], ['taskMap', 'boolean', false, '任务锚定地图', 'mechanism'], ['superagentStallMs', 'integer', 600000, '主控作业停滞升级阈值（毫秒，0 关闭）', 'mechanism', 0, 3600000],
  ['cacheWriteReadRatio', 'number', 12.5, '缓存写入 / 读取成本比', 'mechanism', 0],
  ['reducerProvider', 'string', '', '约简 Provider（留空使用宿主默认）', 'reducer'], ['reducerModel', 'string', '', '约简模型（留空使用宿主默认）', 'reducer'], ['reducerMaxTokens', 'integer', 2048, '约简输出 token 上限', 'reducer', 256, 8192],
  ['nativeSearch', 'boolean', true, '无密钥搜索', 'retrieval'], ['nativeSearchProviders', 'providers', ['bing-rss', 'brave-html', 'uapis-keyless', 'tavily-keyless', 'duckduckgo-html'], '搜索来源（逗号分隔）', 'retrieval'], ['nativeSearchMaxResults', 'integer', 8, '每次搜索结果上限', 'retrieval', 1, 12], ['nativeSearchTimeoutMs', 'integer', 15000, '搜索超时（毫秒）', 'retrieval', 1000, 30000],
  ['nativeFetch', 'boolean', true, '公开网页抓取', 'retrieval'], ['nativeFetchAllowedHosts', 'hosts', [], '允许主机（逗号分隔；空表示公开主机）', 'retrieval'], ['nativeFetchTimeoutMs', 'integer', 15000, '抓取超时（毫秒）', 'retrieval', 1000, 30000], ['nativeFetchMaxBytes', 'integer', 2000000, '抓取字节上限', 'retrieval', 1024, 2000000], ['nativeFetchMaxChars', 'integer', 6000, '摘录字符上限', 'retrieval', 256, 12000], ['nativeFetchRobots', 'boolean', true, '遵守 robots.txt', 'retrieval'],
  ['skillsEnabled', 'boolean', true, '启用技能', 'skills'], ['skillsMode', 'enum', 'core', '技能加载范围', 'skills', ['core', 'expanded']], ['evidenceGate', 'boolean', true, '证据门', 'skills'], ['taskPolicyMode', 'enum', 'structured', '任务策略', 'skills', ['structured', 'strict']], ['memoryEnabled', 'boolean', true, '显式记忆工具', 'memory'],
  ['codeEnabled', 'boolean', true, '本地代码地图/检索', 'code'], ['codeMaxFiles', 'integer', 4000, '索引文件上限', 'code', 100, 20000], ['codeTokenBudget', 'integer', 2000, '代码地图 token 预算', 'code', 400, 8000],
].map(([key, type, defaultValue, label, group, min, max]) => ({ key, type, defaultValue, label, group, ...(type === 'enum' ? { choices: min } : { min, max }) }))
export function validateSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'body-not-an-object' }
  const value = {}
  for (const [key, item] of Object.entries(raw)) {
    const field = SETTING_FIELDS.find(field => field.key === key)
    if (!field) return { ok: false, reason: `unknown-key:${key}` }
    let valid = false
    if (field.type === 'boolean') valid = typeof item === 'boolean'
    else if (['integer', 'number'].includes(field.type)) valid = typeof item === 'number' && Number.isFinite(item) && item >= field.min && (field.max === undefined || item <= field.max) && (field.type !== 'integer' || Number.isInteger(item))
    else if (field.type === 'enum') valid = field.choices.includes(item)
    else if (field.type === 'string') valid = typeof item === 'string' && item.length <= 160 && !/[\r\n\0]/.test(item)
    else if (field.type === 'providers') valid = Array.isArray(item) && item.length > 0 && item.length <= 5 && new Set(item).size === item.length && item.every(v => ['bing-rss', 'brave-html', 'duckduckgo-html', 'uapis-keyless', 'tavily-keyless'].includes(v))
    else if (field.type === 'hosts') valid = Array.isArray(item) && item.length <= 64 && item.every(v => typeof v === 'string' && v.length <= 253 && /^(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(v))
    if (!valid) return { ok: false, reason: field.type === 'boolean' ? `${key}-must-be-boolean` : field.type === 'number' ? `${key}-must-be-a-finite-non-negative-number` : `${key}-invalid-${field.type}` }
    value[key] = item
  }
  return { ok: true, value }
}

export const CONFIG_PRESETS = {
  craftsman: {
    label: '工匠严谨模式 (Craftsman Mode)',
    description: '严格执行品味契约、反证法假设核对、双轨回执验证与证据门禁。',
    settings: {
      actionFusion: true,
      observationPack: true,
      evidencePreservingReducer: true,
      onlineContextCompact: true,
      evidenceGate: true,
      taskPolicyMode: 'strict',
      nativeSearch: true,
      nativeFetch: true,
      codeEnabled: true,
    },
  },
  agile: {
    label: '敏捷工匠模式 (Agile Mode)',
    description: '极速代码迭代，轻量验证，自动静默管理上下文与搜索。',
    settings: {
      actionFusion: true,
      observationPack: false,
      evidencePreservingReducer: false,
      onlineContextCompact: false,
      evidenceGate: false,
      taskPolicyMode: 'structured',
      nativeSearch: true,
      nativeFetch: true,
      codeEnabled: true,
    },
  },
  explore: {
    label: '只读探索模式 (Explore Mode)',
    description: '只读代码拓扑索引与外部检索，严禁写入或变更。',
    settings: {
      actionFusion: true,
      codeEnabled: true,
      nativeSearch: true,
      nativeFetch: true,
      evidenceGate: true,
      taskPolicyMode: 'structured',
    },
  },
}
