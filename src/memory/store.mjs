import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { isPatchworkAgent } from '../scope.mjs'

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

function memoryPath() { return process.env.DSH_HOME ? join(process.env.DSH_HOME, 'patchwork', 'memory.json') : dshHomePath('patchwork', 'memory.json') }

function bounded(value, max) { return typeof value === 'string' ? value.slice(0, max) : undefined }

function fingerprint(value) { return createHash('sha256').update(String(value)).digest('hex') }

function likelySecret(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return /(?:api[_-]?key|access[_-]?token|secret|password|authorization|bearer)\s*[:=]/i.test(text) || /-----BEGIN [A-Z ]+ KEY-----/.test(text)
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
  if (!raw || raw.schemaVersion !== MEMORY_SCHEMA_VERSION || !Array.isArray(raw.records) || !Array.isArray(raw.tombstones)) return emptyDatabase()
  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    revision: Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    namespaceEpoch: Number.isSafeInteger(raw.namespaceEpoch) && raw.namespaceEpoch >= 0 ? raw.namespaceEpoch : 0,
    records: raw.records.filter(record => record && typeof record.id === 'string' && VALID_VISIBILITY.has(record.visibility) && VALID_STATUS.has(record.status)).slice(-MEMORY_LIMIT),
    tombstones: raw.tombstones.filter(item => item && typeof item.id === 'string').slice(-MEMORY_LIMIT),
  }
}

async function loadDatabase() {
  try { return normalizeDatabase(JSON.parse(await readFile(memoryPath(), 'utf8'))) } catch { return emptyDatabase() }
}

async function acquireLock(path) {
  const lock = `${path}.lock`
  const started = Date.now()
  while (true) {
    try { await mkdir(lock); return lock } catch (error) {
      if (Date.now() - started > 2000) { error.code = 'MEMORY_LOCK_TIMEOUT'; throw error }
      await new Promise(resolve => setTimeout(resolve, 12))
    }
  }
}

async function writeDatabase(database) {
  const path = memoryPath()
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const lock = await acquireLock(path)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(database, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  } finally { await rm(temporary, { force: true }); await rm(lock, { recursive: true, force: true }) }
}

function enqueue(work) {
  const path = memoryPath()
  const previous = queues.get(path) ?? Promise.resolve()
  const next = previous.then(work, work)
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

export async function proposeMemory(agent, input = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  const visibility = VALID_VISIBILITY.has(input.visibility) ? input.visibility : 'session-private'
  const key = bounded(String(input.key ?? '').trim(), MAX_KEY_CHARS)
  const value = typeof input.value === 'string' ? input.value.trim() : ''
  if (!key || !value || value.length > MAX_VALUE_CHARS) return operation('failed', { failureCode: 'MEMORY_INVALID_RECORD' })
  if (likelySecret(value)) return operation('failed', { failureCode: 'MEMORY_SENSITIVE_VALUE' })
  const namespace = namespaceFor(agent, visibility)
  if (!namespace) return operation('failed', { failureCode: 'MEMORY_PROJECT_UNKNOWN' })
  return enqueue(async () => {
    const database = await loadDatabase()
    const record = {
      id: `mem_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      schemaVersion: MEMORY_SCHEMA_VERSION, namespace: visibility === 'project-shared' ? `project:${namespace.projectId}` : `session:${namespace.ownerSessionId}`,
      visibility, ownerSessionId: namespace.ownerSessionId, projectId: namespace.projectId,
      kind: bounded(input.kind || 'fact', 64), key, value, conditions: bounded(input.conditions || '', 512),
      status: 'proposed', validity: 'unsupported', revision: database.revision + 1,
      sources: [{ kind: 'model-proposed', sessionId: agent.session.header.id }], observedAt: new Date().toISOString(), ingestedAt: new Date().toISOString(),
      sensitivity: 'ordinary',
    }
    database.revision += 1
    database.records.push(record)
    database.records = database.records.slice(-MEMORY_LIMIT)
    await writeDatabase(database)
    states.set(memoryPath(), { database })
    return operation('committed', { recordId: record.id, revision: database.revision, visibility, indexed: false, record: cleanRecord(record) })
  })
}

export async function confirmMemory(agent, id, expectedRevision, { userConfirmed = false, validity = 'fresh' } = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  if (userConfirmed !== true) return operation('failed', { failureCode: 'MEMORY_USER_CONFIRMATION_REQUIRED' })
  if (!VALID_VALIDITY.has(validity) || validity === 'unsupported') return operation('failed', { failureCode: 'MEMORY_INVALID_VALIDITY' })
  return enqueue(async () => {
    const database = await loadDatabase()
    const record = database.records.find(item => item.id === id && readScope(item, agent, true) && item.status === 'proposed')
    if (!record) return operation('failed', { failureCode: 'MEMORY_NOT_FOUND' })
    if (expectedRevision !== undefined && expectedRevision !== database.revision) return operation('failed', { failureCode: 'MEMORY_REVISION_CONFLICT', revision: database.revision })
    database.records.filter(item => item.status === 'active' && item.visibility === record.visibility && item.key === record.key && readScope(item, agent, true)).forEach(item => { item.status = 'superseded'; item.revision = database.revision + 1 })
    database.revision += 1
    record.status = 'active'; record.validity = validity; record.verifiedAt = new Date().toISOString(); record.revision = database.revision
    await writeDatabase(database)
    states.set(memoryPath(), { database })
    return operation('committed', { recordId: record.id, revision: database.revision, visibility: record.visibility, indexed: false, record: cleanRecord(record) })
  })
}

export async function forgetMemory(agent, id, expectedRevision, { userConfirmed = false } = {}) {
  if (!isPatchworkAgent(agent)) return operation('failed', { failureCode: 'MEMORY_SCOPE_REQUIRED' })
  if (userConfirmed !== true) return operation('failed', { failureCode: 'MEMORY_USER_CONFIRMATION_REQUIRED' })
  return enqueue(async () => {
    const database = await loadDatabase()
    const record = database.records.find(item => item.id === id && readScope(item, agent, true) && item.status !== 'revoked')
    if (!record) return operation('failed', { failureCode: 'MEMORY_NOT_FOUND' })
    if (expectedRevision !== undefined && expectedRevision !== database.revision) return operation('failed', { failureCode: 'MEMORY_REVISION_CONFLICT', revision: database.revision })
    database.revision += 1; database.namespaceEpoch += 1
    record.status = 'revoked'; record.validity = 'expired'; record.revision = database.revision
    database.tombstones.push({ id: record.id, key: record.key, visibility: record.visibility, namespaceEpoch: database.namespaceEpoch, revokedAt: new Date().toISOString() })
    await writeDatabase(database)
    states.set(memoryPath(), { database })
    return operation('committed', { recordId: record.id, revision: database.revision, namespaceEpoch: database.namespaceEpoch, visibility: record.visibility, indexed: false })
  })
}

export async function recallMemory(agent, { query = '', includeProject = false, limit = 5 } = {}) {
  if (!isPatchworkAgent(agent)) return { status: 'failed', failureCode: 'MEMORY_SCOPE_REQUIRED', entries: [] }
  const normalized = String(query).trim().toLowerCase()
  const boundedLimit = Math.max(1, Math.min(5, Math.trunc(Number(limit) || 5)))
  const database = await loadDatabase()
  states.set(memoryPath(), { database })
  const entries = database.records.filter(record => record.status === 'active' && record.validity === 'fresh' && readScope(record, agent, includeProject) && (!normalized || `${record.key} ${record.value} ${record.conditions}`.toLowerCase().includes(normalized))).slice(-boundedLimit).map(record => cleanRecord(record))
  return { status: 'indexed', revision: database.revision, entries, includeProject }
}

export function memorySnapshot(agent) {
  if (!isPatchworkAgent(agent)) return null
  const path = memoryPath()
  const state = states.get(path)
  const database = state?.database ?? emptyDatabase()
  const entries = database.records.filter(record => readScope(record, agent, true)).slice(-MEMORY_LIMIT).map(record => cleanRecord(record))
  return { schemaVersion: 1, persistence: 'file', automaticInjection: 'disabled', namespaceEpoch: database.namespaceEpoch, revision: database.revision, entries }
}

export async function loadMemoryState() {
  const path = memoryPath()
  const database = await loadDatabase()
  states.set(path, { database })
  return database
}

export async function refreshMemoryState() { return loadMemoryState() }
