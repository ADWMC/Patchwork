// 由 scripts/build-client.mjs 生成，请勿手改。
window.__ModuleLoader__.load({
	id: "@patchwork/coding-agent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/PatchworkPanel.jsx
var import_react = require("react");
var STATS_SELECTOR = "script[data-patchwork-stats]";
var MECHANISMS = [
  ["actionFusion", "Action Fusion", "\u6539\u6587\u4EF6\u4E0E\u9A8C\u8BC1\u547D\u4EE4\u5408\u5E76\u4E3A\u4E00\u6B21\u8C03\u7528"],
  ["observationPack", "ObservationPack", "\u5927\u7ED3\u679C\u6362\u6210\u53E5\u67C4\uFF0C\u53EF\u6309\u5B57\u8282\u7CBE\u786E\u53EC\u56DE"],
  ["evidencePreservingReducer", "Evidence-Preserving Reducer", "\u8BCA\u65AD\u65E5\u5FD7\u538B\u6210\u6536\u636E\uFF08\u4F1A\u8C03\u7528\u6A21\u578B\uFF09"],
  ["onlineContextCompact", "Online Context Compact", "\u5728\u5B50\u4EFB\u52A1\u8FB9\u754C\u538B\u7F29\u5E76\u5728\u65B0 turn \u7EED\u8DD1"]
];
var COUNTER_LABELS = {
  fusedCalls: "\u5408\u5E76\u7684\u8C03\u7528",
  savedRequests: "\u7701\u53BB\u7684\u8BF7\u6C42",
  packedResults: "\u6253\u5305\u7684\u7ED3\u679C",
  packedBytes: "\u5F52\u6863\u5B57\u8282",
  receipts: "\u6536\u636E",
  reducedBytes: "\u538B\u7F29\u6389\u7684\u5B57\u8282",
  compactions: "\u538B\u7F29\u6B21\u6570"
};
var styles = {
  root: {
    padding: "12px 14px 20px",
    fontFamily: "var(--dsw-font-family)",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "var(--dsw-alias-label-primary)",
    background: "var(--dsw-alias-bg-base)",
    height: "100%",
    overflowY: "auto"
  },
  title: { fontSize: "13px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  subtitle: { color: "var(--dsw-alias-label-tertiary)", marginBottom: "14px" },
  section: {
    margin: "0 0 6px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: "var(--dsw-alias-label-tertiary)"
  },
  card: {
    background: "var(--dsw-alias-bg-layer-1)",
    border: "1px solid var(--dsw-alias-border-l1)",
    borderRadius: "8px",
    padding: "2px 10px",
    marginBottom: "16px"
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "7px 0",
    borderBottom: "1px solid var(--dsw-alias-border-l1)"
  },
  rowLast: { borderBottom: "none" },
  label: { color: "var(--dsw-alias-label-primary)" },
  hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: "11px" },
  mono: { fontFamily: "var(--dsw-font-markdown-code-font-family)", color: "var(--dsw-alias-label-secondary)" },
  on: { color: "var(--dsw-alias-state-success-primary)", fontWeight: 600 },
  off: { color: "var(--dsw-alias-label-tertiary)" },
  empty: { color: "var(--dsw-alias-label-tertiary)", padding: "10px 0" }
};
function collect(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return void 0;
  const config = {};
  const counters = {};
  for (const entry of list) {
    for (const [key, value] of Object.entries(entry?.config ?? {})) {
      if (typeof value === "boolean") config[key] = config[key] === true || value === true;
      else if (!(key in config)) config[key] = value;
    }
    for (const [mechanism, fields] of Object.entries(entry?.counters ?? {})) {
      if (!counters[mechanism]) counters[mechanism] = {};
      for (const [field, value] of Object.entries(fields)) {
        counters[mechanism][field] = (counters[mechanism][field] ?? 0) + value;
      }
    }
  }
  return { config, counters };
}
function readInjected() {
  if (typeof document === "undefined") return [];
  const entries = [];
  for (const node of document.querySelectorAll(STATS_SELECTOR)) {
    try {
      entries.push(JSON.parse(node.textContent));
    } catch {
    }
  }
  return entries;
}
function PatchworkTitle() {
  return (0, import_react.createElement)("span", null, "Patchwork");
}
function PatchworkPanel() {
  const [data, setData] = (0, import_react.useState)(() => collect(readInjected));
  (0, import_react.useEffect)(() => {
    const timer = setInterval(() => setData(collect(readInjected)), 1e3);
    return () => clearInterval(timer);
  }, []);
  if (!data) {
    return (0, import_react.createElement)(
      "div",
      { style: styles.root },
      (0, import_react.createElement)("div", { style: styles.title }, "Patchwork"),
      (0, import_react.createElement)("div", { style: styles.subtitle }, "\u6B63\u5728\u7B49\u5F85\u5BBF\u4E3B\u6570\u636E\u2026")
    );
  }
  const active = MECHANISMS.filter(([key]) => data.config?.[key] === true).length;
  return (0, import_react.createElement)(
    "div",
    { style: styles.root },
    (0, import_react.createElement)("div", { style: styles.title }, "Patchwork"),
    (0, import_react.createElement)("div", { style: styles.subtitle }, `${active} / ${MECHANISMS.length} \u4E2A\u673A\u5236\u5DF2\u542F\u7528`),
    (0, import_react.createElement)("div", { style: styles.section }, "\u673A\u5236"),
    (0, import_react.createElement)(
      "div",
      { style: styles.card },
      ...MECHANISMS.map(([key, label, hint], index) => {
        const enabled = data.config?.[key] === true;
        return (0, import_react.createElement)(
          "div",
          { key, style: index === MECHANISMS.length - 1 ? { ...styles.row, ...styles.rowLast } : styles.row },
          (0, import_react.createElement)(
            "span",
            null,
            (0, import_react.createElement)("div", { style: styles.label }, label),
            (0, import_react.createElement)("div", { style: styles.hint }, hint)
          ),
          (0, import_react.createElement)("span", { style: enabled ? styles.on : styles.off }, enabled ? "\u5DF2\u542F\u7528" : "\u672A\u542F\u7528")
        );
      })
    ),
    (0, import_react.createElement)("div", { style: styles.section }, "\u672C\u6B21\u8FD0\u884C\u7684\u8BA1\u91CF"),
    (0, import_react.createElement)("div", { style: styles.card }, renderCounters(data.counters))
  );
}
function renderCounters(counters) {
  const entries = Object.entries(counters ?? {}).filter(([, fields]) => fields && Object.keys(fields).length > 0);
  if (entries.length === 0) {
    return (0, import_react.createElement)("div", { style: styles.empty }, "\u672C\u6B21\u8FD0\u884C\u8FD8\u6CA1\u6709\u673A\u5236\u52A8\u624B\u3002");
  }
  const rows = [];
  for (const [mechanism, fields] of entries) {
    rows.push((0, import_react.createElement)("div", { key: `${mechanism}-name`, style: { ...styles.label, paddingTop: "8px" } }, mechanism));
    for (const [field, value] of Object.entries(fields)) {
      rows.push(
        (0, import_react.createElement)(
          "div",
          { key: `${mechanism}-${field}`, style: styles.row },
          (0, import_react.createElement)("span", { style: styles.hint }, COUNTER_LABELS[field] ?? field),
          (0, import_react.createElement)("span", { style: styles.mono }, String(value))
        )
      );
    }
  }
  return rows;
}

// src/client/index.jsx
var TAB_ID = "patchwork-agent";
var TAB_KIND = "patchwork";
var title = () => "Patchwork";
var inject = ["slots", "sidebarRightTabs"];
function apply(ctx) {
  ctx.effect(
    () => ctx.sidebarRightTabs.register({
      id: TAB_ID,
      kind: TAB_KIND,
      // title 是必填字段：标签片上的初始文字。
      title,
      // 没有 guide 条目，这个 page 类型就没有任何入口能被打开——它既不匹配
      // 任何资源地址，也没有按钮。guide 就是那个入口。
      guide: [
        {
          order: 50,
          title,
          description: () => "\u673A\u5236\u914D\u7F6E\u4E0E\u672C\u6B21\u8FD0\u884C\u7684\u5B9E\u9645\u8BA1\u91CF"
        }
      ]
    }),
    "patchwork: sidebar tab definition"
  );
  ctx.effect(
    () => ctx.slots.inject(
      "sidebar.right.pane.tab",
      () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID }, PatchworkPanel)
    ),
    "patchwork: sidebar tab body"
  );
  ctx.effect(
    () => ctx.slots.inject(
      "sidebar.right.pane.tab.title",
      () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: TAB_ID }, PatchworkTitle)
    ),
    "patchwork: sidebar tab title"
  );
}

		return module.exports;
	},
});
