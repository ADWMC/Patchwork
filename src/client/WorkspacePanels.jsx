import { useState } from 'react'
import { Button, Switch, SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import { EvidenceList } from './EvidenceList.jsx'
import { TaskEvidence } from './TaskEvidence.jsx'
import { RetrievalPanel } from './RetrievalPanel.jsx'
import { EmptyState, PanelIcon, SectionHeading, TechnicalDetails } from './panel-elements.jsx'

export const mechanisms = [
  { key: 'actionFusion', code: 'AF', name: '接续执行', description: '写入或编辑后直接运行校验命令。' },
  { key: 'observationPack', code: 'OP', name: '大输出归档', description: '保存完整原文，按需召回片段。' },
  { key: 'evidencePreservingReducer', code: 'EPR', name: '证据约简', description: '缩短诊断输出，保留可核对的引用。' },
  { key: 'onlineContextCompact', code: 'OCC', name: '上下文压缩', description: '在计划边界评估并整理上下文。' },
]
const onOff = value => value === true ? '开启' : value === false ? '关闭' : '未知'
const fmt = n => Number.isFinite(n) ? n.toLocaleString() : '未测量'
export const settingsKeys = [...mechanisms.map(({ key }) => key), 'cacheWriteReadRatio']

export function MechanismStatus({ item, data }) {
  const loaded = data.loadedConfig?.[item.key]
  const active = data.mechanisms?.[item.key]?.active
  const label = loaded === false ? '未加载' : loaded !== true ? '未知' : active === true ? '已注册' : active === false ? '未注册' : '已加载'
  return <span className="pw-status" data-tone={active === true ? 'success' : undefined}>{label}</span>
}

export function OverviewPanel({ data, pending, navigate }) {
  const events = data.events ?? []
  const improvements = data.improvements ?? { candidates: [], incidents: [] }
  return <>
    <TaskEvidence task={data.task} onEvidence={() => navigate('evidence', 'current')}/>
    {pending > 0 && <div className="pw-note"><p>{pending} 项已保存配置等待重新加载。</p><Button size="sm" variant="ghost" onClick={() => navigate('settings')}>查看设置</Button></div>}
    <section className="pw-section"><SectionHeading title="工具记录"><Button size="sm" variant="ghost" onClick={() => navigate('evidence', 'current')}>查看证据 <PanelIcon name="chevron"/></Button></SectionHeading>
      <EvidenceList items={events.slice(0, 3)}/>
    </section>
    {improvements.candidates.length > 0 && <section className="pw-section"><SectionHeading title="待审改进"><span className="pw-muted">尚未验证</span></SectionHeading>
      <button className="pw-knowledge-row" onClick={() => navigate('evidence', 'improvements')}><span><strong>{improvements.candidates[0].trigger}</strong><small>{improvements.candidates.length} 条改进候选 · 仅供审查</small></span><PanelIcon name="chevron"/></button>
    </section>}
    <TechnicalDetails title="机制与运行状态">
      {mechanisms.map(item => <div className="pw-row" key={item.key}><span className="pw-mechanism-code">{item.code}</span><div className="pw-copy"><strong>{item.name}</strong></div><MechanismStatus item={item} data={data}/></div>)}
      <p className="pw-muted">工具结果 {events.length} 条 · 失败 {events.filter(e => e.outcome === 'failed').length} 条</p><p className="pw-muted">上下文 {fmt(data.context?.tokens)} tokens · 窗口 {fmt(data.context?.window)}</p>
    </TechnicalDetails>
  </>
}

export function MechanismsPanel({ data }) {
  return <><div className="pw-page-heading"><h2>运行机制</h2><p>区分本次加载、能力注册与已保存配置。</p></div><div className="pw-card"><div className="pw-compare"><span>机制</span><span>已加载</span><span>已保存</span></div>{mechanisms.map(item => <div className="pw-compare-row" key={item.key}><div className="pw-copy"><strong>{item.name} <span className="pw-mechanism-code">{item.code}</span></strong><small>{item.description}</small><MechanismStatus item={item} data={data}/></div><span>{onOff(data.loadedConfig?.[item.key])}</span><span data-tone={data.loadedConfig?.[item.key] !== data.config?.[item.key] ? 'warn' : undefined}>{onOff(data.config?.[item.key])}</span></div>)}</div><p className="pw-live-note">“已加载”表示配置已载入，不代表已经执行或产生收益。实际决策请查看日志。</p></>
}

export function EvidencePanel({ data, view, setView, prefix, memoryAction, improvementAction }) {
  const [query, setQuery] = useState('')
  const [improvementBusy, setImprovementBusy] = useState(null)
  const [improvementMessage, setImprovementMessage] = useState('')
  const events = data.events ?? []
  const candidates = data.task?.candidates ?? []
  const improvements = data.improvements ?? { incidents: [], candidates: [], experiments: [] }
  async function decide(action, candidate) {
    setImprovementBusy(candidate.id); setImprovementMessage('')
    try { await improvementAction(action, candidate.id, data.improvements?.revision); setImprovementMessage(action === 'rollback' ? '已记录回滚，运行规则未被自动改写。' : '已记录用户决定，运行规则仍需经过代码接入。') }
    catch (error) { setImprovementMessage(error.message === 'improvement-unavailable' ? '改进管理通道不可用。' : '操作失败，可能是版本已变化，请刷新后重试。') }
    finally { setImprovementBusy(null) }
  }
  return <><nav className="pw-secondary-nav"><SegmentedTabs label="证据类别" value={view} onChange={setView} items={[
    ['current', '本次'], ['retrieval', '检索'], ['memory', '记忆'], ['improvements', '改进'],
  ].map(([value, label]) => ({ value, label, id: prefix + '-evidence-' + value, panelId: prefix + '-evidence-panel' }))}/></nav>
    <div role="tabpanel" id={prefix + '-evidence-panel'} aria-labelledby={prefix + '-evidence-' + view}>
      {view === 'current' && <><TaskEvidence task={data.task} expanded/><section className="pw-section"><SectionHeading title="工具证据" description="命令、文件变更与实际执行结果。"/><div className="pw-search"><PanelIcon name="search"/><input type="search" aria-label="搜索工具证据" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索命令、路径或工具"/></div><EvidenceList items={events.filter(e => [e.command, e.path, e.tool].join(' ').toLowerCase().includes(query.toLowerCase()))}/><p className="pw-live-note">最多预览本次运行的 100 条记录。更早结果请查看 DSH 会话历史。</p></section></>}
      {view === 'retrieval' && <RetrievalPanel data={data}/>}
      {view === 'memory' && <MemoryPanel data={data} onCurrent={() => setView('current')} memoryAction={memoryAction}/>}
      {view === 'improvements' && <><div className="pw-page-heading"><h2>待审改进</h2><p>失败与纠正先形成可追溯候选，再经过隔离实验和用户决定；候选不会自动改变运行规则。</p></div>{improvements.candidates.length ? improvements.candidates.map(candidate => { const experiment = improvements.experiments.find(item => item.candidateId === candidate.id); return <article className="pw-candidate" key={candidate.id}><span className="pw-eyebrow">候选 · {candidate.decision}</span><h3>{candidate.trigger}</h3><p>{candidate.hypothesis}</p><TechnicalDetails title="候选来源"><dl className="pw-facts"><div><dt>改进对象</dt><dd>{candidate.object}</dd></div><div><dt>影响范围</dt><dd>{candidate.activationScope}</dd></div><div><dt>实验状态</dt><dd>{experiment?.eligibleForReview ? '可供审查' : '未通过准入'}</dd></div><div><dt>候选 ID</dt><dd>{candidate.id}</dd></div></dl></TechnicalDetails>{experiment?.eligibleForReview && candidate.decision === 'proposed' && <div className="pw-actions"><Button size="sm" variant="outline" disabled={improvementBusy === candidate.id} onClick={() => decide('trial', candidate)}>试用记录</Button><Button size="sm" variant="primary" disabled={improvementBusy === candidate.id} onClick={() => decide('approve', candidate)}>批准记录</Button></div>}{['trial', 'enabled'].includes(candidate.decision) && <Button size="sm" variant="ghost" disabled={improvementBusy === candidate.id} onClick={() => decide('rollback', candidate)}>回滚记录</Button>}</article> }) : <EmptyState title="还没有候选经验" icon="file"><p>失败回执会先形成 Incident；需要真实来源才能提出候选。</p></EmptyState>}{improvements.incidents.length > 0 && <p className="pw-live-note">已记录 {improvements.incidents.length} 个问题；当前改进自动激活：关闭。</p>}{improvementMessage && <p className="pw-live-note" role="status">{improvementMessage}</p>}<p className="pw-live-note">批准、试用和回滚只记录用户决定，不会把模型文本直接升级为规则、权限或记忆。</p></>}
    </div>
  </>
}

function MemoryPanel({ data, onCurrent, memoryAction }) {
  const memory = data.memory
  const entries = memory?.entries ?? []
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  async function act(action, entry) {
    setBusy(entry.id); setMessage('')
    try { await memoryAction(action, entry.id, memory.revision); setMessage(action === 'confirm' ? '已确认记忆，正在刷新状态。' : '已忘记该记录，正在刷新状态。') }
    catch (error) { setMessage(error.message === 'memory-unavailable' ? '记忆管理通道不可用。' : '操作失败，可能是版本已变化，请刷新后重试。') }
    finally { setBusy(null) }
  }
  return <>
    <div className="pw-page-heading"><h2>记忆</h2><p>只在 Patchwork Agent 范围内按需读取；不会自动注入普通请求。</p></div>
    <div className="pw-note"><strong>自动注入：已关闭</strong><p>候选必须先经过明确确认才能成为 active；项目共享也需要显式确认。当前页面只显示这个会话有权看到的记录。</p></div>
    {entries.length ? entries.map(entry => <article className="pw-knowledge-row" key={entry.id}><div className="pw-copy"><strong>{entry.key}</strong><small>{entry.visibility} · {entry.status} · {entry.validity}</small><p>{entry.value}</p></div><div className="pw-actions">{entry.status === 'proposed' && <Button size="sm" variant="outline" disabled={busy === entry.id} onClick={() => act('confirm', entry)}>确认</Button>}{entry.status === 'active' && <Button size="sm" variant="ghost" disabled={busy === entry.id} onClick={() => act('forget', entry)}>忘记</Button>}</div></article>) : <EmptyState title="还没有记忆记录" icon="lock"><p>当前没有已保存或待确认的记录。</p><p>本次任务依据仍可在“本次”查看。</p><Button size="sm" variant="outline" onClick={onCurrent}>查看本次证据</Button></EmptyState>}
    {message && <p className="pw-live-note" role="status">{message}</p>}
    <TechnicalDetails title="记忆状态"><dl className="pw-facts"><div><dt>存储</dt><dd>{memory?.persistence === 'file' ? 'Patchwork 本地文件' : '未连接'}</dd></div><div><dt>版本</dt><dd>{memory?.revision ?? 0}</dd></div><div><dt>命名空间 epoch</dt><dd>{memory?.namespaceEpoch ?? 0}</dd></div><div><dt>可见记录</dt><dd>{entries.length}</dd></div></dl><p>删除会递增命名空间 epoch，并阻止旧的异步写入复活。记忆不授予工具、目录、付费或发布权限。</p></TechnicalDetails>
  </>
}

export function SettingsPanel({ data, draft, saving, invalid, ratio, conflict, dirty, message, connected, pending, prefix, edit, persist, discard }) {
  const desired = data.config ?? {}, loaded = data.loadedConfig ?? {}
  return <><div className="pw-page-heading"><h2>运行设置</h2><p>保存后重新加载，应用新的运行配置。</p></div><section className="pw-card"><SectionHeading title="执行与上下文"/>{mechanisms.map(item => <div className="pw-row" key={item.key}><div className="pw-copy"><strong>{item.name} <span className="pw-mechanism-code">{item.code}</span></strong><small>{item.description}{desired[item.key] !== loaded[item.key] ? ' · 等待重载' : ''}</small></div><Switch label={item.name} checked={draft[item.key] ?? desired[item.key] ?? false} onChange={value => edit(item.key, value)} disabled={saving}/></div>)}
    <div className="pw-row"><div className="pw-copy"><label htmlFor={prefix + '-ratio'}>缓存写入 / 读取成本比</label><small>用于成本估计，无单位。</small></div><input id={prefix + '-ratio'} className="pw-input pw-ratio" type="number" min="0" step="0.1" value={ratio} disabled={saving} onChange={e => edit('cacheWriteReadRatio', e.target.value === '' ? '' : Number(e.target.value))} aria-invalid={invalid}/></div>
    </section>
    {invalid && <p className="pw-error" role="alert">请检查数值：成本比为非负有限数，资源设置为所示范围内的整数。</p>}
    {conflict && <div className="pw-note pw-warning" role="alert"><div><p>其他页面已更新配置，草稿已保留。载入最新值会清除本地草稿，请先保留需要的修改。</p><Button size="sm" variant="outline" onClick={discard}>载入最新配置</Button></div></div>}
    <div className="pw-save"><span className="pw-muted" role="status">{dirty ? `${dirty} 项未保存` : pending ? `${pending} 项等待重载` : '无未保存更改'}</span><div className="pw-actions"><Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={discard}>撤销更改</Button><Button size="sm" variant="primary" disabled={!dirty || invalid || saving || !connected || Boolean(conflict)} onClick={persist}>{saving ? '保存中…' : '保存更改'}</Button></div></div>
    <p className="pw-live-note" role="status" aria-live="polite">{message || '保存后重新加载插件或重启实例，读取新配置。'}</p>
    <TechnicalDetails title="配置范围"><p>配置覆盖作用于当前 DSH_HOME 下的 Patchwork，不是 profile 或会话独立配置。未使用 Patchwork 的 Agent 不受这些机制设置影响。</p><p>此处只显示当前会话能力；主题和字体由 DSH 外观设置统一控制。</p></TechnicalDetails>
  </>
}
