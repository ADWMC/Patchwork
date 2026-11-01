import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { EmptyState, TechnicalDetails, SectionHeading } from './panel-elements.jsx'
import { Facets, RecordStatus, SearchField, SummaryStrip } from './workspace-elements.jsx'
import { improvementBucket, textMatches } from './workspace-model.mjs'
const decisionLabels = { proposed: '待验证', trial: '试用中', enabled: '已确认', revoked: '已回滚' }
const latencyText = value => Number.isFinite(value) && value >= 0 ? Math.round(value) : '未知'

export function ImprovementPanel({ data, improvementAction }) {
  const [busy, setBusy] = useState(null), [message, setMessage] = useState('')
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all')
  const state = data.improvements ?? { candidates: [], incidents: [], experiments: [] }
  const fullReview = state.policy?.reviewDetail === 'full'
  const visible = state.candidates.filter(candidate => (filter === 'all' || improvementBucket(candidate) === filter) && textMatches(query, candidate.trigger, candidate.hypothesis, candidate.patch?.setting, candidate.id))
  async function act(action, id) {
    setBusy(id); setMessage('')
    try {
      await improvementAction(action, id, state.revision)
      setMessage(action === 'experiment' ? '隔离契约实验结束，查看证据与准入结果。' : action === 'rollback' ? '当前会话策略已回滚。' : action === 'propose' ? '已生成待审候选；尚未改变运行行为。' : '策略已应用于当前会话，其他会话保持原状态。')
    } catch (error) { setMessage(`未完成：${error.message}。刷新核对版本后重试。`) }
    finally { setBusy(null) }
  }
  return <>
    <div className="pw-page-heading"><h2>改进审查</h2><p>实际失败或纠正 → 候选 → 隔离实验 → 你确认 → 当前会话应用；随时回滚。</p></div>
    <SummaryStrip label="改进统计" items={[{ label: '实际问题', value: state.incidents.length }, { label: '待审候选', value: state.candidates.filter(item => improvementBucket(item) === 'pending').length }, { label: '当前生效', value: state.candidates.filter(item => item.applied).length }, { label: '已回滚', value: state.candidates.filter(item => item.decision === 'revoked').length }]}/>
    <SearchField label="搜索改进候选" value={query} onChange={setQuery} placeholder="搜索问题、假设或策略设置"/>
    <Facets label="改进状态筛选" value={filter} onChange={setFilter} items={[{ value: 'all', label: '全部' }, { value: 'pending', label: '待审' }, { value: 'applied', label: '生效中' }, { value: 'revoked', label: '已回滚' }]}/>
    <p className="pw-live-note">{fullReview ? '请核对来源、版本、实验差异、退化与副作用，再决定是否应用；可随时回滚。' : '核对证据后确认，必要时回滚。'}</p>
    {visible.length ? visible.map(candidate => {
      const experiment = [...state.experiments].reverse().find(item => item.candidateId === candidate.id)
      return <article className="pw-candidate" key={candidate.id}><div className="pw-heading-actions"><h3>{candidate.trigger}</h3><RecordStatus tone={candidate.applied ? 'success' : undefined}>{candidate.applied ? '当前生效' : decisionLabels[candidate.decision] ?? candidate.decision}</RecordStatus></div><p className="pw-body-copy">{candidate.hypothesis}</p>
        {candidate.patch && <div className="pw-policy-diff" aria-label="受限策略改动"><span>{candidate.patch.setting}</span><div><span>当前 <code>{JSON.stringify(state.policy?.[candidate.patch.setting]) ?? '未知'}</code></span><span>候选 <code>{JSON.stringify(candidate.patch.value)}</code></span></div></div>}
        {experiment && <SummaryStrip label="隔离契约对比" items={[{ label: '基线正确性', value: experiment.baseline?.correctness }, { label: '候选正确性', value: experiment.candidate?.correctness }, { label: '准入', value: experiment.eligibleForReview ? '可审核' : '未通过' }]}/>}
        <dl className="pw-facts"><div><dt>改动</dt><dd>{candidate.patch ? `${candidate.patch.setting} = ${JSON.stringify(candidate.patch.value)}` : '尚未提供可执行的受限策略'}</dd></div><div><dt>范围</dt><dd>当前会话；切换 Agent 或重启后须重新确认</dd></div><div><dt>回滚目标</dt><dd>撤销此候选，恢复此前会话策略</dd></div></dl>
        <TechnicalDetails key={fullReview ? 'full' : 'compact'} open={fullReview} title="来源与实验详情"><p>{candidate.changeScope}</p><p>来源：{candidate.sourceReceiptIds.join('、')}</p><p>候选 {candidate.id}</p>
          {candidate.incidentIds.map(id => { const item = state.incidents.find(item => item.id === id); return item ? <p key={id}>{item.kind} · {item.trigger} · {item.action}</p> : <p key={id}>来源不可用：{id}</p> })}
          {experiment ? <><p>{experiment.claim}</p><dl className="pw-facts"><div><dt>基线 / 候选</dt><dd>{experiment.baseline?.correctness} / {experiment.candidate?.correctness}</dd></div><div><dt>运行时间</dt><dd>{latencyText(experiment.baseline?.latency)} / {latencyText(experiment.candidate?.latency)} ms（非模型延迟）</dd></div><div><dt>调优 / 留出</dt><dd>{experiment.sets.tuning.join('、')} / {experiment.sets.heldOut.join('、')}</dd></div><div><dt>退化</dt><dd>{experiment.regressions.join('、') || '契约检查未发现'}</dd></div><div><dt>副作用</dt><dd>{experiment.sideEffects.join('、') || '未提供评估'}</dd></div><div><dt>准入</dt><dd>{experiment.eligibleForReview ? '可供用户审查' : experiment.eligibilityReasons.join('、') || '未通过'}</dd></div><div><dt>证据</dt><dd className="pw-task-path">{experiment.evidenceRef}<br/>{experiment.evidenceHash}</dd></div></dl></> : <p>尚未执行隔离实验。</p>}
        </TechnicalDetails>
        <div className="pw-actions">{!candidate.applied && candidate.patch && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act('experiment', candidate.id)}>运行隔离实验</Button>}{experiment?.eligibleForReview && !candidate.applied && candidate.decision !== 'revoked' && <><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act('trial', candidate.id)}>确认试用</Button><Button size="sm" variant="primary" disabled={busy !== null} onClick={() => act('approve', candidate.id)}>确认应用</Button></>}{candidate.applied && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act('rollback', candidate.id)}>回滚此改动</Button>}</div>
      </article>
    }) : <EmptyState title={state.candidates.length ? '没有匹配的改进候选' : '还没有改进候选'} icon="file">{state.candidates.length ? '调整搜索与状态筛选。' : '从下方真实问题生成候选，或由 Agent 提出受限策略。'}</EmptyState>}
    <section className="pw-section"><SectionHeading title="实际问题" description="仅含本会话有真实来源的失败和纠正。"/>{state.incidents.filter(item => textMatches(query, item.trigger, item.kind, item.action)).map(item => <article className="pw-candidate" key={item.id}><h3>{item.trigger}</h3><p className="pw-live-note">{item.kind} · {new Date(item.observedAt).toLocaleString()}</p><p className="pw-body-copy">{item.action}</p><TechnicalDetails title="来源回执"><code className="pw-task-path">{item.sourceReceiptIds.join('\n')}</code><p>状态：{item.status} · 隐私：{item.privacyClass}</p></TechnicalDetails>{!state.candidates.some(candidate => candidate.incidentIds.includes(item.id)) && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act('propose', item.id)}>提出交付复核提醒</Button>}</article>)}{!state.incidents.length && <p className="pw-muted">当前尚无真实问题记录，不会为了填充界面生成候选。</p>}</section>
    {busy && <p role="status">正在处理…</p>}{message && <p className="pw-live-note" role="status">{message}</p>}<p className="pw-live-note">受限策略实验验证执行契约与隔离，不代表真模型质量提升；自由文本规则不能直接执行。</p>
  </>
}
