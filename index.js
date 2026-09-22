/* Patchwork architecture preview — offline, no deps */

const packs = [
  {
    id: "anti-slop",
    title: "反 AI 垃圾",
    desc: "拒绝 generic UI、套话文风、谄媚措辞；输出要像人写的工程判断。",
    triggers: ["write/edit 文案", "README/UI 文本", "冷却释放 lead"],
    source: "hallmark · taste-skill · unslop（要点改写）",
  },
  {
    id: "web-ui",
    title: "Web / UI 设计",
    desc: "视觉层次、对比与组件边界；非模板布局；可访问的基本盘。",
    triggers: [".css/.html/.jsx/.tsx", "src/ui · components", "lead 优先"],
    source: "frontend-arch skill · design tells（要点）",
  },
  {
    id: "architecture",
    title: "架构设计",
    desc: "职责树、依赖方向、何时写 ADR；拆分先于堆文件。",
    triggers: ["新目录/跨模块", "结构 Hook 升级路径", "lead"],
    source: "adr-skill · DDD · 本仓结构提示",
  },
  {
    id: "collaborator",
    title: "协作 · 反迎合 · 决策",
    desc: "事实优先、A/B 选项、不空转道歉；合作者姿态。",
    triggers: ["/patchwork-skill collaborator", "冲突场景", "stance"],
    source: "engineering-guide · frank 要点 · CVM 转述",
  },
  {
    id: "standards",
    title: "自有规范",
    desc: "工程代理指南 + 命名 + 提交规范 —— 唯一权威源。",
    triggers: ["/patchwork-standards", "结构检查对齐", "body 全量"],
    source: "本仓 docs/*（单一真相）",
  },
  {
    id: "evidence",
    title: "完成证据门禁",
    desc: "无 shell 命令+退出码不得称完成；fail-closed 短码。",
    triggers: ["完成类断言", "[pw:evidence]", "默认开"],
    source: "审查纪律 · EvidenceGate",
  },
];

const phases = [
  ["Phase 0", "移除 systemPrompt.section 与 inject.systemPrompt"],
  ["Phase 1", "assets/skills 六包 + registry/router/loader"],
  ["Phase 2", "/patchwork-skill · /patchwork-standards"],
  ["Phase 3", "Hook 精准释放 + EvidenceGate + 结构短码"],
  ["Phase 4", "配置默认值、面板计数、测试与 README"],
  ["Phase 5", "本页与设计文档对齐验收"],
];

function renderPacks() {
  const el = document.getElementById("packs");
  if (!el) return;
  el.innerHTML = packs
    .map(
      (p) => `
    <article class="pack">
      <h3>${p.title} <code>${p.id}</code></h3>
      <p>${p.desc}</p>
      <div class="meta">
        ${p.triggers.map((t) => `<span class="tag">${t}</span>`).join("")}
      </div>
      <p style="margin-top:10px;font-size:12px;opacity:.85">${p.source}</p>
    </article>`
    )
    .join("");
}

function renderPhases() {
  const el = document.getElementById("phases");
  if (!el) return;
  el.innerHTML = phases
    .map(([name, text]) => `<li><strong>${name}</strong> — ${text}</li>`)
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderPacks();
  renderPhases();
});
