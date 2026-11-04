import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { EmptyState, PanelIcon, SectionHeading, TechnicalDetails } from './panel-elements.jsx'
import { TaskEvidence } from './TaskEvidence.jsx'
import { EvidenceList } from './EvidenceList.jsx'
import { Facets, SearchField, SummaryStrip } from './workspace-elements.jsx'
import { textMatches, workspaceSummary } from './workspace-model.mjs'

export const mechanisms = [
  { key: 'actionFusion', code: 'AF', name: '接续执行', description: '把文件编辑和必要校验接成一次受控操作。', boundary: '只有工具契约暴露 then_run 才能确认已注册；不把工具成功当成任务通过。', log: 'af' },
  { key: 'observationPack', code: 'OP', name: '大输出归档', description: '保存完整原文，按需读取少量片段。', boundary: '归档指针不是内容本身；调用召回工具后才得到对应原文。', log: 'op' },
  { key: 'evidencePreservingReducer', code: 'EPR', name: '证据约简', description: '保留可核对引用，缩短较长的工具观察。', boundary: '默认关闭，敏感输出拒绝外发；不能用缩短字数冒充质量提升。', log: 'epr' },
  { key: 'onlineContextCompact', code: 'OCC', name: '上下文压缩', description: '在计划边界评估是否需要整理上下文。', boundary: '配置开启不代表实际执行；查看决策日志确认压缩前后状态。', log: 'occ' },
]
const skillLabels = { 'anti-slop': '去模板化复核', architecture: '架构设计', collaborator: '协作', evidence: '证据核对', patchwork: '工作流程', standards: '工程标准', 'web-ui': '界面设计', debugging: '故障排查', 'code-review': '代码审查', retrieval: '信息检索', documentation: '文档维护', memory: '记忆管理', improvement: '受控改进' }
export function MechanismStatus({ item, data }) {
  const loaded = data.loadedConfig?.[item.key], active = data.mechanisms?.[item.key]?.active
  return <span className="pw-status" data-tone={active === true ? 'success' : undefined}>{loaded === false ? '未加载' : loaded !== true ? '未知' : active === true ? '已注册' : active === false ? '未注册' : '已加载'}</span>
}
export function OverviewPanel({ data, pending, navigate }) {
  const summary = workspaceSummary(data), events = data.events ?? []
  const attention = [
    summary.review > 0 && { label: `${summary.review} 个执行器结果等待复核`, detail: '先查看当前产物与证据，再决定是否接纳。', tab: 'execution', view: 'queue' },
    summary.blocked > 0 && { label: `${summary.blocked} 个执行器需要处理`, detail: '查看阻塞原因、依赖与重试次数。', tab: 'execution', view: 'queue' },
    summary.failures > 0 && { label: `${summary.failures} 条失败工具回执`, detail: '定位最近失败；数字仅覆盖当前预览。', tab: 'evidence', view: 'tools' },
    summary.candidates > 0 && { label: `${summary.candidates} 条改进候选待审`, detail: '检查来源、实验差异与影响范围。', tab: 'management', view: 'improvements' },
    pending > 0 && { label: `${pending} 项配置等待重新加载`, detail: '查看已保存值与当前实际加载值的差异。', tab: 'settings' },
  ].filter(Boolean)
  return <>
    <div className="pw-page-heading"><h2>工作概览</h2><p>{data.task?.workspace ?? '当前 Patchwork 会话'} </p></div>
    <SummaryStrip label="当前工作统计" items={[{ label: '必需验收', value: summary.requirements ? `${summary.passed} / ${summary.requirements}` : '未定义' }, { label: '执行中', value: summary.running }, { label: '待复核', value: summary.review }, { label: '工具失败', value: summary.failures, tone: summary.failures ? 'warn' : undefined }]}/>
    <section className="pw-section" aria-label="待处理事项"><SectionHeading title="待处理"><span className="pw-muted">{attention.length ? `${attention.length} 类` : '暂无待处理'}</span></SectionHeading>{attention.length ? attention.map(item => <button type="button" className="pw-knowledge-row" key={item.label} onClick={() => navigate(item.tab, item.view)}><span><strong>{item.label}</strong><small>{item.detail}</small></span><PanelIcon name="chevron"/></button>) : <p className="pw-muted">当前快照没有待处理事项；任务完成仍以实际验收为准。</p>}</section>
    <TaskEvidence task={data.task} onEvidence={() => navigate('execution', 'task')}/>
    <section className="pw-section"><SectionHeading title="最近工具活动"><Button size="sm" variant="ghost" onClick={() => navigate('evidence', 'tools')}>查看证据 <PanelIcon name="chevron"/></Button></SectionHeading><EvidenceList items={events.slice(0, 3)}/></section>
    <section className="pw-section"><SectionHeading title="上下文与能力"><Button size="sm" variant="ghost" onClick={() => navigate('diagnostics', 'capabilities')}>查看机制与技能</Button></SectionHeading><div className="pw-context-value"><strong>{summary.tokens == null ? '未测量' : summary.tokens.toLocaleString()}<small> tokens</small></strong><span className="pw-muted">窗口 {summary.window == null ? '未知' : summary.window.toLocaleString()}</span></div>{summary.tokens != null && summary.window != null && <div className="pw-meter" role="meter" aria-label="当前上下文占用" aria-valuemin={0} aria-valuemax={summary.window} aria-valuenow={Math.min(summary.tokens, summary.window)}><span style={{ width: `${Math.min(100, summary.tokens / summary.window * 100)}%` }}/></div>}<p className="pw-live-note">仅显示宿主实际计量；记忆按需读取，管理页正文不会自动注入。</p></section>
    <div className="pw-quick-links" aria-label="工作区快捷入口">{[['任务验收', 'execution', 'task'], ...(data.superagent?.jobs?.length ? [['主控队列', 'execution', 'queue']] : []), ['记忆管理', 'management', 'memory'], ...((data.retrieval?.entries ?? []).length ? [['检索来源', 'evidence', 'retrieval']] : []), ['运行日志', 'diagnostics', 'logs'], ['配置', 'settings']].map(([label, tab, view]) => <Button size="sm" variant="outline" key={label} onClick={() => navigate(tab, view)}>{label}</Button>)}</div>
  </>
}
export function MechanismsPanel({ data }) {
  const [query, setQuery] = useState(''), [view, setView] = useState('all')
  const names = data.skills?.names ?? []
  const rows = mechanisms.filter(item => textMatches(query, item.name, item.code, item.description))
  const visibleNames = names.filter(name => textMatches(query, name, skillLabels[name]))
  return <>
    <div className="pw-page-heading"><h2>机制与技能</h2><p>查看实际加载状态、最近决策，以及本会话可按需读取的技能。</p></div>
    <SummaryStrip label="能力统计" items={[{ label: '机制已加载', value: mechanisms.filter(item => data.loadedConfig?.[item.key] === true).length }, { label: '已注册技能', value: names.length }, { label: '正文加载', value: '按需' }]}/>
    <SearchField label="搜索机制与技能" value={query} onChange={setQuery} placeholder="搜索名称、用途或机制代码"/>
    <Facets label="能力类别" value={view} onChange={setView} items={[{ value: 'all', label: '全部' }, { value: 'mechanisms', label: '运行机制', count: mechanisms.length }, { value: 'skills', label: '技能目录', count: names.length }]}/>
    {view !== 'skills' && <div className="pw-mechanism-grid">{rows.map(item => {
      const latest = (data.diagnostics?.entries ?? []).find(entry => entry.mechanism === item.log)
      return <section className="pw-section" key={item.key}><SectionHeading title={item.name}><MechanismStatus item={item} data={data}/></SectionHeading><p className="pw-body-copy">{item.description}</p><div className="pw-inline-facts"><span>{item.code}</span><span>已保存 {data.config?.[item.key] === true ? '开启' : '关闭'}</span>{data.config?.[item.key] !== data.loadedConfig?.[item.key] && <span className="pw-warning">等待重载</span>}</div><p className="pw-live-note">{latest ? `最近记录：${latest.event} · ${latest.reason}` : '当前预览暂无运行记录，尚不能证明执行或收益。'}</p><TechnicalDetails title="运行边界"><p>{item.boundary}</p></TechnicalDetails></section>
    })}</div>}
    {view !== 'skills' && !rows.length && <EmptyState title="没有匹配的运行机制">调整搜索条件。</EmptyState>}
    {view !== 'mechanisms' && <section className="pw-section"><SectionHeading title="本会话技能目录" description={`${data.skills?.mode === 'expanded' ? '扩展' : '核心'}目录 · 已注册不等于模型已经阅读`}/>{visibleNames.map(name => <div className="pw-row" key={name}><div className="pw-copy"><strong>{skillLabels[name] ?? name}</strong><small>{name}</small></div><span className="pw-status">按需读取</span></div>)}{!visibleNames.length && <EmptyState title={names.length ? '没有匹配的技能' : '当前没有注册的技能'}>{names.length ? '调整搜索条件。' : '核对技能开关、加载模式与宿主技能服务。'}</EmptyState>}<p className="pw-live-note">目录来自当前实例的注册结果。这里查看不会向模型发送技能正文。</p></section>}
  </>
}
