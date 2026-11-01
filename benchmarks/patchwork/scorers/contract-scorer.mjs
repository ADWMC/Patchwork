import { readFile } from 'node:fs/promises'

function expectedPass(command, result) {
  const expect = command.expect ?? {}
  if (expect.exitCode !== undefined && result.exitCode !== expect.exitCode) return false
  if (expect.stdoutIncludes && !expect.stdoutIncludes.every(value => result.stdout.includes(value))) return false
  if (expect.stdoutNotIncludes && expect.stdoutNotIncludes.some(value => result.stdout.includes(value))) return false
  if (expect.stderrIncludes && !expect.stderrIncludes.every(value => result.stderr.includes(value))) return false
  if (expect.stderrNotIncludes && expect.stderrNotIncludes.some(value => result.stderr.includes(value))) return false
  if (command.requireNoSkips && /\bskipped\s+[1-9]\b/i.test(result.stdout)) return false
  return true
}

export function scoreCommand(command, result) {
  return {
    id: command.id,
    passed: expectedPass(command, result),
    exitCode: result.exitCode,
    timedOut: result.timedOut === true,
    durationMs: result.durationMs,
    stdoutBytes: Buffer.byteLength(result.stdout ?? ''),
    stderrBytes: Buffer.byteLength(result.stderr ?? ''),
    failure: expectedPass(command, result) ? null : (result.timedOut ? 'timeout' : 'oracle-mismatch'),
  }
}

export async function loadTask(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function scoreTask(task, results) {
  const checks = (task.oracle?.commands ?? []).map(command => {
    const result = results.find(item => item.id === command.id) ?? { exitCode: null, stdout: '', stderr: '', timedOut: true, durationMs: 0 }
    return scoreCommand(command, result)
  })
  return {
    id: task.id,
    title: task.title,
    suite: task.suite,
    passed: checks.length > 0 && checks.every(check => check.passed),
    checks,
    marketing: task.marketing ?? null,
  }
}

export function aggregate(scores) {
  const total = scores.length
  const passed = scores.filter(score => score.passed).length
  const negative = scores.filter(score => score.suite === 'security-negative')
  return {
    tasks: total,
    passed,
    failed: total - passed,
    passRate: total ? passed / total : 0,
    securityTasks: negative.length,
    securityPassRate: negative.length ? negative.filter(score => score.passed).length / negative.length : null,
  }
}
