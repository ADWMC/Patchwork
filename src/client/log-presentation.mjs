export const mechanismLabels = { runtime: '运行时', af: 'AF', op: 'OP', epr: 'EPR', occ: 'OCC', taskMap: '任务地图', search: '检索', fetch: '抓取', memory: '记忆', improvement: '改进', browser: '浏览器', task: '任务', superagent: '主控', skill: '技能', evidence: '引用', settings: '设置', maintenance: '结构检查', code: '代码检索', docs: '项目文档' }
export const levelLabels = { info: '信息', warn: '警告', error: '错误' }

const reasonLabels = {
  'browser-completed': '浏览器操作结束，任务结果以动作后验为准', 'browser-failed': '浏览器操作失败或后验不一致', 'browser-no-progress': '重复操作未取得进展',
  'command-succeeded': '命令执行成功', 'command-failed': '命令返回非零退出码',
  'command-unverified': '尚未核验执行结果', 'target-changed': '目标工具已变化',
  'no-shell': '当前组合没有可用的 Shell', 'no-tools': '工具服务不可用',
  'packed': '原文已归档，可按句柄召回', 'recalled': '已读取归档中的原文片段',
  'retained': '已保留可核对的关键引用', 'likely-secret': '检测到可能的凭据，保留原始结果',
  'plan-boundary': '计划步骤完成，进入评估边界', 'plan-complete': '计划已完成',
  'non-positive-saving': '预估节省不足，保持当前上下文', 'horizon-unavailable': '任务视界不足，暂不压缩',
  'deferred-breakeven': '尚未达到压缩盈亏平衡点', 'deferred-debt': '等待已有压缩成本回收',
  'window-pressure': '上下文接近窗口上限', 'economic': '预计可回收压缩成本',
  'economic-first': '首次压缩预计可节省成本', 'compact-noop': '此次压缩没有产生变更',
  'compacted': '上下文已压缩', 'continuation': '压缩后继续任务',
  'scope-changed': 'Agent 已切换', 'agent-scope-changed': 'Agent 已切换',
  'no-results': '没有找到结果', 'provider-partial': '部分 provider 可用', 'all-providers-failed': '所有 provider 均失败',
  'fetch-started': '开始抓取公开页面', 'fetch-completed': '公开页面抓取完成', 'invalid-url': '地址无效', 'invalid-option': '抓取参数无效',
  'ssrf-blocked': '地址解析到本机或保留网络', 'host-not-allowed': '域名不在允许范围', 'dns-failed': '域名解析失败',
  'robots-denied': 'robots.txt 禁止抓取', 'robots-unavailable': '无法确认 robots.txt', 'response-too-large': '响应超过大小上限',
  'unsupported-content-type': '内容类型不受支持', 'empty-content': '页面没有可读文本', 'transport-error': '网络传输失败',
  'http-error': '页面返回 HTTP 错误', 'memory-started': '开始记忆操作', 'memory-completed': '记忆操作完成', 'memory-failed': '记忆操作失败',
  'improvement-started': '开始记录改进', 'improvement-completed': '改进记录完成', 'improvement-failed': '改进记录失败',
  'state-update-failed': '状态写入失败，主任务继续', 'evaluation-failed': '评估失败，本次不压缩',
  'compact-failed': '压缩失败，保留原始上下文', 'archive-failed': '原文归档失败',
  'recall-failed': '原文召回失败', 'enabled': '机制已启用',
  'task-defined': '任务要求已登记', 'task-corrected': '任务要求已纠正', 'task-artifact': '任务产物已登记', 'task-check': '任务验收已执行',
  'task-assessment': '语义评审已记录', 'task-candidate': '候选经验已登记', 'task-cancelled': '任务已取消',
  'queue-submitted': '主控队列已提交', 'queue-input': '已向执行器补充输入', 'queue-retry': '执行器已重试', 'queue-review': '执行器结果已复核',
  'queue-paused': '主控队列已暂停', 'queue-resumed': '主控队列已继续', 'queue-cancelled': '主控队列已取消', 'queue-reconciled': '主控队列已对账',
  'skill-loaded': '技能正文已按需加载', 'evidence-cited': '引用已绑定精确摘录', 'evidence-compared': '独立来源字段已对比',
  'settings-saved': '配置已保存并等待重载', 'structure-warning': '文件结构建议已触发', 'shortcut-ledger': '已提醒登记过的有意妥协', 'task-anchored-map': '已注入任务锚定上下文', 'evidence-hint': '缺少有效验收的提示已触发', 'exploration-hint': '探索预算提示已触发',
  'code-started': '开始代码检索', 'code-map': '已生成仓库地图', 'code-outline': '已读取文件结构', 'code-find': '已查找符号定义',
  'code-references': '已查找词法引用', 'code-search': '已完成代码文本检索', 'code-failed': '代码检索失败',
  'code-graph-status': '已读取代码图状态', 'code-graph-enabled': '工作区代码图已启用', 'code-graph-disabled': '工作区代码图已停用',
  'code-graph-started': '工作区代码图已启动', 'code-graph-stopped': '工作区代码图已停止',
  'code-callers': '已查询调用者', 'code-callees': '已查询被调用者', 'code-impact': '已查询影响面', 'code-affected': '已查询受影响测试',
  'docs-started': '开始项目文档操作', 'docs-status': '已读取项目文档状态', 'docs-read': '已读取项目文档', 'docs-validate': '项目文档校验完成', 'docs-apply': '项目文档已写入', 'docs-failed': '项目文档操作失败',
  'memory-proposed': '记忆提案已创建', 'memory-revised': '记忆修订已创建', 'memory-confirmed': '记忆版本已确认', 'memory-forgotten': '记忆已停止召回', 'memory-validity': '记忆召回状态已更新',
}
const eventTitles = {
  browser: { success: '浏览器操作记录', failure: '浏览器操作未通过' },
  runtime: { loaded: '运行时已就绪', decision: '运行时检查', failure: '运行时异常' },
  search: { start: '开始检索', success: '检索完成', failure: '检索失败' },
  fetch: { start: '开始抓取公开页面', success: '页面抓取完成', failure: '页面抓取失败' },
  memory: { start: '开始记忆操作', success: '记忆操作完成', failure: '记忆操作失败' },
  improvement: { start: '开始记录改进', success: '改进记录完成', failure: '改进记录失败', decision: '改进决定已记录', rollback: '改进已回滚' },
  af: { start: '开始接续执行', success: '接续执行完成', failure: '接续执行失败', skipped: '已跳过接续执行', inactive: '接续执行不可用' },
  op: { packed: '大输出已归档', recall: '原文片段已召回', failure: '归档处理异常' },
  epr: { decision: '证据约简评估', failure: '证据约简异常' },
  occ: { boundary: '到达计划边界', decision: '上下文压缩评估', start: '开始压缩上下文', success: '上下文压缩完成', noop: '上下文保持不变', failure: '上下文压缩异常', continued: '任务继续执行', skipped: '已跳过上下文压缩' },
  taskMap: { inject: '任务锚定地图已注入' },
  task: { define: '任务要求已登记', correct: '任务要求已纠正', artifact: '任务产物已登记', check: '任务验收已执行', assessment: '语义评审已记录', candidate: '候选经验已登记', cancel: '任务已取消', handoff: '任务交接已读取', inspect: '任务状态已读取', review: '任务语义验收已复核' },
  superagent: { submit: '主控队列已提交', report: '执行器已汇报', input: '已向执行器补充输入', retry: '执行器已重试', review: '执行器结果已复核', pause: '主控队列已暂停', resume: '主控队列已继续', cancel: '主控队列已取消', reconcile: '主控队列已对账' },
  skill: { load: '技能正文已加载' },
  evidence: { cite: '引用已绑定', compare: '独立来源已对比', list: '引用证据已读取' },
  settings: { save: '配置已保存' },
  code: { start: '开始代码检索', success: '代码检索完成', failure: '代码检索失败' },
  docs: { start: '开始项目文档操作', success: '项目文档操作完成', failure: '项目文档操作失败' },
  maintenance: { warning: '结构或证据提示', blocked: '结构检查阻断' },
}

export function logTitle(entry) {
  if (entry.mechanism === 'epr' && entry.reason === 'retained') return '关键证据已保留'
  return eventTitles[entry.mechanism]?.[entry.event] ?? '机制运行记录'
}

export const logReason = entry => reasonLabels[entry.reason] ?? '查看详情了解本次机制决策'
export const logTone = entry => entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : entry.event === 'success' ? 'success' : undefined
export const logTime = value => new Date(value).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function formatBytes(value) {
  if (!Number.isFinite(value)) return null
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : value >= 1024 ? `${(value / 1024).toFixed(1)} KB` : `${value} B`
}

export function formatElapsed(value) {
  return Number.isFinite(value) ? value >= 1000 ? `${(value / 1000).toFixed(2)} 秒` : `${value} ms` : null
}

export function logFacts(entry) {
  const fields = [
    ['执行结果', Number.isInteger(entry.exitCode) ? `退出码 ${entry.exitCode}` : null],
    ['耗时', formatElapsed(entry.elapsedMs)], ['原文大小', formatBytes(entry.sourceBytes)],
    ['结果大小', formatBytes(entry.resultBytes)], ['保留引用', Number.isFinite(entry.evidenceItems) ? `${entry.evidenceItems} 条` : null],
    ['处理方式', entry.routeKind === 'local' ? '本地提取' : entry.routeKind === 'model' ? '模型约简' : null],
    ['压缩前 tokens', entry.contextTokens], ['压缩后 tokens', entry.afterTokens],
    ['估计节省 tokens', entry.estimatedSaving], ['实际节省 tokens', entry.measuredSaving],
    ['保留 tokens', entry.keepRecentTokens], ['剩余步骤', entry.remaining],
    ['累计请求', entry.requests], ['压缩债务 tokens', entry.carriedDebtTokens],
    ['原文行数', entry.lines], ['分页偏移', entry.offset], ['下页偏移', entry.nextOffset],
    ['结果数', entry.resultCount], ['可用 provider', entry.providerCount], ['失败 provider', entry.failedProviderCount],
    ['输入 tokens', entry.usage?.inputTokens], ['输出 tokens', entry.usage?.outputTokens],
    ['缓存读取 tokens', entry.usage?.cacheReadTokens], ['缓存写入 tokens', entry.usage?.cacheWriteTokens],
  ]
  return fields.filter(([, value]) => value !== undefined && value !== null)
}

export function matchesLog(entry, { mechanism = 'all', level = 'all', query = '' } = {}) {
  return (mechanism === 'all' || entry.mechanism === mechanism) && (level === 'all' || entry.level === level) &&
    (!query.trim() || [logTitle(entry), logReason(entry), entry.reason, entry.event, entry.mechanism, entry.callIdHash, entry.rootCallIdHash, entry.commandHash, entry.source, entry.handle, entry.errorCode]
      .join(' ').toLowerCase().includes(query.trim().toLowerCase()))
}
