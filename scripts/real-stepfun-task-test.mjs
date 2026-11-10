import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const apiKey = process.env.STEPFUN_API_KEY
if (!apiKey) {
  console.error('STEPFUN_API_KEY environment variable required')
  process.exit(1)
}
const tempRoot = await mkdtemp(join(tmpdir(), 'patchwork-stepfun-real-test-'))
const home = join(tempRoot, 'home')
const workspace = join(tempRoot, 'workspace')
await mkdir(home, { recursive: true })
await mkdir(workspace, { recursive: true })

console.log('=== Real End-to-End Task Test with DSH + Patchwork + StepFun ===\n')
console.log('Isolated Temp Root:', tempRoot)
console.log('Isolated Workspace:', workspace)

// 1. Prepare Target Code and Test in Workspace
const initialCode = `export function calculateDiscount(price, user) {
  // BUG: Throws TypeError if user is null or undefined
  if (user.isVip) {
    return price * 0.8
  }
  return price
}
`
const testCode = `import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDiscount } from './calc.mjs'

test('calculateDiscount properly handles VIP and non-VIP users', () => {
  assert.equal(calculateDiscount(100, { isVip: true }), 80)
  assert.equal(calculateDiscount(100, { isVip: false }), 100)
})

test('calculateDiscount safely handles null or undefined user with fallback to full price', () => {
  assert.equal(calculateDiscount(100, null), 100)
  assert.equal(calculateDiscount(100, undefined), 100)
})
`

await writeFile(join(workspace, 'calc.mjs'), initialCode, 'utf8')
await writeFile(join(workspace, 'calc.test.mjs'), testCode, 'utf8')

// 2. Prepare .patchwork/taste.md in Workspace
await mkdir(join(workspace, '.patchwork'), { recursive: true })
const tasteMd = `# 项目工程品味契约 (.patchwork/taste.md)

## 1. 架构品味 (Architectural Invariants)
- 单一事实源 (SSOT)：状态只在一处持有，严禁多头同步。

## 2. 实现品味 (Implementation Taste)
- 卫语句扁平化：优先使用卫语句提前 return，主干逻辑零缩进。
- 快速失败不吞错：错误精准处理，严禁写空的 catch {} 块。

## 3. 禁手清单 (Banned Anti-patterns)
- 【绝对禁手】严禁为了让测试通过而修改或删除已有的测试断言！
`
await writeFile(join(workspace, '.patchwork', 'taste.md'), tasteMd, 'utf8')

// 3. Prepare DSH Overlay
const overlayPath = join(tempRoot, 'stepfun-patchwork.overlay.yml')
const overlayContent = `- id: llm-pi-ai
  config:
    providers:
      stepfun-isolated:
        displayName: StepFun isolated validation
        api: openai-completions
        apiKeyEnv: STEPFUN_API_KEY
        baseURL: https://api.stepfun.com/step_plan/v1
        defaultMaxTokens: 16384
        timeoutMs: 180000
        retryPolicy:
          mode: normal
          maxRetries: 2
        models:
          - id: step-3.5-flash
            name: Step 3.5 Flash
            contextWindow: 262144
            maxTokens: 16384
          - id: step-5-preview
            name: Step 5 Preview
            contextWindow: 1000000
            maxTokens: 16384
- id: agent-default-model
  config:
    provider: stepfun-isolated
    model: step-3.5-flash
`
await writeFile(overlayPath, overlayContent, 'utf8')

// 4. Run DSH Headless with the Task
const prompt = `这是一个代码修复与真实验收任务。
当前工作区有一个 calc.mjs 及其测试 calc.test.mjs。
问题：calculateDiscount 在 user 为 null 或 undefined 时会抛出异常。
要求：
1. 修复 calc.mjs 中的 calculateDiscount，使其在 user 为 null/undefined 时安全返回原价，VIP 返回 8 折。
2. 遵守 .patchwork/taste.md 的品味契约（使用扁平卫语句 early return，绝不修改测试用例）。
3. 运行 node --test calc.test.mjs 验证测试是否通过。
4. 修复完成后输出简要总结。`

console.log('Task Prompt:\n', prompt)
console.log('\nBooting DSH Headless agent...')

const env = {
  ...process.env,
  DSH_HOME: home,
  STEPFUN_API_KEY: apiKey,
  DSH_PERMISSION_MODE: 'danger-full-access',
}

const child = spawn('cmd.exe', ['/c', 'dsh', '--profile', 'headless', '--patch', overlayPath, prompt], {
  cwd: workspace,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let fullOutput = ''
child.stdout.on('data', d => {
  const text = d.toString()
  fullOutput += text
  process.stdout.write(text)
})
child.stderr.on('data', d => {
  const text = d.toString()
  fullOutput += text
  process.stderr.write(text)
})

const exitCode = await new Promise(resolve => child.on('exit', resolve))
console.log('\n=== DSH Run Finished with exitCode:', exitCode, '===')

// 5. Ground-Truth Independent Verification
console.log('\n--- Independent Ground-Truth Verification ---')
const updatedCode = await readFile(join(workspace, 'calc.mjs'), 'utf8')
console.log('Resulting calc.mjs content:\n', updatedCode)

const currentTestCode = await readFile(join(workspace, 'calc.test.mjs'), 'utf8')
const testUntouched = currentTestCode.trim() === testCode.trim()
console.log('Did AI preserve original test assertions untouched?', testUntouched ? 'YES (Passed Invariant)' : 'NO (Violated Invariant)')

// Run test runner directly
const testRunner = spawn('node', ['--test', 'calc.test.mjs'], { cwd: workspace, stdio: 'inherit' })
const testExitCode = await new Promise(resolve => testRunner.on('exit', resolve))
console.log('Independent test runner exitCode:', testExitCode)

if (exitCode === 0 && testExitCode === 0 && testUntouched) {
  console.log('\n>>> REAL TEST OUTCOME: COMPLETE SUCCESS! <<<')
} else {
  console.log('\n>>> REAL TEST OUTCOME: FAILED <<<')
}
