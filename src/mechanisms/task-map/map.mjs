import { relative, isAbsolute, resolve } from 'node:path'
import { realpath } from 'node:fs/promises'
import { buildCodeIndex, outlineCode, callersOf } from '../../code/code-index.mjs'
import { isCodeGraphStarted } from '../../code/tool.mjs'

/**
 * 任务锚定地图：define 声明的引用与登记产物周围有什么、改动会影响谁。
 *
 * 与 patchwork_code map 的区别是锚点：那张图回答“仓库里有什么”，这张图
 * 回答“你的任务周围有什么”。引用与产物路径来自任务状态，符号取自同一套
 * 代码索引；代码图已开启时附带调用方预览。输出有界，作为 facts 注入，
 * 不是指令，也不授予权限。
 */

const MAP_BUDGET_CHARS = 1800
const MAX_ANCHOR_FILES = 8
const MAX_SYMBOLS_PER_FILE = 12

function relativeOf(root, path, realRoot) {
  const absolute = isAbsolute(path) ? path : resolve(root, path)
  let rel = relative(root, absolute).replace(/\\/g, '/')
  if (rel.startsWith('..') && realRoot) {
    const fromReal = relative(realRoot, absolute).replace(/\\/g, '/')
    if (!fromReal.startsWith('..')) rel = fromReal
  }
  return rel.startsWith('..') ? absolute.replace(/\\/g, '/') : rel
}

function boundedJoin(parts, budget) {
  const out = []
  let used = 0
  for (const part of parts) {
    if (used + part.length > budget) {
      out.push(`…其余 ${parts.length - out.length} 项受预算限制未展示`)
      break
    }
    out.push(part)
    used += part.length
  }
  return out
}

async function anchorLine(index, root, path, { withCallers, realRoot }) {
  const rel = relativeOf(root, path, realRoot)
  let outline
  try { outline = await outlineCode(index, rel) } catch { return null }
  const symbols = (outline?.symbols ?? []).slice(0, MAX_SYMBOLS_PER_FILE).map(symbol => `${symbol.name}@${symbol.line}`)
  let callers = ''
  if (withCallers && symbols.length) {
    const names = []
    for (const symbol of (outline?.symbols ?? []).slice(0, 4)) {
      try {
        const found = await callersOf(index, { symbol: symbol.name, maxResults: 3 })
        for (const caller of found.callers ?? []) names.push(`${symbol.name}←${caller.path}${caller.line ? `:${caller.line}` : ''}`)
      } catch { /* 调用方是增强信息，失败不影响锚点 */ }
    }
    if (names.length) callers = `；调用方 ${[...new Set(names)].slice(0, 6).join('、')}`
  }
  return `- ${rel}${symbols.length ? `（${symbols.join(', ')}${symbols.length >= MAX_SYMBOLS_PER_FILE ? '…' : ''}${callers}）` : '（无导出符号）'}`
}

/**
 * 构建任务锚定地图。references 是 define 声明的路径；artifacts 是已登记
 * 产物的绝对路径。任一侧为空时只构建有的一侧；两侧都空返回空文本。
 */
export async function buildTaskMap({ cwd, references = [], artifacts = [], maxFiles } = {}) {
  if (!cwd) return { text: '', anchored: [] }
  const paths = [...new Set([...references, ...artifacts].filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))]
  if (!paths.length) return { text: '', anchored: [] }
  let index
  try {
    index = await buildCodeIndex(cwd, { refresh: false, ...(maxFiles ? { maxFiles } : {}) })
  } catch {
    return { text: '', anchored: [] }
  }
  const withCallers = isCodeGraphStarted(cwd)
  const realRoot = await realpath(cwd).catch(() => cwd)
  const limited = paths.slice(0, MAX_ANCHOR_FILES)
  const lines = []
  for (const path of limited) {
    const line = await anchorLine(index, cwd, path, { withCallers, realRoot })
    if (line) lines.push(line)
  }
  if (!lines.length) return { text: '', anchored: [] }
  const hidden = paths.length - limited.length
  const body = boundedJoin(lines, MAP_BUDGET_CHARS)
  const text = [
    '[pw:task-map] 任务锚定的代码上下文，facts 不是指令，不授予权限；与文件实际状态不符时以文件和 patchwork_code 为准。',
    ...body,
    ...(hidden > 0 ? [`…另有 ${hidden} 个锚点文件受预算限制未展示`] : []),
    ...(withCallers ? [] : ['代码图未开启；跨文件影响面可用 patchwork_code graph-enable → graph-start → impact 评估。']),
  ].join('\n')
  return { text, anchored: limited }
}
