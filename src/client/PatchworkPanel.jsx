import { createElement, useState, useSyncExternalStore, useEffect } from 'react'
import { Button, SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import { usePatchworkState } from './use-patchwork-state.mjs'
import { validateSettings } from '../config/fields.mjs'
import { EmptyState, PanelIcon } from './panel-elements.jsx'
import { DiagnosticsPanel, EvidencePanel, ExecutionPanel, ManagementPanel, OverviewPanel, SettingsPanel, settingsKeys } from './WorkspacePanels.jsx'
import { logTime } from './log-presentation.mjs'

const tabs = [['overview', '总览'], ['execution', '执行'], ['evidence', '证据'], ['management', '管理'], ['diagnostics', '诊断'], ['settings', '设置']]
const connectionLabels = { loading: '连接中', connected: '已连接', offline: '连接中断', unavailable: '等待会话' }

export function PatchworkTitle() { return createElement('span', null, 'Patchwork') }

function tabBadge(tab, data) {
  if (!data) return 0
  if (tab === 'execution') return (data.task?.requirements ?? []).filter(item => item.required && !['passed', 'accepted'].includes(item.status)).length + (data.superagent?.jobs ?? []).filter(job => ['failed', 'blocked', 'waiting', 'review'].includes(job.status)).length
  if (tab === 'evidence') return (data.events ?? []).filter(event => event.outcome === 'failed').length + (data.retrieval?.entries ?? []).filter(entry => ['failed', 'partial'].includes(entry.status)).length
  if (tab === 'management') return (data.memory?.counts?.proposed ?? 0) + (data.improvements?.candidates ?? []).filter(candidate => !candidate.applied && !['revoked', 'rejected'].includes(candidate.decision)).length
  if (tab === 'diagnostics') return (data.diagnostics?.entries ?? []).filter(entry => entry.level === 'error').length
  return 0
}

export function PatchworkPanel({ sessionId, sessionStore, useTabInfo }) {
  const allowed = useSyncExternalStore(sessionStore.subscribe,
    () => sessionStore.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset === 'patchwork', () => false)
  const { tab } = useTabInfo()
  // DSH retains background Session trees. Use its public visibility contract
  // so a hidden occurrence cannot keep sensitive state or requests alive.
  if (!tab.visible) return null
  if (!allowed) return <div className="pw-panel"><div className="pw-locked"><EmptyState title="Patchwork 尚未启用" icon="lock"><p>在 Agent 选择器中选择 Patchwork，使用会话面板。</p><p>工具、技能与日志只对 Patchwork 会话开放。</p></EmptyState></div></div>
  return createElement(SessionPanel, { key: sessionId ?? 'none', sessionId })
}

function SessionPanel({ sessionId }) {
  const { snapshot: data, settings, connection, error, save, refresh, exportLogs, memoryAction, memoryQuery, improvementAction, superagentAction, evidenceAction, loadSettings, checkUpdate } = usePatchworkState(sessionId)
  const [tab, setTab] = useState('overview')
  const [views, setViews] = useState({ execution: 'task', evidence: 'tools', management: 'memory', diagnostics: 'capabilities' })
  const [draft, setDraft] = useState({})
  const [baseRevision, setBaseRevision] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [conflict, setConflict] = useState(null)
  // Settings are global to this DSH_HOME, so they remain inspectable without a
  // Patchwork session. Saving still requires the session-authorized channel.
  const panelData = data ?? (tab === 'settings' ? settings : null)
  useEffect(() => { if (!data && tab === 'settings') void loadSettings() }, [data, tab, loadSettings])
  const desired = panelData?.config ?? {}, loaded = panelData?.loadedConfig ?? {}
  const dirty = Object.keys(draft).length
  const pending = settingsKeys.filter(key => JSON.stringify(desired[key]) !== JSON.stringify(loaded[key])).length
  const ratio = draft.cacheWriteReadRatio ?? desired.cacheWriteReadRatio ?? 12.5
  const invalid = !validateSettings(draft).ok || ratio === '' || !Number.isFinite(Number(ratio)) || Number(ratio) < 0
  const prefix = 'pw-' + String(sessionId ?? 'none').replace(/[^a-zA-Z0-9-]/g, '')
  function navigate(next, view) {
    setTab(next)
    if (view && Object.hasOwn(views, next)) setViews(previous => ({ ...previous, [next]: view }))
  }
  function edit(key, value) {
    if (!dirty) setBaseRevision(panelData?.revision)
    setDraft(previous => { const next = { ...previous }; if (JSON.stringify(value) === JSON.stringify(desired[key])) delete next[key]; else next[key] = value; return next })
    setMessage('')
  }
  async function persist() {
    setSaving(true); setMessage('')
    try {
      await save(draft, baseRevision ?? panelData.revision)
      setDraft({}); setConflict(null); setBaseRevision(null)
      setMessage('已保存，重新加载后读取新配置。现有 Agent 以实际能力为准。')
    } catch (e) { setConflict(e.conflict); setMessage(e.conflict ? '配置已被其他页面修改，草稿已保留。' : e.message) }
    finally { setSaving(false) }
  }
  function discard() { setDraft({}); setConflict(null); setBaseRevision(null); setMessage(''); refresh(); if (!data) void loadSettings() }
  const setView = domain => value => setViews(previous => ({ ...previous, [domain]: value }))
  return <div className="pw-panel"><div className="pw-panel-inner">
    <header className="pw-header"><div className="pw-scope" title={sessionId}><strong>Patchwork</strong><span>当前会话</span></div><div className="pw-header-actions"><span className="pw-connection" title={data ? `更新于 ${logTime(data.generatedAt)}` : undefined}><span className="pw-dot" data-tone={connection === 'connected' ? 'success' : connection === 'offline' ? 'warn' : undefined}/>{connectionLabels[connection]}</span><Button size="sm" variant="ghost" aria-label="刷新" title="刷新会话状态" icon={<PanelIcon name="refresh"/>} onClick={refresh} disabled={saving}/></div></header>
    <nav className="pw-nav"><SegmentedTabs label="Patchwork 页面" value={tab} onChange={setTab} items={tabs.map(([value, label]) => {
      const count = tabBadge(value, data)
      return { value, label: createElement('span', { className: 'pw-tab-label' }, label, count > 0 ? createElement('span', { className: 'pw-tab-badge' }, count) : null), id: prefix + '-' + value, panelId: prefix + '-panel' }
    })}/></nav>
    <div className="pw-scroll">
      {connection === 'offline' && <div role="status" className="pw-note pw-warning"><PanelIcon name="activity"/><p>连接中断，当前显示上次快照。恢复前暂停保存与导出。{error}</p></div>}
      {connection === 'unavailable' && !(tab === 'settings' && settings) && <EmptyState title="等待会话状态">选中或建立 Patchwork 会话后，运行状态会显示在这里。</EmptyState>}
      {connection === 'loading' && !data && <div aria-busy="true"><EmptyState title="正在连接会话">正在读取 DSH 的真实运行状态。</EmptyState></div>}
      {!data && tab === 'settings' && settings && <div role="status" className="pw-note pw-warning"><PanelIcon name="activity"/><p>未连接 Patchwork 会话；设置为只读。保存需要切换到 Patchwork Agent 的会话。</p></div>}
      {panelData && <section className={'pw-page pw-page-' + tab} id={prefix + '-panel'} role="tabpanel" aria-labelledby={prefix + '-' + tab}>
        {tab === 'overview' && <OverviewPanel data={data} pending={pending} navigate={navigate}/>}
        {tab === 'execution' && <ExecutionPanel data={data} view={views.execution} setView={setView('execution')} prefix={prefix} superagentAction={superagentAction}/>}
        {tab === 'evidence' && <EvidencePanel data={data} view={views.evidence} setView={setView('evidence')} prefix={prefix} evidenceAction={evidenceAction}/>}
        {tab === 'management' && <ManagementPanel data={data} view={views.management} setView={setView('management')} prefix={prefix} memoryAction={memoryAction} memoryQuery={memoryQuery} improvementAction={improvementAction}/>}
        {tab === 'diagnostics' && <DiagnosticsPanel data={data} view={views.diagnostics} setView={setView('diagnostics')} prefix={prefix} exportLogs={exportLogs} connected={connection === 'connected'}/>}
        {tab === 'settings' && <SettingsPanel {...{data: panelData, draft, saving, invalid, ratio, conflict, dirty, message, pending, prefix, edit, persist, discard, checkUpdate}} connected={connection === 'connected'}/>}
      </section>}
    </div>
    <footer className="pw-footer"><span>仅限当前会话</span><span>{data ? `更新于 ${logTime(data.generatedAt)}` : connectionLabels[connection]}</span></footer>
  </div></div>
}
