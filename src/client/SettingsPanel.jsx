import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SettingsFields } from './SettingsFields.jsx'
import { SETTING_FIELDS } from '../config/fields.mjs'
import { SectionHeading, TechnicalDetails } from './panel-elements.jsx'
import { Facets, SearchField, SummaryStrip } from './workspace-elements.jsx'
const display = value => value === undefined ? '未知' : Array.isArray(value) ? value.join(', ') || '空列表' : typeof value === 'boolean' ? value ? '开启' : '关闭' : String(value) || '沿用宿主默认'
export function SettingsPanel({ data, draft, saving, invalid, conflict, dirty, message, connected, pending, edit, persist, discard }) {
  const [query, setQuery] = useState(''), [group, setGroup] = useState('all')
  const desired = data.config ?? {}, loaded = data.loadedConfig ?? {}
  return <>
    <div className="pw-page-heading"><h2>运行设置</h2><p>配置作用于当前 DSH_HOME 的 Patchwork；保存后重新加载生效。</p></div>
    <SummaryStrip label="配置状态" items={[{ label: '可配置项', value: SETTING_FIELDS.length }, { label: '草稿变更', value: dirty }, { label: '等待重载', value: pending }]}/>
    <SearchField label="搜索设置" value={query} onChange={setQuery} placeholder="搜索用途、名称或配置键"/>
    <Facets label="设置分类" value={group} onChange={setGroup} items={[['all', '全部'], ['mechanism', '执行'], ['reducer', '约简'], ['retrieval', '检索'], ['skills', '技能'], ['memory', '记忆']].map(([value, label]) => ({ value, label }))}/>
    <SettingsFields data={data} draft={draft} saving={saving} edit={edit} query={query} group={group}/>
    {dirty > 0 && <section className="pw-section" aria-label="待保存配置差异"><SectionHeading title="保存前核对" description="草稿不会立即改变当前运行机制。"/>{Object.keys(draft).map(key => <div className="pw-setting-diff" key={key}><strong>{SETTING_FIELDS.find(field => field.key === key)?.label ?? key}</strong><span>已保存：{display(desired[key])}</span><span>草稿：{display(draft[key])}</span></div>)}</section>}
    {pending > 0 && <TechnicalDetails title="已保存与实际加载差异">{SETTING_FIELDS.filter(field => JSON.stringify(desired[field.key]) !== JSON.stringify(loaded[field.key])).map(field => <div className="pw-setting-diff" key={field.key}><strong>{field.label}</strong><span>实际加载：{display(loaded[field.key])}</span><span>已保存：{display(desired[field.key])}</span></div>)}</TechnicalDetails>}
    {invalid && <p className="pw-error" role="alert">请检查数值与配置格式，合法范围见对应字段。</p>}
    {conflict && <div className="pw-note pw-warning" role="alert"><div><p>其他页面已更新配置，草稿已保留。载入最新值会清除本地草稿，请先保留需要的修改。</p><Button size="sm" variant="outline" onClick={discard}>载入最新配置</Button></div></div>}
    <div className="pw-save"><span className="pw-muted" role="status">{dirty ? `${dirty} 项未保存` : pending ? `${pending} 项等待重载` : '无未保存更改'}</span><div className="pw-actions"><Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={discard}>撤销更改</Button><Button size="sm" variant="primary" disabled={!dirty || invalid || saving || !connected || Boolean(conflict)} onClick={persist}>{saving ? '保存中…' : '保存更改'}</Button></div></div>
    <p className="pw-live-note" role="status" aria-live="polite">{message || '保存后重新加载插件或重启实例，读取新配置。'}</p>
    <TechnicalDetails title="配置范围"><p>配置覆盖作用于当前 DSH_HOME 下的 Patchwork，不是 profile 或会话独立配置。未使用 Patchwork 的 Agent 不受这些机制设置影响。</p><p>主题和字体由 DSH 外观设置统一控制。独立浏览器环境与资源设置在可选浏览器包内管理。</p></TechnicalDetails>
  </>
}
