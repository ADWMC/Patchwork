import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rename, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { SETTING_FIELDS, validateSettings } from './fields.mjs'

/**
 * 用户在侧边栏里改的那部分配置。
 *
 * 与 profile 里的部署默认值（插件行 config）合并，**用户值优先**。放在插件自己的
 * 目录下而不是去改 profile 的 YAML：写 YAML 需要手工拼接、出错会毁掉用户的 profile，
 * 而这里只写我们自己的一个 JSON 文件。
 */
export const BOOLEAN_KEYS = SETTING_FIELDS.filter(field => field.type === 'boolean').map(field => field.key)
export const NUMBER_KEYS = SETTING_FIELDS.filter(field => ['integer', 'number'].includes(field.type)).map(field => field.key)
export const WRITABLE_KEYS = SETTING_FIELDS.map(field => field.key)

export function userConfigPath() {
  return dshHomePath('patchwork', 'config.json')
}

/** 同步读：注入发生在 index 渲染路径上，那里只能是同步的。 */
export function readUserConfig() {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(userConfigPath(), 'utf8'))
  } catch {
    return {}
  }
  // Legacy browser settings belong to the separately installed browser package.
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsed = Object.fromEntries(Object.entries(parsed).filter(([key]) => !key.startsWith('browser')))
  const validated = validatePatch(parsed)
  return validated.ok ? validated.value : {}
}

export function effectiveConfig(rowConfig = {}, userConfig = readUserConfig()) {
  return { ...rowConfig, ...userConfig }
}

/**
 * 校验一次写入。未知键与非法类型一律拒绝：一个拼错的键被静默接受，就等于让用户
 * 以为改了、实际没改。
 */
export function validatePatch(raw) {
  return validateSettings(raw)
}

/**
 * 把一次改动并入用户配置并落盘。
 *
 * 只替换这次提交的键，其余键保留——侧边栏保存一个开关不应该把别的设置清掉。
 * 先写临时文件再改名，避免写到一半断电留下半个 JSON。
 */
export function configRevision(config = readUserConfig()) {
  const ordered = Object.fromEntries(Object.entries(config).sort(([a], [b]) => a.localeCompare(b)))
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex').slice(0, 16)
}

let writeQueue = Promise.resolve()

export function mergeUserConfigState(patch, expectedRevision, authorize) {
  const work = writeQueue.then(() => writeConfig(patch, expectedRevision, authorize))
  writeQueue = work.catch(() => {})
  return work
}

export async function mergeUserConfig(patch) {
  return (await mergeUserConfigState(patch)).config
}

async function writeConfig(patch, expectedRevision, authorize) {
  const assertAuthorized = () => {
    if (authorize && !authorize()) {
      const error = new Error('patchwork-agent-required')
      error.code = 'patchwork-agent-required'
      throw error
    }
  }
  assertAuthorized()
  const current = readUserConfig()
  if (expectedRevision !== undefined && expectedRevision !== configRevision(current)) {
    const error = new Error('revision-conflict')
    error.code = 'revision-conflict'
    throw error
  }
  const next = { ...current, ...patch }
  const path = userConfigPath()
  await mkdir(join(path, '..'), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    assertAuthorized()
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
  return { config: next, revision: configRevision(next) }
}
