/**
 * Invariants Sentinel (禁手哨兵)
 * 静态检查代码和变更，阻断核心禁手（如删测试断言、空 catch 吞错）。
 */

export function checkCodeInvariants(codeText) {
  const violations = []
  if (!codeText || typeof codeText !== 'string') return violations

  // 1. 空的 catch 块: catch (...) {} 或 catch {}
  if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(codeText)) {
    violations.push('【禁手】检测到空的 catch {} 块静默吞掉异常，违背快速失败与精准错误边界原则。')
  }

  return violations
}

export function checkDiffInvariants(diffText) {
  const violations = []
  if (!diffText || typeof diffText !== 'string') return violations

  const deletedLines = diffText.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---'))
  for (const line of deletedLines) {
    if (/(?:assert(?:\.[a-zA-Z0-9_]+)?\(|expect\([^)]*\)\.(?:to|toBe|toEqual)|t\.is\(|t\.assert\()/i.test(line)) {
      violations.push(`【绝对禁手】检测到删除或弱化已有测试断言: ${line.trim().slice(0, 100)}`)
    }
  }

  return violations
}
