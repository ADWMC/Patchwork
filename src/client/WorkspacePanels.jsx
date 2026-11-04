import { createElement } from 'react'
import { SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import { ImprovementPanel } from './ImprovementPanel.jsx'
import { MemoryPanel } from './MemoryPanel.jsx'
import { ToolEvidencePanel } from './ToolEvidencePanel.jsx'
import { SETTING_FIELDS } from '../config/fields.mjs'
import { TaskEvidence } from './TaskEvidence.jsx'
import { RetrievalPanel } from './RetrievalPanel.jsx'
import { SuperagentPanel } from './SuperagentPanel.jsx'
import { LogPanel } from './LogPanel.jsx'
import { MechanismsPanel } from './OperationalPanels.jsx'
import { CopyButton, SummaryStrip } from './workspace-elements.jsx'
import { EmptyState, SectionHeading } from './panel-elements.jsx'
import { formatBytes, logTime } from './log-presentation.mjs'

export { OverviewPanel, MechanismsPanel, MechanismStatus, mechanisms } from './OperationalPanels.jsx'
export { SettingsPanel } from './SettingsPanel.jsx'
export const settingsKeys = SETTING_FIELDS.map(field => field.key)

const pendingRequirements = data => (data.task?.requirements ?? []).filter(item => item.required && !['passed', 'accepted'].includes(item.status)).length
const queueAttention = data => (data.superagent?.jobs ?? []).filter(job => ['failed', 'blocked', 'waiting', 'review'].includes(job.status)).length
const memoryProposed = data => data.memory?.counts?.proposed ?? (data.memory?.entries ?? []).filter(entry => entry.status === 'proposed').length
const improvementPending = data => (data.improvements?.candidates ?? []).filter(candidate => !candidate.applied && !['revoked', 'rejected'].includes(candidate.decision)).length
const retrievalFailures = data => (data.retrieval?.entries ?? []).filter(entry => ['failed', 'partial'].includes(entry.status)).length
const diagnosticErrors = data => (data.diagnostics?.entries ?? []).filter(entry => entry.level === 'error').length

export const domains = {
  execution: [['task', '任务', pendingRequirements], ['queue', '主控', queueAttention]],
  evidence: [['tools', '工具', data => (data.events ?? []).filter(event => event.outcome === 'failed').length], ['retrieval', '检索', retrievalFailures]],
  management: [['memory', '记忆', memoryProposed], ['improvements', '改进', improvementPending]],
  diagnostics: [['capabilities', '能力'], ['logs', '日志', diagnosticErrors]],
}

export function visibleDomainTabs(domain, data) {
  const items = (domains[domain] ?? []).filter(([value]) => {
    if (domain === 'execution' && value === 'queue') return Boolean(data.superagent?.jobs?.length || (data.superagent && data.superagent.status !== 'idle'))
    if (domain === 'evidence' && value === 'retrieval') return Boolean((data.retrieval?.entries ?? []).length || (data.retrieval?.evidence ?? []).length)
    if (domain === 'management' && value === 'memory') return Boolean(data.memory && (data.config?.memoryEnabled !== false || data.memory.entryCount || data.memory.counts?.proposed || data.memory.counts?.active))
    if (domain === 'management' && value === 'improvements') return Boolean((data.improvements?.incidents ?? []).length || (data.improvements?.candidates ?? []).length || (data.improvements?.experiments ?? []).length)
    return true
  }).map(([value, label, count]) => ({ value, label, count: count?.(data) ?? 0 }))
  return items.length ? items : [{ value: domains[domain][0][0], label: domains[domain][0][1], count: 0 }]
}

export function DomainNav({ domain, value, onChange, data, prefix }) {
  const items = visibleDomainTabs(domain, data)
  const active = items.some(item => item.value === value) ? value : items[0].value
  const label = { execution: '执行页面', evidence: '证据页面', management: '管理页面', diagnostics: '诊断页面' }[domain] ?? '页面'
  return <nav className="pw-secondary-nav"><SegmentedTabs label={label} value={active} onChange={onChange} items={items.map(item => ({
    value: item.value,
    id: `${prefix}-${domain}-${item.value}`,
    panelId: `${prefix}-${domain}-panel`,
    label: createElement('span', { className: 'pw-tab-label' }, item.label, item.count > 0 ? createElement('span', { className: 'pw-tab-badge' }, item.count) : null),
  }))}/></nav>
}

function tabPanel(domain, view, prefix, children) {
  return <div role="tabpanel" id={`${prefix}-${domain}-panel`} aria-labelledby={`${prefix}-${domain}-${view}`}>{children}</div>
}

export function ExecutionPanel({ data, view, setView, prefix, superagentAction }) {
  const active = visibleDomainTabs('execution', data).some(item => item.value === view) ? view : 'task'
  return <>
    <DomainNav domain="execution" value={active} onChange={setView} data={data} prefix={prefix}/>
    {tabPanel('execution', active, prefix, active === 'task'
      ? <><TaskEvidence task={data.task} expanded handoff={data.taskHandoff} reviewAction={superagentAction}/><CorrectionHistory task={data.task}/></>
      : <SuperagentPanel data={data} superagentAction={superagentAction}/>)}
  </>
}

export function EvidencePanel({ data, view, setView, prefix, evidenceAction }) {
  const active = visibleDomainTabs('evidence', data).some(item => item.value === view) ? view : 'tools'
  return <>
    <DomainNav domain="evidence" value={active} onChange={setView} data={data} prefix={prefix}/>
    {tabPanel('evidence', active, prefix, active === 'retrieval'
      ? <RetrievalPanel data={data} evidenceAction={evidenceAction}/>
      : <ToolEvidencePanel events={data.events ?? []}/>)}
  </>
}

export function ManagementPanel({ data, view, setView, prefix, memoryAction, memoryQuery, improvementAction }) {
  const active = visibleDomainTabs('management', data).some(item => item.value === view) ? view : 'memory'
  return <>
    <DomainNav domain="management" value={active} onChange={setView} data={data} prefix={prefix}/>
    {tabPanel('management', active, prefix, active === 'improvements'
      ? <ImprovementPanel data={data} improvementAction={improvementAction}/>
      : <MemoryPanel data={data} onCurrent={() => setView('memory')} memoryAction={memoryAction} memoryQuery={memoryQuery}/>)}
  </>
}

export function DiagnosticsPanel({ data, view, setView, prefix, exportLogs, connected }) {
  const active = view === 'logs' ? 'logs' : 'capabilities'
  return <>
    <DomainNav domain="diagnostics" value={active} onChange={setView} data={data} prefix={prefix}/>
    {tabPanel('diagnostics', active, prefix, active === 'logs'
      ? <LogPanel diagnostics={data.diagnostics} exportLogs={exportLogs} connected={connected}/>
      : <CapabilitiesPanel data={data}/>)}
  </>
}

function CapabilitiesPanel({ data }) {
  return <>
    <MechanismsPanel data={data}/>
    <MechanismStatsPanel stats={data.stats}/>
    <CodePanel code={data.code} codeGraph={data.codeGraph}/>
    <ProjectDocsPanel docs={data.projectDocs}/>
    <ExplorationPanel exploration={data.exploration}/>
    <PlanPanel plan={data.plan}/>
    <ObservationPanel items={data.observations ?? []}/>
  </>
}

function CodePanel({ code, codeGraph }) {
  if (!code) return null
  const items = [
    { label: '状态', value: code.available ? '可用' : code.configured ? '未注册' : '关闭' },
    { label: '请求', value: (code.requests ?? 0) + ' 次' },
    { label: '索引文件', value: code.filesIndexed ?? 0 },
    { label: '地图', value: (code.mapCalls ?? 0) + ' 次' },
    { label: '检索', value: (code.searchCalls ?? 0) + ' 次' },
    { label: '调用/影响', value: ((code.callersCalls ?? 0) + (code.calleesCalls ?? 0) + (code.impactCalls ?? 0) + (code.affectedCalls ?? 0)) + ' 次' },
    { label: '图启动', value: (code.graphStartCalls ?? 0) + ' 次' },
    { label: '代码图', value: codeGraph?.started ? '已启动' : codeGraph?.enabled ? '已启用/未启动' : '未启用' },
  ]
  return <section className="pw-section" aria-label="本地代码检索"><SectionHeading title="本地代码检索" description="只读代码地图/符号/文本检索；工作区代码图按需启用并由模型启动。不读依赖、构建产物或密钥文件，不把原文写入诊断。"/><SummaryStrip label="代码检索计数" items={items.map(item => ({ label: item.label, value: item.value }))}/>{codeGraph && <p className="pw-live-note">工作区配置：{codeGraph.configPath}；{codeGraph.status === 'invalid' ? `配置无效 ${codeGraph.failureCode ?? ''}` : codeGraph.exists ? '已存在' : '尚未创建'}。代码图仅在 graph-start 后提供 callers/callees/impact/affected。</p>}<p className="pw-live-note">计数是进程内动作，不等于召回率、正确率或 token 收益。</p></section>
}

function ProjectDocsPanel({ docs }) {
  if (!docs) return null
  const items = ['agents', 'design'].map(key => {
    const item = docs[key]
    return { label: key === 'agents' ? 'AGENTS.md' : 'DESIGN.md', value: item?.exists ? `${formatBytes(item.bytes) ?? item.bytes + ' B'} · ${item.sha256.slice(0, 8)}` : '未创建' }
  })
  return <section className="pw-section" aria-label="项目文档"><SectionHeading title="项目文档" description="AGENTS.md 和 DESIGN.md 会持续影响后续 agent；修改必须带当前 hash，防止静默覆盖。"/><SummaryStrip label="项目文档状态" items={items}/><p className="pw-live-note">由 patchwork_project_docs 读取/校验/写入；只允许这两个文件名，不授予权限。</p></section>
}

function ExplorationPanel({ exploration }) {
  if (!exploration) return null
  const items = [
    { label: 'read', value: exploration.read ?? 0 },
    { label: 'grep', value: exploration.grep ?? 0 },
    { label: 'glob', value: exploration.glob ?? 0 },
    { label: 'code', value: exploration.patchwork_code ?? 0 },
    { label: '重复查询', value: exploration.duplicateQueries ?? 0 },
    { label: '读入', value: formatBytes(exploration.bytesRead) ?? '0 B' },
  ]
  return <section className="pw-section" aria-label="探索成本"><SectionHeading title="探索成本" description="本会话已观察到的探索调用；只用于发现重复搜索，不判断任务质量。"/><SummaryStrip label="探索成本计数" items={items.map(item => ({ label: item.label, value: item.value }))}/></section>
}

function MechanismStatsPanel({ stats }) {
  const af = stats?.actionFusion ?? {}, op = stats?.observationPack ?? {}, epr = stats?.evidencePreservingReducer ?? {}, occ = stats?.onlineContextCompact ?? {}, maintenance = stats?.maintenance ?? {}
  const items = [
    { label: 'AF 接续', value: (af.fusedCalls ?? 0) + ' 次', title: `${af.succeededCalls ?? 0} 成功 / ${af.failedCalls ?? 0} 失败` },
    { label: 'OP 归档', value: (op.packedResults ?? 0) + ' 条', title: `${formatBytes(op.packedBytes) ?? '0 B'} 原文` },
    { label: 'EPR 约简', value: (epr.receipts ?? 0) + ' 条', title: `${formatBytes(epr.reducedBytes) ?? '0 B'} 缩减` },
    { label: 'OCC 压缩', value: (occ.compactions ?? 0) + ' 次', title: '仅执行计数' },
    { label: '维护提示', value: (maintenance.structureWarnings ?? 0) + (maintenance.evidenceBlocks ?? 0) + ' 次', title: `结构 ${maintenance.structureWarnings ?? 0} / 证据 ${maintenance.evidenceBlocks ?? 0}` },
  ]
  return <section className="pw-section" aria-label="机制执行计数"><SectionHeading title="执行计数" description="进程内计数，仅说明机制实际动作；不是 token、延迟或成本收益。"/><SummaryStrip label="机制执行计数" items={items.map(item => ({ label: item.label, value: item.value, tone: undefined }))}/><p className="pw-live-note">{items.map(item => `${item.label}：${item.title}`).join('；')}。计数不代替真实账单、正确性或任务通过。</p></section>
}

function PlanPanel({ plan }) {
  const steps = plan?.steps ?? []
  return <section className="pw-section" aria-label="当前计划"><SectionHeading title="当前计划" description={plan ? `${plan.completed} / ${steps.length || 0} 步完成` : '当前没有模型登记的计划。'}/>
    {steps.length ? <ol className="pw-plan-list">{steps.map(step => <li key={step.id} data-status={step.status}><span className="pw-dot" data-tone={step.status === 'completed' ? 'success' : step.status === 'in_progress' ? 'warn' : undefined}/><span>{step.text}</span><small>{step.status}</small></li>)}</ol> : <p className="pw-muted">模型调用 update_plan 后，这里显示步骤状态；计划不是任务验收。</p>}
    {plan?.lastDecision && <p className="pw-live-note">最近决策：{plan.lastDecision}</p>}
  </section>
}

function ObservationPanel({ items }) {
  return <section className="pw-section" aria-label="大输出归档"><SectionHeading title="归档句柄" description="只显示本次运行登记过的句柄；完整原文仍按会话隔离保存在磁盘。"/>
    {items.length ? <div className="pw-list">{items.map(item => <div className="pw-row" key={item.handle}><div className="pw-copy"><strong className="pw-mono">{item.handle}</strong><small>{item.tool} · {formatBytes(item.bytes) ?? item.bytes + ' B'} · {item.lines} 行 · {logTime(item.at)}</small><pre className="pw-archive-head">{item.head}</pre></div><CopyButton label="复制句柄" value={item.handle}/></div>)}</div> : <p className="pw-muted">当前没有归档句柄。超过阈值的成功工具输出会在这里出现。</p>}
    <p className="pw-live-note">句柄只用于 obs_recall；归档不会自动进入模型上下文，也不等于任务验收。</p>
  </section>
}

function CorrectionHistory({ task }) {
  const corrections = task?.corrections ?? []
  if (!corrections.length) return null
  return <section className="pw-section" aria-label="纠正历史"><SectionHeading title="纠正历史" description="最近 20 次纠正；旧回执会因版本变化失效。"/>
    {corrections.slice().reverse().map((item, index) => <div className="pw-row" key={`${item.revision}-${index}`}><div className="pw-copy"><strong>r{item.revision}</strong><small>受影响：{item.affected.join('、') || '全部验收项'}</small></div><span className="pw-muted">{item.at ? new Date(item.at).toLocaleString() : '时间未记录'}</span></div>)}
  </section>
}
