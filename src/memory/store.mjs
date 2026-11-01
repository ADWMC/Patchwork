import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { isPatchworkAgent } from '../scope.mjs'
import { acquireFileLease } from '../util/file-lease.mjs'
import { currentPolicy } from '../improvement/policy.mjs'
import { redactPreview } from '../logging/redact.mjs'

export const MEMORY_SCHEMA_VERSION = 1
export const MEMORY_LIMIT = 200
export const MEMORY_RECORD = 'plugin:patchwork/memory'
const MAX_VALUE_CHARS = 4000
const MAX_KEY_CHARS = 256
const VALID_VISIBILITY = new Set(['session-private', 'project-shared'])
const VALID_STATUS = new Set(['proposed', 'active', 'superseded', 'revoked'])
const VALID_VALIDITY = new Set(['fresh', 'stale', 'conflicted', 'expired', 'unsupported'])
const states = new Map()
const queues = new Map()
const epochs = new WeakMap()
export function revokeMemoryOperations(ctx) { epochs.set(ctx, (epochs.get(ctx) ?? 0) + 1) }

function memoryPath() { return process.env.DSH_HOME ? join(process.env.DSH_HOME, 'patchwork', 'memory.json') : dshHomePath('patchwork', 'memory.json') }

function fingerprint(value) { return createHash('sha256').update(String(value)).digest('hex') }

function likelySecret(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return redactPreview(text) !== text || /(?:api[_-]?key|access[_-]?token|secret|password|authorization|bearer)\s*[:=]/i.test(text) || /-----BEGIN [A-Z ]+ KEY-----/.test(text)
}

function projectIdFor(agent) {
  const cwd = agent?.session?.header?.cwd
  return cwd ? `project_${fingerprint(cwd).slice(0, 24)}` : undefined
}

function namespaceFor(agent, visibility) {
  if (visibility === 'project-shared') {
    const projectId = projectIdFor(agent)
    if (!projectId) return undefined
    return { visibility, projectId, profileId: 'local' }
  }
  return { visibility: 'session-private', ownerSessionId: agent.session.header.id, profileId: 'local' }
}

function emptyDatabase() { return { schemaVersion: MEMORY_SCHEMA_VERSION, revision: 0, namespaceEpoch: 0, records: [], tombstones: [] } }

function normalizeDatabase(raw) {
  if (!raw || raw.schemaVersion !== MEMORY_SCHEMA_VERSION || !Array.isArray(raw.records) || !Array.isArray(raw.tombstones) || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || raw.records.some(record => !record || typeof record.id !== 'string' || !VALID_VISIBILITY.has(record.visibility) || !VALID_STATUS.has(record.status))) throw Object.assign(new Error('Memory database is invalid; original file retained. Restore memory.json.bak after inspection.'), { code: 'MEMORY_DATABASE_INVALID' })
  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    revision: Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    namespaceEpoch: Number.isSafeInteger(raw.namespaceEpoch) && raw.namespaceEpoch >= 0 ? raw.namespaceEpoch : 0,
    records: raw.records,
    tombstones: raw.tombstones.filter(item => item && typeof item.id === 'string'),
  }
}

async function loadDatabase(path = memoryPath()) {
  try { return normalizeDatabase(JSON.parse(await readFile(path, 'utf8'))) } catch (error) {
    if (error.code === 'ENOENT') return emptyDatabase()
    throw Object.assign(new Error('Memory could not be read; file retained. Inspect memory.json and memory.json.bak.', { cause: error }), { code: error.code === 'EACCES' ? 'MEMORY_READ_DENIED' : 'MEMORY_DATABASE_INVALID' })
  }
}

async function writeDatabase(database, path, check) {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(database, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    check()
    await rename(temporary, path)
  } finally { await rm(temporary, { force: true }) }
}

function enqueue(agent, work, signal) {
  const path = memoryPath()
  const ctx = agent.ctx, session = agent.session, id = session.header.id, cwd = session.header.cwd, epoch = epochs.get(ctx) ?? 0
  const check = () => {
    if (!isPatchworkAgent(agent) || agent.ctx !== ctx || agent.session !== session || session.header.id !== id || session.header.cwd !== cwd || (epochs.get(ctx) ?? 0) !== epoch || agent.signal?.aborted || signal?.aborted) throw Object.assign(new Error('Memory scope changed or operation cancelled'), { code: 'MEMORY_SCOPE_REVOKED' })
  }
  const transaction = async () => {
    let release
    try {
      check()
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      release = await acquireFileLease(`${path}.lock`, { check })
      check()
      const database = await loadDatabase(path)
      check()
      const result = await work(database)
      if (result.status === 'committed') {
        // Backup only a validated previous version, never a corrupt input.
        const old = await readFile(path, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return undefined })
        check()
        if (old !== undefined) await writeDatabase(JSON.parse(old), `${path}.bak`, check)
        await writeDatabase(database, path, check)
        states.set(path, { database })
      }
      return result
    } catch (error) { if (['MEMORY_DATABASE_INVALID', 'MEMORY_READ_DENIED'].includes(error.code)) states.set(path, { error: error.code }); return operation('failed', { failureCode: error.code || 'MEMORY_IO_FAILED' }) }
    finally { await release?.() }
  }
  const previous = queues.get(path) ?? Promise.resolve()
  const next = previous.then(transaction, transaction)
  queues.set(path, next.catch(() => {}))
  return next
}

function readScope(record, agent, includeProject = false) {
  if (record.visibility === 'session-private') return record.ownerSessionId === agent.session.header.id
  return includeProject && record.projectId === projectIdFor(agent)
}

function cleanRecord(record, { includeValue = true } = {}) {
  const clean = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined))
  if (!includeValue) delete clean.value
  if (typeof clean.value === 'string') clean.value = clean.value.slice(0, MAX_VALUE_CHARS)
  return clean
}

function operation(status, extra = {}) {
  return { schemaVersion: 1, operationId: `memop_${randomUUID().replaceAll('-', '').slice(0, 24)}`, status, ...extra }
}

export function memoryNamespace(agent, visibility = 'session-private') {
  if (!isPatchworkAgent(agent) || !agent?.session?.header?.id) return undefined
  return namespaceFor(agent, visibility)
}

function prepareRecord(agent, input, sourceKind) {
  const visibility = input.visibility ?? 'session-private'
  const key = typeof input.key === 'string' ? input.key.trim() : ''
  const value = typeof input.value === 'string' ? input.value.trim() : ''
  if (!VALID_VISIBILITY.has(visibility) || !key || key.length > MAX_KEY_CHARS || !value || value.length > MAX_VALUE_CHARS || input.conditions !== undefined && (typeof input.conditions !== 'string' || input.conditions.length > 512) || input.kind !== undefined && (typeof input.kind !== 'string' || !input.kind.trim() || input.kind.length > 64)) return { failureCode: 'MEMORY_INVALID_RECORD' }
  if ([key, value, input.conditions ?? '', input.kind ?? ''].some(likelySecret)) return { failureCode: 'MEMORY_SENSITIVE_VALUE' }
  const namespace = namespaceFor(agent, visibility)
  if (!namespace) return { failureCode: 'MEMORY_PROJECT_UNKNOWN' }
  const id = `mem_${randomUUID().replaceAll('-', '').slice(0, 24)}`
  return { id, lineageId: id, contentVersion: 1, schemaVersion: MEMORY_SCHEMA_VERSION, namespace: visibility === 'project-shared' ? `project:${namespace.projectId}` : `session:${namespace.ownerSessionId}`, visibility, ownerSessionId: namespace.ownerSessionId, projectId: namespace.projectId, kind: input.kind?.trim() || 'fact', key, value, conditions: input.conditions || '', status: 'proposed', validity: 'unsupported', sources: [{ kind: sourceKind, sessionId: agent.session.header.id }], observedAt: new Date().toISOString(), ingestedAt: new Date().toISOString(), sensitivity: 'ordinary' }
}

function change(record, action, revision, agent, extra = {}) {
  record.revision = revision; record.updatedAt = new Date().toISOString()
  record.changes = [...record.changes ?? [], { action, revision, at: record.updatedAt, sessionId: agent.session.header.id, ...extra }].slice(-20)
}

export async function proposeMemory(agent, input = {}, { signal, expectedRevision, sourceKind = 'model-proposed' } = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  const record = prepareRecord(agent, input, sourceKind)
  if (record.failureCode) return operation('failed', record)
  return enqueue(agent, async database => {
    if (expectedRevision !== undefined && expectedRevision !== database.revision) return operation('failed', { failureCode: 'MEMORY_REVISION_CONFLICT', revision: database.revision })
    if (database.records.filter(item => item.namespace === record.namespace && item.status !== 'revoked').length >= MEMORY_LIMIT) return operation('failed', { failureCode: 'MEMORY_NAMESPACE_QUOTA' })
    database.revision += 1
    change(record, 'proposed', database.revision, agent)
    database.records.push(record)
    return operation('committed', { recordId: record.id, revision: database.revision, visibility: record.visibility, indexed: false, record: cleanRecord(record) })
  }, signal)
}

export async function reviseMemory(agent, id, input, expectedRevision, { signal, userConfirmed = false } = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  if (!userConfirmed) return operation('failed', { failureCode: 'MEMORY_USER_CONFIRMATION_REQUIRED' })
  if (!input || typeof input !== 'object' || Array.isArray(input)) return operation('failed', { failureCode: 'MEMORY_INVALID_RECORD' })
  return enqueue(agent, async database => {
    if (expectedRevision !== database.revision) return operation('failed', { failureCode: 'MEMORY_REVISION_CONFLICT', revision: database.revision })
    const previous = database.records.find(item => item.id === id && readScope(item, agent, true) && ['active', 'proposed'].includes(item.status))
    if (!previous) return operation('failed', { failureCode: 'MEMORY_NOT_FOUND' })
    if (input.visibility !== undefined && input.visibility !== previous.visibility) return operation('failed', { failureCode: 'MEMORY_SCOPE_CHANGE_REQUIRES_COPY' })
    const record = prepareRecord(agent, { key: previous.key, value: previous.value, kind: previous.kind, conditions: previous.conditions, ...input, visibility: previous.visibility }, 'user-revised')
    if (record.failureCode) return operation('failed', record)
    if (database.records.filter(item => item.namespace === record.namespace && item.status !== 'revoked').length >= MEMORY_LIMIT) return operation('failed', { failureCode: 'MEMORY_NAMESPACE_QUOTA' })
    Object.assign(record, { lineageId: previous.lineageId ?? previous.id, contentVersion: (previous.contentVersion ?? 1) + 1, replacesId: previous.id, replacesRevision: previous.revision, sources: [...previous.sources ?? [], ...record.sources].slice(-20) })
    database.revision += 1; change(record, 'revised-proposal', database.revision, agent)
    database.records.push(record)
    return operation('committed', { recordId: record.id, revision: database.revision, record: cleanRecord(record) })
  }, signal)
}

export async function confirmMemory(agent, id, expectedRevision, { userConfirmed = false, validity = 'fresh', signal } = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  if (userConfirmed !== true) return operation('failed', { failureCode: 'MEMORY_USER_CONFIRMATION_REQUIRED' })
  if (!VALID_VALIDITY.has(validity) || validity === 'unsupported') return operation('failed', { failureCode: 'MEMORY_INVALID_VALIDITY' })
  return enqueue(agent, async database => {
    const record = database.records.find(item => item.id === id && readScope(item, agent, true) && item.status === 'proposed')
    if (!record) return operation('failed', { failureCode: 'MEMORY_NOT_FOUND' })
    if (expectedRevision !== undefined && expectedRevision !== database.revision) return operation('failed', { failureCode: 'MEMORY_REVISION_CONFLICT', revision: database.revision })
    const base = record.replacesId && database.records.find(item => item.id === record.replacesId && item.namespace === record.namespace && readScope(item, agent, true))
    if (record.replacesId && (!base || base.revision !== record.replacesRevision || !['active', 'proposed'].includes(base.status))) return operation('failed', { failureCode: 'MEMORY_BASE_CHANGED' })
    database.records.filter(item => (item.status === 'active' && item.namespace === record.namespace && item.key === record.key || item === base) && readScope(item, agent, true)).forEach(item => { item.status = 'superseded'; change(item, 'superseded', database.revision + 1, agent, { replacedBy: record.id }) })
    database.revision += 1
    record.status = 'active'; record.validity = validity; record.verifiedAt = new Date().toISOString(); record.revision = database.revision
    change(record, 'confirmed', database.revision, agent)
    return operation('committed', { recordId: record.id, revision: database.revision, visibility: record.visibility, indexed: false, record: cleanRecord(record) })
  }, signal)
}

export async function forgetMemory(agent, id, expectedRevision, { userConfirmed = false, signal } = {}) {
  return forgetMemories(agent, [id], expectedRevision, { userConfirmed, signal })
}

export async function forgetMemories(agent, ids, expectedRevision, { userConfirmed = false, signal } = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  if (userConfirmed !== true) return operation('failed', { failureCode: 'MEMORY_USER_CONFIRMATION_REQUIRED' })
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) return operation('failed', { failureCode: 'MEMORY_INVALID_SELECTION' })
  return enqueue(agent, async database => {
    const records = ids.map(id => database.records.find(item => item.id === id && readScope(item, agent, true) && item.status !== 'revoked'))
    if (records.some(item => !item)) return operation('failed', { failureCode: 'MEMORY_NOT_FOUND' })
    if (expectedRevision !== undefined && expectedRevision !== database.revision) return operation('failed', { failureCode: 'MEMORY_REVISION_CONFLICT', revision: database.revision })
    database.revision += 1; database.namespaceEpoch += 1
    for (const record of records) {
      record.status = 'revoked'; record.validity = 'expired'; change(record, 'forgotten', database.revision, agent)
      database.tombstones.push({ id: record.id, key: record.key, visibility: record.visibility, namespaceEpoch: database.namespaceEpoch, revokedAt: new Date().toISOString() })
    }
    return operation('committed', { recordId: records[0].id, revision: database.revision, namespaceEpoch: database.namespaceEpoch, visibility: records[0].visibility, indexed: false })
  }, signal)
}

export async function setMemoryValidity(agent, id, expectedRevision, validity, { userConfirmed = false, signal } = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  if (!userConfirmed) return operation('failed', { failureCode: 'MEMORY_USER_CONFIRMATION_REQUIRED' })
  if (!VALID_VALIDITY.has(validity) || validity === 'unsupported') return operation('failed', { failureCode: 'MEMORY_INVALID_VALIDITY' })
  return enqueue(agent, async database => {
    if (expectedRevision !== database.revision) return operation('failed', { failureCode: 'MEMORY_REVISION_CONFLICT', revision: database.revision })
    const record = database.records.find(item => item.id === id && readScope(item, agent, true) && item.status === 'active')
    if (!record) return operation('failed', { failureCode: 'MEMORY_NOT_FOUND' })
    if (record.validity === validity) return operation('unchanged', { revision: database.revision })
    const previousValidity = record.validity
    database.revision += 1; record.validity = validity
    if (validity === 'fresh') record.verifiedAt = new Date().toISOString()
    change(record, 'validity-changed', database.revision, agent, { previousValidity, validity })
    return operation('committed', { recordId: id, revision: database.revision, record: cleanRecord(record) })
  }, signal)
}

export async function listMemory(agent, { query = '', scope = 'session-private', status = 'all', validity = 'all', offset = 0, limit = 20, id, includeValue = false, signal } = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'MEMORY_SCOPE_REQUIRED' }
  if (!['all', ...VALID_VISIBILITY].includes(scope) || !['all', ...VALID_STATUS].includes(status) || !['all', ...VALID_VALIDITY].includes(validity) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || typeof query !== 'string' || query.length > 256) return { status: 'failed', failureCode: 'MEMORY_INVALID_QUERY' }
  const session = agent.session, ctx = agent.ctx, sessionId = session.header.id, cwd = session.header.cwd, epoch = epochs.get(ctx) ?? 0
  let database
  try { database = await loadDatabase() } catch (error) { states.set(memoryPath(), { error: error.code }); return { status: 'failed', failureCode: error.code, entries: [], revision: null } }
  if (!isPatchworkAgent(agent) || agent.session !== session || agent.ctx !== ctx || session.header.id !== sessionId || session.header.cwd !== cwd || (epochs.get(ctx) ?? 0) !== epoch || signal?.aborted) return { status: 'failed', failureCode: 'MEMORY_SCOPE_REVOKED' }
  states.set(memoryPath(), { database })
  const visible = database.records.filter(record => readScope(record, agent, scope !== 'session-private') && (scope === 'all' || record.visibility === scope))
  const needle = query.trim().toLowerCase()
  const matches = visible.filter(record => (status === 'all' || record.status === status) && (validity === 'all' || record.validity === validity) && (!needle || `${record.key} ${includeValue ? record.value : ''} ${record.conditions} ${record.kind}`.toLowerCase().includes(needle)))
  const ordered = [...matches].sort((a, b) => b.revision - a.revision || b.id.localeCompare(a.id))
  const counts = Object.fromEntries([...VALID_STATUS].map(status => [status, visible.filter(record => record.status === status).length]))
  const quotas = ['session-private', 'project-shared'].filter(visibility => scope === 'all' || scope === visibility).map(visibility => ({ visibility, used: visible.filter(record => record.visibility === visibility && record.status !== 'revoked').length, limit: MEMORY_LIMIT }))
  const impact = record => record.status === 'proposed' ? { activationImpact: visible.filter(item => item.namespace === record.namespace && (item.status === 'active' && item.key === record.key || item.id === record.replacesId && ['active', 'proposed'].includes(item.status))).map(item => ({ id: item.id, key: item.key, contentVersion: item.contentVersion ?? 1, status: item.status })) } : {}
  const result = { status: 'indexed', revision: database.revision, namespaceEpoch: database.namespaceEpoch, automaticInjection: 'disabled', entryCount: matches.length, visibleCount: visible.length, offset, limit, hasMore: offset + limit < ordered.length, counts, quotas, entries: ordered.slice(offset, offset + limit).map(record => ({ ...cleanRecord(record, { includeValue }), ...impact(record) })) }
  if (id) {
    const record = visible.find(record => record.id === id)
    if (!record) return { status: 'failed', failureCode: 'MEMORY_NOT_FOUND' }
    result.record = { ...cleanRecord(record), ...impact(record) }
    const history = visible.filter(item => item.namespace === record.namespace && (item.lineageId && item.lineageId === record.lineageId || item.id === record.replacesId || item.id === record.id || item.key === record.key)).sort((a, b) => b.revision - a.revision || b.id.localeCompare(a.id))
    result.history = history.slice(0, 50).map(item => cleanRecord(item, { includeValue: false }))
    result.historyHasMore = history.length > result.history.length
  }
  return result
}

export async function recallMemory(agent, { query = '', includeProject = false, limit = 5 } = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'MEMORY_SCOPE_REQUIRED', entries: [] }
  const normalized = String(query).trim().toLowerCase()
  const boundedLimit = Math.max(1, Math.min(currentPolicy(agent).recallLimit, Math.trunc(Number(limit) || 5)))
  const database = await loadDatabase()
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'MEMORY_SCOPE_REVOKED', entries: [] }
  states.set(memoryPath(), { database })
  const entries = database.records.filter(record => record.status === 'active' && record.validity === 'fresh' && readScope(record, agent, includeProject) && (!normalized || `${record.key} ${record.value} ${record.conditions}`.toLowerCase().includes(normalized))).slice(-boundedLimit).map(record => cleanRecord(record))
  return { status: 'indexed', revision: database.revision, entries, includeProject }
}

export function memorySnapshot(agent, { includeValue = true, includeProject = true } = {}) {
  if (!isPatchworkAgent(agent)) return null
  const path = memoryPath()
  const state = states.get(path)
  if (state?.error) return { schemaVersion: 1, persistence: 'failed', failureCode: state.error, automaticInjection: 'disabled', recovery: 'Inspect memory.json; memory.json.bak contains the last validated version. Restore only after stopping writers.', revision: null, entries: [] }
  const database = state?.database ?? emptyDatabase()
  const visible = database.records.filter(record => readScope(record, agent, includeProject))
  const entries = visible.slice(-MEMORY_LIMIT).map(record => cleanRecord(record, { includeValue }))
  return { schemaVersion: 1, persistence: 'file', automaticInjection: 'disabled', namespaceEpoch: database.namespaceEpoch, revision: database.revision, entryCount: visible.length, hasMore: visible.length > entries.length, entries }
}

export async function loadMemoryState() {
  const path = memoryPath()
  let database
  try { database = await loadDatabase(path) }
  catch (error) { states.set(path, { error: error.code }); throw error }
  states.set(path, { database })
  return database
}

export async function refreshMemoryState() { return loadMemoryState() }
