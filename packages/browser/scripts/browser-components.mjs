#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { isAbsolute, join } from 'node:path'
import { ComponentInstaller } from '../src/browser/components/installer.mjs'
import { safeBrowserError } from '../src/browser/policy.mjs'

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { home: { type: 'string' }, proxy: { type: 'string' }, offline: { type: 'boolean' }, replace: { type: 'boolean' }, refresh: { type: 'boolean' }, help: { type: 'boolean' } } })
  if (values.help || !positionals.length) {
    console.log('Usage: patchwork-browser-components <plan|list|download|install|verify|rollback|remove|clean-cache> [chromium|recorder|camoufox|aliasmode] --home ABS_DSH_HOME [--proxy HTTP_PROXY] [--offline] [--replace] [--refresh]\nDownload prepares a verified component without activating it. Install downloads when needed; --offline uses only the prepared download. No implicit main DSH home or system browser installation.')
  } else {
    const [command, id, ...extra] = positionals, home = values.home ?? process.env.DSH_HOME
    if (!['plan', 'list', 'download', 'install', 'verify', 'rollback', 'remove', 'clean-cache'].includes(command) || extra.length || command === 'list' && id || command !== 'list' && !id) throw new Error('Invalid component command; use --help')
    if (!home || !isAbsolute(home)) throw new Error('Specify an absolute --home or explicit DSH_HOME; no default main home is selected')
    if (values.offline && command !== 'install' || values.replace && command !== 'install' || values.refresh && command !== 'download') throw new Error('Use --offline/--replace with install, and --refresh with download')
    const controller = new AbortController(), cancel = () => controller.abort(new Error('Component operation cancelled'))
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel)
    const installer = new ComponentInstaller(join(home, 'patchwork/browser'), { signal: controller.signal, proxy: values.proxy ?? process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy, onProgress: event => process.stderr.write(JSON.stringify(event) + '\n') })
    try {
      let result
      if (command === 'list') result = await installer.list()
      else if (command === 'clean-cache') result = await installer.cleanCache(id)
      else result = await installer[command](id, values)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) { process.stderr.write(safeBrowserError(error) + '\n'); process.exitCode = 1 }
    finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel) }
  }
}
await main().catch(error => { process.stderr.write(safeBrowserError(error) + '\n'); process.exitCode = 1 })
