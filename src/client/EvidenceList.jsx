import { EmptyState, PanelIcon, TechnicalDetails } from './panel-elements.jsx'
import { formatBytes, logTime } from './log-presentation.mjs'

const outcomes = { completed: '工具完成', failed: '执行失败', skipped: '已跳过', unverified: '待核验' }
export function EvidenceList({ items }) {
  if (!items.length) return <EmptyState title="暂无工具证据">任务中的工具结果会显示在这里，仅保留当前会话的预览。</EmptyState>
  return <div className="pw-list">{items.map(event => <details className="pw-event" key={event.id}>
    <summary><span className="pw-dot" data-tone={event.outcome === 'failed' ? 'error' : event.outcome === 'completed' ? 'success' : 'warn'}/><div className="pw-event-main"><span className="pw-event-title pw-summary-copy">{event.command ?? event.path ?? event.tool}</span><div className="pw-event-subtitle"><span className="pw-mono">{event.tool}</span><span>{outcomes[event.outcome] ?? '未知结果'}</span><span>{Number.isInteger(event.exitCode) ? `exit ${event.exitCode}` : '退出码未采集'}</span></div></div><time className="pw-event-time" dateTime={event.at}>{logTime(event.at)}</time><PanelIcon name="chevron" className="pw-event-chevron"/></summary>
    <div className="pw-event-body"><dl className="pw-facts"><div><dt>工具结果</dt><dd>{outcomes[event.outcome] ?? '未知结果'}</dd></div><div><dt>原始输出</dt><dd className="pw-mono">{formatBytes(event.bytes)}</dd></div></dl><pre>{event.text || '无文本输出'}{event.truncated ? '\n[预览已截断；完整内容见 DSH 会话记录]' : ''}</pre><TechnicalDetails title="调用关联"><dl className="pw-facts"><div><dt>调用 ID</dt><dd>{event.id}</dd></div>{event.rootCallId && <div><dt>根调用 ID</dt><dd>{event.rootCallId}</dd></div>}{event.callIdHash && <div><dt>调用指纹</dt><dd>{event.callIdHash}</dd></div>}</dl></TechnicalDetails></div>
  </details>)}</div>
}
