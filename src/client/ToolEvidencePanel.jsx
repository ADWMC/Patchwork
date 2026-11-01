import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Select } from './controls.jsx'
import { EvidenceList } from './EvidenceList.jsx'
import { EmptyState, SectionHeading } from './panel-elements.jsx'
import { Facets, SearchField, SummaryStrip } from './workspace-elements.jsx'
import { evidenceGroups, textMatches } from './workspace-model.mjs'
const outcomes = [['all', '全部'], ['failed', '失败'], ['unverified', '待核验'], ['completed', '已完成'], ['skipped', '已跳过']]
export function ToolEvidencePanel({ events }) {
  const [query, setQuery] = useState(''), [outcome, setOutcome] = useState('all'), [tool, setTool] = useState('all'), [grouped, setGrouped] = useState(false)
  const tools = [...new Set(events.map(event => event.tool).filter(Boolean))]
  const visible = events.filter(event => (outcome === 'all' || event.outcome === outcome) && (tool === 'all' || event.tool === tool) && textMatches(query, event.command, event.path, event.tool, event.id, event.rootCallId, event.text))
  return <section className="pw-section" aria-label="工具证据管理"><SectionHeading title="工具证据" description="按结果定位问题，按根调用串起相关操作。"/>
    <SummaryStrip label="工具证据统计" items={[{ label: '当前预览', value: events.length }, { label: '失败', value: events.filter(item => item.outcome === 'failed').length }, { label: '待核验', value: events.filter(item => item.outcome === 'unverified').length }]}/>
    <SearchField label="搜索工具证据" value={query} onChange={setQuery} placeholder="搜索命令、路径、工具或回执"/>
    <Facets label="工具结果筛选" value={outcome} onChange={setOutcome} items={outcomes.map(([value, label]) => ({ value, label, count: value === 'all' ? events.length : events.filter(event => event.outcome === value).length }))}/>
    <div className="pw-toolbar"><Select aria-label="工具类别筛选" value={tool} onChange={setTool} options={[{ value: 'all', label: '全部工具' }, ...tools.map(tool => ({ value: tool, label: tool }))]}/><Button size="sm" variant="ghost" aria-pressed={grouped} onClick={() => setGrouped(value => !value)}>按根调用分组</Button><span className="pw-muted">显示 {visible.length} 条</span></div>
    {visible.length ? grouped ? evidenceGroups(visible).map(group => <div className="pw-evidence-group" key={group.id}><div className="pw-list-meta"><code>{group.id}</code><span>{group.entries.length} 条</span></div><EvidenceList items={group.entries}/></div>) : <EvidenceList items={visible}/> : <EmptyState title={events.length ? '没有匹配的工具证据' : '暂无工具证据'}>调整筛选，或在当前会话执行任务后查看。</EmptyState>}
    <p className="pw-live-note">最多预览本次运行的 100 条记录；筛选仅覆盖当前预览。更早结果请查看 DSH 会话记录。</p>
  </section>
}
