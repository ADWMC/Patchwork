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
var INJECTION_GLOBAL = "__PATCHWORK__";
var SWITCHES = [
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
  compactions: "\u538B\u7F29\u6B21\u6570",
  boundaries: "\u8BED\u4E49\u8FB9\u754C",
  fallbacks: "\u964D\u7EA7\u6B21\u6570"
};
var styles = {
  root: { padding: "12px 14px", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "12px", lineHeight: 1.6 },
  h: { fontSize: "13px", fontWeight: 600, margin: "14px 0 6px" },
  h1: { fontSize: "14px", fontWeight: 700, margin: "0 0 4px" },
  sub: { opacity: 0.6, marginBottom: "10px" },
  row: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "3px 0" },
  name: { opacity: 0.9 },
  on: { color: "#2ea043", fontWeight: 600 },
  off: { opacity: 0.45 },
  box: { border: "1px solid rgba(128,128,128,0.28)", borderRadius: "6px", padding: "8px 10px", marginTop: "6px" },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px" },
  muted: { opacity: 0.55, marginTop: "12px" },
  warn: { color: "#d29922", marginTop: "6px" }
};
function readInjected() {
  if (typeof window === "undefined") return void 0;
  return window[INJECTION_GLOBAL];
}
function collect(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return void 0;
  const config = {};
  const counters = {};
  let inconsistent = false;
  for (const entry of list) {
    for (const [key, value] of Object.entries(entry?.config ?? {})) {
      if (typeof value === "boolean") {
        if (key in config && config[key] !== value) inconsistent = true;
        config[key] = config[key] === true || value === true;
      } else if (!(key in config)) {
        config[key] = value;
      }
    }
    for (const [mechanism, fields] of Object.entries(entry?.counters ?? {})) {
      if (!counters[mechanism]) counters[mechanism] = {};
      for (const [field, value] of Object.entries(fields)) {
        counters[mechanism][field] = (counters[mechanism][field] ?? 0) + value;
      }
    }
  }
  return { config, counters, instances: list.length, inconsistent, generatedAt: list[list.length - 1]?.generatedAt };
}
function PatchworkTitle() {
  return (0, import_react.createElement)("span", null, "Patchwork");
}
function PatchworkPanel() {
  const [data, setData] = (0, import_react.useState)(() => collect(readInjected));
  (0, import_react.useEffect)(() => {
    const timer = setInterval(() => {
      const next = collect(readInjected);
      if (!next) return;
      setData(
        (previous) => !previous || previous.instances !== next.instances || previous.generatedAt !== next.generatedAt ? next : previous
      );
    }, 1e3);
    return () => clearInterval(timer);
  }, []);
  if (!data) {
    return (0, import_react.createElement)(
      "div",
      { style: styles.root },
      (0, import_react.createElement)("div", { style: styles.h1 }, "Patchwork"),
      (0, import_react.createElement)("div", { style: styles.sub }, "\u8FD9\u4E00\u9875\u6CA1\u6709\u62FF\u5230\u5BBF\u4E3B\u6CE8\u5165\u7684\u6570\u636E\u3002\u5237\u65B0\u4E00\u6B21\u9875\u9762\u5373\u53EF\u3002")
    );
  }
  const counters = data.counters ?? {};
  const active = Object.entries(counters).filter(([, value]) => value && Object.keys(value).length > 0);
  return (0, import_react.createElement)(
    "div",
    { style: styles.root },
    (0, import_react.createElement)("div", { style: styles.h1 }, "Patchwork"),
    (0, import_react.createElement)("div", { style: styles.sub }, "\u673A\u5236\u914D\u7F6E\u4E0E\u672C\u6B21\u8FD0\u884C\u7684\u5B9E\u9645\u8BA1\u91CF"),
    (0, import_react.createElement)("div", { style: styles.h }, "\u914D\u7F6E"),
    (0, import_react.createElement)(
      "div",
      { style: styles.box },
      ...SWITCHES.map(([key, label, hint]) => {
        const on = data.config?.[key] === true;
        return (0, import_react.createElement)(
          "div",
          { key, style: styles.row, title: hint },
          (0, import_react.createElement)("span", { style: styles.name }, label),
          (0, import_react.createElement)("span", { style: on ? styles.on : styles.off }, on ? "\u5F00" : "\u5173")
        );
      }),
      (0, import_react.createElement)(
        "div",
        { style: { ...styles.row, marginTop: "4px" } },
        (0, import_react.createElement)("span", { style: styles.name }, "\u7F13\u5B58\u5199\u8BFB\u6BD4"),
        (0, import_react.createElement)("span", { style: styles.mono }, String(data.config?.cacheWriteReadRatio ?? "\u2014"))
      )
    ),
    (0, import_react.createElement)("div", { style: styles.muted }, `\u63D2\u4EF6\u52A0\u8F7D\u5B9E\u4F8B\uFF1A${data.instances}`),
    data.inconsistent ? (0, import_react.createElement)(
      "div",
      { style: styles.warn },
      "\u914D\u7F6E\u4E0D\u4E00\u81F4\uFF1A\u540C\u4E00\u8FDB\u7A0B\u91CC\u6709\u5B9E\u4F8B\u6CA1\u6709\u6536\u5230\u672C profile \u7684\u914D\u7F6E\uFF08\u5F00\u5173\u53D6\u4EFB\u4E00\u5B9E\u4F8B\u5F00\u542F\u5373\u4E3A\u5F00\u542F\uFF09\u3002"
    ) : null,
    (0, import_react.createElement)("div", { style: styles.h }, "\u5B9E\u9645\u8BA1\u91CF"),
    active.length === 0 ? (0, import_react.createElement)("div", { style: styles.box }, "\u672C\u6B21\u8FD0\u884C\u8FD8\u6CA1\u6709\u673A\u5236\u52A8\u624B\u3002") : (0, import_react.createElement)(
      "div",
      { style: styles.box },
      ...active.map(
        ([mechanism, fields]) => (0, import_react.createElement)(
          "div",
          { key: mechanism, style: { padding: "4px 0" } },
          (0, import_react.createElement)("div", { style: { fontWeight: 600 } }, mechanism),
          ...Object.entries(fields).map(
            ([field, value]) => (0, import_react.createElement)(
              "div",
              { key: field, style: styles.row },
              (0, import_react.createElement)("span", { style: styles.name }, COUNTER_LABELS[field] ?? field),
              (0, import_react.createElement)("span", { style: styles.mono }, String(value))
            )
          )
        )
      )
    ),
    (0, import_react.createElement)("div", { style: styles.muted }, `\u6570\u636E\u5FEB\u7167\uFF1A${data.generatedAt ?? "\u672A\u77E5"}\uFF08\u5237\u65B0\u9875\u9762\u5373\u5237\u65B0\uFF09`)
  );
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
