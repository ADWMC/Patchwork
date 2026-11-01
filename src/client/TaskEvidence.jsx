import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { EmptyState, PanelIcon, SectionHeading, TechnicalDetails } from './panel-elements.jsx'
import { Facets, SummaryStrip } from './workspace-elements.jsx'
import { Select } from './controls.jsx'

const labels = { 'in-progress': '进行中', ready: '登记验收通过', partial: '部分验收', blocked: '已阻塞', cancelled: '已取消', superseded: '已替代',
  pending: '待检查', passed: '通过', accepted: '用户已接纳', failed: '失败', unknown: '未知', stale: '已过期', skipped: '已跳过',
  analysis: '分析', plan: '方案', implement: '实施', verify: '验证', unassessed: '尚未评估', stated: '模型已陈述', 'needs-clarification': '待澄清' }
const phases = ['analysis', 'plan', 'implement', 'verify']
const tone = status => ['ready', 'passed'].includes(status) ? 'success' : ['failed', 'blocked', 'stale'].includes(status) ? 'warn' : undefined

export function TaskEvidence({ task, expanded = false, onEvidence, reviewAction }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all'), [kind, setKind] = useState('all')
  if (!task?.title) return <EmptyState title="尚未登记当前任务" icon="file"><p>Agent 登记任务后，这里会显示阶段与验收依据。</p><p>工具执行成功不会自动标记任务完成。</p></EmptyState>
  const requirements = task.requirements ?? []
  const pending = requirements.filter(r => r.required && !['passed', 'accepted'].includes(r.status)).length
  const visible = expanded ? requirements.filter(item => (kind === 'all' || item.kind === kind) && (filter === 'all' || filter === 'pending' && !['passed', 'accepted'].includes(item.status) || filter === 'passed' && ['passed', 'accepted'].includes(item.status) || filter === 'stale' && item.status === 'stale')) : requirements
  async function review(id, accept) {
    setBusy(true)
    try { await reviewAction({ action: 'task-review', id, accept, baseRevision: task.revision }); setMessage(accept ? '已接纳当前产物版本；后续变更会使接纳失效。' : '已撤回接纳，等待复核。') }
    catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  async function copy(path) {
    try { await navigator.clipboard.writeText(path); setMessage('已复制完整路径') }
    catch { setMessage('复制失败，可选择完整路径手动复制') }
  }
  return <div className="pw-task">
    <div className="pw-card pw-task-core">
    <div className="pw-task-summary">
    <div className="pw-task-heading"><p className="pw-eyebrow">当前任务</p><h2>{task.title}</h2><p className="pw-task-state" data-tone={tone(task.status)}><span className="pw-dot" data-tone={tone(task.status)}/>{labels[task.status] ?? '未知状态'}</p></div>
    <ol className="pw-stage-line" aria-label="登记任务阶段">{phases.map(phase => <li key={phase} aria-current={task.phase === phase ? 'step' : undefined}>{labels[phase]}</li>)}</ol>
    <p className="pw-muted">{pending ? `仍有 ${pending} 项必需验收未通过。` : requirements.some(r => r.required) ? '已登记的必需验收均通过。' : '尚未定义必需验收。'}阶段由 Agent 陈述。</p>
    </div>
    <section className="pw-section"><SectionHeading title="验收依据">{onEvidence && <Button size="sm" variant="ghost" onClick={onEvidence}>查看全部 <PanelIcon name="chevron"/></Button>}</SectionHeading>
      {expanded && <><SummaryStrip label="任务验收统计" items={[{ label: '验收项', value: requirements.length }, { label: '必需待验', value: pending }, { label: '产物', value: (task.artifacts ?? []).filter(item => item.status !== 'superseded').length }]}/><Facets label="验收状态筛选" value={filter} onChange={setFilter} items={[{ value: 'all', label: '全部' }, { value: 'pending', label: '待处理' }, { value: 'passed', label: '已通过' }, { value: 'stale', label: '已过期' }]}/><Select aria-label="验收类型筛选" value={kind} onChange={setKind} options={[{ value: 'all', label: '全部类型' }, { value: 'command', label: '实际工具执行' }, { value: 'artifact', label: '产物结构' }, { value: 'semantic', label: '语义评审' }]}/></>}
      {visible.length ? visible.map(r => <div className="pw-check-row" key={r.id}>
        <PanelIcon name={r.status === 'passed' ? 'check' : 'circle'} className={r.status === 'passed' ? 'pw-success' : 'pw-muted'}/>
        <div className="pw-copy"><strong>{r.label}{r.required ? '' : '（可选）'}</strong>
          {expanded && <><small>{r.kind === 'semantic' ? '语义评审，模型判断不自动放行' : r.kind === 'artifact' ? '仅结构检查' : '实际工具执行'} · 覆盖 {r.coverage.filter(unit => r.evidence.some(e => e.unit === unit && e.outcome === 'passed')).length}/{r.coverage.length}</small><small>{r.coverage.map(unit => `${unit}: ${labels[r.evidence.find(e => e.unit === unit)?.outcome] ?? '未覆盖'}`).join(' · ')}</small>{r.evidence.map(e => <code className="pw-task-path pw-muted" key={e.id}>{e.tool} · {e.callId}{e.tool === 'artifact-check' ? ' · 文件结构回执' : ` · exit ${e.exitCode ?? '未知'}`}</code>)}</>}
        </div><span className="pw-status" data-tone={tone(r.status)}>{labels[r.status] ?? '未知'}</span>{expanded && reviewAction && r.kind === 'semantic' && <Button size="sm" variant="outline" disabled={busy} onClick={() => review(r.id, r.status !== 'accepted')}>{r.status === 'accepted' ? '撤回接纳' : '接纳当前版本'}</Button>}
      </div>) : <p className="pw-muted">{requirements.length ? '没有匹配的验收项。' : '未定义必需验收，不能聚合为通过。'}</p>}
      {!expanded && pending > 0 && onEvidence && <Button className="pw-task-cta" size="sm" variant="primary" onClick={onEvidence}>查看待验项目 <PanelIcon name="chevron"/></Button>}
    </section>
    </div>
    {expanded && <>
      {(task.artifacts ?? []).some(a => a.status !== 'superseded') && <section className="pw-section"><SectionHeading title="任务产物"/>{task.artifacts.filter(a => a.status !== 'superseded').map(a => <div className="pw-row" key={a.id}><div className="pw-copy"><strong>{a.id}{a.status === 'changed' ? ' · 已变更，待重验' : ''}</strong><code className="pw-task-path">{a.path}</code><small>版本 {a.version.slice(0, 8)}{a.supersedes ? ` · 替代 ${a.supersedes}` : ''}</small></div><Button size="sm" variant="ghost" onClick={() => copy(a.path)} aria-label={`复制 ${a.id} 完整路径`}>复制路径</Button></div>)}<p className="pw-live-note" role="status">{message}</p></section>}
      <TechnicalDetails title="任务范围与来源">
        <dl className="pw-facts"><div><dt>任务版本</dt><dd>{task.revision}</dd></div><div><dt>理解状态</dt><dd>{labels[task.understandingStatus] ?? '未知'}</dd></div><div><dt>工作区</dt><dd>{task.workspace ?? '未确认'}</dd></div><div><dt>参考对象</dt><dd>{task.references?.length ? task.references.map(path => <code key={path} className="pw-task-path">{path}</code>) : '未登记'}</dd></div><div><dt>独立实例</dt><dd>{task.instance ? `${task.instance.id} · ${task.instance.endpoint}（声明，未证明执行绑定）` : '未登记独立实例'}</dd></div><div><dt>记录</dt><dd>{task.persistence === 'native' ? '宿主原生记录' : task.persistence === 'failed' ? '失败，任务已阻塞' : '当前内存，原生记录不可用'}</dd></div><div><dt>来源</dt><dd>{task.source?.kind === 'observed-user-kind' ? '已观察 user 类型，不证明人类授权' : task.source?.kind ?? '未知'}</dd></div></dl>
        {task.lastCorrection && <p>最近纠正 r{task.lastCorrection.revision} · {task.lastCorrection.affected.join('、') || '无关联验收'}</p>}
        <p>策略检查覆盖已知结构化写入；普通 shell 不是强隔离。阶段不等于人类授权；状态只反映已登记检查，未覆盖需求与主观质量须另行说明。</p>
      </TechnicalDetails>
    </>}
  </div>
}
