import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { Input, Select } from './controls.jsx'
import { SETTING_FIELDS } from '../config/fields.mjs'
import { EmptyState, SectionHeading } from './panel-elements.jsx'
import { textMatches } from './workspace-model.mjs'
export const settingHelp = {
  actionFusion: '把文件编辑与必要校验接成一次受控操作。', observationPack: '保存完整原文，按需召回少量片段。', evidencePreservingReducer: '默认关闭；敏感输出拒绝外发。约简模型设置不改变主会话模型。', onlineContextCompact: '在计划边界评估上下文压缩，是否执行以实际日志为准。', taskMap: '把任务声明的引用与登记产物周围的符号与调用方注入会话；有界、可再注入，默认关闭。', superagentStallMs: '主控队列里作业超阈值无进展时升级：一级转评审、二级转阻塞；0 关闭扫描。', cacheWriteReadRatio: '用于成本估计，无单位；不改变服务商的实际计费。',
  reducerProvider: '仅 EPR 使用；留空沿用宿主，不在此保存服务密钥。', reducerModel: '为约简指定模型；不会更改主会话模型。', reducerMaxTokens: '限制约简输出长度，不是主模型上下文窗口。',
  nativeSearch: '启用无需服务密钥的公开页面搜索，可用性受上游页面影响。', nativeSearchProviders: '按配置顺序查询；可选 bing-rss、brave-html、duckduckgo-html、uapis-keyless、tavily-keyless。', nativeSearchMaxResults: '每次工具调用返回的结果数量上限。', nativeSearchTimeoutMs: '搜索总预算，超过预算返回实际失败状态。',
  nativeFetch: '启用公开网页读取，保留公网地址和响应大小检查。', nativeFetchAllowedHosts: '可限定主机；空列表仍只允许经检查的公网主机。', nativeFetchTimeoutMs: '单次抓取总时间预算。', nativeFetchMaxBytes: '限制下载体积，避免大响应占满内存。', nativeFetchMaxChars: '限制返回给当前任务的摘录长度。', nativeFetchRobots: '启用时核对目标站点 robots.txt。',
  skillsEnabled: '为 Patchwork 注册技能目录，正文仍由模型按需读取。', skillsMode: '核心为 7 项；扩展模式加入调试、审查、检索、文档、记忆和改进。', evidenceGate: '交付前核对证据与要求，不能替代人工质量判断。', taskPolicyMode: 'structured / strict 控制已知结构化写入，不是操作系统沙箱。', memoryEnabled: '启用显式记忆工具；不会开启自动注入或跨会话共享。',
  codeEnabled: '启用只读本地代码地图、符号与文本检索；不读取依赖、构建产物或密钥文件。', codeMaxFiles: '单次索引的文件上限；超过时返回截断地图，不阻塞任务。', codeTokenBudget: '代码地图的默认 token 预算；结果仍受硬上限约束。',
}
const groups = [['mechanism', '执行与上下文'], ['reducer', '约简模型'], ['retrieval', '信息检索'], ['code', '代码检索'], ['skills', '技能与任务'], ['memory', '记忆']]
const enumLabels = { core: '核心目录', expanded: '扩展目录', structured: '结构化写入', strict: '严格结构化写入' }
export function SettingsFields({ data, draft, saving, edit, query = '', group: selectedGroup = 'all' }) {
  const visible = SETTING_FIELDS.filter(field => (selectedGroup === 'all' || selectedGroup === field.group) && textMatches(query, field.label, field.key, settingHelp[field.key]))
  return <><div className="pw-settings-grid">{groups.map(([group, title]) => {
    const fields = visible.filter(field => field.group === group)
    return fields.length ? <section className="pw-card" key={group}><SectionHeading title={title}/>{fields.map(field => {
      const value = draft[field.key] ?? data.config?.[field.key] ?? field.defaultValue
      return <div className="pw-row pw-setting-row" data-changed={Object.hasOwn(draft, field.key)} key={field.key}><div className="pw-copy"><strong>{field.label}</strong><small>{settingHelp[field.key]}</small>{field.min !== undefined && <small>范围 {field.min}—{field.max ?? '不限'}</small>}{JSON.stringify(data.config?.[field.key]) !== JSON.stringify(data.loadedConfig?.[field.key]) && <small className="pw-warning">已保存值等待重载</small>}</div>{field.type === 'boolean' ? <Switch label={field.label} checked={value} onChange={next => edit(field.key, next)} disabled={saving}/> : field.type === 'enum' ? <Select aria-label={field.label} value={value} options={field.choices.map(value => ({ value, label: enumLabels[value] ?? value }))} onChange={value => edit(field.key, value)} disabled={saving}/> : <Input className="pw-input" aria-label={field.label} type={['integer', 'number'].includes(field.type) ? 'number' : 'text'} min={field.min} max={field.max} step={field.type === 'integer' ? 1 : undefined} value={Array.isArray(value) ? value.join(', ') : value} disabled={saving} onChange={event => { const value = event.target.value; edit(field.key, ['integer', 'number'].includes(field.type) ? value === '' ? '' : Number(value) : ['providers', 'hosts'].includes(field.type) ? value.split(',').map(item => item.trim()).filter(Boolean) : value) }}/>}</div>
    })}</section> : null
  })}</div>{!visible.length && <EmptyState title="没有匹配的设置">调整分类或搜索条件；隐藏字段的草稿仍会保留。</EmptyState>}</>
}
