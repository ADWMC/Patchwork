import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const cli = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(path => path && /(?:^|[\\/])npm-cli\.js$/i.test(path) && existsSync(path))
if (!cli) throw new Error('npm CLI not found')
const result = spawnSync(process.execPath, [cli, 'pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000 })
if (result.status !== 0) throw new Error(result.stderr || 'Browser package preflight failed')
const [pack] = JSON.parse(result.stdout)
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const names = new Set(pack.files.map(file => file.path))
const required = ['LICENSE', 'README.md', 'CHANGELOG.md', 'src/index.mjs', 'src/scope.mjs', 'src/skill.mjs', 'src/browser/session.mjs', 'src/browser/tool.mjs', 'src/browser/locator.mjs', 'src/browser/annotations.mjs', 'src/client/index.jsx', 'src/client/BrowserAnnotations.jsx', 'src/client/annotation-send.mjs', 'lib/client.js', 'assets/skills/browser-workspace/SKILL.md', 'assets/skills/browser-workspace/references/gui-verification.md', 'assets/skills/browser-workspace/references/operations.md', 'docs/experience-design-2026-11-01.md', 'docs/checks/experience-2026-11-01.json', 'scripts/browser-components.mjs', 'scripts/browser-component-worker.mjs', 'cordis.patch.yml']
const missing = required.filter(file => !names.has(file))
if (!names.has('src/client/element-inspector.mjs')) missing.push('src/client/element-inspector.mjs')
if (!names.has('src/client/controls.jsx')) missing.push('src/client/controls.jsx')
for (const path of ['src/client/BrowserEnvironments.jsx', 'docs/fingerprint-switching-2026-11-01.md', 'docs/checks/fingerprint-switching-2026-11-01.json']) if (!names.has(path)) missing.push(path)
for (const path of ['src/browser/native-identity.mjs', 'src/browser/client-hints.mjs', 'docs/native-fingerprint-2026-11-01.md', 'docs/checks/native-fingerprint-2026-11-01.json', 'THIRD_PARTY_NOTICES.md']) if (!names.has(path)) missing.push(path)
for (const path of ['src/browser/transport.mjs', 'src/browser/input.mjs', 'src/browser/agent-features.mjs', 'src/browser/public-network.mjs', 'src/client/BrowserFrame.jsx', 'src/client/input-queue.mjs', 'docs/community-agent-ux-2026-11-01.md', 'docs/performance-interaction-plan-2026-11-01.md', 'docs/checks/interaction-public-2026-11-01.json', 'docs/checks/interaction-visual-2026-11-01.json']) if (!names.has(path)) missing.push(path)
const forbidden = [...names].filter(path => /(?:^|\/)(?:node_modules|\.git|artifacts|screenshots|logs)(?:\/|$)|\.(?:exe|dll|zip|tgz|log|key|pem)$/i.test(path))
const dependencies = Object.keys(manifest.dependencies)
const isolated = !dependencies.includes('@patchwork/coding-agent') && manifest.bin?.['patchwork-browser-components'] === 'scripts/browser-components.mjs'
const noInstallHooks = !['preinstall', 'install', 'postinstall'].some(key => manifest.scripts?.[key])
const summary = { ok: !missing.length && !forbidden.length && isolated && noInstallHooks, package: manifest.name, version: manifest.version, compressedBytes: pack.size, unpackedBytes: pack.unpackedSize, files: names.size, missing, forbidden, isolated, noInstallHooks, bundledEngine: false }
if (!summary.ok) throw new Error(JSON.stringify(summary))
console.log(JSON.stringify(summary, null, 2))
