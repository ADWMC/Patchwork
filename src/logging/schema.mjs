import { createHash } from 'node:crypto'

export const RECORD_TYPE = 'plugin:patchwork/diagnostic'
export const LOG_LIMIT = 200
export const LEVELS = new Set(['info', 'warn', 'error'])
const MECHANISMS = new Set(['runtime', 'af', 'op', 'epr', 'occ', 'search', 'fetch', 'memory', 'improvement', 'browser', 'task', 'superagent', 'skill', 'evidence', 'settings', 'maintenance', 'code'])
const EVENTS = new Set(['loaded', 'inactive', 'boundary', 'decision', 'start', 'success', 'failure', 'noop', 'skipped', 'packed', 'recall', 'continued', 'incident', 'candidate', 'experiment', 'approval', 'rollback',
  'define', 'correct', 'artifact', 'check', 'assessment', 'cancel', 'handoff', 'inspect', 'submit', 'report', 'input', 'retry', 'pause', 'resume', 'reconcile', 'review', 'load', 'cite', 'compare', 'save', 'warning', 'blocked', 'propose', 'revise', 'confirm', 'forget', 'validity'])
const REASONS = new Set([
  'enabled', 'no-tools', 'no-shell', 'shadow-failed', 'target-changed', 'command-failed', 'command-unverified', 'command-succeeded',
  'archive-failed', 'recall-failed', 'packed', 'recalled', 'scope-changed', 'exception', 'cancelled', 'timeout',
  'upstream-declined', 'no-session', 'not-a-shell-tool', 'not-a-diagnostic-command', 'not-plain-text', 'already-reduced',
  'source-over-max-chars', 'below-threshold', 'likely-secret', 'no-reducer-route', 'llm-unavailable', 'reducer-call-failed',
  'reducer-timeout', 'reducer-aborted', 'reducer-budget-exhausted', 'reducer-empty-response', 'unparseable-receipt',
  'receipt-not-an-object', 'receipt-schema-mismatch', 'receipt-source-hash-mismatch', 'receipt-status-missing',
  'receipt-uncertain-not-boolean', 'receipt-evidence-missing', 'receipt-too-many-evidence-items', 'evidence-not-an-object',
  'evidence-kind-unknown', 'evidence-quote-length', 'unverifiable-quote', 'missing-failure-evidence',
  'agent-scope-changed', 'structured-evidence-collapsed', 'receipt-not-smaller', 'retained', 'unexpected',
  'no-model-route', 'no-llm-service', 'model-call-exception', 'model-call-error', 'model-call-aborted', 'model-call-unknown',
  'reducer-output-budget-exhausted', 'empty-reducer-output',
  'plan-boundary', 'plan-complete', 'inputs-unavailable', 'non-positive-saving', 'window-pressure', 'horizon-unavailable',
  'economic-first', 'economic', 'deferred-breakeven', 'deferred-debt', 'compactor-unavailable',
  'compact-noop', 'compact-failed', 'compacted', 'state-update-failed', 'evaluation-failed', 'continuation', 'task-changed',
  'no-results', 'provider-partial', 'all-providers-failed', 'fetch-started', 'fetch-completed', 'memory-started', 'memory-completed', 'memory-failed',
  'invalid-url', 'ssrf-blocked', 'host-not-allowed', 'dns-failed', 'robots-denied', 'robots-unavailable',
  'response-too-large', 'unsupported-content-type', 'empty-content', 'transport-error', 'http-error',
  'improvement-started', 'improvement-completed', 'improvement-failed', 'provenance-required', 'user-confirmation-required',
  'browser-completed', 'browser-failed', 'browser-no-progress', 'task-defined', 'task-corrected', 'task-artifact', 'task-check',
  'task-assessment', 'task-candidate', 'task-cancelled', 'queue-submitted', 'queue-input', 'queue-retry', 'queue-review',
  'queue-paused', 'queue-resumed', 'queue-cancelled', 'queue-reconciled', 'skill-loaded', 'evidence-cited', 'evidence-compared',
  'settings-saved', 'structure-warning', 'evidence-hint', 'exploration-hint', 'memory-proposed', 'memory-revised', 'memory-confirmed', 'memory-forgotten', 'memory-validity',
  'code-started', 'code-map', 'code-outline', 'code-find', 'code-references', 'code-search', 'code-failed',
  'code-graph-status', 'code-graph-enabled', 'code-graph-disabled', 'code-graph-started', 'code-graph-stopped',
  'code-callers', 'code-callees', 'code-impact', 'code-affected',
])
const NUMBERS = ['sourceBytes', 'resultBytes', 'lines', 'offset', 'nextOffset', 'elapsedMs', 'contextTokens', 'afterTokens',
  'keepRecentTokens', 'estimatedSaving', 'measuredSaving', 'requests', 'remaining', 'carriedDebtTokens', 'breakeven', 'expectedRequests', 'evidenceItems', 'resultCount', 'providerCount', 'failedProviderCount']
const ERROR_CODES = new Set(['ENOSPC', 'EACCES', 'EPERM', 'ENOENT', 'EIO', 'ETIMEDOUT', 'ABORT_ERR', 'summary',
  'FETCH_INVALID_URL', 'FETCH_INVALID_OPTION', 'FETCH_SSRF_BLOCKED', 'FETCH_HOST_NOT_ALLOWED', 'FETCH_DNS_FAILED', 'FETCH_ROBOTS_DENIED',
  'FETCH_ROBOTS_UNAVAILABLE', 'FETCH_RESPONSE_TOO_LARGE', 'FETCH_UNSUPPORTED_CONTENT_TYPE', 'FETCH_EMPTY_CONTENT',
  'FETCH_TRANSPORT_ERROR', 'FETCH_HTTP_ERROR', 'FETCH_TIMEOUT', 'FETCH_ABORTED',
  'CODE_INVALID_ACTION', 'CODE_INVALID_MODE', 'CODE_INVALID_REGEX', 'CODE_QUERY_REQUIRED', 'CODE_QUERY_TOO_LONG',
  'CODE_SYMBOL_REQUIRED', 'CODE_PATH_REQUIRED', 'CODE_PATH_OUTSIDE_WORKSPACE', 'CODE_PATH_NOT_FOUND', 'CODE_PATH_NOT_FILE',
  'CODE_FILE_NOT_INDEXED', 'CODE_WORKSPACE_REQUIRED', 'CODE_FAILED',
  'CODE_GRAPH_CONFIG_INVALID', 'CODE_GRAPH_DISABLED', 'CODE_GRAPH_NOT_STARTED',
])

export function fingerprint(value) {
  return typeof value === 'string' && value !== '' ? createHash('sha256').update(value).digest('hex') : undefined
}

export function reasonCode(reason) {
  const code = String(reason ?? '').split(':')[0]
  if (/^retained-\d+-quotes$/.test(code)) return 'retained'
  return REASONS.has(code) ? code : 'exception'
}

export function errorCode(error) {
  if (error?.name === 'AbortError') return 'cancelled'
  if (error?.name === 'TimeoutError') return 'timeout'
  return ERROR_CODES.has(error?.code) ? error.code : 'exception'
}

/** Strict allowlist: no prompts, arguments, command, output, headers or error text. */
export function diagnosticData(input = {}, exec = {}) {
  if (!MECHANISMS.has(input.mechanism) || !EVENTS.has(input.event)) return undefined
  const data = { schemaVersion: 1, mechanism: input.mechanism, event: input.event,
    level: LEVELS.has(input.level) ? input.level : 'info', reason: reasonCode(input.reason) }
  const retained = /^retained-(\d+)-quotes$/.exec(String(input.reason ?? ''))
  if (retained) data.evidenceItems = Number(retained[1])
  for (const key of NUMBERS) if (Number.isFinite(input[key]) && Math.abs(input[key]) <= Number.MAX_SAFE_INTEGER) data[key] = input[key]
  if (Number.isInteger(input.exitCode)) data.exitCode = input.exitCode
  for (const key of ['callId', 'rootCallId']) {
    const hash = fingerprint(exec[key] ?? input[key])
    if (hash) data[`${key}Hash`] = hash
  }
  if (typeof input.source === 'string' && /^[a-f0-9]{64}$/.test(input.source)) data.source = input.source
  if (typeof input.handle === 'string' && /^obs_[a-f0-9]{24}$/.test(input.handle)) data.handle = input.handle
  if (input.error) data.errorCode = errorCode(input.error)
  if (input.routeKind === 'local' || input.routeKind === 'model') data.routeKind = input.routeKind
  for (const key of ['provider', 'model', 'command']) {
    const hash = fingerprint(input[key])
    if (hash) data[`${key}Hash`] = hash
  }
  const usage = {}
  for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']) {
    const value = input.usage?.[key]
    if (Number.isFinite(value) && value >= 0) usage[key] = value
  }
  if (Object.keys(usage).length) data.usage = usage
  return data
}

/** Persisted records are untrusted; never echo arbitrary restored payload fields. */
export function readDiagnostic(data) {
  if (data?.schemaVersion !== 1) return undefined
  const clean = diagnosticData(data)
  if (!clean) return undefined
  for (const key of ['callIdHash', 'rootCallIdHash', 'providerHash', 'modelHash', 'commandHash']) {
    if (/^[a-f0-9]{64}$/.test(data[key] ?? '')) clean[key] = data[key]
  }
  if (['cancelled', 'timeout', 'exception', ...ERROR_CODES].includes(data.errorCode)) clean.errorCode = data.errorCode
  return clean
}
