const packs = [
  { id: "patchwork", title: "总规则 · 导航", desc: "身份 + 不变量 + 其余六技能导航，任务开始先加载。", nav: "任务开始 / 选技能前" },
  { id: "anti-slop", title: "反 AI 垃圾", desc: "文案/汇报拒模板与谄媚，给具体判断。", nav: "写 README / PR / UI 字符串" },
  { id: "web-ui", title: "Web / UI", desc: "层次、对比、反模板布局。", nav: "改 css / html / react" },
  { id: "architecture", title: "架构", desc: "职责树 → 命名 → 何时 ADR。", nav: "新目录 / 跨模块" },
  { id: "collaborator", title: "合作者", desc: "事实优先，A/B+推荐，不空转道歉。", nav: "冲突 / 取舍" },
  { id: "standards", title: "自有规范", desc: "提交、验证、文档同步唯一权威。", nav: "提交前 / 改名 / 补测" },
  { id: "evidence", title: "证据门禁", desc: "无命令+退出码不得称完成。", nav: "说「已完成」前" },
];

const phases = [
  ["Phase 0", "去掉 systemPrompt.section；inject 改为 skills/commands/tools"],
  ["Phase 1", "七份精简 SKILL.md + skills/register.mjs"],
  ["Phase 2", "结构一行码 + EvidenceGate"],
  ["Phase 3", "测试：无 section、七包注册、体量上限"],
  ["Phase 4", "README / 本预览对齐"],
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
      <div class="meta"><span class="tag">${p.nav}</span></div>
    </article>`
    )
    .join("");
}

function renderPhases() {
  const el = document.getElementById("phases");
  if (!el) return;
  el.innerHTML = phases.map(([n, t]) => `<li><strong>${n}</strong> — ${t}</li>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderPacks();
  renderPhases();
});
