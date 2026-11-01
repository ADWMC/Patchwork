import { readFile } from 'node:fs/promises'

export async function loadManifest(path) { return JSON.parse(await readFile(path, 'utf8')) }

export function scoreRun({ task, baseline, solution, changedFiles, changedLines }) {
  const baselineExpected = baseline.exitCode !== 0
  const solutionPassed = solution.exitCode === 0
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
  const hiddenPassed = tests.exitCode === 0
  const scopeClean = unauthorizedFiles.length === 0
  return {
    id: task.id,
    title: task.title,
    passed: hiddenPassed && scopeClean,
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
  const leaked = scores.filter(item => item.scopeLeakage).length
  return {
    tasks: attempted,
    passed,
    failed: attempted - passed,
    agentTaskPassRate: attempted ? passed / attempted : 0,
    hiddenTestPassRate: attempted ? hiddenPassed / attempted : 0,
    scopeLeakageRate: attempted ? leaked / attempted : 0,
  }
}
