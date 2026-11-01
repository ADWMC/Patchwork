import { EmptyState, PanelIcon, SectionHeading, TechnicalDetails } from './panel-elements.jsx'

const statusLabels = { retrieved: '已检索', partial: '部分成功', failed: '失败', admitted: '已准入', sent: '已发送', cited: '已引用', verified: '已验证', rejected: '已拒绝' }
const healthLabels = { healthy: '正常', zero_result: '零结果', parser_drift: '解析漂移', blocked: '被阻断', transport_error: '传输失败' }

function RetrievalEntry({ entry }) {
  return <article className="pw-candidate">
    <span className="pw-eyebrow">{statusLabels[entry.status] ?? entry.status} · {entry.type === 'fetch' ? '抓取' : '搜索'} · {entry.trust === 'external-untrusted' ? '外部不可信数据' : entry.trust}</span>
    <h3>{entry.provider ?? 'Patchwork 检索'}</h3>
    <p>{entry.resultCount ?? 0} 条结果 · {entry.elapsedMs ?? '未知'} ms{entry.failureCode ? ` · ${entry.failureCode}` : ''}</p>
    {entry.providerHealth?.length > 0 && <TechnicalDetails title="Provider 状态"><dl className="pw-facts">{entry.providerHealth.map(item => <div key={item.provider}><dt>{item.provider}</dt><dd>{healthLabels[item.status] ?? item.status} · {item.resultCount ?? 0} 条</dd></div>)}</dl></TechnicalDetails>}
    {entry.sources?.length > 0 && <TechnicalDetails title="来源"><ul className="pw-source-list">{entry.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.url}</small>{source.snippet && <p>{source.snippet}</p>}</li>)}</ul></TechnicalDetails>}
    <TechnicalDetails title="检索元数据"><dl className="pw-facts"><div><dt>操作 ID</dt><dd className="pw-mono">{entry.operationId}</dd></div><div><dt>范围</dt><dd>{entry.scope}</dd></div>{entry.queryFingerprint && <div><dt>查询指纹</dt><dd className="pw-mono">{entry.queryFingerprint}</dd></div>}</dl></TechnicalDetails>
  </article>
}

export function RetrievalPanel({ data }) {
  const entries = data.retrieval?.entries ?? []
  return <><div className="pw-page-heading"><h2>检索证据</h2><p>显示本会话实际检索到的来源和 provider 状态；网页内容仍按外部不可信数据处理。</p></div><section className="pw-section"><SectionHeading title="检索记录"><span className="pw-muted">{entries.length} 条 · {data.retrieval?.persistence === 'native' ? '已写入会话' : '本次运行'}</span></SectionHeading>{entries.length ? entries.map(entry => <RetrievalEntry key={entry.operationId + (entry.seq ?? '')} entry={entry}/>) : <EmptyState title="还没有检索记录" icon="search"><p>执行 Patchwork 搜索后，来源和失败状态会显示在这里。</p></EmptyState>}</section><p className="pw-live-note"><PanelIcon name="info"/> 检索结果不会自动进入长期记忆、规则或权限。</p></>
}
