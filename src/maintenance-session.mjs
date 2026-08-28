const LARGE_TASK_PATTERN = /新增|实现|重构|迁移|架构|系统|模块|功能|集成|拆分|替换/i

export function createMaintenanceSession({ prompt, scope = [] } = {}) {
  if (typeof prompt !== 'string' || prompt.trim() === '') throw new TypeError('prompt must be a non-empty string')

  const task = classifyTask(prompt)
  const state = {
    task,
    research: [],
    scope: [...scope],
    changed: false,
    verification: [],
  }

  return {
    snapshot: () => structuredClone(state),
    setScope(files) {
      if (!Array.isArray(files) || files.some(file => typeof file !== 'string' || !file)) {
        throw new TypeError('scope must be an array of non-empty file paths')
      }
      state.scope = [...new Set(files)]
    },
    recordResearch(entry) {
      if (!entry?.source || !entry?.query) throw new TypeError('research requires query and source')
      state.research.push({ query: String(entry.query), source: String(entry.source), decision: String(entry.decision || '') })
    },
    markChanged(file) {
      if (state.scope.length && !state.scope.includes(file)) throw new Error(`file is outside change scope: ${file}`)
      state.changed = true
    },
    recordVerification(entry) {
      if (!entry?.name) throw new TypeError('verification requires a name')
      state.verification.push({ name: String(entry.name), passed: entry.passed === true })
    },
    canStartImplementation() {
      return !task.requiresResearch || state.research.length > 0
    },
    canFinish() {
      return !state.changed || state.verification.some(item => item.passed)
    },
  }
}

export function classifyTask(prompt) {
  const text = String(prompt || '').trim()
  // ponytail: keyword/length triage is intentionally cheap; replace with an
  // Agent-provided classification when semantic accuracy becomes necessary.
  return {
    kind: text.length >= 240 || LARGE_TASK_PATTERN.test(text) ? 'large' : 'small',
    requiresResearch: text.length >= 240 || LARGE_TASK_PATTERN.test(text),
  }
}

export function summarizeOutput(output, maxLength = 2000) {
  const text = String(output ?? '')
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 24))}\n...[output truncated]`
}
