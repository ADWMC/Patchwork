/**
 * 由**真实轨迹事实**推导的逐机制反事实估计。
 *
 * 这不是重跑测量。它的含义是：「在同一条真实轨迹上，如果机制当时是开着的，
 * 会少花多少」。输入全部来自会话日志的事实（每个请求的 provider usage、
 * 每个工具结果的宿主估算 token）。每处假设都单独写明；凡是假设支撑不了的
 * 数字，一律不报。
 */

const SHELL_TOOLS = new Set(['bash', 'pwsh'])
const MUTATION_TOOLS = new Set(['edit', 'write'])
const DIAGNOSTIC_COMMAND = /(?:^|[;&|()\s])(?:cargo|pytest|ctest|cmake|ninja|make|npm\s+test|pnpm\s+test|yarn\s+test|go\s+test|bazel\s+test|dotnet\s+test|mvn\s+test|gradle|tsc|vitest|jest)(?:\s|$)/i

const stepKey = item => `${item.turn}/${item.step}`

function afterStep(request, result) {
  if (request.turn !== result.turn) return request.turn > result.turn
  return request.step > result.step
}

/** 一次请求的**全部**上下文成本：非缓存输入 + 缓存读取 + 输出。 */
function requestCost(request) {
  return request.inputTokens + request.cacheReadTokens + request.outputTokens
}

export function summarize(session) {
  const totals = session.requests.reduce(
    (sum, request) => ({
      inputTokens: sum.inputTokens + request.inputTokens,
      outputTokens: sum.outputTokens + request.outputTokens,
      totalTokens: sum.totalTokens + request.totalTokens,
      cacheReadTokens: sum.cacheReadTokens + request.cacheReadTokens,
      reasoningTokens: sum.reasoningTokens + request.reasoningTokens,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, reasoningTokens: 0 },
  )
  const measured = session.results.filter(result => typeof result.tokens === 'number')
  return {
    requests: session.requests.length,
    turns: new Set(session.requests.map(request => request.turn)).size,
    results: session.results.length,
    toolBytes: session.results.reduce((sum, result) => sum + result.bytes, 0),
    tokenCoverage: session.results.length === 0 ? 1 : measured.length / session.results.length,
    ...totals,
  }
}

/**
 * Action Fusion：一步只改文件、下一步只跑 shell 命令的相邻步对。
 *
 * 假设：融合后**下一步那次模型请求整体消失**，省下它的全部上下文成本
 * （非缓存输入 + 缓存读取 + 输出）。忽略融合调用在同一轮里略增的输出 token，
 * 因此这是上限估计。
 */
export function actionFusion(session) {
  const byStep = new Map()
  for (const result of session.results) {
    const key = stepKey(result)
    if (!byStep.has(key)) byStep.set(key, [])
    byStep.get(key).push(result)
  }
  const steps = [...new Set(session.results.map(stepKey))].sort((a, b) => {
    const [at, as] = a.split('/').map(Number)
    const [bt, bs] = b.split('/').map(Number)
    return at - bt || as - bs
  })

  let candidates = 0
  let savedRequests = 0
  let savedTokens = 0
  const examples = []

  for (let index = 0; index < steps.length - 1; index += 1) {
    const current = byStep.get(steps[index]) ?? []
    const next = byStep.get(steps[index + 1]) ?? []
    const mutates = current.length === 1 && MUTATION_TOOLS.has(current[0].toolName)
    const shells = next.length === 1 && SHELL_TOOLS.has(next[0].toolName)
    if (!mutates || !shells) continue

    candidates += 1
    const request = session.requests.find(item => stepKey(item) === steps[index + 1])
    if (!request) continue
    savedRequests += 1
    savedTokens += requestCost(request)
    if (examples.length < 5) {
      examples.push({ after: current[0].toolName, ran: next[0].command ?? next[0].toolName })
    }
  }

  return { candidates, savedRequests, savedTokens, examples }
}

/**
 * ObservationPack：超过阈值的纯文本结果，在其之后每次请求都以句柄替代全文。
 *
 * 假设：句柄 + 头部摘录约 `placeholderTokens`；每次后续请求省下
 * 「该结果的宿主估算 token − 句柄 token」。
 *
 * 这是**上限**：本机制的实现是首次即换，而 SoL-Pi 前两次仍发全文，所以真实
 * 节省会更低一些。
 */
export function observationPack(session, { minBytes = 10 * 1024, placeholderTokens = 300 } = {}) {
  let candidates = 0
  let measured = 0
  let rawBytes = 0
  let replays = 0
  let savedTokens = 0
  const examples = []

  for (const result of session.results) {
    if (result.isError || result.bytes <= minBytes) continue
    candidates += 1
    rawBytes += result.bytes
    if (typeof result.tokens !== 'number') continue
    measured += 1
    const replaysAfter = session.requests.filter(request => afterStep(request, result)).length
    replays += replaysAfter
    savedTokens += Math.max(0, result.tokens - placeholderTokens) * replaysAfter
    if (examples.length < 5) {
      examples.push({ tool: result.toolName, bytes: result.bytes, tokens: result.tokens, replays: replaysAfter })
    }
  }

  return { candidates, measured, rawBytes, replays, savedTokens, examples }
}

/**
 * Evidence-Preserving Reducer：诊断命令的长输出被换成收据。
 *
 * 假设：收据大小在轨迹里无从得知，按 `receiptTokens` 取值。被替换掉的原文量
 * 作为**事实**单独给出，便于用别的收据大小重算。
 */
export function reducer(session, { minBytes = 4096, receiptTokens = 400 } = {}) {
  let candidates = 0
  let measured = 0
  let sourceBytes = 0
  let replays = 0
  let savedTokens = 0
  const examples = []

  for (const result of session.results) {
    if (result.bytes < minBytes) continue
    if (!SHELL_TOOLS.has(result.toolName)) continue
    if (!result.command || !DIAGNOSTIC_COMMAND.test(result.command)) continue
    candidates += 1
    sourceBytes += result.bytes
    if (typeof result.tokens !== 'number') continue
    measured += 1
    const replaysAfter = session.requests.filter(request => afterStep(request, result)).length
    replays += replaysAfter
    savedTokens += Math.max(0, result.tokens - receiptTokens) * replaysAfter
    if (examples.length < 5) {
      examples.push({ command: result.command, bytes: result.bytes, replays: replaysAfter })
    }
  }

  return { candidates, measured, sourceBytes, replays, savedTokens, examples }
}

/**
 * Online Context Compact：只报**事实**——上下文增长与轮次边界数量。
 * 压缩能省多少取决于经济性判定（写入成本 vs 未来节省），这里不虚构数字。
 */
export function contextGrowth(session) {
  const curve = session.requests.map(request => request.inputTokens + request.cacheReadTokens)
  return {
    requests: curve.length,
    peakTokens: curve.length ? Math.max(...curve) : 0,
    turnBoundaries: session.requests.filter(request => request.step === 1).length,
    curve,
  }
}
