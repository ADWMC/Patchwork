import { Button, Disclosure, Input, Select } from './controls.jsx'
import { useEffect, useRef, useState } from 'react'

const MODES = { native: '原生环境', device: '设备参数模板', fingerprint: 'JS 指纹（实验）' }
const modeLabel = profile => profile?.fingerprintKind === 'native-engine' || profile?.backend === 'aliasmode' ? '原生内核指纹（实验）' : MODES[profile?.mode] ?? '原生环境'
const environmentFields = [
  ['内核', profile => profile?.backend ?? 'chromium'],
  ['语言 / 时区', profile => `${profile?.locale ?? '宿主默认'} / ${profile?.timezoneId ?? '宿主默认'}`],
  ['视口 / 像素比', profile => profile?.viewport ? `${profile.viewport.width} × ${profile.viewport.height} / ${profile.deviceScaleFactor ?? 1}` : '宿主默认'],
  ['登录存储', profile => profile?.persistStorage ? '本环境加密保存' : '临时存储'],
]

export function BrowserEnvironments({ state, busy, act, Form }) {
  const [editing, setEditing] = useState(null), [rotation, setRotation] = useState(null), [notice, setNotice] = useState('')
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [confirmation, setConfirmation] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const confirmationRef = useRef(null)
  useEffect(() => { confirmationRef.current?.scrollIntoView({ block: 'nearest' }) }, [confirmation])
  const current = state.profiles.find(profile => profile.id === state.profileId)
  const full = state.profiles.length >= 9
  const mismatch = profile => profile.mode === 'fingerprint' && state.engineVersion && (profile.backend ?? 'chromium') === (current?.backend ?? 'chromium') && profile.fingerprintBrowserMajor !== Number(state.engineVersion.split('.')[0])
  const unavailable = profile => profile.backend === 'aliasmode' && state.nativeBackend?.installed === false
  const visible = state.profiles.filter(profile => profile.id !== 'native' && (filter === 'all' || profile.mode === filter) && `${profile.name} ${profile.backend ?? 'chromium'} ${profile.locale ?? ''} ${profile.timezoneId ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const request = (action, profile) => { setConfirmation({ action, profile, revision: state.revision, currentId: state.profileId }); setEditing(null); setRotation(null); setNotice('') }
  async function confirm() {
    if (confirmation.revision !== state.revision || confirmation.currentId !== state.profileId) { setNotice('环境已变化，请取消后重新选择操作。'); return }
    const result = await act(confirmation.action, { profileId: confirmation.profile.id, revision: confirmation.revision })
    if (result) { setNotice(({ useProfile: '已切换环境。旧标签页已关闭，新页面使用此环境。', clearStorage: '此环境保存的登录状态已清除。', deleteProfile: '环境已删除。' })[confirmation.action]); setConfirmation(null) }
  }
  async function regenerate() {
    const result = await act('regenerateProfile', { profileId: rotation.id, revision: rotation.revision })
    if (result) { setRotation(null); setNotice('已生成新的独立环境。点击新环境的“使用”才会切换；当前页面保持原环境。') }
  }
  return <>
    <div className="pw-browser-environment">
      <label><span>当前环境</span><Select aria-label="浏览器环境" value={state.profileId} disabled={busy} onChange={id => { if (id !== state.profileId) request('useProfile', state.profiles.find(profile => profile.id === id)) }} options={state.profiles.map(profile => ({value:profile.id,label:profile.name,disabled:mismatch(profile)||unavailable(profile)}))}/></label>
    </div>
    <section className="pw-browser-profiles" aria-label="环境与指纹管理">
      <h3>环境与指纹</h3>
      <p>当前：{modeLabel(current)} · {state.engineVersion ? `内核 ${state.engineVersion}` : '内核尚未启动'}{current?.fingerprintId ? ` · ${current.mode === 'fingerprint' ? '指纹' : '设备参数'} ID ${current.fingerprintId}` : ' · 保留真实设备身份'}</p>
      <p role="status">AliasMode 可选内核：{state.nativeBackend?.installed ? `已安装 ${state.nativeBackend.version ?? ''}` : '未安装，需在此实例独立安装后使用'}。</p>
      <Disclosure title="环境切换与登录范围" open={helpOpen} onToggle={() => setHelpOpen(previous => !previous)}><p>切换环境会关闭当前标签页；原生指纹切换会重启本会话内核，未提交表单不保留。更换指纹先生成独立新环境，不复制旧登录；点击“使用”后才生效。设备参数模板只调整屏幕、像素比等设置，不等于更换 CPU、GPU 或 Canvas 指纹。</p></Disclosure>
      {state.nativeBackend?.installed === false && <p className="pw-muted">安装命令：<code>patchwork-browser-components install aliasmode --home &lt;隔离实例目录&gt;</code>（仅 Windows x64，不随主包下载）</p>}
      <div className="pw-browser-management-toolbar"><Input aria-label="搜索浏览器环境" type="search" value={query} placeholder="搜索环境、语言或内核" onChange={event => setQuery(event.target.value)}/><Select aria-label="环境类型筛选" value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部环境' }, { value: 'device', label: '设备参数' }, { value: 'fingerprint', label: '指纹环境' }]}/></div>
      <p className="pw-muted">显示 {visible.length} / {state.profiles.filter(profile => profile.id !== 'native').length} 个自定义环境。当前环境：{current?.name ?? '未知'}。</p>
      {visible.map(profile => <div className="pw-browser-profile-row" role="group" aria-label={`环境 ${profile.name}`} key={profile.id}>
        <span>{profile.name}<small>{modeLabel(profile)} · {profile.persistStorage ? '保存登录状态' : '临时存储'}</small>{profile.fingerprintId && <small>{profile.mode === 'fingerprint' ? '指纹' : '设备参数'} ID：{profile.fingerprintId}</small>}{profile.mode === 'fingerprint' && <small>{profile.backend === 'aliasmode' ? unavailable(profile) ? '无法启用：请先安装可选内核' : `${profile.engineRelease} · 启用时按身份重启` : mismatch(profile) ? `无法启用：样本 Chromium ${profile.fingerprintBrowserMajor ?? '未知'} 与当前内核不匹配` : `样本 Chromium ${profile.fingerprintBrowserMajor ?? '未知'} · 启用前核对内核`}</small>}</span>
        <Button type="button" disabled={busy || profile.id === state.profileId || mismatch(profile) || unavailable(profile)} onClick={() => request('useProfile', profile)}>{profile.id === state.profileId ? '使用中' : '使用'}</Button>
        {profile.mode !== 'native' && <Button type="button" disabled={busy || full} onClick={() => { setRotation({ ...profile, revision: state.revision }); setEditing(null); setConfirmation(null); setNotice('') }}>{profile.mode === 'fingerprint' ? '更换指纹' : '更换设备参数'}</Button>}
        <Button type="button" disabled={busy || profile.id === state.profileId} onClick={() => { setEditing({ ...profile, revision: state.revision }); setRotation(null); setConfirmation(null); setNotice('') }}>编辑</Button>
        <Button type="button" disabled={busy} onClick={() => request('clearStorage', profile)}>清除登录</Button>
        <Button type="button" disabled={busy || profile.id === state.profileId} onClick={() => request('deleteProfile', profile)}>删除</Button>
      </div>)}
      {!visible.length && <p role="status">{query || filter !== 'all' ? '没有匹配的环境。' : '还没有自定义环境。新增后可预览差异，再决定是否切换。'}</p>}
      {confirmation && <section ref={confirmationRef} className="pw-browser-identity-confirm" aria-label="浏览器环境操作确认">
        <strong>{({ useProfile: '切换到', clearStorage: '清除登录状态', deleteProfile: '删除环境' })[confirmation.action]}：{confirmation.profile.name}</strong>
        {confirmation.action === 'useProfile' ? <><div className="pw-browser-environment-diff"><strong>配置项</strong><strong>当前</strong><strong>目标</strong>{environmentFields.map(([label, value]) => <div key={label} className="pw-browser-diff-row"><span>{label}</span><span>{value(current)}</span><span>{value(confirmation.profile)}</span></div>)}</div><p>确认后关闭本会话当前 {state.tabs.length} 个标签；未提交表单不保留。原生内核指纹切换会重启内核；登录状态按目标环境独立处理。</p></> : <p>{confirmation.action === 'clearStorage' ? '清除此环境已保存的 Cookie、localStorage 等登录状态；若为当前环境，会关闭当前标签页。此操作不能撤销。' : '删除此环境及其保存的登录状态。此操作不能撤销，当前环境不允许删除。'}</p>}
        {(confirmation.revision !== state.revision || confirmation.currentId !== state.profileId) && <p role="alert">环境已变化，请取消后重新选择。</p>}
        <div className="pw-actions"><Button disabled={busy || confirmation.revision !== state.revision || confirmation.currentId !== state.profileId} onClick={confirm}>确认{confirmation.action === 'useProfile' ? '切换' : confirmation.action === 'clearStorage' ? '清除登录' : '删除环境'}</Button><Button disabled={busy} onClick={() => setConfirmation(null)}>取消操作</Button></div>
      </section>}
      {rotation && <div className="pw-browser-identity-confirm" role="group" aria-label="确认更换环境">
        <strong>{rotation.mode === 'fingerprint' ? '重新生成指纹' : '重新生成设备参数'}：{rotation.name}</strong>
        <p>创建新环境，保留原环境与当前页面。新环境不继承 Cookie、localStorage 或 IndexedDB，代理和语言等配置沿用。生成成功不代表已通过站点检测；原生身份在点击“使用”并重启内核后生效。</p>
        <div><Button type="button" disabled={busy || full} onClick={regenerate}>生成新环境</Button><Button type="button" disabled={busy} onClick={() => setRotation(null)}>取消更换</Button></div>
      </div>}
      {editing ? <Form key={editing.id ?? editing.mode ?? 'new'} initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={async profile => { const result = await act(editing.id ? 'updateProfile' : 'createProfile', { profileId: editing.id, profile, revision: editing.revision }); if (result) { setEditing(null); setNotice('环境已保存，点击“使用”后生效。') } }}/>
        : <div className="pw-actions"><Button type="button" disabled={busy || full} onClick={() => { setEditing({ mode: 'device', revision: state.revision }); setRotation(null); setConfirmation(null) }}>新增设备环境</Button><Button type="button" disabled={busy || full} onClick={() => { setEditing({ name: '原生指纹环境', mode: 'fingerprint', backend: 'aliasmode', revision: state.revision }); setRotation(null); setConfirmation(null) }}>新增原生指纹</Button><Button type="button" disabled={busy || full} onClick={() => { setEditing({ mode: 'fingerprint', revision: state.revision }); setRotation(null); setConfirmation(null) }}>新增 JS 指纹</Button></div>}
      {full && <p>已达 8 个自定义环境上限，先删除不再使用的环境。</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  </>
}
