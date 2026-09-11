/** 模型必须逐字复制引用，因此这些常量同时约束提示词与校验。 */
export const RECEIPT_MARKER = '[evidence-preserving-reducer]'
export const RECEIPT_SCHEMA = 'sol-pi-evidence-receipt/1'

export const MIN_BYTES = 4096
export const MAX_CHARS = 600_000
export const MAX_EVIDENCE_ITEMS = 12
export const MAX_QUOTE_CHARS = 600
export const MAX_OUTPUT_TOKENS = 2048

/** reducer 调用自身的上限；与调用方 signal 取并集，先到者中止。 */
export const REDUCER_TIMEOUT_MS = 90_000

export const EVIDENCE_KINDS = new Set(['fatal', 'failure', 'warning', 'target', 'summary'])

/** 只有诊断类命令的输出才值得做证据压缩。 */
export const DIAGNOSTIC_COMMAND =
  /(?:^|[;&|()\s])(?:cargo(?:\s+(?:build|test|check))?|pytest|python(?:3)?\s+-m\s+(?:pytest|unittest|py_compile)|ctest|cmake\s+--build|ninja|make|npm\s+test|pnpm\s+test|yarn\s+test|go\s+test|bazel\s+test|dotnet\s+test|mvn\s+test|gradle(?:\s+\w+)*\s+test|tsc|vitest|jest)(?:\s|$)/i

export const FAILURE_SIGNAL = /error|failed|failure|fatal|exception|panic|timeout|unsolved|type mismatch|assert/i

/**
 * 疑似密钥的预防性拦截。这是**预防**而不是完整的密钥扫描器：
 * 日志必须留在本地的场景不应开启本机制。
 */
export const LIKELY_SECRET = /(?:api[_-]?key|authorization|bearer|access[_-]?token|secret)[^\n]{0,32}[=:][^\n]+/i

/** 会话级判断日志与归档的根，落在宿主自己的用户数据根下。 */
export const MECHANISM_DIR = 'evidence-preserving-reducer'
