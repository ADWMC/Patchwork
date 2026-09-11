import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 只构建**浏览器半边**。Node 半边保持零构建，直接跑 `src/`。
 *
 * 产物必须是模块加载器载荷（`window.__ModuleLoader__.load({ id, factory })`），
 * 所以这里用 esbuild 打成 CJS 再套一层包装：宿主侧已有的共享依赖
 * （react / react-dom / @deepseek-ai/*）保持外置，由加载器的 `require` 提供。
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const outFile = join(root, 'lib', 'client.js')

const result = await build({
  entryPoints: [join(root, 'src', 'client', 'index.jsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/*'],
  write: false,
  logLevel: 'warning',
})

const code = result.outputFiles[0].text
const wrapped = [
  '// 由 scripts/build-client.mjs 生成，请勿手改。',
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkg.name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  code,
  '\t\treturn module.exports;',
  '\t},',
  '});',
  '',
].join('\n')

await mkdir(dirname(outFile), { recursive: true })

// `--check`：不写文件，只回答「提交的产物是否与源码一致」。
// 浏览器半边是提交进仓库的构建产物，没有这道门就会悄悄落后于源码。
if (process.argv.includes('--check')) {
  const current = await readFile(outFile, 'utf8').catch(() => undefined)
  if (current === wrapped) {
    console.log(`client bundle is up to date (${Buffer.byteLength(wrapped)} bytes)`)
    process.exit(0)
  }
  console.error('client bundle is STALE: run `node scripts/build-client.mjs`')
  process.exit(1)
}

await writeFile(outFile, wrapped, 'utf8')
console.log(`built ${outFile} (${Buffer.byteLength(wrapped)} bytes)`)
