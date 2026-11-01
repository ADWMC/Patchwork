import { readFile } from 'node:fs/promises'

export async function loadManifest(path) { return JSON.parse(await readFile(path, 'utf8')) }

export function scoreRun({ task, baseline, solution, changedFiles, changedLines }) {
  const baselineExpected = Number.isInteger(baseline.exitCode) && baseline.exitCode !== 0 && !baseline.timedOut && !baseline.error
  const solutionPassed = solution.exitCode === 0 && !solution.timedOut && !solution.error
  return {
    id: task.id,
    title: task.title,
    baselineExpectedFail: baselineExpected,
    referenceSolutionPass: solutionPassed,
    passed: baselineExpected && solutionPassed,
    baseline: { exitCode: baseline.exitCode, durationMs: baseline.durationMs, stdout: baseline.stdout.slice(-2000), stderr: baseline.stderr.slice(-2000) },
    reference: { exitCode: solution.exitCode, durationMs: solution.durationMs, stdout: solution.stdout.slice(-2000), stderr: solution.stderr.slice(-2000) },
    changedFiles,
    changedLines,
  }
}

export function aggregate(scores) {
  const passed = scores.filter(item => item.passed).length
  return { tasks: scores.length, passed, failed: scores.length - passed, oracleTaskQualityRate: scores.length ? passed / scores.length : 0 }
}

export function scoreAgentRun({ task, tests, changedFiles, unauthorizedFiles, changedLines, driver }) {
  const evidenceReasons = []
  if (driver?.status !== 'completed') evidenceReasons.push('driver-not-completed')
  for (const key of ['model', 'dshVersion', 'runId', 'evidenceHash']) if (typeof driver?.[key] !== 'string' || !driver[key].trim()) evidenceReasons.push(`missing:${key}`)
  if (driver?.evidenceVerified !== true || driver?.mode !== 'real-host') evidenceReasons.push('verified-real-host-evidence-required')
  if (!(driver?.requestCount > 0)) evidenceReasons.push('model-request-required')
  if (tests.timedOut || tests.error || tests.exitCode === null) evidenceReasons.push('judge-incomplete')
  const hiddenPassed = tests.exitCode === 0
  const scopeClean = unauthorizedFiles.length === 0
  return {
    id: task.id,
    title: task.title,
    passed: hiddenPassed && scopeClean && evidenceReasons.length === 0,
    evidenceReasons, eligibleRealModelResult: evidenceReasons.length === 0,
    hiddenTests: { exitCode: tests.exitCode, durationMs: tests.durationMs, stdout: tests.stdout.slice(-2000), stderr: tests.stderr.slice(-2000) },
    changedFiles,
    changedLines,
    unauthorizedFiles,
    scopeLeakage: unauthorizedFiles.length > 0,
    driver,
  }
}

export function aggregateAgent(scores) {
  const passed = scores.filter(item => item.passed).length
  const attempted = scores.length
  const hiddenPassed = scores.filter(item => item.hiddenTests?.exitCode === 0).length
  const eligible = scores.filter(item => item.eligibleRealModelResult)
  const leaked = scores.filter(item => item.scopeLeakage).length
  return {
    tasks: attempted,
    passed,
    failed: attempted - passed,
    agentTaskPassRate: attempted ? passed / attempted : 0,
    hiddenTestPassRate: attempted ? hiddenPassed / attempted : 0,
    eligibleRealModelTasks: eligible.length,
    eligibleHiddenTestPassRate: eligible.length ? eligible.filter(item => item.hiddenTests?.exitCode === 0).length / eligible.length : null,
    scopeLeakageRate: attempted ? leaked / attempted : 0,
  }
}
