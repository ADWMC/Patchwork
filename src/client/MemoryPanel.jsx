import { useEffect, useRef, useState } from 'react'
import { Button, InlineEditor } from '@deepseek-ai/dsh-client-ui-primitives'
import { Input, Select } from './controls.jsx'
import { EmptyState, PanelIcon, TechnicalDetails } from './panel-elements.jsx'
import { Facets, SummaryStrip } from './workspace-elements.jsx'

const scopeLabels = { 'session-private': '本会话私有', 'project-shared': '当前项目共享', all: '本会话与当前项目' }
const statusLabels = { all: '全部状态', proposed: '待确认', active: '已确认', superseded: '历史版本', revoked: '已遗忘' }
const validityLabels = { all: '全部有效性', fresh: '已核实', stale: '暂停召回', conflicted: '存在冲突', expired: '已过期', unsupported: '尚未验证' }
const recallLabel = record => record.status === 'active' ? record.validity === 'fresh' ? '可按需召回' : validityLabels[record.validity] : '不参与召回'
const sourceLabels = { 'model-proposed': 'Agent 提议', 'user-authored': '用户新增', 'user-revised': '用户修订' }
const actionLabels = { proposed: '创建提案', 'revised-proposal': '提交修订', confirmed: '用户确认', superseded: '被新版本替代', forgotten: '遗忘', 'validity-changed': '更新召回状态' }
const errorLabels = {
  MEMORY_REVISION_CONFLICT: '记录已被其他页面或进程修改。草稿已保留，请刷新并核对最新版本，再重新打开编辑。',
  MEMORY_BASE_CHANGED: '修订所依据的版本已变化或被遗忘，请重新核对后创建提案。',
  MEMORY_SENSITIVE_VALUE: '内容可能包含密钥、密码或认证信息，已拒绝保存。',
  MEMORY_NAMESPACE_QUOTA: '此范围的保存版本已达到 200 条。请先遗忘不再需要的提案或历史版本。',
  MEMORY_INVALID_RECORD: '请填写标题与内容，并检查字段长度。',
  MEMORY_SCOPE_REVOKED: '当前会话授权已变化，操作已取消。',
  MEMORY_NOT_FOUND: '记录已变化或不属于当前可访问范围，请刷新。',
  MEMORY_DATABASE_INVALID: '记忆文件损坏，已停止写入；请保留原文件，停用写入后核对备份恢复。',
  MEMORY_READ_DENIED: '记忆文件读取被拒绝，请检查文件权限；不会创建空库覆盖原文件。',
}
const options = labels => Object.entries(labels).map(([value, label]) => ({ value, label }))
const time = value => value ? new Date(value).toLocaleString() : '尚无记录'
const messageFor = error => errorLabels[error.message] ?? '记忆管理暂不可用，请刷新后重试。'

export function MemoryPanel({ data, memoryAction, memoryQuery, onCurrent }) {
  const [query, setQuery] = useState(''), [scope, setScope] = useState('session-private')
  const [status, setStatus] = useState('all'), [validity, setValidity] = useState('all')
  const [offset, setOffset] = useState(0), [selectedId, selectDetail] = useState(null)
  const [selected, setSelected] = useState([]), [snapshot, setSnapshot] = useState(null)
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [readError, setReadError] = useState(''), [editor, setEditor] = useState(null), [confirmation, setConfirmation] = useState(null)
  const detailRef = useRef(null)

  useEffect(() => {
    const cancellation = new AbortController(); let timer
    setLoading(true); setReadError('')
    async function read() {
      try {
        const next = await memoryQuery({ query, scope, status, validity, offset: String(offset), limit: '20', ...(selectedId ? { id: selectedId } : {}) }, cancellation.signal)
        if (!cancellation.signal.aborted) {
          if (offset > 0 && offset >= next.entryCount) { setOffset(Math.max(0, Math.floor((next.entryCount - 1) / 20) * 20)); return }
          setSnapshot(next); setReadError(''); setLoading(false)
          setSelected(previous => previous.filter(id => next.entries.some(entry => entry.id === id && entry.status !== 'revoked')))
        }
      } catch (error) {
        if (!cancellation.signal.aborted) { setReadError(messageFor(error)); setLoading(false) }
      } finally { if (!cancellation.signal.aborted) timer = setTimeout(read, 5000) }
    }
    timer = setTimeout(read, query ? 180 : 0)
    return () => { cancellation.abort(); clearTimeout(timer) }
  }, [memoryQuery, query, scope, status, validity, offset, selectedId, refresh, data.memory?.revision])

  function filter(update) { update(); setOffset(0); setSelected([]); selectDetail(null); setSnapshot(null); setConfirmation(null) }
  const entries = snapshot?.entries ?? [], record = snapshot?.record
  useEffect(() => { if (record?.id) detailRef.current?.scrollIntoView({ block: 'start' }) }, [record?.id])
  const disabled = busy || loading || Boolean(readError)
  async function act(action, id, fields = {}, revision = snapshot?.revision) {
    setBusy(true); setMessage('')
    try {
      await memoryAction(action, id, revision, fields)
      setConfirmation(null); setEditor(null); setSelected([]); setRefresh(value => value + 1)
      setMessage(action === 'propose' || action === 'revise' ? '已保存为待确认提案，尚未改变召回内容。' : action.startsWith('forget') ? '已停止召回，保留历史和撤销记录；这不是磁盘内容擦除。' : action === 'validity' ? '召回状态已更新。' : '已确认当前版本。')
      return true
    } catch (error) { setMessage(messageFor(error)); return false }
    finally { setBusy(false) }
  }
  function request(action, entry, fields = {}) {
    if (action === 'confirm' && entry.visibility === 'session-private' && !entry.activationImpact?.length) return void act(action, entry.id)
    setConfirmation({ action, id: entry.id, fields, revision: snapshot.revision, names: [entry.key], shared: entry.visibility === 'project-shared', replacements: entry.activationImpact })
  }
  function openEditor(entry, copy = false) {
    setConfirmation(null); setMessage('')
    setEditor({ id: copy ? null : entry?.id, revision: snapshot.revision, key: entry?.key ?? '', value: entry?.value ?? '', conditions: entry?.conditions ?? '', kind: entry?.kind ?? 'fact', visibility: copy || !entry ? 'session-private' : entry.visibility })
  }
  function exportSelected() {
    const records = entries.filter(entry => selected.includes(entry.id))
    const blob = new Blob([JSON.stringify({ schema: 'patchwork-memory-export-v1', exportedAt: new Date().toISOString(), scope, records }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = 'patchwork-memory-' + Date.now() + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage(`已导出所选 ${records.length} 条记录到本地文件，未发送给模型。`)
  }
  const validDraft = editor && editor.key.trim() && editor.key.length <= 256 && editor.value.trim() && editor.value.length <= 4000 && editor.conditions.length <= 512 && editor.kind.trim() && editor.kind.length <= 64
  const saveDraft = () => { if (validDraft && !disabled) void act(editor.id ? 'revise' : 'propose', editor.id, { record: { key: editor.key, value: editor.value, kind: editor.kind, conditions: editor.conditions, visibility: editor.visibility } }, editor.revision) }

  return <>
    <div className="pw-page-heading pw-heading-actions"><div><h2>记忆管理</h2><p>管理保存内容、适用条件与召回状态。</p></div><Button size="sm" variant="outline" disabled={disabled} onClick={() => openEditor()}>新增记忆</Button></div>
    <p className="pw-live-note">自动注入已关闭。只在 Agent 显式召回时读取，单次最多 5 条；此管理页不会作为模型上下文发送。</p>
    {snapshot && <SummaryStrip label="所选范围记忆统计" items={[{ label: '待确认', value: snapshot.counts.proposed }, { label: '已确认', value: snapshot.counts.active }, { label: '历史', value: snapshot.counts.superseded }, { label: '已遗忘', value: snapshot.counts.revoked }]}/>}
    <section className="pw-card pw-memory-controls" aria-label="记忆筛选">
      <div className="pw-search"><PanelIcon name="search"/><Input type="search" aria-label="搜索记忆" placeholder="搜索标题、内容或适用条件" maxLength={256} value={query} onChange={event => filter(() => setQuery(event.target.value))}/></div>
      <div className="pw-toolbar"><Select aria-label="记忆范围" value={scope} options={options(scopeLabels)} onChange={value => filter(() => setScope(value))}/><Select aria-label="记忆状态筛选" value={status} options={options(statusLabels)} onChange={value => filter(() => setStatus(value))}/><Select aria-label="记忆有效性筛选" value={validity} options={options(validityLabels)} onChange={value => filter(() => setValidity(value))}/><Button size="sm" variant="ghost" disabled={busy} onClick={() => setRefresh(value => value + 1)}>刷新记录</Button></div>
      <Facets label="记忆快捷状态" value={status} onChange={value => filter(() => setStatus(value))} items={['all', 'proposed', 'active', 'superseded', 'revoked'].map(value => ({ value, label: statusLabels[value] }))}/>
      {snapshot?.quotas.map(quota => <p className="pw-muted" key={quota.visibility}>{scopeLabels[quota.visibility]}：{quota.used} / {quota.limit} 个保存版本（含待确认与历史）</p>)}
      {scope !== 'session-private' && <p className="pw-live-note">项目共享按工作目录隔离。其他 Patchwork 会话须显式包含项目记忆才能召回；此处的确认、暂停或遗忘会影响该共享记录。</p>}
    </section>
    {(readError || data.memory?.failureCode) && <p role="alert" className="pw-error">{readError || errorLabels[data.memory.failureCode] || data.memory.failureCode}</p>}
    {message && <p className="pw-live-note" role="status">{message}</p>}
    {editor && <section className="pw-card pw-memory-editor" aria-label={editor.id ? '修订记忆' : '新建记忆'}>
      <h3>{editor.id ? '修订为新版本' : '新建记忆提案'}</h3><p className="pw-live-note">保存不会立即生效。修订确认前，原版本继续按当前状态召回。</p>
      <label>记忆标题<Input aria-label="记忆标题" maxLength={256} value={editor.key} onChange={event => setEditor({ ...editor, key: event.target.value })}/></label>
      <div><span className="pw-field-label">记忆内容</span><InlineEditor label="记忆内容" className="pw-memory-textarea" value={editor.value} onChange={value => setEditor({ ...editor, value })} onSave={saveDraft} onCancel={() => setEditor(null)}/><p className="pw-muted">{editor.value.length} / 4000 字符 · Shift+Enter 换行</p></div>
      <label>适用条件<Input aria-label="记忆适用条件" maxLength={512} placeholder="例如：仅修改当前仓库的前端时" value={editor.conditions} onChange={event => setEditor({ ...editor, conditions: event.target.value })}/></label>
      <label>类型<Input aria-label="记忆类型" maxLength={64} value={editor.kind} onChange={event => setEditor({ ...editor, kind: event.target.value })}/></label>
      <div className="pw-actions"><span className="pw-muted">保存范围</span><Select aria-label="新记忆保存范围" disabled={Boolean(editor.id) || busy} value={editor.visibility} options={options({ 'session-private': scopeLabels['session-private'], 'project-shared': scopeLabels['project-shared'] })} onChange={visibility => setEditor({ ...editor, visibility })}/></div>
      {editor.visibility === 'project-shared' && <p className="pw-warning">确认后可被同项目的其他已授权 Patchwork 会话显式召回。不会自动注入任何会话。</p>}
      {editor.id && <p className="pw-muted">修订保留原作用域；需要共享或转为私有时，请从详情创建独立提案。</p>}
      <div className="pw-actions"><Button size="sm" variant="primary" disabled={disabled || !validDraft} onClick={saveDraft}>保存提案</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditor(null)}>取消编辑</Button></div>
    </section>}
    {confirmation && <section className="pw-card pw-memory-confirm" aria-label="确认记忆操作">
      <h3>{confirmation.action === 'confirm' ? confirmation.shared ? '确认共享记忆' : '确认记忆版本' : confirmation.action === 'validity' ? '确认召回状态变更' : `确认遗忘 ${confirmation.names.length} 条记忆`}</h3>
      <ul>{confirmation.names.map((name, index) => <li key={index}>{name}</li>)}</ul>
      {confirmation.replacements?.length > 0 && <p>确认后将替换：{confirmation.replacements.map(item => `${item.key}（内容 v${item.contentVersion}）`).join('、')}。原内容保留为历史，不再召回。</p>}
      <p>{confirmation.action.startsWith('forget') ? '将停止召回并撤销旧引用，保留内容历史和撤销记录；不会擦除磁盘或备份。' : confirmation.action === 'validity' ? confirmation.fields.validity === 'fresh' ? '恢复为可按需召回；请先核对内容仍然适用。' : '停止召回但保留内容，可稍后重新核实恢复。' : '此操作使当前提案成为已确认版本。'}{confirmation.shared ? ' 其中包含项目共享记录，会影响同项目显式读取该记录的会话。' : ' 仅影响本会话私有记录。'}</p>
      <div className="pw-actions"><Button size="sm" variant="primary" disabled={disabled} onClick={() => act(confirmation.action, confirmation.id, confirmation.fields, confirmation.revision)}>确认操作</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmation(null)}>取消操作</Button></div>
    </section>}
    <div className="pw-memory-bulk"><span className="pw-muted">已选 {selected.length} 条</span><div className="pw-actions"><Button size="sm" variant="ghost" disabled={disabled || !entries.length} onClick={() => setSelected(selected.length ? [] : entries.filter(entry => entry.status !== 'revoked').map(entry => entry.id))}>{selected.length ? '取消选择' : '选择本页'}</Button><Button size="sm" variant="outline" disabled={disabled || !selected.length} onClick={exportSelected}>导出所选</Button><Button size="sm" variant="ghost" disabled={disabled || !selected.length} onClick={() => { const items = entries.filter(entry => selected.includes(entry.id)); setConfirmation({ action: 'forget-many', fields: { ids: items.map(entry => entry.id) }, revision: snapshot.revision, names: items.map(entry => entry.key), shared: items.some(entry => entry.visibility === 'project-shared') }) }}>遗忘所选</Button></div></div>
    <div className="pw-memory-list" aria-busy={loading}>
      {entries.map(entry => <article className="pw-card pw-memory-item" key={entry.id}>
        <div className="pw-heading-actions"><div><h3>{entry.key}</h3><p className="pw-muted">{scopeLabels[entry.visibility]} · {statusLabels[entry.status]} · {recallLabel(entry)} · 内容 v{entry.contentVersion ?? 1}</p></div><Button size="sm" variant="ghost" aria-label={`选择记忆：${entry.key}`} aria-pressed={selected.includes(entry.id)} disabled={disabled || entry.status === 'revoked'} onClick={() => setSelected(previous => previous.includes(entry.id) ? previous.filter(id => id !== entry.id) : [...previous, entry.id])}>{selected.includes(entry.id) ? '已选' : '选择'}</Button></div>
        <p className="pw-memory-preview">{entry.value?.slice(0, 160)}{entry.value?.length > 160 ? '…' : ''}</p>
        <div className="pw-actions"><Button size="sm" variant="outline" disabled={busy} onClick={() => { selectDetail(entry.id); setConfirmation(null) }}>查看详情</Button>{entry.status === 'proposed' && <Button size="sm" variant="outline" disabled={disabled} onClick={() => request('confirm', entry)}>确认</Button>}{entry.status === 'active' && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => request('validity', entry, { validity: entry.validity === 'fresh' ? 'stale' : 'fresh' })}>{entry.validity === 'fresh' ? '暂停召回' : '恢复召回'}</Button>}{entry.status !== 'revoked' && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => request('forget', entry)}>{entry.status === 'proposed' ? '丢弃' : '忘记'}</Button>}</div>
      </article>)}
      {!entries.length && !loading && !readError && <EmptyState title={query || status !== 'all' || validity !== 'all' ? '没有匹配的记忆' : '当前范围还没有记忆'} icon="lock"><p>可手动新增提案，或让当前 Patchwork Agent 提议记忆。</p><Button size="sm" variant="outline" onClick={onCurrent}>查看本次证据</Button></EmptyState>}
    </div>
    {snapshot && <div className="pw-memory-pagination"><Button size="sm" variant="ghost" disabled={disabled || offset === 0} onClick={() => { setOffset(Math.max(0, offset - 20)); setSelected([]); selectDetail(null) }}>上一页</Button><span className="pw-muted">{snapshot.entryCount ? `${offset + 1}–${Math.min(offset + entries.length, snapshot.entryCount)}` : '0'} / {snapshot.entryCount}</span><Button size="sm" variant="ghost" disabled={disabled || !snapshot.hasMore} onClick={() => { setOffset(offset + 20); setSelected([]); selectDetail(null) }}>下一页</Button></div>}
    {record && <section ref={detailRef} className="pw-card pw-memory-detail" aria-label="记忆详情"><div className="pw-heading-actions"><h3>记忆详情</h3><Button size="sm" variant="ghost" onClick={() => selectDetail(null)}>收起详情</Button></div><h3>{record.key}</h3><p className="pw-memory-body">{record.value}</p>
      <dl className="pw-facts"><div><dt>适用条件</dt><dd>{record.conditions || '未限定；召回后仍需核对当前任务'}</dd></div><div><dt>类型 / 范围</dt><dd>{record.kind} · {scopeLabels[record.visibility]}</dd></div><div><dt>状态 / 有效性</dt><dd>{statusLabels[record.status]} · {validityLabels[record.validity]}</dd></div><div><dt>召回资格</dt><dd>{recallLabel(record)}</dd></div><div><dt>观察 / 确认</dt><dd>{time(record.observedAt)}<br/>{time(record.verifiedAt)}</dd></div><div><dt>记录 ID / 版本</dt><dd>{record.id}<br/>内容 v{record.contentVersion ?? 1} · 记录 r{record.revision}</dd></div></dl>
      <div className="pw-actions">{['active', 'proposed'].includes(record.status) && <Button size="sm" variant="outline" disabled={disabled} onClick={() => openEditor(record)}>修订记忆</Button>}<Button size="sm" variant="outline" disabled={disabled} onClick={() => openEditor(record, true)}>以此内容新建提案</Button>{record.status === 'active' && <Select aria-label="设置记忆有效性" value={record.validity} options={options({ fresh: validityLabels.fresh, stale: validityLabels.stale, conflicted: validityLabels.conflicted, expired: validityLabels.expired })} disabled={disabled} onChange={value => request('validity', record, { validity: value })}/>}</div>
      <TechnicalDetails title="来源与操作记录"><ul>{record.sources?.map((source, index) => <li key={index}>{sourceLabels[source.kind] ?? source.kind} · 会话 {source.sessionId}</li>)}</ul>{record.changes?.map((item, index) => <p key={index}>{actionLabels[item.action] ?? item.action} · r{item.revision} · {time(item.at)}{item.validity ? ` · ${validityLabels[item.validity]}` : ''}</p>)}<p className="pw-muted">最多保留最近 20 次状态操作；正文修订另存为版本，不原地覆盖。</p></TechnicalDetails>
      <TechnicalDetails title="内容版本历史">{snapshot.history?.map(item => <div className="pw-memory-history-row" key={item.id}><span>内容 v{item.contentVersion ?? 1} · r{item.revision} · {item.key} · {statusLabels[item.status]}</span><Button size="sm" variant="ghost" disabled={busy || item.id === record.id} onClick={() => selectDetail(item.id)}>查看此版本</Button></div>)}{snapshot.historyHasMore && <p>仅显示最近 50 个关联版本，更早版本可通过搜索和翻页查找。</p>}</TechnicalDetails>
    </section>}
    <TechnicalDetails title="存储与恢复"><p>数据库版本 {snapshot?.revision ?? '未知'} · 撤销 epoch {snapshot?.namespaceEpoch ?? '未知'}。损坏时停止写入并保留原文件；停用所有写进程后，核对 memory.json.bak 再离线恢复。</p><p>遗忘是逻辑撤销，历史内容保留用于审查。记忆不会授予工具、目录、付费或发布权限。</p></TechnicalDetails>
  </>
}
