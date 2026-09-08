import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const promptPath = fileURLToPath(new URL('../assets/prompts/user-review-prompt.md', import.meta.url))
const prompt = (await readFile(promptPath, 'utf8')).trim()

const DEFAULT_SCOPE = '当前工作区最近未提交的改动；没有改动时评审产品核心用户路径'

export function reviewInstruction(scope) {
  const trimmed = String(scope || '').trim()
  return `${prompt}\n\n评审范围：${trimmed || DEFAULT_SCOPE}`
}

export async function submitReview(invocation) {
  const instruction = reviewInstruction(invocation?.rawInput)
  const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
  invocation.agent.followup(createUserMessage({
    content: [{ type: 'text', text: instruction }],
    source: { kind: 'user' },
  }))
  return { kind: 'success', text: '已提交用户视角评审任务。' }
}

export function registerReviewCommand(ctx) {
  ctx.commands.register({
    name: 'patchwork-review',
    description: '站在用户立场评审代码：走用户路径找 bug 与体验缺陷，兼顾商业化边界',
    input: { hint: '[<评审范围>]' },
    handler: invocation => submitReview(invocation),
  })
}
