import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const patchworkEntry = pathToFileURL(join(here, '..', '..', 'src', 'index.mjs')).href

/** 组合里必须挂载的宿主包。缺失时调用方应跳过测试而不是失败。 */
const REQUIRED_HOST_PACKAGES = [
  '@deepseek-ai/dsh-app-boot',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-commands',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-fs-local',
  '@deepseek-ai/dsh-tool-fs',
  '@deepseek-ai/dsh-pwsh-local',
  '@deepseek-ai/dsh-tool-pwsh',
  '@deepseek-ai/dsh-subprocess-local',
  '@deepseek-ai/dsh-shell-env',
]

export function hostAvailable() {
  try {
    for (const name of REQUIRED_HOST_PACKAGES) import.meta.resolve(name)
    return true
  } catch {
    return false
  }
}

/**
 * 用真实 Cordis Loader 启动一个 test-only `cordis.yml`：真实的服务注册、
 * 真实的 entry 并行挂载与生命周期、真实的 `dsh-tool-fs` 工具面。
 *
 * Loader 的 entry 是并发挂载的，所以插件在 `apply` 期间看不到兄弟 entry 的
 * 注册；必须等 boot 返回（settle）之后再创建 agent 并断言。
 */
export async function bootPatchwork(
  pluginConfig = {},
  { driverFile = 'agent-driver.mjs', extraRows = [], pluginEntry = patchworkEntry } = {},
) {
  const work = await mkdtemp(join(tmpdir(), 'patchwork-compose-'))
  const configPath = join(work, 'cordis.yml')
  const rows = [
    ['system-prompt', import.meta.resolve('@deepseek-ai/dsh-system-prompt')],
    ['commands', import.meta.resolve('@deepseek-ai/dsh-commands')],
    ['tools', import.meta.resolve('@deepseek-ai/dsh-tools')],
    ['fs', import.meta.resolve('@deepseek-ai/dsh-fs-local')],
    ['tool-fs', import.meta.resolve('@deepseek-ai/dsh-tool-fs')],
    ['subprocess', import.meta.resolve('@deepseek-ai/dsh-subprocess-local')],
    ['shell-env', import.meta.resolve('@deepseek-ai/dsh-shell-env')],
    ['shell', import.meta.resolve('@deepseek-ai/dsh-pwsh-local')],
    ['tool-pwsh', import.meta.resolve('@deepseek-ai/dsh-tool-pwsh')],
    ...extraRows,
    ['patchwork', pluginEntry],
    ['driver', pathToFileURL(join(here, driverFile)).href],
  ]

  const yml = rows
    .flatMap(([id, name]) => {
      const head = [`- id: ${id}`, `  name: '${name}'`]
      if (id !== 'patchwork') return head
      const entries = Object.entries(pluginConfig)
      if (!entries.length) return head
      return [...head, '  config:', ...entries.map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`)]
    })
    .join('\n')

  await writeFile(configPath, `${yml}\n`)

  const { boot } = await import('@deepseek-ai/dsh-app-boot')
  const ctx = await boot('patchwork-compose', configPath)

  return {
    ctx,
    configPath,
    async dispose() {
      await ctx.fiber?.dispose?.()
      await rm(work, { recursive: true, force: true })
    },
  }
}

/** 把驱动插件模块按 Loader 用的同一个 URL 导入，以取得同一个模块实例。 */
export async function loadDriver(driverFile = 'agent-driver.mjs') {
  return import(pathToFileURL(join(here, driverFile)).href)
}
