export const DEFAULT_MODEL_PRESETS = {
  'deepseek': {
    id: 'deepseek',
    label: 'DeepSeek / DSH 原生 (Deep Reasoning)',
    description: '针对 DeepSeek (V3/R1) 优化：尊重长思考链，不干扰自省推导，提供充分 Token 配额并以纯粹契约验收。',
    cognitiveStyle: {
      mode: 'autonomous-reasoning',
      falsificationPriority: 'high',
      instructionDensity: 'minimal',
      tokenHeadroom: 16384,
    },
    settings: {
      actionFusion: true,
      observationPack: true,
      evidencePreservingReducer: true,
      onlineContextCompact: true,
      reducerMaxTokens: 8192,
      taskPolicyMode: 'strict',
      evidenceGate: true,
      codeEnabled: true,
      codeTokenBudget: 2000,
    },
    cognitiveNudge: `[Cognitive Strategy: DeepSeek / Deep Reasoning]
• Reasoning path is unconstrained: explore hypotheses freely in internal thought.
• Focus on architectural invariants and falsification: do not dilute focus on cosmetic rules.
• Verify via real command checks; never assume outcome without execution receipt.`,
  },

  'stepfun': {
    id: 'stepfun',
    label: 'StepFun / 阶跃星辰 (Step-Plan Defensive)',
    description: '针对 StepFun 树状分步推导优化：规避思考链 Token 饥饿截断，强化前置侦查（先查后读）与防御性 Guard Clauses。',
    cognitiveStyle: {
      mode: 'step-plan-defensive',
      falsificationPriority: 'high',
      instructionDensity: 'structured',
      tokenHeadroom: 8192,
    },
    settings: {
      actionFusion: true,
      observationPack: true,
      evidencePreservingReducer: true,
      onlineContextCompact: false,
      reducerMaxTokens: 8192, // Prevents token starvation in reasoning_content
      taskPolicyMode: 'strict',
      evidenceGate: true,
      codeEnabled: true,
      codeTokenBudget: 3000,
    },
    cognitiveNudge: `[Cognitive Strategy: StepFun / Step-Plan Defensive]
• Safeguard against token starvation: keep intermediate explanations concise and action-oriented.
• Prioritize defensive Guard Clauses and fail-fast checks over nested conditions.
• Stat/inspect targets before mutating. Test assertions are immutable truth.`,
  },
}

export const MODEL_PRESETS = DEFAULT_MODEL_PRESETS

export function detectModelPreset(identifier = '') {
  const str = String(identifier).toLowerCase()
  if (/step|stepfun/.test(str)) return 'stepfun'
  return 'deepseek'
}
