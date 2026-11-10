import { useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SettingsFields } from './SettingsFields.jsx'
import { CONFIG_PRESETS, MODEL_PRESETS, SETTING_FIELDS, validateSettings } from '../config/fields.mjs'
import { SectionHeading, TechnicalDetails } from './panel-elements.jsx'
import { Facets, SearchField, SummaryStrip } from './workspace-elements.jsx'
const display = value => value === undefined ? '未知' : Array.isArray(value) ? value.join(', ') || '空列表' : typeof value === 'boolean' ? value ? '开启' : '关闭' : String(value) || '沿用宿主默认'
export function SettingsPanel({ data, draft, saving, invalid, conflict, dirty, message, connected, pending, edit, persist, discard, checkUpdate }) {
  const [query, setQuery] = useState(''), [group, setGroup] = useState('all'), [notice, setNotice] = useState('')
  const [update, setUpdate] = useState(null), [checking, setChecking] = useState(false), [updateError, setUpdateError] = useState('')
  const fileRef = useRef(null)
  const desired = data.config ?? {}, loaded = data.loadedConfig ?? {}
  async function runUpdateCheck() {
    setChecking(true); setUpdateError(''); setUpdate(null)
    try { setUpdate(await checkUpdate()) } catch (error) { setUpdateError(error instanceof Error ? error.message : String(error)) } finally { setChecking(false) }
  }
  function resetDefaults() {
    for (const field of SETTING_FIELDS) edit(field.key, field.defaultValue)
    setNotice('已把全部可配置项恢复为默认值；仍需保存后生效。')
  }
  function applyPreset(presetKey) {
    const preset = CONFIG_PRESETS[presetKey]
    if (!preset) return
    for (const [key, value] of Object.entries(preset.settings)) edit(key, value)
    setNotice(`已应用「${preset.label}」预设；核对后保存。`)
  }
  function applyModelPreset(presetKey) {
    const preset = MODEL_PRESETS[presetKey]
    if (!preset) return
    for (const [key, value] of Object.entries(preset.settings)) edit(key, value)
    edit('modelPreset', presetKey)
    setNotice(`已应用「${preset.label}」；已适配该模型思考逻辑与 Token 预算，核对后保存。`)
  }
  function exportConfig() {
    const blob = new Blob([JSON.stringify(desired, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = 'patchwork-config.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('已导出当前已保存配置；不包含密钥。')
  }
  async function importConfig(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const validated = validateSettings(parsed)
      if (!validated.ok) { setNotice(`导入失败：${validated.reason}`); return }
      for (const [key, value] of Object.entries(validated.value)) edit(key, value)
      setNotice(`已载入 ${Object.keys(validated.value).length} 项配置到草稿；核对后保存。`)
    } catch { setNotice('导入失败：文件不是有效 JSON。') }
  }
  return <>
    <div className="pw-page-heading pw-heading-actions"><div><h2>运行设置</h2><p>配置作用于当前 DSH_HOME 的 Patchwork；保存后重新加载生效。</p></div><div className="pw-actions"><Button size="sm" variant="ghost" disabled={saving} onClick={resetDefaults}>恢复默认</Button><Button size="sm" variant="ghost" disabled={saving} onClick={exportConfig}>导出</Button><Button size="sm" variant="ghost" disabled={saving} onClick={() => fileRef.current?.click()}>导入</Button><Button size="sm" variant="outline" disabled={checking} onClick={runUpdateCheck}>{checking ? '检查中…' : '检查更新'}</Button><input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="导入配置 JSON" onChange={importConfig}/></div></div>
    {notice && <p className="pw-live-note" role="status">{notice}</p>}
    {updateError && <p className="pw-error" role="alert">更新检查失败：{updateError}</p>}
    {update?.ok === false && !updateError && <p className="pw-error" role="alert">更新检查失败：{update.reason}</p>}
    {update?.ok && update.supported === false && <p className="pw-muted">当前发布来源不是 GitHub Release，未启用更新检查。</p>}
    {update?.ok && update.supported !== false && <p className="pw-live-note" role="status">{update.updateAvailable ? `发现新版本 ${update.latest}（当前 ${update.current}）` : `已是最新版本 ${update.current}`}{update.url ? <>，<a href={update.url} target="_blank" rel="noreferrer">查看 Release</a></> : null}</p>}
    <div className="pw-actions" style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}><span className="pw-muted" style={{ alignSelf: 'center', fontSize: '12px' }}>工作流预设：</span><Button size="sm" variant="outline" disabled={saving} onClick={() => applyPreset('craftsman')}>工匠模式</Button><Button size="sm" variant="outline" disabled={saving} onClick={() => applyPreset('agile')}>敏捷模式</Button><Button size="sm" variant="outline" disabled={saving} onClick={() => applyPreset('explore')}>探索模式</Button></div>
    <div className="pw-actions" style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}><span className="pw-muted" style={{ alignSelf: 'center', fontSize: '12px' }}>模型认知预设：</span><Button size="sm" variant="outline" disabled={saving} onClick={() => applyModelPreset('deepseek')}>DeepSeek (DSH 原生)</Button><Button size="sm" variant="outline" disabled={saving} onClick={() => applyModelPreset('stepfun')}>StepFun (阶跃星辰)</Button></div>
    <SummaryStrip label="配置状态" items={[{ label: '可配置项', value: SETTING_FIELDS.length }, { label: '当前版本', value: data.version ?? '未知' }, { label: '草稿变更', value: dirty }, { label: '等待重载', value: pending }]}/>
    <SearchField label="搜索设置" value={query} onChange={setQuery} placeholder="搜索用途、名称或配置键"/>
    <Facets label="设置分类" value={group} onChange={setGroup} items={[['all', '全部'], ['mechanism', '执行'], ['reducer', '约简'], ['retrieval', '检索'], ['code', '代码'], ['skills', '技能'], ['memory', '记忆']].map(([value, label]) => ({ value, label }))}/>
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
