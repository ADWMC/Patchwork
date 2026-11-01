// Called in a separate process so Playwright resolves only the selected cache.
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import { componentSpec, DRIVER_VERSION } from '../src/browser/components/catalog.mjs'
const [id, directory] = process.argv.slice(2)
const spec = componentSpec(id)
if (!spec.playwright || !directory) throw new Error('Invalid browser component worker arguments')
process.env.PLAYWRIGHT_BROWSERS_PATH = join(directory, 'cache')
const require = createRequire(import.meta.url)
if (require('playwright-core/package.json').version !== DRIVER_VERSION) throw new Error('Playwright driver version differs from the component catalog')
// This registry namespace is inspected/tested against the exact pinned driver;
// a driver upgrade must explicitly update and revalidate this adapter.
const { registry } = require('playwright-core/lib/coreBundle').registry
const executable = registry.findExecutable(spec.playwright)
if (!executable?.executablePath()) throw new Error('Official installer does not support this platform')
console.log(JSON.stringify({ executable: relative(directory, executable.executablePath()).replaceAll('\\', '/'), revision: executable.revision, urls: executable.downloadURLs }))
