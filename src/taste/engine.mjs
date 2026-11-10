import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const MAX_TASTE_RULES = 25
export const MAX_TASTE_CHARS = 4000

export class TasteEngine {
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot
    this.cachedContract = null
    this.contractMtime = 0
  }

  getDefaultContract() {
    return {
      architecture: [
        '单一事实源 (SSOT)：状态只在一处持有，派生状态使用计算属性派生，严禁在多处手动维护同步副本。',
        '三行重复优于过早抽象：在同一模式出现三次且具备相同变更动因前，严禁引入高阶泛化封装或工厂模式。',
        '目录与依赖拓扑：纯工具函数收敛于 util/，有副作用与网络 IO 收敛于 bridge/，严禁跨层循环依赖。',
      ],
      implementation: [
        '卫语句扁平化：优先使用卫语句提前 return，主干逻辑保持零缩进层级，严禁 3 层以上 if-else 嵌套。',
        '快速失败不吞错：预期异常显式定义错误码，未知异常抛出并保留堆栈，严禁空的 catch {} 块。',
        '零废话注释：命名即文档；注释仅用于解释“为什么这么做 (Why)”，绝不解释“这一行干了什么 (What)”。',
      ],
      visual: [
        '抵御 AI 塑料感：严禁通用紫色渐变、过大外发光阴影与生硬的弹跳骨架屏。',
        '严格空间节奏：间距与内边距严格遵守 4px / 8px 栅格节奏，基准字阶 14px，优先使用系统原生字体栈。',
        '触感交互回执：可交互元素必须具备即时反馈（40ms 激活态高亮与悬浮态过渡），严禁无视觉回执的静默等待。',
      ],
      banned: [
        '【绝对禁手】严禁为了让测试通过而弱化、注释或删除现有的断言 (assert)。',
        '【绝对禁手】严禁在未度量真实性能瓶颈前引入私有缓存层或 Memoization。',
        '【绝对禁手】严禁在缺少实际调用点的情况下预先编写“工具类 / Helper”。',
      ],
    }
  }

  async loadContract() {
    const tastePath = join(this.workspaceRoot, '.patchwork', 'taste.md')
    try {
      const content = await readFile(tastePath, 'utf8')
      this.cachedContract = this.parseContract(content)
      return this.cachedContract
    } catch {
      this.cachedContract = this.getDefaultContract()
      return this.cachedContract
    }
  }

  parseContract(markdown) {
    const sections = { architecture: [], implementation: [], visual: [], banned: [] }
    if (!markdown || typeof markdown !== 'string') return sections
    let current = null

    for (const rawLine of markdown.split('\n')) {
      const line = rawLine.trim()
      if (line.includes('架构品味') || line.toLowerCase().includes('architecture')) current = 'architecture'
      else if (line.includes('实现品味') || line.toLowerCase().includes('implementation')) current = 'implementation'
      else if (line.includes('视觉与交互品味') || line.toLowerCase().includes('visual')) current = 'visual'
      else if (line.includes('禁手清单') || line.toLowerCase().includes('banned')) current = 'banned'
      else if ((line.startsWith('- ') || line.startsWith('* ')) && current) {
        const item = line.slice(2).trim()
        if (item) sections[current].push(item)
      }
    }
    return sections
  }

  serializeContract(contract) {
    return [
      '# 项目工程品味契约 (.patchwork/taste.md)',
      '',
      '## 1. 架构品味 (Architectural Invariants)',
      ...(contract.architecture ?? []).map(r => `- ${r}`),
      '',
      '## 2. 实现品味 (Implementation Taste)',
      ...(contract.implementation ?? []).map(r => `- ${r}`),
      '',
      '## 3. 视觉与交互品味 (Visual & Interaction Taste)',
      ...(contract.visual ?? []).map(r => `- ${r}`),
      '',
      '## 4. 禁手清单 (Banned Anti-patterns / Negative Taste)',
      ...(contract.banned ?? []).map(r => `- ${r}`),
      '',
    ].join('\n')
  }

  /**
   * 按当前任务受影响文件，自适应切片生成精炼注入块 (< 500 tokens)
   */
  async getContextInjection(affectedFiles = []) {
    const contract = this.cachedContract ?? (await this.loadContract())
    const files = Array.isArray(affectedFiles) ? affectedFiles : []
    const isUI = files.length === 0 || files.some(f => /\.(jsx|tsx|vue|svelte|css|scss|html)$/i.test(f))
    const isCore = files.length === 0 || files.some(f => /\.(js|mjs|cjs|ts|py|rs|go|java|c|cpp)$/i.test(f))

    const activeRules = []

    // 禁手清单永远最高优先级置顶
    for (const rule of (contract.banned ?? []).slice(0, 4)) {
      activeRules.push(`[FORBIDDEN] ${rule}`)
    }

    if (isCore) {
      for (const rule of (contract.architecture ?? []).slice(0, 3)) activeRules.push(`[ARCH] ${rule}`)
      for (const rule of (contract.implementation ?? []).slice(0, 3)) activeRules.push(`[CODE] ${rule}`)
    }

    if (isUI) {
      for (const rule of (contract.visual ?? []).slice(0, 3)) activeRules.push(`[UI] ${rule}`)
    }

    if (!activeRules.length) return null

    const prompt = `[Craftsmanship & Taste Invariants]\n${activeRules.map(r => `• ${r}`).join('\n')}`
    return prompt.length > MAX_TASTE_CHARS ? prompt.slice(0, MAX_TASTE_CHARS) : prompt
  }

  /**
   * 提炼经验，受五重稳定性护栏约束
   */
  async proposeRule(category, ruleText) {
    if (!['architecture', 'implementation', 'visual', 'banned'].includes(category)) {
      throw new Error(`Invalid category: ${category}`)
    }
    const cleanText = (ruleText ?? '').trim().replace(/^[-*]\s*/, '')
    if (!cleanText) throw new Error('Rule text cannot be empty')

    const contract = await this.loadContract()
    const targetList = contract[category] ??= []

    // 冲突与重复检查
    if (targetList.includes(cleanText)) {
      return { status: 'duplicate', rule: cleanText }
    }

    // 容量上限：总规则数不超过 MAX_TASTE_RULES
    const totalCount = Object.values(contract).reduce((acc, arr) => acc + arr.length, 0)
    if (totalCount >= MAX_TASTE_RULES) {
      // 淘汰非禁手清单中最旧的一条规则
      for (const cat of ['visual', 'implementation', 'architecture']) {
        if (contract[cat]?.length > 2) {
          contract[cat].shift()
          break
        }
      }
    }

    targetList.push(cleanText)
    const tastePath = join(this.workspaceRoot, '.patchwork', 'taste.md')
    await mkdir(dirname(tastePath), { recursive: true })
    await writeFile(tastePath, this.serializeContract(contract), 'utf8')
    this.cachedContract = contract
    return { status: 'added', category, rule: cleanText }
  }
}
