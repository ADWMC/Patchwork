import { readFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '*.md'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const broken = [], checked = new Set()
for (const file of files) {
  let text
  try { text = await readFile(resolve(root, file), 'utf8') } catch (error) { if (error.code === 'ENOENT') continue; throw error }
  const source = text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '').replace(/`[^`\n]+`/g, '')
  for (const match of source.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    let target = match[1].replace(/\s+["'][^]*$/, '').replace(/^<|>$/g, '')
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue
    target = target.split('#')[0].split('?')[0]
    if (!target) continue
    try { target = decodeURIComponent(target) } catch {}
    const path = resolve(dirname(resolve(root, file)), target), key = `${file}:${target}`
    if (checked.has(key)) continue; checked.add(key)
    try { await access(path) } catch { broken.push({ file, target }) }
  }
}
console.log(JSON.stringify({ ok: !broken.length, markdownFiles: files.length, localLinks: checked.size, broken }, null, 2))
if (broken.length) process.exitCode = 1
