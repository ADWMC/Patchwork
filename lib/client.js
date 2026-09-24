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
var DEFAULT_RATIO = 12.5;
var MECHANISMS = [
  ["actionFusion", "Action Fusion", "\u6539\u6587\u4EF6\u4E0E\u9A8C\u8BC1\u547D\u4EE4\u5408\u5E76\u4E3A\u4E00\u6B21\u8C03\u7528"],
  ["observationPack", "ObservationPack", "\u5927\u7ED3\u679C\u6362\u6210\u53E5\u67C4\uFF0C\u53EF\u6309\u5B57\u8282\u7CBE\u786E\u53EC\u56DE"],
  ["evidencePreservingReducer", "Evidence-Preserving Reducer", "\u8BCA\u65AD\u65E5\u5FD7\u538B\u6210\u6536\u636E\uFF08\u4F1A\u8C03\u7528\u6A21\u578B\uFF09"],
  ["onlineContextCompact", "Online Context Compact", "\u5728\u5B50\u4EFB\u52A1\u8FB9\u754C\u538B\u7F29\u5E76\u5728\u65B0 turn \u7EED\u8DD1"]
];
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
  title: { fontSize: "13px", fontWeight: 600 },
  subtitle: { color: "var(--dsw-alias-label-tertiary)", marginBottom: "14px" },
  section: { margin: "0 0 6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", color: "var(--dsw-alias-label-tertiary)" },
  card: {
    background: "var(--dsw-alias-bg-layer-1)",
    border: "1px solid var(--dsw-alias-border-l1)",
    borderRadius: "8px",
    padding: "2px 10px",
    marginBottom: "14px"
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
  empty: { color: "var(--dsw-alias-label-tertiary)", padding: "10px 0" },
  // 第一屏的主数字：大字号，回答「省了多少」。
  hero: { fontSize: "22px", fontWeight: 700, lineHeight: 1.2, color: "var(--dsw-alias-label-primary)" },
  heroHint: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)", marginTop: "2px" },
  // 开关：轨道 + 圆钮，用状态色与边框 token。
  switchTrack: (enabled) => ({
    width: "32px",
    height: "18px",
    borderRadius: "9px",
    border: "1px solid var(--dsw-alias-border-l2)",
    background: enabled ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-bg-layer-2)",
    position: "relative",
    cursor: "pointer",
    padding: 0,
    flex: "0 0 auto"
  }),
  switchKnob: (enabled) => ({
    position: "absolute",
    top: "1px",
    left: enabled ? "15px" : "1px",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "var(--dsw-alias-label-primary-inverted)",
    transition: "left 120ms ease"
  }),
  input: {
    width: "68px",
    textAlign: "right",
    fontFamily: "var(--dsw-font-markdown-code-font-family)",
    color: "var(--dsw-alias-label-primary)",
    background: "var(--dsw-specific-input-major)",
    border: "1px solid var(--dsw-alias-border-l1)",
    borderRadius: "6px",
    padding: "2px 6px",
    outline: "none"
  },
  inputInvalid: { borderColor: "var(--dsw-alias-state-error-primary)" },
  actions: { display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" },
  button: (disabled) => ({
    fontFamily: "var(--dsw-font-family)",
    fontSize: "12px",
    padding: "3px 12px",
    borderRadius: "6px",
    border: "1px solid var(--dsw-alias-border-l1)",
    background: disabled ? "var(--dsw-alias-bg-layer-2)" : "var(--dsw-alias-button-primary-fill)",
    color: disabled ? "var(--dsw-alias-label-tertiary)" : "var(--dsw-alias-label-primary-inverted)",
    cursor: disabled ? "default" : "pointer"
  }),
  badge: { color: "var(--dsw-alias-state-warn-primary)" },
  ok: { color: "var(--dsw-alias-state-success-primary)" },
  error: { color: "var(--dsw-alias-state-error-primary)" }
};
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
function collect(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return void 0;
  const config = {};
  const counters = {};
  const maintenance = {};
  let writePath;
  let token;
  for (const entry of list) {
    for (const [key, value] of Object.entries(entry?.config ?? {})) {
      if (typeof value === "boolean") {
        config[key] = config[key] === true || value === true;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        const existing = config[key];
        const existingFinite = typeof existing === "number" && Number.isFinite(existing);
        if (!existingFinite || existing === null || existing === void 0) config[key] = value;
      } else if (!(key in config)) {
        config[key] = value;
      }
    }
    for (const [mechanism, fields] of Object.entries(entry?.counters ?? {})) {
      if (mechanism === "maintenance") continue;
      if (!counters[mechanism]) counters[mechanism] = {};
      for (const [field, value] of Object.entries(fields)) {
        counters[mechanism][field] = (counters[mechanism][field] ?? 0) + value;
      }
    }
    for (const [field, value] of Object.entries(entry?.maintenance ?? {})) {
      maintenance[field] = (maintenance[field] ?? 0) + value;
    }
    if (entry?.writePath) writePath = entry.writePath;
    if (entry?.token) token = entry.token;
  }
  return { config, counters, maintenance, writePath, token };
}
function bytesText(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
function renderStatsPower(counters) {
  const af = counters.actionFusion ?? {};
  const op = counters.observationPack ?? {};
  const epr = counters.evidencePreservingReducer ?? {};
  const occ = counters.onlineContextCompact ?? {};
  const savedRequests = af.savedRequests ?? 0;
  const contributions = [];
  if ((af.fusedCalls ?? 0) > 0) contributions.push(["Action Fusion", `${af.fusedCalls} \u6B21\u8BFB\u5199+\u9A8C\u8BC1\u5408\u5E76\u4E3A\u4E00\u6B21\u8C03\u7528`]);
  if ((op.packedResults ?? 0) > 0) {
    const archived = bytesText(op.packedBytes);
    contributions.push(["ObservationPack", `${op.packedResults} \u4E2A\u5927\u7ED3\u679C\u6362\u6210\u53E5\u67C4${archived ? ` \xB7 \u5F52\u6863 ${archived}` : ""}`]);
  }
  if ((epr.receipts ?? 0) > 0) {
    const reduced = bytesText(epr.reducedBytes);
    contributions.push(["Evidence-Preserving Reducer", `${epr.receipts} \u4EFD\u8BCA\u65AD\u6536\u636E${reduced ? ` \xB7 \u538B\u7F29 ${reduced}` : ""}`]);
  }
  if ((occ.compactions ?? 0) > 0) contributions.push(["Online Context Compact", `${occ.compactions} \u6B21\u4E0A\u4E0B\u6587\u538B\u7F29`]);
  return (0, import_react.createElement)(
    "div",
    { style: styles.card },
    (0, import_react.createElement)(
      "div",
      { style: { ...styles.row, ...styles.rowLast } },
      (0, import_react.createElement)(
        "span",
        null,
        (0, import_react.createElement)("div", { style: styles.hero }, savedRequests > 0 ? `\u7701\u53BB ${savedRequests} \u6B21\u6A21\u578B\u8BF7\u6C42` : "\u8FD8\u6CA1\u7701\u4E0B\u8BF7\u6C42"),
        (0, import_react.createElement)("div", { style: styles.heroHint }, "\u672C\u4F1A\u8BDD\u5B9E\u6D4B\u8BA1\u6570\uFF0C\u4E0D\u662F\u9884\u4F30\uFF1B\u957F\u4EFB\u52A1\u8FDB\u884C\u4E2D\u770B\u8FD9\u91CC")
      )
    ),
    contributions.length === 0 ? (0, import_react.createElement)("div", { style: styles.empty }, "\u8FD8\u6CA1\u6709\u673A\u5236\u52A8\u624B\u3002\u4FDD\u5B58\u914D\u7F6E\u5E76\u7EE7\u7EED\u8DD1\u4EFB\u52A1\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u5B9E\u9645\u7701\u4E0B\u7684\u8BF7\u6C42\u4E0E\u5F52\u6863\u91CF\u3002") : contributions.map(
      ([name, text], index) => (0, import_react.createElement)(
        "div",
        { key: name, style: index === contributions.length - 1 ? { ...styles.row, ...styles.rowLast } : styles.row },
        (0, import_react.createElement)("span", { style: styles.label }, name),
        (0, import_react.createElement)("span", { style: styles.hint }, text)
      )
    )
  );
}
function renderMaintenance(maintenance) {
  const count = maintenance.structureWarnings ?? 0;
  const evidence = maintenance.evidenceBlocks ?? 0;
  return (0, import_react.createElement)(
    "div",
    { style: styles.card },
    (0, import_react.createElement)(
      "div",
      { style: styles.row },
      (0, import_react.createElement)("span", null, (0, import_react.createElement)("div", { style: styles.label }, "\u7ED3\u6784\u7EF4\u62A4\u63D0\u9192")),
      (0, import_react.createElement)("span", { style: styles.mono }, `${count} \u6B21`)
    ),
    (0, import_react.createElement)(
      "div",
      { style: { ...styles.row, ...styles.rowLast } },
      (0, import_react.createElement)("span", null, (0, import_react.createElement)("div", { style: styles.label }, "\u5B8C\u6210\u8BC1\u636E\u62E6\u622A")),
      (0, import_react.createElement)("span", { style: styles.mono }, `${evidence} \u6B21`)
    ),
    (0, import_react.createElement)(
      "div",
      { style: { ...styles.hint, paddingBottom: "8px" } },
      "Hook \u6CE8\u5165\u7684\u4E00\u884C\u63D0\u9192\u8BA1\u6570\uFF1B\u63D0\u9192\u5185\u5BB9\u8FDB\u5165\u8BE5\u6B21\u4F1A\u8BDD\u4E0A\u4E0B\u6587\uFF0C\u4E0D\u5728\u6B64\u843D\u76D8\u3002"
    )
  );
}
function PatchworkTitle() {
  return (0, import_react.createElement)("span", null, "Patchwork");
}
function PatchworkPanel() {
  const [data, setData] = (0, import_react.useState)(() => collect(readInjected));
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [status, setStatus] = (0, import_react.useState)(null);
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
  const live = collect(readInjected());
  const source = live ?? data;
  const baseline = source.config ?? {};
  const value = (key) => draft && key in draft ? draft[key] : baseline[key];
  const dirty = Boolean(draft) && Object.keys(draft).length > 0;
  const ratioTouched = Boolean(draft) && "cacheWriteReadRatio" in draft;
  const baselineRatio = typeof baseline.cacheWriteReadRatio === "number" && Number.isFinite(baseline.cacheWriteReadRatio) ? baseline.cacheWriteReadRatio : DEFAULT_RATIO;
  const ratioRaw = value("cacheWriteReadRatio");
  const ratioInvalid = ratioTouched && (ratioRaw === null || ratioRaw === void 0 || typeof ratioRaw !== "number" || !Number.isFinite(ratioRaw) || ratioRaw < 0);
  const ratioDisplay = ratioTouched ? ratioRaw === null || ratioRaw === void 0 ? "" : String(ratioRaw) : String(baselineRatio);
  const stage = (key, next) => setDraft((current) => ({ ...current ?? {}, [key]: next }));
  const save = async () => {
    if (!dirty) {
      setStatus({ kind: "info", text: "\u6CA1\u6709\u672A\u4FDD\u5B58\u7684\u6539\u52A8\u3002" });
      return;
    }
    if (ratioInvalid) {
      setStatus({ kind: "error", text: "\u7F13\u5B58\u5199\u8BFB\u6BD4\u5FC5\u987B\u662F \u2265 0 \u7684\u6570\u5B57\u3002" });
      return;
    }
    const endpoint = collect(readInjected()) ?? live ?? data;
    const writePath = endpoint?.writePath;
    const token = endpoint?.token;
    if (!writePath || !token) {
      setStatus({ kind: "error", text: "\u8FD9\u4E2A\u90E8\u7F72\u6CA1\u6709\u5F00\u653E\u5199\u5165\u53E3\u3002" });
      return;
    }
    const body = {};
    for (const [key, item] of Object.entries(draft ?? {})) {
      if (key === "cacheWriteReadRatio") {
        if (typeof item === "number" && Number.isFinite(item) && item >= 0) body[key] = item;
        continue;
      }
      body[key] = item;
    }
    if (Object.keys(body).length === 0) {
      setStatus({ kind: "info", text: "\u6CA1\u6709\u672A\u4FDD\u5B58\u7684\u6539\u52A8\u3002" });
      return;
    }
    setStatus({ kind: "saving", text: "\u4FDD\u5B58\u4E2D\u2026" });
    try {
      const response = await fetch(writePath, {
        method: "POST",
        headers: { "content-type": "application/json", "x-patchwork-token": token },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        setStatus({ kind: "error", text: `\u4FDD\u5B58\u5931\u8D25\uFF1A${payload.reason ?? response.status}` });
        return;
      }
      setDraft(null);
      setStatus({ kind: "ok", text: "\u5DF2\u4FDD\u5B58\u3002\u673A\u5236\u884C\u4E3A\u9700\u91CD\u542F\u540E\u751F\u6548\u3002" });
      const next = collect(readInjected()) ?? endpoint;
      setData(
        (current) => current ? { ...current, config: payload.config ?? next?.config ?? current.config, writePath, token } : next
      );
    } catch (error) {
      setStatus({ kind: "error", text: `\u4FDD\u5B58\u5931\u8D25\uFF1A${String(error?.message ?? error)}` });
    }
  };
  const active = MECHANISMS.filter(([key]) => value(key) === true).length;
  return (0, import_react.createElement)(
    "div",
    { style: styles.root },
    (0, import_react.createElement)("div", { style: styles.title }, "Patchwork"),
    (0, import_react.createElement)("div", { style: styles.subtitle }, `${active} / ${MECHANISMS.length} \u4E2A\u673A\u5236\u5DF2\u542F\u7528`),
    // 第一屏：本次实测节省
    (0, import_react.createElement)("div", { style: styles.section }, "\u672C\u6B21\u5B9E\u6D4B\u8282\u7701"),
    renderStatsPower(data.counters, styles),
    // 第二屏：配置
    (0, import_react.createElement)("div", { style: styles.section }, "\u673A\u5236"),
    (0, import_react.createElement)(
      "div",
      { style: styles.card },
      ...MECHANISMS.map(
        ([key, label, hint], index) => (0, import_react.createElement)(
          "div",
          { key, style: index === MECHANISMS.length - 1 ? { ...styles.row, ...styles.rowLast } : styles.row },
          (0, import_react.createElement)(
            "span",
            null,
            (0, import_react.createElement)("div", { style: styles.label }, label),
            (0, import_react.createElement)("div", { style: styles.hint }, hint)
          ),
          (0, import_react.createElement)(
            "button",
            {
              type: "button",
              role: "switch",
              "aria-checked": value(key) === true,
              "aria-label": label,
              style: styles.switchTrack(value(key) === true),
              onClick: () => stage(key, value(key) !== true)
            },
            (0, import_react.createElement)("span", { style: styles.switchKnob(value(key) === true) })
          )
        )
      )
    ),
    (0, import_react.createElement)("div", { style: styles.section }, "\u538B\u7F29\u7ECF\u6D4E\u6027"),
    (0, import_react.createElement)(
      "div",
      { style: styles.card },
      (0, import_react.createElement)(
        "div",
        { style: { ...styles.row, ...styles.rowLast } },
        (0, import_react.createElement)(
          "span",
          null,
          (0, import_react.createElement)("div", { style: styles.label }, "\u7F13\u5B58\u5199\u8BFB\u6BD4"),
          (0, import_react.createElement)("div", { style: styles.hint }, "\u5199\u5165\u76F8\u5BF9\u8BFB\u53D6\u7684\u989D\u5916\u4EE3\u4EF7\uFF1B\u8D8A\u9AD8\u8D8A\u4E0D\u8F7B\u6613\u538B\u7F29")
        ),
        (0, import_react.createElement)("input", {
          type: "number",
          min: "0",
          step: "0.5",
          "aria-label": "\u7F13\u5B58\u5199\u8BFB\u6BD4",
          value: ratioDisplay,
          onChange: (event) => {
            const text = event.target.value;
            stage("cacheWriteReadRatio", text === "" ? null : Number(text));
          },
          style: ratioInvalid ? { ...styles.input, ...styles.inputInvalid } : styles.input
        })
      )
    ),
    (0, import_react.createElement)(
      "div",
      { style: styles.actions },
      (0, import_react.createElement)(
        "button",
        // 保存不再被 ratio 校验禁用：非法值在点击时给出明确错误，开关改动仍可提交。
        { type: "button", style: styles.button(false), disabled: false, onClick: save },
        "\u4FDD\u5B58"
      ),
      dirty ? (0, import_react.createElement)("span", { style: styles.badge }, "\u6709\u672A\u4FDD\u5B58\u7684\u6539\u52A8") : null,
      status && !dirty ? (0, import_react.createElement)(
        "span",
        { style: status.kind === "error" ? styles.error : status.kind === "info" ? styles.hint : styles.ok },
        status.text
      ) : null,
      status && dirty && status.kind === "error" ? (0, import_react.createElement)("span", { style: styles.error }, status.text) : null
    ),
    dirty ? null : (0, import_react.createElement)("div", { style: styles.hint }, "\u4FDD\u5B58\u540E\u5237\u65B0\u9875\u9762\u5373\u89C1\uFF1B\u673A\u5236\u884C\u4E3A\u9700\u91CD\u542F\u540E\u751F\u6548\u3002"),
    // 第三屏：维护提醒
    (0, import_react.createElement)("div", { style: { ...styles.section, marginTop: "16px" } }, "\u7EF4\u62A4\u63D0\u9192"),
    renderMaintenance(data.maintenance)
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
          // id 是 guide 条目的稳定标识（注册时按它查重），必须给。
          id: TAB_KIND,
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
